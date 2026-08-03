export interface PersistedDemoWalletState {
  readonly schemaVersion: 1;
  readonly networkId: string;
  readonly sdkVersion: string;
  readonly savedAt: number;
  readonly shielded: string;
  readonly unshielded: string;
  readonly dust: string;
}

export interface DemoWalletStateStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: PersistedDemoWalletState): Promise<void>;
  delete(key: string): Promise<void>;
}

const CACHE_KEY_PREFIX = 'midnight-demo-v2:wallet-state:v1';
const CACHE_KEY_DOMAIN = 'midnight-demo-v2:demo-wallet-cache-key:v1';
const DATABASE_NAME = 'midnight-private-payment-demo';
const OBJECT_STORE_NAME = 'wallet-states';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function seedBytes(seed: string): Uint8Array {
  const normalized = seed.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error('Demo wallet seed must be a 64-character hexadecimal value');
  }
  return Uint8Array.from(
    normalized.match(/.{2}/g) ?? [],
    (value) => Number.parseInt(value, 16),
  );
}

export async function buildDemoWalletStateKey(
  seed: string,
  networkId: string,
  sdkVersion: string,
): Promise<string> {
  const domain = new TextEncoder().encode(CACHE_KEY_DOMAIN);
  const secret = seedBytes(seed);
  const input = new Uint8Array(domain.length + 1 + secret.length);
  input.set(domain);
  input[domain.length] = 0;
  input.set(secret, domain.length + 1);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', input);
  return [
    CACHE_KEY_PREFIX,
    encodeURIComponent(networkId),
    encodeURIComponent(sdkVersion),
    bytesToHex(new Uint8Array(digest)),
  ].join(':');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseDemoWalletState(
  value: unknown,
  networkId: string,
  sdkVersion: string,
): PersistedDemoWalletState | null {
  const record = asRecord(value);
  if (
    record?.schemaVersion !== 1
    || record.networkId !== networkId
    || record.sdkVersion !== sdkVersion
    || typeof record.savedAt !== 'number'
    || !Number.isFinite(record.savedAt)
    || record.savedAt <= 0
    || typeof record.shielded !== 'string'
    || record.shielded.length === 0
    || typeof record.unshielded !== 'string'
    || record.unshielded.length === 0
    || typeof record.dust !== 'string'
    || record.dust.length === 0
  ) {
    return null;
  }
  return record as unknown as PersistedDemoWalletState;
}

export async function loadDemoWalletState(
  storage: DemoWalletStateStorage,
  key: string,
  networkId: string,
  sdkVersion: string,
): Promise<PersistedDemoWalletState | null> {
  const stored = await storage.get(key);
  if (stored === undefined || stored === null) return null;
  const parsed = parseDemoWalletState(stored, networkId, sdkVersion);
  if (parsed) return parsed;
  await storage.delete(key);
  return null;
}

export async function saveDemoWalletState(
  storage: DemoWalletStateStorage,
  key: string,
  state: PersistedDemoWalletState,
): Promise<void> {
  const parsed = parseDemoWalletState(state, state.networkId, state.sdkVersion);
  if (!parsed) throw new Error('Refusing to persist invalid demo wallet state');
  await storage.set(key, parsed);
}

export interface DemoWalletStateFallbackOptions<T> {
  readonly cachedState: PersistedDemoWalletState | null;
  readonly clearCachedState: () => Promise<void>;
  readonly run: (state: PersistedDemoWalletState | null) => Promise<T>;
  readonly shouldRetryFreshState: (error: unknown) => boolean;
  readonly shouldDiscardCachedState: (error: unknown) => boolean;
}

export async function runWithDemoWalletStateFallback<T>(
  options: DemoWalletStateFallbackOptions<T>,
): Promise<T> {
  if (!options.cachedState) return options.run(null);
  try {
    return await options.run(options.cachedState);
  } catch (error) {
    if (options.shouldRetryFreshState(error)) return options.run(null);
    if (!options.shouldDiscardCachedState(error)) throw error;
    await options.clearCachedState();
    return options.run(null);
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(
      transaction.error ?? new Error('IndexedDB transaction failed'),
    );
    transaction.onabort = () => reject(
      transaction.error ?? new Error('IndexedDB transaction was aborted'),
    );
  });
}

export function createIndexedDbDemoWalletStateStorage(
  indexedDb: IDBFactory | undefined = globalThis.indexedDB,
): DemoWalletStateStorage | null {
  if (!indexedDb) return null;

  const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        request.result.createObjectStore(OBJECT_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
  });

  return {
    get: async (key) => {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
      return requestResult(transaction.objectStore(OBJECT_STORE_NAME).get(key));
    },
    set: async (key, value) => {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      transaction.objectStore(OBJECT_STORE_NAME).put(value, key);
      await transactionComplete(transaction);
    },
    delete: async (key) => {
      const db = await database;
      const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
      transaction.objectStore(OBJECT_STORE_NAME).delete(key);
      await transactionComplete(transaction);
    },
  };
}

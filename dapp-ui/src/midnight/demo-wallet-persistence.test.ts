import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDemoWalletStateKey,
  loadDemoWalletState,
  runWithDemoWalletStateFallback,
  saveDemoWalletState,
  type DemoWalletStateStorage,
  type PersistedDemoWalletState,
} from './demo-wallet-persistence.ts';
import { isIdleWalletSyncTimeout, WalletSyncTimeoutError } from './sync-timeout.ts';

const NETWORK_ID = 'preprod';
const SDK_VERSION = 'wallet-sdk-test-v1';
const SEED = 'ab'.repeat(32);

function validState(): PersistedDemoWalletState {
  return {
    schemaVersion: 1,
    networkId: NETWORK_ID,
    sdkVersion: SDK_VERSION,
    savedAt: 1_786_000_000_000,
    shielded: 'shielded-state',
    unshielded: 'unshielded-state',
    dust: 'dust-state',
  };
}

function memoryStorage(initial?: unknown) {
  let value = initial;
  let deleteCalls = 0;
  const storage: DemoWalletStateStorage = {
    get: async () => value,
    set: async (_key, next) => {
      value = next;
    },
    delete: async () => {
      deleteCalls += 1;
      value = undefined;
    },
  };
  return {
    storage,
    read: () => value,
    deleteCalls: () => deleteCalls,
  };
}

test('demo wallet cache keys partition state without exposing the raw seed', async () => {
  const key = await buildDemoWalletStateKey(SEED, NETWORK_ID, SDK_VERSION);
  const otherNetworkKey = await buildDemoWalletStateKey(SEED, 'preview', SDK_VERSION);
  const otherSdkKey = await buildDemoWalletStateKey(SEED, NETWORK_ID, 'wallet-sdk-test-v2');

  assert.doesNotMatch(key, new RegExp(SEED, 'i'));
  assert.notEqual(key, otherNetworkKey);
  assert.notEqual(key, otherSdkKey);
  assert.equal(key, await buildDemoWalletStateKey(SEED, NETWORK_ID, SDK_VERSION));
});

test('invalid cached wallet state is discarded before a restore is attempted', async () => {
  const cache = memoryStorage({
    ...validState(),
    networkId: 'wrong-network',
  });

  const loaded = await loadDemoWalletState(
    cache.storage,
    'cache-key',
    NETWORK_ID,
    SDK_VERSION,
  );

  assert.equal(loaded, null);
  assert.equal(cache.deleteCalls(), 1);
});

test('wallet state persistence stores all three serialized modules', async () => {
  const cache = memoryStorage();
  const state = validState();

  await saveDemoWalletState(cache.storage, 'cache-key', state);

  assert.deepEqual(cache.read(), state);
});

test('a failed cached restore clears the cache and retries once from chain state', async () => {
  const cache = memoryStorage(validState());
  const calls: Array<'cached' | 'fresh'> = [];

  const result = await runWithDemoWalletStateFallback({
    cachedState: validState(),
    clearCachedState: () => cache.storage.delete('cache-key'),
    run: async (state) => {
      calls.push(state ? 'cached' : 'fresh');
      if (state) throw new Error('serialized wallet state is inconsistent');
      return 'fresh-wallet';
    },
    shouldRetryFreshState: () => false,
    shouldDiscardCachedState: () => true,
  });

  assert.equal(result, 'fresh-wallet');
  assert.deepEqual(calls, ['cached', 'fresh']);
  assert.equal(cache.deleteCalls(), 1);
});

test('an idle timeout from restored state preserves the cache and retries fresh once', async () => {
  const cache = memoryStorage(validState());
  const calls: Array<'cached' | 'fresh'> = [];

  const result = await runWithDemoWalletStateFallback({
    cachedState: validState(),
    clearCachedState: () => cache.storage.delete('cache-key'),
    run: async (state) => {
      calls.push(state ? 'cached' : 'fresh');
      if (state) throw new WalletSyncTimeoutError('sync', 60_000, 'idle');
      return 'fresh-wallet';
    },
    shouldRetryFreshState: isIdleWalletSyncTimeout,
    shouldDiscardCachedState: () => false,
  });

  assert.equal(result, 'fresh-wallet');
  assert.deepEqual(calls, ['cached', 'fresh']);
  assert.equal(cache.deleteCalls(), 0);
  assert.deepEqual(cache.read(), validState());
});

test('a failed fresh retry propagates without looping or deleting the cached state', async () => {
  const cache = memoryStorage(validState());
  const calls: Array<'cached' | 'fresh'> = [];

  await assert.rejects(
    runWithDemoWalletStateFallback({
      cachedState: validState(),
      clearCachedState: () => cache.storage.delete('cache-key'),
      run: async (state) => {
        calls.push(state ? 'cached' : 'fresh');
        if (state) throw new WalletSyncTimeoutError('sync', 60_000, 'idle');
        throw new WalletSyncTimeoutError('sync', 60_000, 'idle');
      },
      shouldRetryFreshState: isIdleWalletSyncTimeout,
      shouldDiscardCachedState: () => false,
    }),
    WalletSyncTimeoutError,
  );

  assert.deepEqual(calls, ['cached', 'fresh']);
  assert.equal(cache.deleteCalls(), 0);
  assert.deepEqual(cache.read(), validState());
});

test('an absolute sync timeout preserves valid cached state and fails closed', async () => {
  const cache = memoryStorage(validState());

  await assert.rejects(
    runWithDemoWalletStateFallback({
      cachedState: validState(),
      clearCachedState: () => cache.storage.delete('cache-key'),
      run: async () => {
        throw new WalletSyncTimeoutError('sync', 45 * 60_000, 'absolute');
      },
      shouldRetryFreshState: isIdleWalletSyncTimeout,
      shouldDiscardCachedState: () => false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof WalletSyncTimeoutError);
      assert.equal(error.reason, 'absolute');
      return true;
    },
  );

  assert.equal(cache.deleteCalls(), 0);
  assert.deepEqual(cache.read(), validState());
});

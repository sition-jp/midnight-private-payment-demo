import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WebSocket } from 'ws';

import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { getNetworkId, setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import type { MidnightProvider, WalletProvider } from '@midnight-ntwrk/midnight-js-types';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

// Required by the wallet's GraphQL subscription client in Node.js.
// @ts-expect-error The ws implementation is API-compatible with the browser WebSocket used by the SDK.
globalThis.WebSocket = WebSocket;

setNetworkId('preprod');

export const PREPROD_CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
  faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
} as const;

export interface WalletContext {
  readonly wallet: WalletFacade;
  readonly shieldedSecretKeys: ledger.ZswapSecretKeys;
  readonly dustSecretKey: ledger.DustSecretKey;
  readonly unshieldedKeystore: ReturnType<typeof createKeystore>;
  readonly privateStatePassword: string;
  readonly accountId: string;
}

interface SerializedWalletCache {
  readonly version: 1;
  readonly network: 'preprod';
  readonly shielded: string;
  readonly unshielded: string;
  readonly dust: string;
}

interface EncryptedWalletCache {
  readonly version: 1;
  readonly iv: string;
  readonly authTag: string;
  readonly ciphertext: string;
}

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid wallet seed');

  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Wallet key derivation failed');

  hdWallet.hdWallet.clear();
  return result.keys;
}

function derivePrivateStatePassword(seed: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(Buffer.from(seed, 'hex'))
    .update('midnight-private-payment-state-v2')
    .digest('hex');
  return `Midnight-${digest}!Aa9`;
}

function loadWalletCache(
  cacheFile: string | undefined,
  password: string,
): SerializedWalletCache | undefined {
  if (!cacheFile || !fs.existsSync(cacheFile)) return undefined;

  try {
    const encrypted = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as EncryptedWalletCache;
    if (encrypted.version !== 1) throw new Error('Unsupported wallet cache version');
    const key = crypto.createHash('sha256').update(password).digest();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encrypted.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, 'base64')),
      decipher.final(),
    ]);
    const cache = JSON.parse(plaintext.toString('utf8')) as SerializedWalletCache;
    if (cache.version !== 1 || cache.network !== 'preprod') {
      throw new Error('Wallet cache does not match preprod v1');
    }
    console.log('WALLET_CACHE_RESTORED');
    return cache;
  } catch {
    throw new Error('Encrypted wallet cache is invalid or belongs to another seed');
  }
}

export function installWalletLogRedaction(): () => void {
  const originalError = console.error;
  let historyWarningPrinted = false;
  console.error = (...args: unknown[]) => {
    if (args[0] === 'Error processing tx history metadata') {
      if (!historyWarningPrinted) {
        historyWarningPrinted = true;
        console.warn('WALLET_HISTORY_METADATA_ERRORS_REDACTED');
      }
      return;
    }
    const first = args[0];
    if (typeof first === 'object' && first !== null && '_tag' in first) {
      const tag = (first as { _tag?: unknown })._tag;
      if (tag === 'Wallet.Sync') {
        console.warn('WALLET_SYNC_RETRY');
        return;
      }
    }
    originalError(...args);
  };
  return () => {
    console.error = originalError;
  };
}

export async function createWalletFromSeed(seed: string): Promise<WalletContext> {
  const keys = deriveKeys(seed);
  const privateStatePassword = derivePrivateStatePassword(seed);
  const cached = loadWalletCache(
    process.env.MIDNIGHT_WALLET_CACHE_FILE,
    privateStatePassword,
  );
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  // The workshop demo does not display wallet transaction history. Keeping the
  // full initial-sync history in memory can exhaust Node's heap on preprod.
  const txHistoryStorage = new NoOpTransactionHistoryStorage();

  const configuration = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: PREPROD_CONFIG.indexer,
      indexerWsUrl: PREPROD_CONFIG.indexerWS,
      keepAlive: 30_000,
    },
    provingServerUrl: new URL(PREPROD_CONFIG.proofServer),
    relayURL: new URL(PREPROD_CONFIG.node.replace(/^http/, 'ws')),
    txHistoryStorage,
    batchUpdates: {
      size: 1_000,
      timeout: 25,
      spacing: 0,
    },
    costParameters: {
      additionalFeeOverhead: 300_000_000_000_000n,
      feeBlocksMargin: 5,
    },
  };

  const wallet = await WalletFacade.init({
    configuration,
    shielded: (config) => cached
      ? ShieldedWallet(config).restore(cached.shielded)
      : ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) => cached
      ? UnshieldedWallet(config).restore(cached.unshielded)
      : UnshieldedWallet(config).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore)),
    dust: (config) => cached
      ? DustWallet(config).restore(cached.dust)
      : DustWallet(config).startWithSecretKey(
        dustSecretKey,
        ledger.LedgerParameters.initialParameters().dust,
      ),
  });

  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return {
    wallet,
    shieldedSecretKeys,
    dustSecretKey,
    unshieldedKeystore,
    privateStatePassword,
    accountId: unshieldedKeystore.getBech32Address().toString(),
  };
}

export async function saveWalletCache(walletContext: WalletContext): Promise<boolean> {
  const cacheFile = process.env.MIDNIGHT_WALLET_CACHE_FILE;
  if (!cacheFile) return false;

  const [shielded, unshielded, dust] = await Promise.all([
    walletContext.wallet.shielded.serializeState(),
    walletContext.wallet.unshielded.serializeState(),
    walletContext.wallet.dust.serializeState(),
  ]);
  const cache: SerializedWalletCache = {
    version: 1,
    network: 'preprod',
    shielded,
    unshielded,
    dust,
  };
  const key = crypto
    .createHash('sha256')
    .update(walletContext.privateStatePassword)
    .digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(cache), 'utf8'),
    cipher.final(),
  ]);
  const encrypted: EncryptedWalletCache = {
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true, mode: 0o700 });
  const temporaryFile = `${cacheFile}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryFile, JSON.stringify(encrypted), { mode: 0o600 });
  fs.renameSync(temporaryFile, cacheFile);
  return true;
}

export async function createMidnightProviders(
  walletContext: WalletContext,
  zkConfigPath: string,
  privateStateStoreName: string,
) {
  const state = await walletContext.wallet.waitForSyncedState();

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(transaction, ttl) {
      const recipe = await walletContext.wallet.balanceUnboundTransaction(
        transaction,
        {
          shieldedSecretKeys: walletContext.shieldedSecretKeys,
          dustSecretKey: walletContext.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signedRecipe = await walletContext.wallet.signRecipe(
        recipe,
        (payload) => walletContext.unshieldedKeystore.signData(payload),
      );
      return walletContext.wallet.finalizeRecipe(signedRecipe);
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: (transaction) => walletContext.wallet.submitTransaction(transaction),
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName,
      privateStoragePasswordProvider: () => walletContext.privateStatePassword,
      accountId: walletContext.accountId,
    }),
    publicDataProvider: indexerPublicDataProvider(
      PREPROD_CONFIG.indexer,
      PREPROD_CONFIG.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(PREPROD_CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider,
  };
}

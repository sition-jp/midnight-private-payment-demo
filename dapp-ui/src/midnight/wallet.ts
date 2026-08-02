/**
 * Dual-mode wallet: Demo (seed-based) and Lace (browser extension).
 *
 * Demo mode creates a full wallet from a random seed (same as deploy-test).
 * Lace mode connects to window.midnight.mnLace browser extension.
 */
import { Buffer } from 'buffer';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v8';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v8';
import { NoOpTransactionHistoryStorage } from '@midnight-ntwrk/wallet-sdk-abstractions';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { MIDNIGHT_CONFIG } from './config.js';
import { runWalletSyncLifecycle } from './sync-timeout.js';
import { readRequiredWalletState } from './wallet-readiness.js';
import type { WalletContext } from '../types/index.js';

const DEMO_WALLET_SYNC_TIMEOUT_MS = 90_000;

// ─── Network Setup ───────────────────────────────────────────────────────────

/** Ensure the network ID is set (idempotent) */
export function ensureNetworkId(): void {
  setNetworkId(MIDNIGHT_CONFIG.network);
}

// ─── Seed Generation ─────────────────────────────────────────────────────────

/** Generate a random 64-character hex seed for demo wallets */
export function generateSeed(): string {
  return toHex(Buffer.from(generateRandomSeed()));
}

// ─── Demo Mode (Seed-Based) ──────────────────────────────────────────────────

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

/**
 * Internal wallet context with SDK objects needed for provider creation.
 * Extended by the public WalletContext.
 */
interface InternalDemoWallet {
  wallet: WalletFacade;
  shieldedSecretKeys: ledger.ZswapSecretKeys;
  dustSecretKey: ledger.DustSecretKey;
  unshieldedKeystore: ReturnType<typeof createKeystore>;
}

async function createInternalWallet(seed: string): Promise<InternalDemoWallet> {
  ensureNetworkId();
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);
  const txHistoryStorage = new NoOpTransactionHistoryStorage();

  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: MIDNIGHT_CONFIG.indexer,
      indexerWsUrl: MIDNIGHT_CONFIG.indexerWS,
      keepAlive: 30_000,
    },
    provingServerUrl: new URL(MIDNIGHT_CONFIG.proofServer, window.location.origin),
    relayURL: new URL(MIDNIGHT_CONFIG.node.replace(/^http/, 'ws')),
    txHistoryStorage,
    batchUpdates: { size: 1_000, timeout: 25, spacing: 0 },
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  };

  const wallet = await WalletFacade.init({
    configuration: walletConfig,
    shielded: (config) => ShieldedWallet(config).startWithSecretKeys(shieldedSecretKeys),
    unshielded: (config) => UnshieldedWallet(config).startWithPublicKey(
      PublicKey.fromKeyStore(unshieldedKeystore),
    ),
    dust: (config) => DustWallet(config).startWithSecretKey(
      dustSecretKey,
      ledger.LedgerParameters.initialParameters().dust,
    ),
  });
  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

/**
 * Create a demo-mode wallet from a hex seed.
 * Syncs with the network before returning.
 */
export async function createWalletFromSeed(seed: string): Promise<WalletContext> {
  const internal = await createInternalWallet(seed.trim());

  const state = await runWalletSyncLifecycle({
    start: () => internal.wallet.start(
      internal.shieldedSecretKeys,
      internal.dustSecretKey,
    ),
    waitForSyncedState: () => internal.wallet.waitForSyncedState(),
    stop: () => internal.wallet.stop(),
  }, DEMO_WALLET_SYNC_TIMEOUT_MS);

  const address = internal.unshieldedKeystore.getBech32Address().toString();
  const coinPublicKey = state.shielded.coinPublicKey.toHexString();
  const encryptionPublicKey = state.shielded.encryptionPublicKey.toHexString();

  const walletProvider = {
    getCoinPublicKey: () => coinPublicKey,
    getEncryptionPublicKey: () => encryptionPublicKey,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe = await internal.wallet.balanceUnboundTransaction(
        tx as Parameters<WalletFacade['balanceUnboundTransaction']>[0],
        {
          shieldedSecretKeys: internal.shieldedSecretKeys,
          dustSecretKey: internal.dustSecretKey,
        },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signedRecipe = await internal.wallet.signRecipe(
        recipe,
        (payload) => internal.unshieldedKeystore.signData(payload),
      );
      return internal.wallet.finalizeRecipe(signedRecipe);
    },
    submitTx: (tx: unknown) =>
      internal.wallet.submitTransaction(
        tx as Parameters<WalletFacade['submitTransaction']>[0],
      ),
  };

  return {
    mode: 'demo',
    address,
    coinPublicKey,
    encryptionPublicKey,
    balanceTx: walletProvider.balanceTx,
    submitTx: walletProvider.submitTx,
    stop: () => internal.wallet.stop(),
    getBalance: async () => {
      const s = await internal.wallet.waitForSyncedState();
      return s.unshielded.balances[unshieldedToken().raw] ?? 0n;
    },
    seed,
  };
}

/**
 * Build the providers object needed by midnight-js-contracts.
 * This is separate from WalletContext to keep the public interface clean.
 */
export function getDemoWalletProvider(walletCtx: WalletContext) {
  return {
    getCoinPublicKey: () => walletCtx.coinPublicKey,
    getEncryptionPublicKey: () => walletCtx.encryptionPublicKey,
    balanceTx: walletCtx.balanceTx,
    submitTx: walletCtx.submitTx,
  };
}

// ─── Lace Mode (Browser Extension) ──────────────────────────────────────────

/** Check if any wallet extension is available (Lace or 1AM) */
export function isLaceAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  const m = window.midnight as Record<string, unknown> | undefined;
  return !!(m?.mnLace || m?.['1am']);
}

/** Get the name of the detected wallet extension */
export function getDetectedWalletName(): string {
  const m = window.midnight as Record<string, unknown> | undefined;
  if (m?.['1am']) return '1AM';
  if (m?.mnLace) return 'Lace';
  return 'None';
}

/** Connect to wallet browser extension (Lace or 1AM) */
export async function connectLace(): Promise<WalletContext> {
  ensureNetworkId();

  const m = window.midnight as Record<string, unknown> | undefined;
  const walletApi = (m?.['1am'] || m?.mnLace) as InitialAPI | undefined;

  if (!walletApi) {
    throw new Error('Midnight wallet extension not found. Please install 1AM or Lace.');
  }

  const connectedWallet = await walletApi.connect('preprod');
  const walletState = await readRequiredWalletState(connectedWallet);

  return {
    mode: 'lace',
    address: walletState.address,
    coinPublicKey: walletState.coinPublicKey,
    encryptionPublicKey: walletState.encryptionPublicKey,
    balanceTx: async (tx: unknown) => {
      if (typeof tx !== 'string') {
        throw new Error('Wallet connector transactions must be serialized before balancing');
      }
      const result = await connectedWallet.balanceUnsealedTransaction(tx);
      return result.tx;
    },
    submitTx: async (tx: unknown) => {
      if (typeof tx !== 'string') {
        throw new Error('Wallet connector transactions must be serialized before submission');
      }
      await connectedWallet.submitTransaction(tx);
    },
    stop: async () => {
      // Extension wallets don't need cleanup
    },
    getBalance: async () => (await readRequiredWalletState(connectedWallet)).balance,
    rawWalletApi: connectedWallet,
  };
}

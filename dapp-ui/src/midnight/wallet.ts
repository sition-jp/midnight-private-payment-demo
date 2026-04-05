/**
 * Dual-mode wallet: Demo (seed-based) and Lace (browser extension).
 *
 * Demo mode creates a full wallet from a random seed (same as deploy-test).
 * Lace mode connects to window.midnight.mnLace browser extension.
 */
import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { unshieldedToken } from '@midnight-ntwrk/ledger-v7';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles, generateRandomSeed } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import {
  createKeystore,
  InMemoryTransactionHistoryStorage,
  PublicKey,
  UnshieldedWallet,
} from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import type { DAppConnectorAPI, DAppConnectorWalletAPI } from '@midnight-ntwrk/dapp-connector-api';
import { MIDNIGHT_CONFIG } from './config.js';
import type { WalletContext } from '../types/index.js';

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

/** Workaround for wallet SDK signRecipe bug (same as deploy-test) */
function signTransactionIntents(
  tx: { intents?: Map<number, unknown> },
  signFn: (payload: Uint8Array) => ledger.Signature,
  proofMarker: 'proof' | 'pre-proof',
): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment) as ledger.Intent<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >;
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<
      ledger.SignatureEnabled,
      ledger.Proofish,
      ledger.PreBinding
    >('signature', proofMarker, 'pre-binding', (intent as { serialize(): Uint8Array }).serialize());
    const sigData = (cloned as { signatureData(s: number): Uint8Array }).signatureData(segment);
    const signature = signFn(sigData);
    type IntentWithOffers = {
      fallibleUnshieldedOffer?: {
        inputs: unknown[];
        signatures: { at(i: number): ledger.Signature | undefined };
        addSignatures(sigs: ledger.Signature[]): unknown;
      };
      guaranteedUnshieldedOffer?: {
        inputs: unknown[];
        signatures: { at(i: number): ledger.Signature | undefined };
        addSignatures(sigs: ledger.Signature[]): unknown;
      };
    };
    const c = cloned as unknown as IntentWithOffers;
    if (c.fallibleUnshieldedOffer) {
      const sigs = c.fallibleUnshieldedOffer.inputs.map(
        (_: unknown, i: number) => c.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      c.fallibleUnshieldedOffer = c.fallibleUnshieldedOffer.addSignatures(sigs) as typeof c.fallibleUnshieldedOffer;
    }
    if (c.guaranteedUnshieldedOffer) {
      const sigs = c.guaranteedUnshieldedOffer.inputs.map(
        (_: unknown, i: number) => c.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      c.guaranteedUnshieldedOffer = c.guaranteedUnshieldedOffer.addSignatures(sigs) as typeof c.guaranteedUnshieldedOffer;
    }
    tx.intents.set(segment, cloned);
  }
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

  const walletConfig = {
    networkId,
    indexerClientConnection: {
      indexerHttpUrl: MIDNIGHT_CONFIG.indexer,
      indexerWsUrl: MIDNIGHT_CONFIG.indexerWS,
    },
    provingServerUrl: new URL(MIDNIGHT_CONFIG.proofServer, window.location.origin),
    relayURL: new URL(MIDNIGHT_CONFIG.node.replace(/^http/, 'ws')),
  };

  const shieldedWallet = ShieldedWallet(walletConfig).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet({
    networkId,
    indexerClientConnection: walletConfig.indexerClientConnection,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
  const dustWallet = DustWallet({
    ...walletConfig,
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

/**
 * Create a demo-mode wallet from a hex seed.
 * Syncs with the network before returning.
 */
export async function createWalletFromSeed(seed: string): Promise<WalletContext> {
  const internal = await createInternalWallet(seed.trim());

  // Wait for initial sync
  const state = await Rx.firstValueFrom(
    internal.wallet.state().pipe(
      Rx.throttleTime(5000),
      Rx.filter((s) => s.isSynced),
    ),
  );

  const address = internal.unshieldedKeystore.getBech32Address() as unknown as string;
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
      const signFn = (payload: Uint8Array) => internal.unshieldedKeystore.signData(payload);
      signTransactionIntents(
        recipe.baseTransaction as { intents?: Map<number, unknown> },
        signFn,
        'proof',
      );
      if (recipe.balancingTransaction) {
        signTransactionIntents(
          recipe.balancingTransaction as { intents?: Map<number, unknown> },
          signFn,
          'pre-proof',
        );
      }
      return internal.wallet.finalizeRecipe(recipe);
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
      const s = await Rx.firstValueFrom(
        internal.wallet.state().pipe(Rx.filter((st) => st.isSynced)),
      );
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
  const walletApi = (m?.['1am'] || m?.mnLace) as DAppConnectorAPI | undefined;

  if (!walletApi) {
    throw new Error('Midnight wallet extension not found. Please install 1AM or Lace.');
  }

  const walletExtApi = walletApi as any;

  // 1AM uses connect(), Lace uses enable()
  let connectedWallet: any;
  if (typeof walletExtApi.connect === 'function') {
    connectedWallet = await walletExtApi.connect('preprod');
  } else if (typeof walletExtApi.enable === 'function') {
    connectedWallet = await walletExtApi.enable();
  } else {
    throw new Error('Failed to connect to wallet extension');
  }

  // Get address
  let address = '';
  try {
    if (typeof connectedWallet.getUnshieldedAddress === 'function') {
      const addrResult = await connectedWallet.getUnshieldedAddress();
      address = String(addrResult?.unshieldedAddress ?? addrResult ?? '');
    } else if (typeof connectedWallet.state === 'function') {
      const state = await connectedWallet.state();
      address = String(state.address ?? '');
    }
  } catch {
    address = 'unknown';
  }

  // Get balance — 1AM returns { "0000...0000": "1000000000" }
  const NATIVE_TOKEN = '0'.repeat(64);
  let balance = 0n;
  try {
    if (typeof connectedWallet.getUnshieldedBalances === 'function') {
      const balances = await connectedWallet.getUnshieldedBalances();
      if (balances && typeof balances === 'object') {
        const raw = balances[NATIVE_TOKEN] ?? balances.totalBalance ?? '0';
        balance = BigInt(raw);
      }
    }
  } catch {
    balance = 0n;
  }

  // Get shielded keys for coin/encryption public keys
  let coinPublicKey = '';
  let encryptionPublicKey = '';
  try {
    if (typeof connectedWallet.getShieldedAddresses === 'function') {
      const shielded = await connectedWallet.getShieldedAddresses();
      coinPublicKey = String(shielded?.shieldedCoinPublicKey ?? '');
      encryptionPublicKey = String(shielded?.shieldedEncryptionPublicKey ?? '');
    }
  } catch {
    // Non-fatal — keys may not be needed for all operations
  }

  return {
    mode: 'lace',
    address,
    coinPublicKey,
    encryptionPublicKey,
    balanceTx: async (tx: unknown) => {
      if (typeof connectedWallet.balanceUnsealedTransaction === 'function') {
        return connectedWallet.balanceUnsealedTransaction(tx);
      }
      return connectedWallet.balanceAndProveTransaction(tx, []);
    },
    submitTx: (tx: unknown) => connectedWallet.submitTransaction(tx),
    stop: async () => {
      // Extension wallets don't need cleanup
    },
    getBalance: async () => {
      try {
        const balances = await connectedWallet.getUnshieldedBalances();
        if (balances && typeof balances === 'object') {
          const raw = balances[NATIVE_TOKEN] ?? balances.totalBalance ?? '0';
          return BigInt(raw);
        }
      } catch { /* */ }
      return balance;
    },
    rawWalletApi: connectedWallet,
  };
}

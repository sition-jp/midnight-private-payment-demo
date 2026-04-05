/**
 * Contract interaction module for the private-payment contract.
 *
 * Uses the same patterns as the official Midnight bboard DApp:
 * - FetchZkConfigProvider (not NodeZkConfigProvider) for browser
 * - httpClientProofProvider with direct proof server URL
 * - fetch.bind(window) for browser-native fetch
 */
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';

import { MIDNIGHT_CONFIG } from './config.js';
import { inMemoryPrivateStateProvider } from '../providers/InMemoryPrivateStateProvider.js';
import {
  createWitnesses,
  createInitialPrivateState,
  setTransferContext,
  type PrivatePaymentState,
} from './witness.js';
import { getDemoWalletProvider } from './wallet.js';
import type {
  WalletContext,
  ContractContext,
  TransactionResult,
  TransferContext,
} from '../types/index.js';

// Circuit IDs matching the compiled contract
type PrivatePaymentCircuitKeys = 'deposit' | 'private_transfer' | 'check_balance';

// ─── Contract Loading ────────────────────────────────────────────────────────

/**
 * Dynamically load the compiled contract module.
 */
async function loadContractModule() {
  const contractModule = await import('../contract/index.js');
  return contractModule;
}

/**
 * Build the compiled contract with witnesses.
 * Uses window.location.origin as the ZK config base path (same as bboard).
 */
async function buildCompiledContract() {
  const contractModule = await loadContractModule();

  const compiledContract = (CompiledContract as any).make('private-payment', contractModule.Contract).pipe(
    (CompiledContract as any).withWitnesses(createWitnesses()),
    (CompiledContract as any).withCompiledFileAssets(window.location.origin),
  );

  return { compiledContract };
}

// ─── Provider Assembly ───────────────────────────────────────────────────────

/**
 * Assemble providers using the bboard pattern:
 * - FetchZkConfigProvider with fetch.bind(window) for browser compatibility
 * - httpClientProofProvider with direct proof server URL
 */
function createBrowserProviders(walletCtx: WalletContext): MidnightProviders {
  const walletProvider = getDemoWalletProvider(walletCtx);

  // Use FetchZkConfigProvider (official browser-compatible provider)
  // Keys/zkir files are served as static assets from /contracts/private-payment/
  const zkConfigProvider = new FetchZkConfigProvider<PrivatePaymentCircuitKeys>(
    window.location.origin + '/contracts/private-payment',
    fetch.bind(window),
  );

  // Proof server URL - direct connection (same as bboard pattern)
  const proofServerUrl = MIDNIGHT_CONFIG.proofServer;

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      MIDNIGHT_CONFIG.indexer,
      MIDNIGHT_CONFIG.indexerWS,
    ),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider(proofServerUrl, zkConfigProvider as any),
    walletProvider: walletProvider as unknown as MidnightProviders['walletProvider'],
    midnightProvider: walletProvider as unknown as MidnightProviders['midnightProvider'],
  };
}

// ─── 1AM Wallet Providers ────────────────────────────────────────────────────

/**
 * Assemble providers using 1AM wallet's native APIs.
 * Uses 1AM's cloud prover (api-preprod.1am.xyz) instead of local proof server.
 * Uses 1AM's balanceUnsealedTransaction for tx balancing.
 */
async function create1AMProviders(walletCtx: WalletContext): Promise<MidnightProviders> {
  const api = walletCtx.rawWalletApi;
  if (!api) {
    throw new Error('1AM wallet API not available. rawWalletApi is undefined.');
  }

  // Get network config from 1AM (includes cloud prover URL and indexer v4 URLs)
  let indexerUrl = MIDNIGHT_CONFIG.indexer;
  let indexerWsUrl = MIDNIGHT_CONFIG.indexerWS;
  let proverUrl = MIDNIGHT_CONFIG.proofServer;
  try {
    const config = await api.getConfiguration();
    if (config.indexerUri) indexerUrl = config.indexerUri;
    if (config.indexerWsUri) indexerWsUrl = config.indexerWsUri;
    if (config.proverServerUri) proverUrl = config.proverServerUri;
  } catch {
    // Fall back to hardcoded URLs
  }

  // Use standard httpClientProofProvider pointed at 1AM's cloud prover
  // This maintains zkConfigProvider compatibility (getZKIR etc.)
  const zkConfigProvider = new FetchZkConfigProvider<PrivatePaymentCircuitKeys>(
    window.location.origin + '/contracts/private-payment',
    fetch.bind(window),
  );

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerUrl, indexerWsUrl),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: httpClientProofProvider(proverUrl, zkConfigProvider as any),
    walletProvider: {
      getCoinPublicKey: () => walletCtx.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.encryptionPublicKey,
      balanceTx: (tx: unknown) => api.balanceUnsealedTransaction(tx),
      submitTx: (tx: unknown) => api.submitTransaction(tx),
    } as unknown as MidnightProviders['walletProvider'],
    midnightProvider: {
      submitTx: (tx: unknown) => api.submitTransaction(tx),
    } as unknown as MidnightProviders['midnightProvider'],
  };
}

// ─── Transaction Helpers ─────────────────────────────────────────────────────

function extractTxHash(result: unknown): string {
  const r = result as Record<string, unknown> | undefined;
  const pub = r?.public as Record<string, unknown> | undefined;
  return (pub?.txHash as string) ?? (r?.txHash as string) ?? 'unknown';
}

function makeTransactionResult(result: unknown): TransactionResult {
  const txHash = extractTxHash(result);
  return {
    txHash,
    status: 'confirmed',
    explorerUrl: `${MIDNIGHT_CONFIG.explorerUrl}/tx/0x${txHash}`,
    result,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Connect to an already-deployed private-payment contract.
 */
export async function connectToContract(
  walletCtx: WalletContext,
  contractAddress: string,
  secretKey: Uint8Array,
): Promise<ContractContext> {
  const { compiledContract } = await buildCompiledContract();
  const providers = walletCtx.mode === 'lace' && walletCtx.rawWalletApi
    ? await create1AMProviders(walletCtx)
    : createBrowserProviders(walletCtx);

  const contract = await (findDeployedContract as unknown as (
    providers: MidnightProviders,
    config: {
      compiledContract: unknown;
      contractAddress: string;
      privateStateId: string;
      initialPrivateState: PrivatePaymentState;
    },
  ) => Promise<{
    callTx: {
      deposit: (amount: bigint) => Promise<unknown>;
      private_transfer: () => Promise<unknown>;
      check_balance: () => Promise<unknown>;
    };
  }>)(providers, {
    compiledContract: compiledContract as unknown,
    contractAddress,
    privateStateId: 'privatePaymentBrowser',
    initialPrivateState: createInitialPrivateState(secretKey),
  });

  return {
    contractAddress,

    async deposit(amount: bigint): Promise<TransactionResult> {
      const result = await contract.callTx.deposit(amount);
      return makeTransactionResult(result);
    },

    async privateTransfer(): Promise<TransactionResult> {
      const result = await contract.callTx.private_transfer();
      return makeTransactionResult(result);
    },

    async checkBalance(): Promise<TransactionResult> {
      const result = await contract.callTx.check_balance();
      const r = result as Record<string, unknown> | undefined;
      const pub = r?.public as Record<string, unknown> | undefined;
      const balance = pub?.result ?? (r as Record<string, unknown> | undefined)?.result;
      const txResult = makeTransactionResult(result);
      return { ...txResult, result: balance };
    },
  };
}

/**
 * Execute a private transfer with transfer context.
 */
export async function executePrivateTransfer(
  contractCtx: ContractContext,
  amount: bigint,
  recipient: Uint8Array,
  recipientBalance = 0n,
  recipientSalt = new Uint8Array(32),
): Promise<TransactionResult> {
  const ctx: TransferContext = {
    amount,
    recipient,
    recipientBalance,
    recipientSalt,
  };
  setTransferContext(ctx);

  return contractCtx.privateTransfer();
}

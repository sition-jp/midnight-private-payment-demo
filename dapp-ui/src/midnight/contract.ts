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
import {
  createProofProvider,
  type MidnightProviders,
  type PrivateStateProvider,
  type UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';
import {
  Transaction,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v8';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';

import { MIDNIGHT_CONFIG } from './config.js';
import {
  extractCircuitResult,
  extractFinalizedTransactionMetadata,
} from './contract-result.js';
import { buildTransferDisclosure } from './transfer-disclosure.js';
import { inMemoryPrivateStateProvider } from '../providers/InMemoryPrivateStateProvider.js';
import {
  createWitnesses,
  createInitialPrivateState,
  deriveContractPublicKey,
  setTransferContext,
  transferContext,
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

  const compiledContract = CompiledContract.make('private-payment', contractModule.Contract).pipe(
    CompiledContract.withWitnesses(createWitnesses()),
    CompiledContract.withCompiledFileAssets(window.location.origin),
  );

  return { compiledContract, contractModule };
}

// ─── Provider Assembly ───────────────────────────────────────────────────────

/**
 * Assemble providers using the bboard pattern:
 * - FetchZkConfigProvider with fetch.bind(window) for browser compatibility
 * - httpClientProofProvider with direct proof server URL
 */
type BrowserPrivateStateProvider = PrivateStateProvider<string, PrivatePaymentState>;

function createBrowserProviders(
  walletCtx: WalletContext,
  privateStateProvider: BrowserPrivateStateProvider,
): MidnightProviders {
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
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(
      MIDNIGHT_CONFIG.indexer,
      MIDNIGHT_CONFIG.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(proofServerUrl, zkConfigProvider),
    walletProvider: walletProvider as unknown as MidnightProviders['walletProvider'],
    midnightProvider: walletProvider as unknown as MidnightProviders['midnightProvider'],
  };
}

// ─── 1AM Wallet Providers ────────────────────────────────────────────────────

/**
 * Assemble providers using 1AM wallet's native APIs.
 * Delegates proving to 1AM instead of using the localhost proof server.
 * Uses 1AM's balanceUnsealedTransaction for tx balancing.
 */
async function create1AMProviders(
  walletCtx: WalletContext,
  privateStateProvider: BrowserPrivateStateProvider,
): Promise<MidnightProviders> {
  const api = walletCtx.rawWalletApi;
  if (!api) {
    throw new Error('1AM wallet API not available. rawWalletApi is undefined.');
  }

  if (typeof api.getProvingProvider !== 'function') {
    throw new Error('This wallet does not expose the delegated proving API required by the workshop');
  }

  // Prefer the wallet's v4 indexer endpoints when they are compatible.
  let indexerUrl = MIDNIGHT_CONFIG.indexer;
  let indexerWsUrl = MIDNIGHT_CONFIG.indexerWS;
  try {
    const config = await api.getConfiguration();
    if (config.indexerUri?.includes('/api/v4/graphql')) indexerUrl = config.indexerUri;
    if (config.indexerWsUri?.includes('/api/v4/graphql')) indexerWsUrl = config.indexerWsUri;
  } catch {
    // The canonical preprod v4 endpoints remain the source of truth.
  }

  const zkConfigProvider = new FetchZkConfigProvider<PrivatePaymentCircuitKeys>(
    window.location.origin + '/contracts/private-payment',
    fetch.bind(window),
  );
  const delegatedProver = await api.getProvingProvider(zkConfigProvider);
  const proofProvider = createProofProvider(delegatedProver);

  const balanceTx = async (tx: UnboundTransaction): Promise<FinalizedTransaction> => {
    const result = await api.balanceUnsealedTransaction(toHex(tx.serialize()));
    return Transaction.deserialize('signature', 'proof', 'binding', fromHex(result.tx));
  };

  const submitTx = async (tx: FinalizedTransaction): Promise<string> => {
    const [transactionId] = tx.identifiers();
    if (!transactionId) {
      throw new Error('Finalized transaction has no submission identifier');
    }
    await api.submitTransaction(toHex(tx.serialize()));
    return transactionId;
  };

  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(indexerUrl, indexerWsUrl),
    zkConfigProvider,
    proofProvider,
    walletProvider: {
      getCoinPublicKey: () => walletCtx.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.encryptionPublicKey,
      balanceTx,
    } as unknown as MidnightProviders['walletProvider'],
    midnightProvider: {
      submitTx,
    } as unknown as MidnightProviders['midnightProvider'],
  };
}

// ─── Transaction Helpers ─────────────────────────────────────────────────────

function makeTransactionResult(result: unknown): TransactionResult {
  const metadata = extractFinalizedTransactionMetadata(result);
  return {
    txHash: metadata.txHash,
    status: 'confirmed',
    blockHeight: metadata.blockHeight,
    explorerUrl: `${MIDNIGHT_CONFIG.explorerUrl}/tx/0x${metadata.txHash}`,
  };
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    throw new Error(message);
  }
  return value as Record<string, unknown>;
}

function getPublicNextContractState(result: unknown): unknown {
  const root = requireRecord(result, 'Finalized transfer result is unavailable');
  const publicData = requireRecord(root.public, 'Finalized public transfer data is unavailable');
  if (publicData.nextContractState == null) {
    throw new Error('Finalized public contract state is unavailable');
  }
  return publicData.nextContractState;
}

function getPrivateNextState(result: unknown): PrivatePaymentState {
  const root = requireRecord(result, 'Finalized transfer result is unavailable');
  const privateData = requireRecord(root.private, 'Finalized private transfer data is unavailable');
  return privateData.nextPrivateState as PrivatePaymentState;
}

function requireBlockHeight(value: number | undefined): number {
  if (value == null) {
    throw new Error('Transfer finalized, but its block height is unavailable');
  }
  return value;
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
  const privateStateProvider = inMemoryPrivateStateProvider<string, PrivatePaymentState>();
  const senderPublicKey = deriveContractPublicKey(secretKey);
  const { compiledContract, contractModule } = await buildCompiledContract();
  const providers = walletCtx.mode === 'lace' && walletCtx.rawWalletApi
    ? await create1AMProviders(walletCtx, privateStateProvider)
    : createBrowserProviders(walletCtx, privateStateProvider);

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
      const submitted = {
        amount: transferContext.amount,
        recipient: new Uint8Array(transferContext.recipient),
      };
      const result = await contract.callTx.private_transfer();
      const metadata = extractFinalizedTransactionMetadata(result);
      const publicState = getPublicNextContractState(result);
      const privateState = getPrivateNextState(result);
      const ledgerView = contractModule.ledger(
        publicState as Parameters<typeof contractModule.ledger>[0],
      );
      const disclosure = buildTransferDisclosure({
        senderPublicKey,
        recipientPublicKey: submitted.recipient,
        amount: submitted.amount,
        txHash: metadata.txHash,
        blockHeight: requireBlockHeight(metadata.blockHeight),
        senderCommitment: ledgerView.balance_commitments.lookup(senderPublicKey),
        recipientCommitment: ledgerView.balance_commitments.lookup(submitted.recipient),
        nextPrivateState: privateState,
      });
      return { ...makeTransactionResult(result), disclosure };
    },

    async checkBalance(): Promise<TransactionResult> {
      const result = await contract.callTx.check_balance();
      // The contract discloses this value, but midnight-js wraps all JS circuit
      // return values in the generic privacy-sensitive `private.result` envelope.
      // Extract only the value; never log or persist the surrounding object.
      const balance = extractCircuitResult(result);
      if (typeof balance !== 'bigint') {
        throw new Error('Disclosed contract balance is unavailable');
      }
      const txResult = makeTransactionResult(result);
      return { ...txResult, result: balance };
    },

    async readPrivateBalance(): Promise<bigint> {
      const privateState = await privateStateProvider.get('privatePaymentBrowser');
      const balance = privateState?.balances.get(toHex(senderPublicKey));
      if (balance == null) {
        throw new Error('Local contract balance is unavailable');
      }
      return balance;
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
): Promise<TransactionResult> {
  const ctx: TransferContext = {
    amount,
    recipient,
  };
  setTransferContext(ctx);

  return contractCtx.privateTransfer();
}

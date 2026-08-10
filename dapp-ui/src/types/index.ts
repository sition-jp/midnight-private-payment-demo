/**
 * Type definitions for the Midnight Private Payment DApp.
 */

import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';

// ─── Wallet Types ────────────────────────────────────────────────────────────

/** Wallet connection mode: seed-based demo or Lace browser extension */
export type WalletMode = 'demo' | 'lace';

/**
 * Unified wallet context returned by both demo and Lace wallet modes.
 * Provides everything needed to interact with the Midnight network.
 */
export interface WalletContext {
  /** Which mode this wallet was created in */
  readonly mode: WalletMode;
  /** Bech32m encoded wallet address */
  readonly address: string;
  /** Hex-encoded coin public key (used as on-chain identity) */
  readonly coinPublicKey: string;
  /** Hex-encoded encryption public key */
  readonly encryptionPublicKey: string;
  /** Balance a transaction (adds fees, inputs, change) */
  readonly balanceTx: (tx: unknown, ttl?: Date) => Promise<unknown>;
  /** Submit a finalized transaction to the network */
  readonly submitTx: (tx: unknown) => Promise<unknown>;
  /** Stop the wallet (cleanup) */
  readonly stop: () => Promise<void>;
  /** Get current tNight balance (unshielded) */
  readonly getBalance: () => Promise<bigint>;

  // Lace-mode specific fields (undefined for demo mode)
  /** The DApp connector API instance (Lace mode only) */
  readonly laceApi?: InitialAPI;
  /** The Lace wallet API (Lace mode only) */
  readonly laceWallet?: ConnectedAPI;

  // 1AM-mode specific fields
  /** Raw 1AM connected wallet API (17 methods). Used by contract.ts to build providers. */
  readonly rawWalletApi?: ConnectedAPI;
}

// ─── Transaction Types ───────────────────────────────────────────────────────

/** Status of a submitted transaction */
export type TxStatus = 'pending' | 'confirmed' | 'failed';

/** Explicitly selected values used by the workshop transfer-visibility panel. */
export interface TransferDisclosureSnapshot {
  readonly onChain: {
    readonly senderPublicKey: string;
    readonly recipientPublicKey: string;
    readonly senderCommitment: string;
    readonly recipientCommitment: string;
    readonly txHash: string;
    readonly blockHeight: number;
  };
  readonly localOnly: {
    readonly amount: bigint;
    readonly senderBalanceAfter: bigint;
    readonly senderSalt: string;
    readonly recipientSalt: string;
  };
}

/** A non-transactional failure that occurs after the network confirmed a call. */
export interface PostFinalizationIssue {
  readonly kind: 'transfer-disclosure-unavailable';
  readonly message: string;
}

/** Result of a contract transaction */
export interface TransactionResult {
  /** Transaction hash */
  readonly txHash: string;
  /** Current status */
  readonly status: TxStatus;
  /** Block height if confirmed */
  readonly blockHeight?: number;
  /** Return value from circuit (e.g., balance from check_balance) */
  readonly result?: bigint;
  /** Ephemeral values selected for the transfer-visibility lesson */
  readonly disclosure?: TransferDisclosureSnapshot;
  /** Optional enrichment warning; this never changes a confirmed transaction to failed. */
  readonly postFinalizationIssue?: PostFinalizationIssue;
  /** Explorer URL for this transaction */
  readonly explorerUrl: string;
}

// ─── Contract Types ──────────────────────────────────────────────────────────

/** Context for interacting with a deployed private-payment contract */
export interface ContractContext {
  /** The on-chain contract address */
  readonly contractAddress: string;
  /** Execute deposit(amount) */
  readonly deposit: (amount: bigint) => Promise<TransactionResult>;
  /** Execute private_transfer() with a contract-scoped witness input */
  readonly privateTransfer: (
    amount: bigint,
    recipient: Uint8Array,
  ) => Promise<TransactionResult>;
  /** Execute check_balance() */
  readonly checkBalance: () => Promise<TransactionResult>;
  /** Read the retained local private balance without disclosing it on-chain */
  readonly readPrivateBalance: () => Promise<bigint>;
}

// ─── Transfer Context ────────────────────────────────────────────────────────

/** Mutable transfer context owned by one connected contract */
export interface TransferContext {
  amount: bigint;
  recipient: Uint8Array;
}

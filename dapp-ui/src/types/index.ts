/**
 * Type definitions for the Midnight Private Payment DApp.
 */

import type { DAppConnectorAPI, DAppConnectorWalletAPI } from '@midnight-ntwrk/dapp-connector-api';

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

  // Demo-mode specific fields (undefined for Lace mode)
  /** The seed used to create this wallet (demo mode only) */
  readonly seed?: string;

  // Lace-mode specific fields (undefined for demo mode)
  /** The DApp connector API instance (Lace mode only) */
  readonly laceApi?: DAppConnectorAPI;
  /** The Lace wallet API (Lace mode only) */
  readonly laceWallet?: DAppConnectorWalletAPI;

  // 1AM-mode specific fields
  /** Raw 1AM connected wallet API (17 methods). Used by contract.ts to build providers. */
  readonly rawWalletApi?: any;
}

// ─── Transaction Types ───────────────────────────────────────────────────────

/** Status of a submitted transaction */
export type TxStatus = 'pending' | 'confirmed' | 'failed';

/** Result of a contract transaction */
export interface TransactionResult {
  /** Transaction hash */
  readonly txHash: string;
  /** Current status */
  readonly status: TxStatus;
  /** Block height if confirmed */
  readonly blockHeight?: number;
  /** Return value from circuit (e.g., balance from check_balance) */
  readonly result?: unknown;
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
  /** Execute private_transfer() — set transfer context first */
  readonly privateTransfer: () => Promise<TransactionResult>;
  /** Execute check_balance() */
  readonly checkBalance: () => Promise<TransactionResult>;
}

// ─── Transfer Context ────────────────────────────────────────────────────────

/** Mutable transfer context set before calling private_transfer */
export interface TransferContext {
  amount: bigint;
  recipient: Uint8Array;
  recipientBalance: bigint;
  recipientSalt: Uint8Array;
}

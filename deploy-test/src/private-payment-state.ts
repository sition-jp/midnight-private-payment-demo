import * as crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentHash,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';

import type {
  Ledger,
  Witnesses,
} from '../contracts/managed/private-payment/contract/index.js';

/** Off-chain private state. Actual balances and salts never enter ledger state. */
export interface PrivatePaymentState {
  readonly secretKey: Uint8Array;
  readonly balances: Map<string, bigint>;
  readonly salts: Map<string, Uint8Array>;
}

/** Mutable input consumed by the private_transfer witnesses. */
export interface TransferContext {
  amount: bigint;
  recipientPublicKey: Uint8Array;
}

const bytes32 = new CompactTypeBytes(32);
const derivePublicKeyInput = new CompactTypeVector(2, bytes32);
const publicKeyDomain = new Uint8Array(32);
publicKeyDomain.set(Buffer.from('midnight:pk:', 'utf8'));

function toHexKey(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function randomBytes32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/** Mirrors the contract's private derive_pk circuit exactly. */
export function deriveContractPublicKey(secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 32) {
    throw new Error('Contract secret key must be 32 bytes');
  }
  return persistentHash(derivePublicKeyInput, [publicKeyDomain, secretKey]);
}

export function createInitialPrivateState(secretKey: Uint8Array): PrivatePaymentState {
  if (secretKey.length !== 32) {
    throw new Error('Contract secret key must be 32 bytes');
  }
  return {
    secretKey,
    balances: new Map(),
    salts: new Map(),
  };
}

export function createTransferContext(): TransferContext {
  return {
    amount: 0n,
    recipientPublicKey: new Uint8Array(32),
  };
}

/** Implements the contract's eleven private witnesses. */
export function createWitnesses(
  transfer: TransferContext = createTransferContext(),
): Witnesses<PrivatePaymentState> {
  return {
    local_secret_key(context): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, context.privateState.secretKey];
    },

    private_amount(context): [PrivatePaymentState, bigint] {
      return [context.privateState, transfer.amount];
    },

    private_recipient(context): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, transfer.recipientPublicKey];
    },

    get_balance(context, publicKey): [PrivatePaymentState, bigint] {
      return [context.privateState, context.privateState.balances.get(toHexKey(publicKey)) ?? 0n];
    },

    get_salt(context, publicKey): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, context.privateState.salts.get(toHexKey(publicKey)) ?? new Uint8Array(32)];
    },

    new_salt(context): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, randomBytes32()];
    },

    store_balance(context, publicKey, balance, salt): [PrivatePaymentState, []] {
      return [storeAccount(context, publicKey, balance, salt), []];
    },

    get_recipient_balance(context): [PrivatePaymentState, bigint] {
      const key = toHexKey(transfer.recipientPublicKey);
      return [context.privateState, context.privateState.balances.get(key) ?? 0n];
    },

    get_recipient_salt(context): [PrivatePaymentState, Uint8Array] {
      const key = toHexKey(transfer.recipientPublicKey);
      return [context.privateState, context.privateState.salts.get(key) ?? new Uint8Array(32)];
    },

    new_recipient_salt(context): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, randomBytes32()];
    },

    store_recipient_balance(context, publicKey, balance, salt): [PrivatePaymentState, []] {
      return [storeAccount(context, publicKey, balance, salt), []];
    },
  };
}

function storeAccount(
  context: WitnessContext<Ledger, PrivatePaymentState>,
  publicKey: Uint8Array,
  balance: bigint,
  salt: Uint8Array,
): PrivatePaymentState {
  const balances = new Map(context.privateState.balances);
  const salts = new Map(context.privateState.salts);
  const key = toHexKey(publicKey);
  balances.set(key, balance);
  salts.set(key, salt);
  return { ...context.privateState, balances, salts };
}

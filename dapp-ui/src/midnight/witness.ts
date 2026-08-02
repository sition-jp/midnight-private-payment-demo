/**
 * Witness provider for the private-payment contract.
 *
 * Ported from deploy-test/src/deploy.ts and full-test.ts for browser use.
 * Uses crypto.getRandomValues() instead of Node.js crypto module.
 */
import { Buffer } from 'buffer';
import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentHash,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';
import type { Witnesses, Ledger } from '../../public/contracts/private-payment/contract/index.js';
import type { TransferContext } from '../types/index.js';

// ─── Private State ───────────────────────────────────────────────────────────

/** Off-chain private state: stores actual balances and salts per public key */
export interface PrivatePaymentState {
  readonly secretKey: Uint8Array;
  readonly balances: Map<string, bigint>;
  readonly salts: Map<string, Uint8Array>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toHexKey(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

function randomBytes32(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

const bytes32 = new CompactTypeBytes(32);
const derivePublicKeyInput = new CompactTypeVector(2, bytes32);
const publicKeyDomain = new Uint8Array(32);
publicKeyDomain.set(new TextEncoder().encode('midnight:pk:'));

/** Mirrors the contract's private derive_pk circuit exactly. */
export function deriveContractPublicKey(secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 32) {
    throw new Error('Contract secret key must be 32 bytes');
  }
  return persistentHash(derivePublicKeyInput, [publicKeyDomain, secretKey]);
}

// ─── Initial State ───────────────────────────────────────────────────────────

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

// ─── Mutable Transfer Context ────────────────────────────────────────────────

/**
 * Module-level mutable transfer context.
 * Set these values before calling private_transfer().
 * The witnesses close over this object and read from it at circuit execution time.
 */
export const transferContext: TransferContext = {
  amount: 0n,
  recipient: new Uint8Array(32),
};

/** Update the transfer context before executing private_transfer */
export function setTransferContext(ctx: TransferContext): void {
  transferContext.amount = ctx.amount;
  transferContext.recipient = ctx.recipient;
}

// ─── Witness Provider ────────────────────────────────────────────────────────

/**
 * Creates the witness provider implementing all 11 witnesses for the private-payment contract.
 * Transfer-related witnesses read from the mutable transferContext, allowing
 * deposit and private_transfer to share the same compiled contract and private state.
 */
export function createWitnesses(): Witnesses<PrivatePaymentState> {
  return {
    local_secret_key(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, context.privateState.secretKey];
    },

    private_amount(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, bigint] {
      return [context.privateState, transferContext.amount];
    },

    private_recipient(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, transferContext.recipient];
    },

    get_balance(
      context: WitnessContext<Ledger, PrivatePaymentState>,
      pk: Uint8Array,
    ): [PrivatePaymentState, bigint] {
      const balance = context.privateState.balances.get(toHexKey(pk)) ?? 0n;
      return [context.privateState, balance];
    },

    get_salt(
      context: WitnessContext<Ledger, PrivatePaymentState>,
      pk: Uint8Array,
    ): [PrivatePaymentState, Uint8Array] {
      const salt = context.privateState.salts.get(toHexKey(pk)) ?? new Uint8Array(32);
      return [context.privateState, salt];
    },

    new_salt(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, randomBytes32()];
    },

    store_balance(
      context: WitnessContext<Ledger, PrivatePaymentState>,
      pk: Uint8Array,
      balance: bigint,
      salt: Uint8Array,
    ): [PrivatePaymentState, []] {
      const newBalances = new Map(context.privateState.balances);
      const newSalts = new Map(context.privateState.salts);
      newBalances.set(toHexKey(pk), balance);
      newSalts.set(toHexKey(pk), salt);
      return [{ ...context.privateState, balances: newBalances, salts: newSalts }, []];
    },

    get_recipient_balance(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, bigint] {
      const key = toHexKey(transferContext.recipient);
      return [context.privateState, context.privateState.balances.get(key) ?? 0n];
    },

    get_recipient_salt(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, Uint8Array] {
      const key = toHexKey(transferContext.recipient);
      return [context.privateState, context.privateState.salts.get(key) ?? new Uint8Array(32)];
    },

    new_recipient_salt(
      context: WitnessContext<Ledger, PrivatePaymentState>,
    ): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, randomBytes32()];
    },

    store_recipient_balance(
      context: WitnessContext<Ledger, PrivatePaymentState>,
      pk: Uint8Array,
      balance: bigint,
      salt: Uint8Array,
    ): [PrivatePaymentState, []] {
      const newBalances = new Map(context.privateState.balances);
      const newSalts = new Map(context.privateState.salts);
      newBalances.set(toHexKey(pk), balance);
      newSalts.set(toHexKey(pk), salt);
      return [{ ...context.privateState, balances: newBalances, salts: newSalts }, []];
    },
  };
}

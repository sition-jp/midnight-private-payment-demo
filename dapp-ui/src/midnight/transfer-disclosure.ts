import type { TransferDisclosureSnapshot } from '../types/index.js';
import type { PrivatePaymentState } from './witness.js';

export interface TransferDisclosureInput {
  readonly senderPublicKey: Uint8Array;
  readonly recipientPublicKey: Uint8Array;
  readonly amount: bigint;
  readonly txHash: string;
  readonly blockHeight: number;
  readonly senderCommitment: Uint8Array;
  readonly recipientCommitment: Uint8Array;
  readonly nextPrivateState: PrivatePaymentState;
}

const toLowerHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');

const unavailable = (): never => {
  throw new Error('Transfer finalized, but disclosure rendering data is unavailable');
};

/**
 * Select the exact public and local values needed by the workshop lesson.
 * Never return the private state object or its secret key.
 */
export function buildTransferDisclosure(
  input: TransferDisclosureInput,
): TransferDisclosureSnapshot {
  const senderKey = toLowerHex(input.senderPublicKey);
  const recipientKey = toLowerHex(input.recipientPublicKey);
  const senderBalanceAfter = input.nextPrivateState.balances.get(senderKey);
  const senderSalt = input.nextPrivateState.salts.get(senderKey);
  const recipientSalt = input.nextPrivateState.salts.get(recipientKey);

  if (senderBalanceAfter == null || senderSalt == null || recipientSalt == null) {
    unavailable();
  }

  return {
    onChain: {
      senderPublicKey: senderKey,
      recipientPublicKey: recipientKey,
      senderCommitment: toLowerHex(input.senderCommitment),
      recipientCommitment: toLowerHex(input.recipientCommitment),
      txHash: input.txHash,
      blockHeight: input.blockHeight,
    },
    localOnly: {
      amount: input.amount,
      senderBalanceAfter,
      senderSalt: toLowerHex(senderSalt),
      recipientSalt: toLowerHex(recipientSalt),
    },
  };
}

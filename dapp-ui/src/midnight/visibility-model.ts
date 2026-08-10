import type { TransferDisclosureSnapshot } from '../types/index.js';

export type RepetitionMode = 1 | 100;

export interface VisibilityRow {
  readonly label: string;
  readonly value: string;
}

export interface VisibilityModel {
  readonly publicComparison: readonly VisibilityRow[];
  readonly publicComparisonCaption: string;
  readonly onChain: readonly VisibilityRow[];
  readonly localOnly: readonly VisibilityRow[];
  readonly lesson: string;
  readonly isIllustration: boolean;
}

export function buildVisibilityModel(
  disclosure: TransferDisclosureSnapshot,
  repetition: RepetitionMode,
): VisibilityModel {
  const isIllustration = repetition === 100;

  return {
    publicComparison: [
      { label: 'Sender identifier', value: 'Visible' },
      { label: 'Recipient identifier', value: 'Visible' },
      { label: 'Amount and resulting balance', value: 'Visible' },
      { label: 'Transaction trail', value: 'Visible' },
    ],
    publicComparisonCaption:
      'Comparison only — this is not a transaction submitted by the demo.',
    onChain: [
      { label: 'Sender public key', value: disclosure.onChain.senderPublicKey },
      { label: 'Recipient public key', value: disclosure.onChain.recipientPublicKey },
      { label: 'Sender commitment', value: disclosure.onChain.senderCommitment },
      { label: 'Recipient commitment', value: disclosure.onChain.recipientCommitment },
      { label: 'Transaction hash', value: disclosure.onChain.txHash },
      { label: 'Block height', value: disclosure.onChain.blockHeight.toString() },
    ],
    localOnly: [
      { label: 'Transfer amount', value: disclosure.localOnly.amount.toString() },
      {
        label: 'Sender balance after transfer',
        value: disclosure.localOnly.senderBalanceAfter.toString(),
      },
      { label: 'Sender salt', value: disclosure.localOnly.senderSalt },
      { label: 'Recipient salt', value: disclosure.localOnly.recipientSalt },
    ],
    lesson: isIllustration
      ? 'Illustration only: repeated transfers retain a public counterparty-key trail while each amount remains hidden.'
      : 'Public keys remain visible on-chain while the transfer amount and balance values remain hidden.',
    isIllustration,
  };
}

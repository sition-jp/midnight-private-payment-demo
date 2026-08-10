export type PolicyReasonCode =
  | 'approved'
  | 'invalid_amount'
  | 'invalid_limit'
  | 'insufficient_balance'
  | 'over_limit';

export interface PaymentPolicyInput {
  readonly availableBalance: bigint;
  readonly requestedAmount: bigint;
  readonly perTransferLimit: bigint;
}

export interface PaymentPolicyDecision {
  readonly approved: boolean;
  readonly amount: bigint;
  readonly code: PolicyReasonCode;
  readonly summary: string;
  readonly input: PaymentPolicyInput;
}

export function evaluatePaymentPolicy(input: PaymentPolicyInput): PaymentPolicyDecision {
  if (input.requestedAmount <= 0n) {
    return {
      approved: false,
      amount: input.requestedAmount,
      code: 'invalid_amount',
      summary: 'Requested amount must be positive.',
      input,
    };
  }

  if (input.perTransferLimit <= 0n) {
    return {
      approved: false,
      amount: input.requestedAmount,
      code: 'invalid_limit',
      summary: 'Per-transfer limit must be positive.',
      input,
    };
  }

  if (input.availableBalance < input.requestedAmount) {
    return {
      approved: false,
      amount: input.requestedAmount,
      code: 'insufficient_balance',
      summary: 'Available private balance is below the requested amount.',
      input,
    };
  }

  if (input.requestedAmount > input.perTransferLimit) {
    return {
      approved: false,
      amount: input.requestedAmount,
      code: 'over_limit',
      summary: 'Requested amount exceeds the per-transfer limit.',
      input,
    };
  }

  return {
    approved: true,
    amount: input.requestedAmount,
    code: 'approved',
    summary: 'Local payment policy approved one transfer.',
    input,
  };
}

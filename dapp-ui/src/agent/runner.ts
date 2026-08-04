import type { TransactionResult } from '../types/index.js';
import {
  evaluatePaymentPolicy,
  type PaymentPolicyDecision,
  type PaymentPolicyInput,
} from './policy.ts';

export type PolicyLogStage =
  | 'evaluated'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface PolicyLogEntry {
  readonly sequence: number;
  readonly stage: PolicyLogStage;
  readonly code: string;
  readonly message: string;
  readonly localInputs?: PaymentPolicyInput;
}

export interface PolicyRunInput {
  readonly requestedAmount: bigint;
  readonly perTransferLimit: bigint;
  readonly recipientHex: string;
}

export interface PolicyRunnerDependencies {
  readonly readBalance: () => Promise<bigint>;
  readonly transfer: (
    amount: bigint,
    recipientHex: string,
  ) => Promise<TransactionResult | null>;
}

export interface PolicyRunResult {
  readonly decision: PaymentPolicyDecision;
  readonly transaction: TransactionResult | null;
  readonly logs: readonly PolicyLogEntry[];
}

export async function runAutomaticPaymentPolicy(
  input: PolicyRunInput,
  dependencies: PolicyRunnerDependencies,
  onLog?: (entry: PolicyLogEntry) => void,
): Promise<PolicyRunResult> {
  const availableBalance = await dependencies.readBalance();
  const decision = evaluatePaymentPolicy({
    availableBalance,
    requestedAmount: input.requestedAmount,
    perTransferLimit: input.perTransferLimit,
  });
  const logs: PolicyLogEntry[] = [];

  const emit = (
    stage: PolicyLogStage,
    code: string,
    message: string,
    localInputs?: PaymentPolicyInput,
  ): void => {
    const entry: PolicyLogEntry = {
      sequence: logs.length + 1,
      stage,
      code,
      message,
      ...(localInputs ? { localInputs } : {}),
    };
    logs.push(entry);
    onLog?.(entry);
  };

  emit('evaluated', decision.code, 'Evaluated local payment policy.', decision.input);

  if (!decision.approved) {
    emit('rejected', decision.code, decision.summary);
    return { decision, transaction: null, logs };
  }

  emit('approved', decision.code, decision.summary);
  emit('submitted', 'transfer_submitted', 'Submitted one approved transfer.');

  try {
    const transaction = await dependencies.transfer(
      decision.amount,
      input.recipientHex,
    );
    if (transaction == null) {
      emit('failed', 'transfer_failed', 'The approved transfer did not confirm.');
      return { decision, transaction: null, logs };
    }

    emit('confirmed', 'transfer_confirmed', 'The approved transfer confirmed.');
    return { decision, transaction, logs };
  } catch {
    emit('failed', 'transfer_failed', 'The approved transfer did not confirm.');
    return { decision, transaction: null, logs };
  }
}

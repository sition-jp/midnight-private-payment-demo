import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluatePaymentPolicy } from '../agent/policy.ts';
import { runAutomaticPaymentPolicy } from '../agent/runner.ts';
import type { TransactionResult } from '../types/index.ts';

const syntheticRecipient = 'ab'.repeat(32);
const syntheticTransactionResult: TransactionResult = {
  txHash: 'synthetic-transaction-hash',
  status: 'confirmed',
  explorerUrl: 'https://example.invalid/transaction',
};

test('approves a valid request within balance and limit', () => {
  assert.equal(evaluatePaymentPolicy({
    availableBalance: 100n,
    requestedAmount: 20n,
    perTransferLimit: 25n,
  }).code, 'approved');
});

test('rejects insufficient balance before checking the transfer limit', () => {
  assert.equal(evaluatePaymentPolicy({
    availableBalance: 10n,
    requestedAmount: 20n,
    perTransferLimit: 25n,
  }).code, 'insufficient_balance');
});

test('rejects a request above the per-transfer limit', () => {
  assert.equal(evaluatePaymentPolicy({
    availableBalance: 100n,
    requestedAmount: 30n,
    perTransferLimit: 25n,
  }).code, 'over_limit');
});

test('rejects zero and negative amounts and limits', () => {
  for (const requestedAmount of [0n, -1n]) {
    assert.equal(evaluatePaymentPolicy({
      availableBalance: 100n,
      requestedAmount,
      perTransferLimit: 25n,
    }).code, 'invalid_amount');
  }

  for (const perTransferLimit of [0n, -1n]) {
    assert.equal(evaluatePaymentPolicy({
      availableBalance: 100n,
      requestedAmount: 20n,
      perTransferLimit,
    }).code, 'invalid_limit');
  }
});

test('runner submits exactly one approved transfer and emits sequential stages', async () => {
  let transfers = 0;
  const entries: Array<{ stage: string }> = [];

  const result = await runAutomaticPaymentPolicy(
    { requestedAmount: 20n, perTransferLimit: 25n, recipientHex: syntheticRecipient },
    {
      readBalance: async () => 100n,
      transfer: async () => {
        transfers += 1;
        return syntheticTransactionResult;
      },
    },
    (entry) => entries.push(entry),
  );

  assert.equal(transfers, 1);
  assert.deepEqual(entries.map((entry) => entry.stage), [
    'evaluated',
    'approved',
    'submitted',
    'confirmed',
  ]);
  assert.equal(result.transaction, syntheticTransactionResult);
  assert.deepEqual(result.logs.map((entry) => entry.sequence), [1, 2, 3, 4]);
  const confirmed = result.logs.find((entry) => entry.stage === 'confirmed');
  assert.equal(confirmed?.explorerUrl, syntheticTransactionResult.explorerUrl);
  assert.ok(
    result.logs
      .filter((entry) => entry.stage !== 'confirmed')
      .every((entry) => entry.explorerUrl === undefined),
  );
  const serializedLogs = JSON.stringify(
    result.logs,
    (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value,
  );
  assert.doesNotMatch(serializedLogs, new RegExp(syntheticRecipient, 'i'));
  const serializedPreConfirmationLogs = JSON.stringify(
    result.logs.slice(0, -1),
    (_key, value: unknown) => typeof value === 'bigint' ? value.toString() : value,
  );
  assert.doesNotMatch(serializedPreConfirmationLogs, /synthetic-transaction-hash/);
});

test('runner rejects without calling the transfer dependency', async () => {
  let transfers = 0;
  const result = await runAutomaticPaymentPolicy(
    { requestedAmount: 30n, perTransferLimit: 25n, recipientHex: syntheticRecipient },
    {
      readBalance: async () => 100n,
      transfer: async () => {
        transfers += 1;
        return syntheticTransactionResult;
      },
    },
  );

  assert.equal(transfers, 0);
  assert.deepEqual(result.logs.map((entry) => entry.stage), ['evaluated', 'rejected']);
  assert.equal(result.transaction, null);
});

test('runner records a failed stage when transfer returns null', async () => {
  const result = await runAutomaticPaymentPolicy(
    { requestedAmount: 20n, perTransferLimit: 25n, recipientHex: syntheticRecipient },
    {
      readBalance: async () => 100n,
      transfer: async () => null,
    },
  );

  assert.deepEqual(result.logs.map((entry) => entry.stage), [
    'evaluated',
    'approved',
    'submitted',
    'failed',
  ]);
  assert.equal(result.transaction, null);
});

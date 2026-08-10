import assert from 'node:assert/strict';
import test from 'node:test';

import {
  attachTransferDisclosure,
  extractCircuitResult,
  extractFinalizedTransactionMetadata,
  makeTransactionResult,
} from './contract-result.ts';
import type { TransactionResult, TransferDisclosureSnapshot } from '../types/index.ts';

const confirmedResult: TransactionResult = {
  txHash: 'synthetic-confirmed-hash',
  status: 'confirmed',
  blockHeight: 42,
  explorerUrl: 'https://example.invalid/tx/synthetic-confirmed-hash',
};

const syntheticDisclosure: TransferDisclosureSnapshot = {
  onChain: {
    senderPublicKey: 'aa'.repeat(32),
    recipientPublicKey: 'bb'.repeat(32),
    senderCommitment: 'cc'.repeat(32),
    recipientCommitment: 'dd'.repeat(32),
    txHash: 'synthetic-confirmed-hash',
    blockHeight: 42,
  },
  localOnly: {
    amount: 123n,
    senderBalanceAfter: 456n,
    senderSalt: 'ee'.repeat(32),
    recipientSalt: 'ff'.repeat(32),
  },
};

test('builds the current Preprod Explorer transaction URL', () => {
  assert.deepEqual(
    makeTransactionResult(
      {
        public: {
          txHash: 'b3a40853cade84d3468bc8487694b09ee33a6c554812aa3dcb214e6f95d70b07',
          blockHeight: 123,
        },
      },
      'https://preprod.midnightexplorer.com',
    ),
    {
      txHash: 'b3a40853cade84d3468bc8487694b09ee33a6c554812aa3dcb214e6f95d70b07',
      status: 'confirmed',
      blockHeight: 123,
      explorerUrl:
        'https://preprod.midnightexplorer.com/transactions/0xb3a40853cade84d3468bc8487694b09ee33a6c554812aa3dcb214e6f95d70b07',
    },
  );
});

test('extracts only public finalized transaction metadata', () => {
  const source = {
    public: { txHash: 'synthetic-hash', blockHeight: 42 },
    private: { result: 7n, nextPrivateState: { secretKey: 'must-not-escape' } },
  };

  assert.deepEqual(extractFinalizedTransactionMetadata(source), {
    txHash: 'synthetic-hash',
    blockHeight: 42,
  });
  assert.doesNotMatch(
    JSON.stringify(extractFinalizedTransactionMetadata(source)),
    /secretKey/,
  );
});

test('extracts the JS circuit return value from the SDK private envelope', () => {
  const finalizedCall = {
    public: { txHash: 'public-transaction-hash' },
    private: {
      result: 900n,
      nextPrivateState: { mustNotEscape: true },
    },
  };

  assert.equal(extractCircuitResult(finalizedCall), 900n);
});

test('does not treat similarly named public metadata as a circuit return value', () => {
  assert.equal(extractCircuitResult({ public: { result: 900n } }), undefined);
});

test('returns undefined when the SDK result envelope is missing', () => {
  assert.equal(extractCircuitResult(null), undefined);
  assert.equal(extractCircuitResult({ private: null }), undefined);
});

test('attaches a visibility disclosure to an already-confirmed transaction', () => {
  assert.deepEqual(
    attachTransferDisclosure(confirmedResult, () => syntheticDisclosure),
    { ...confirmedResult, disclosure: syntheticDisclosure },
  );
});

test('keeps a finalized transfer confirmed when disclosure enrichment fails', () => {
  const result = attachTransferDisclosure(confirmedResult, () => {
    throw new Error('synthetic disclosure failure');
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.disclosure, undefined);
  assert.deepEqual(result.postFinalizationIssue, {
    kind: 'transfer-disclosure-unavailable',
    message: 'Transaction confirmed, but visibility details are unavailable.',
  });
});

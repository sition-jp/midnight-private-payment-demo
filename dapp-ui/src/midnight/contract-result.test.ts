import assert from 'node:assert/strict';
import test from 'node:test';

import { extractCircuitResult } from './contract-result.ts';

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

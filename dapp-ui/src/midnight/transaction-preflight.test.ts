import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTransactionPreflight,
  createWalletFreshnessCheck,
  getTransactionErrorPresentation,
  isInvalidDustSpendProofError,
} from './transaction-preflight.ts';

test('recognizes ledger error 170 through a nested 1010 submission error', () => {
  const error = new Error('Transaction submission failed', {
    cause: {
      code: 1010,
      message: 'Invalid Transaction',
      data: 'Custom error: 170',
    },
  });

  assert.equal(isInvalidDustSpendProofError(error), true);
  assert.equal(isInvalidDustSpendProofError(new Error('Custom error: 1170')), false);
  assert.equal(isInvalidDustSpendProofError(new Error('Custom error: 171')), false);
});

test('runs the freshness check before constructing a transaction', async () => {
  const events: string[] = [];
  const preflight = createTransactionPreflight(async () => {
    events.push('preflight');
  });

  const result = await preflight.run(async () => {
    events.push('transaction');
    return 'confirmed';
  });

  assert.equal(result, 'confirmed');
  assert.deepEqual(events, ['preflight', 'transaction']);
});

test('fails closed before construction when wallet freshness cannot be confirmed', async () => {
  let transactionCalls = 0;
  const preflight = createTransactionPreflight(async () => {
    throw new Error('internal websocket detail');
  });

  await assert.rejects(
    preflight.run(async () => {
      transactionCalls += 1;
      return 'unreachable';
    }),
    (error: unknown) => {
      const presentation = getTransactionErrorPresentation(error);
      assert.equal(presentation.requiresReconnect, true);
      assert.match(presentation.message, /reconnect/i);
      assert.match(presentation.message, /not submitted/i);
      assert.doesNotMatch(presentation.message, /websocket detail/i);
      return true;
    },
  );

  assert.equal(transactionCalls, 0);
});

test('error 170 blocks later sends and is never retried automatically', async () => {
  let freshnessChecks = 0;
  let transactionCalls = 0;
  const preflight = createTransactionPreflight(async () => {
    freshnessChecks += 1;
  });

  await assert.rejects(
    preflight.run(async () => {
      transactionCalls += 1;
      throw new Error('1010 Invalid Transaction: Custom error: 170');
    }),
    (error: unknown) => {
      const presentation = getTransactionErrorPresentation(error);
      assert.equal(presentation.requiresReconnect, true);
      assert.match(presentation.message, /error 170/i);
      assert.match(presentation.message, /not retried/i);
      assert.doesNotMatch(presentation.message, /1010 Invalid Transaction/i);
      return true;
    },
  );

  await assert.rejects(
    preflight.run(async () => {
      transactionCalls += 1;
      return 'unreachable';
    }),
    /reconnect/i,
  );

  assert.equal(freshnessChecks, 1);
  assert.equal(transactionCalls, 1);
});

test('an unrelated submission failure is preserved and does not block the next send', async () => {
  let transactionCalls = 0;
  const preflight = createTransactionPreflight(async () => undefined);
  const ordinaryError = new Error('proof server unavailable');

  await assert.rejects(
    preflight.run(async () => {
      transactionCalls += 1;
      throw ordinaryError;
    }),
    (error: unknown) => error === ordinaryError,
  );

  const result = await preflight.run(async () => {
    transactionCalls += 1;
    return 'confirmed';
  });

  assert.equal(result, 'confirmed');
  assert.equal(transactionCalls, 2);
});

test('wallet freshness requires a strict synchronized state with usable DUST', async () => {
  const ready = createWalletFreshnessCheck(async () => true);
  await ready();

  const notReady = createWalletFreshnessCheck(async () => false);
  await assert.rejects(notReady(), (error: unknown) => {
    const presentation = getTransactionErrorPresentation(error);
    assert.equal(presentation.requiresReconnect, true);
    assert.match(presentation.message, /not submitted/i);
    return true;
  });
});

test('wallet freshness times out instead of leaving a transaction pending forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const check = createWalletFreshnessCheck(
    () => new Promise<boolean>(() => undefined),
    { timeoutMs: 30_000 },
  );

  const result = assert.rejects(check(), (error: unknown) => {
    const presentation = getTransactionErrorPresentation(error);
    assert.equal(presentation.requiresReconnect, true);
    assert.match(presentation.message, /not submitted/i);
    return true;
  });
  t.mock.timers.tick(30_000);

  await result;
});

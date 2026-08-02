import assert from 'node:assert/strict';
import test from 'node:test';
import { WalletSyncTimeoutError, withWalletSyncTimeout } from './sync-timeout.ts';

test('wallet sync operations fail with a stage-specific timeout instead of waiting forever', async () => {
  const neverCompletes = new Promise<never>(() => {});

  await assert.rejects(
    withWalletSyncTimeout(neverCompletes, 20, 'startup'),
    (error: unknown) => {
      assert.ok(error instanceof WalletSyncTimeoutError);
      assert.equal(error.stage, 'startup');
      assert.match(error.message, /20 ms/);
      return true;
    },
  );
});

test('wallet sync operations return results that complete before the deadline', async () => {
  const result = await withWalletSyncTimeout(Promise.resolve('ready'), 20, 'sync');

  assert.equal(result, 'ready');
});

test('wallet sync timeout messages present long deadlines in seconds', async () => {
  const error = new WalletSyncTimeoutError('sync', 90_000);

  assert.match(error.message, /90 seconds/);
});

test('a wallet that starts after timeout is stopped again without entering sync wait', async () => {
  const module = await import('./sync-timeout.ts');

  assert.equal(
    typeof module.runWalletSyncLifecycle,
    'function',
    'wallet sync lifecycle support should exist',
  );

  let resolveStart: (() => void) | undefined;
  let resolveLateStop: (() => void) | undefined;
  let waitCalls = 0;
  let stopCalls = 0;
  const start = new Promise<void>((resolve) => {
    resolveStart = resolve;
  });
  const lateStop = new Promise<void>((resolve) => {
    resolveLateStop = resolve;
  });

  const operation = module.runWalletSyncLifecycle({
    start: () => start,
    waitForSyncedState: async () => {
      waitCalls += 1;
      return 'ready';
    },
    stop: async () => {
      stopCalls += 1;
      if (stopCalls === 2) resolveLateStop?.();
    },
  }, 20);

  await assert.rejects(operation, /20 ms/);
  assert.equal(stopCalls, 1);

  resolveStart?.();
  await Promise.race([
    lateStop,
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('late wallet cleanup was not called')), 500);
    }),
  ]);

  assert.equal(waitCalls, 0);
  assert.equal(stopCalls, 2);
});

test('wallet lifecycle reports cleanup failure without hiding the original failure', async () => {
  const { runWalletSyncLifecycle } = await import('./sync-timeout.ts');

  await assert.rejects(
    runWalletSyncLifecycle({
      start: async () => {
        throw new Error('startup failed');
      },
      waitForSyncedState: async () => 'ready',
      stop: async () => {
        throw new Error('cleanup failed');
      },
    }, 20),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.match(String(error.errors[0]), /startup failed/);
      assert.match(String(error.errors[1]), /cleanup failed/);
      return true;
    },
  );
});

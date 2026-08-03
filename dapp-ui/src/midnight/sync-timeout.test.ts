import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isIdleWalletSyncTimeout,
  runWalletSyncLifecycle,
  WalletSyncTimeoutError,
  withWalletSyncTimeout,
} from './sync-timeout.ts';

function progress(current: bigint, total: bigint) {
  return {
    shielded: { current, total, isConnected: true },
    unshielded: { current: 10n, total: 10n, isConnected: true },
    dust: { current: 20n, total: 20n, isConnected: true },
  };
}

test('wallet sync operations fail with a stage-specific timeout instead of waiting forever', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const neverCompletes = new Promise<never>(() => {});
  const operation = withWalletSyncTimeout(neverCompletes, 20, 'startup');
  t.mock.timers.tick(20);

  await assert.rejects(
    operation,
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

test('only an idle wallet sync timeout qualifies for a fresh-state retry', () => {
  assert.equal(
    isIdleWalletSyncTimeout(new WalletSyncTimeoutError('sync', 60_000, 'idle')),
    true,
  );
  assert.equal(
    isIdleWalletSyncTimeout(new WalletSyncTimeoutError('sync', 60_000, 'absolute')),
    false,
  );
  assert.equal(isIdleWalletSyncTimeout(new Error('idle')), false);
});

test('a wallet that starts after timeout is stopped again without entering sync wait', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
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

  const operation = runWalletSyncLifecycle({
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

  t.mock.timers.tick(20);
  await assert.rejects(operation, /20 ms/);
  assert.equal(stopCalls, 1);

  resolveStart?.();
  await lateStop;

  assert.equal(waitCalls, 0);
  assert.equal(stopCalls, 2);
});

test('a timeout after startup stops the active wallet only once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let rejectWait: ((error: Error) => void) | undefined;
  let stopCalls = 0;
  const waiting = new Promise<never>((_resolve, reject) => {
    rejectWait = reject;
  });

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => waiting,
    stop: async () => {
      stopCalls += 1;
      rejectWait?.(new Error('wallet stopped'));
    },
  }, 20);

  await Promise.resolve();
  t.mock.timers.tick(20);

  await assert.rejects(operation, WalletSyncTimeoutError);
  await Promise.resolve();
  assert.equal(stopCalls, 1);
});

test('wallet lifecycle reports cleanup failure without hiding the original failure', async () => {
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

test('wallet lifecycle fails closed when the progress stream errors', async () => {
  let stopCalls = 0;

  await assert.rejects(
    runWalletSyncLifecycle({
      start: async () => undefined,
      waitForSyncedState: () => new Promise<never>(() => {}),
      stop: async () => {
        stopCalls += 1;
      },
      subscribeProgress: (_next, onError) => {
        onError(new Error('progress stream failed'));
        return () => undefined;
      },
    }, 20),
    /progress stream failed/,
  );

  assert.equal(stopCalls, 1);
});

test('wallet lifecycle keeps waiting while applied positions continue to advance', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let listener: ((value: ReturnType<typeof progress>) => void) | undefined;
  let resolveSynced: ((value: string) => void) | undefined;
  const synced = new Promise<string>((resolve) => {
    resolveSynced = resolve;
  });
  const observed: ReturnType<typeof progress>[] = [];

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => synced,
    stop: async () => undefined,
    subscribeProgress: (next) => {
      listener = next;
      next(progress(0n, 5n));
      return () => {
        listener = undefined;
      };
    },
  }, {
    idleTimeoutMs: 40,
    absoluteTimeoutMs: 250,
    onProgress: (value) => observed.push(value),
  });

  t.mock.timers.tick(30);
  listener?.(progress(1n, 5n));
  t.mock.timers.tick(30);
  listener?.(progress(2n, 5n));
  t.mock.timers.tick(30);
  listener?.(progress(3n, 5n));
  resolveSynced?.('ready');

  assert.equal(await operation, 'ready');
  assert.equal(observed.at(-1)?.shielded.current, 3n);
  assert.equal(listener, undefined, 'progress subscription should be released');
});

test('wallet lifecycle throttles UI progress reports without throttling sync progress', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  let listener: ((value: ReturnType<typeof progress>) => void) | undefined;
  let resolveSynced: ((value: string) => void) | undefined;
  const synced = new Promise<string>((resolve) => {
    resolveSynced = resolve;
  });
  const observed: ReturnType<typeof progress>[] = [];

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => synced,
    stop: async () => undefined,
    subscribeProgress: (next) => {
      listener = next;
      next(progress(0n, 5n));
      return () => {
        listener = undefined;
      };
    },
  }, {
    idleTimeoutMs: 1_000,
    absoluteTimeoutMs: 2_000,
    progressReportIntervalMs: 250,
    onProgress: (value) => observed.push(value),
  });

  listener?.(progress(1n, 5n));
  t.mock.timers.tick(249);
  listener?.(progress(2n, 5n));
  t.mock.timers.tick(1);
  listener?.(progress(3n, 5n));
  resolveSynced?.('ready');

  assert.equal(await operation, 'ready');
  assert.deepEqual(observed.map((value) => value.shielded.current), [0n, 3n]);
});

test('wallet lifecycle treats total-only movement as stalled applied progress', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let listener: ((value: ReturnType<typeof progress>) => void) | undefined;

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => new Promise<never>(() => {}),
    stop: async () => undefined,
    subscribeProgress: (next) => {
      listener = next;
      next(progress(7n, 10n));
      return () => {
        listener = undefined;
      };
    },
  }, {
    idleTimeoutMs: 40,
    absoluteTimeoutMs: 250,
  });

  t.mock.timers.tick(15);
  listener?.(progress(7n, 11n));
  t.mock.timers.tick(15);
  listener?.(progress(7n, 12n));
  t.mock.timers.tick(10);

  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof WalletSyncTimeoutError);
    assert.equal(error.reason, 'idle');
    assert.match(error.message, /no applied progress/i);
    return true;
  });
});

test('wallet lifecycle does not treat an applied-position rollback as progress', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let listener: ((value: ReturnType<typeof progress>) => void) | undefined;

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => new Promise<never>(() => {}),
    stop: async () => undefined,
    subscribeProgress: (next) => {
      listener = next;
      next(progress(7n, 10n));
      return () => {
        listener = undefined;
      };
    },
  }, {
    idleTimeoutMs: 60,
    absoluteTimeoutMs: 250,
  });

  t.mock.timers.tick(45);
  listener?.(progress(6n, 10n));
  t.mock.timers.tick(15);

  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof WalletSyncTimeoutError);
    assert.equal(error.reason, 'idle');
    return true;
  });
});

test('wallet lifecycle enforces an absolute limit even while progress advances', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let listener: ((value: ReturnType<typeof progress>) => void) | undefined;

  const operation = runWalletSyncLifecycle({
    start: async () => undefined,
    waitForSyncedState: () => new Promise<never>(() => {}),
    stop: async () => undefined,
    subscribeProgress: (next) => {
      listener = next;
      next(progress(0n, 100n));
      return () => {
        listener = undefined;
      };
    },
  }, {
    idleTimeoutMs: 30,
    absoluteTimeoutMs: 75,
  });

  t.mock.timers.tick(20);
  listener?.(progress(1n, 100n));
  t.mock.timers.tick(20);
  listener?.(progress(2n, 100n));
  t.mock.timers.tick(20);
  listener?.(progress(3n, 100n));
  t.mock.timers.tick(15);

  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof WalletSyncTimeoutError);
    assert.equal(error.reason, 'absolute');
    assert.match(error.message, /absolute limit/i);
    return true;
  });
});

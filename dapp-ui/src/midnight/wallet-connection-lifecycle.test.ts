import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatestWalletConnection } from './wallet-connection-lifecycle.ts';

interface TestWalletResource {
  readonly name: string;
  stop(): Promise<void>;
}

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve: (value: T) => resolve?.(value) };
}

test('disconnect aborts a pending connection and stops its late wallet result', async () => {
  const lifecycle = createLatestWalletConnection<TestWalletResource>();
  const pending = deferred<TestWalletResource>();
  let observedSignal: AbortSignal | undefined;
  let accepted = 0;
  let stopCalls = 0;

  const connecting = lifecycle.connect(
    (signal) => {
      observedSignal = signal;
      return pending.promise;
    },
    () => {
      accepted += 1;
    },
  );

  await Promise.resolve();
  await lifecycle.disconnect();
  assert.equal(observedSignal?.aborted, true);

  pending.resolve({
    name: 'stale',
    stop: async () => {
      stopCalls += 1;
    },
  });
  await connecting;

  assert.equal(accepted, 0);
  assert.equal(stopCalls, 1);
});

test('only the newest connection generation can be accepted', async () => {
  const lifecycle = createLatestWalletConnection<TestWalletResource>();
  const first = deferred<TestWalletResource>();
  const accepted: string[] = [];
  let firstSignal: AbortSignal | undefined;
  let staleStopCalls = 0;

  const firstConnect = lifecycle.connect(
    (signal) => {
      firstSignal = signal;
      return first.promise;
    },
    (resource) => accepted.push(resource.name),
  );
  const secondConnect = lifecycle.connect(
    async () => ({ name: 'newest', stop: async () => undefined }),
    (resource) => accepted.push(resource.name),
  );

  await secondConnect;
  assert.equal(firstSignal?.aborted, true);
  first.resolve({
    name: 'stale',
    stop: async () => {
      staleStopCalls += 1;
    },
  });
  await firstConnect;

  assert.deepEqual(accepted, ['newest']);
  assert.equal(staleStopCalls, 1);
});

test('disconnect stops an accepted wallet exactly once', async () => {
  const lifecycle = createLatestWalletConnection<TestWalletResource>();
  let stopCalls = 0;

  await lifecycle.connect(
    async () => ({
      name: 'connected',
      stop: async () => {
        stopCalls += 1;
      },
    }),
    () => undefined,
  );

  await lifecycle.disconnect();
  await lifecycle.disconnect();

  assert.equal(stopCalls, 1);
});

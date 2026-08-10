import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatestDustOperation } from './dust-preparation-lifecycle.ts';

function deferred<T>() {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve: (value: T) => resolve?.(value) };
}

test('allows only one DUST operation at a time', async () => {
  const lifecycle = createLatestDustOperation<number>();
  const pending = deferred<number>();
  const first = lifecycle.run(() => pending.promise, () => undefined);

  await assert.rejects(
    lifecycle.run(async () => 2, () => undefined),
    /already running/i,
  );
  pending.resolve(1);
  await first;
});

test('cancel aborts the active operation and ignores its late result', async () => {
  const lifecycle = createLatestDustOperation<number>();
  const pending = deferred<number>();
  let observedSignal: AbortSignal | undefined;
  const accepted: number[] = [];
  const running = lifecycle.run((signal) => {
    observedSignal = signal;
    return pending.promise;
  }, (value) => accepted.push(value));

  lifecycle.cancel();
  assert.equal(observedSignal?.aborted, true);
  pending.resolve(1);
  assert.equal(await running, false);
  assert.deepEqual(accepted, []);
});

test('a completed operation can be followed by a new operation', async () => {
  const lifecycle = createLatestDustOperation<number>();
  const accepted: number[] = [];

  assert.equal(await lifecycle.run(async () => 1, (value) => accepted.push(value)), true);
  assert.equal(await lifecycle.run(async () => 2, (value) => accepted.push(value)), true);
  assert.deepEqual(accepted, [1, 2]);
});

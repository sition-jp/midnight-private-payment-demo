import assert from 'node:assert/strict';
import test from 'node:test';

import { createContractCallQueue } from './contract-serialization.ts';

test('a contract call waits for the preceding call to settle', async () => {
  const queue = createContractCallQueue();
  let releaseFirst: (() => void) | undefined;
  let markFirstStarted: (() => void) | undefined;
  const firstStarted = new Promise<void>((resolve) => {
    markFirstStarted = resolve;
  });
  const firstCanFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const events: string[] = [];

  const first = queue.run(async () => {
    events.push('first:start');
    markFirstStarted?.();
    await firstCanFinish;
    events.push('first:end');
    return 'first-result';
  });
  const second = queue.run(async () => {
    events.push('second:start');
    return 'second-result';
  });

  await firstStarted;
  assert.deepEqual(events, ['first:start']);

  releaseFirst?.();
  assert.deepEqual(await Promise.all([first, second]), ['first-result', 'second-result']);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start']);
});

test('a rejected contract call does not wedge later calls', async () => {
  const queue = createContractCallQueue();

  const rejected = queue.run(async () => {
    throw new Error('synthetic failure');
  });
  const recovered = queue.run(async () => 'recovered');

  await assert.rejects(rejected, /synthetic failure/);
  assert.equal(await recovered, 'recovered');
});

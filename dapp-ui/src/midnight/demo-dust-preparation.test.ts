import assert from 'node:assert/strict';
import test from 'node:test';

import { createDemoDustPreparation } from './demo-dust-preparation.ts';

const nativeToken = 'native-token';
const eligible = { id: 'eligible', meta: { registeredForDustGeneration: false } };
const registered = { id: 'registered', meta: { registeredForDustGeneration: true } };

function state(options: {
  balance?: bigint;
  dust?: bigint;
  coins?: readonly typeof eligible[];
} = {}) {
  return {
    unshielded: {
      balances: { [nativeToken]: options.balance ?? 1_000_000_000n },
      availableCoins: options.coins ?? [eligible, registered],
    },
    dust: { balance: () => options.dust ?? 0n },
  };
}

function fixture(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const ownDustAddress = { owner: 'self' };
  const dependencies = {
    nativeToken,
    readSyncedState: async () => calls.includes('submit')
      ? state({ dust: 1n, coins: [registered] })
      : state(),
    observeState: (listener: (value: ReturnType<typeof state>) => void) => {
      listener(state({ dust: 1n, coins: [registered] }));
      return () => calls.push('unsubscribe');
    },
    register: async (
      coins: readonly unknown[],
      verifyingKey: unknown,
      sign: (payload: Uint8Array) => unknown,
      dustAddress: unknown,
    ) => {
      calls.push('register');
      assert.deepEqual(coins, [eligible]);
      assert.equal(verifyingKey, 'night-key');
      assert.equal(dustAddress, ownDustAddress);
      assert.equal(sign(new Uint8Array([1])), 'signature');
      return { type: 'recipe' };
    },
    finalize: async () => {
      calls.push('finalize');
      return { type: 'finalized' };
    },
    submit: async () => {
      calls.push('submit');
    },
    revert: async () => {
      calls.push('revert');
    },
    nightVerifyingKey: 'night-key',
    sign: () => 'signature',
    dustAddress: ownDustAddress,
    now: () => new Date(0),
    waitTimeoutMs: 100,
    ...overrides,
  };
  return { calls, dependencies };
}

test('reads a sanitized readiness snapshot from strict synchronized state', async () => {
  const { dependencies } = fixture({
    readSyncedState: async () => state({ balance: 42n, dust: 3n }),
  });
  const capability = createDemoDustPreparation(dependencies);

  assert.deepEqual(await capability.readStatus(), {
    tNightBalance: 42n,
    hasEligibleNight: true,
    isDustReady: true,
  });
});

test('sanitizes synchronized-state read failures', async () => {
  const { dependencies } = fixture({
    readSyncedState: async () => {
      throw new Error('upstream state contained operational details');
    },
  });
  const capability = createDemoDustPreparation(dependencies);

  await assert.rejects(capability.readStatus(), (error: Error) => {
    assert.equal(error.message, 'DUST readiness is unavailable. Refresh and try again.');
    assert.doesNotMatch(error.message, /operational details/);
    return true;
  });
});

test('registers only eligible tNIGHT to the wallet own DUST address once', async () => {
  const { calls, dependencies } = fixture();
  const capability = createDemoDustPreparation(dependencies);
  const phases: string[] = [];

  const result = await capability.prepare(
    new AbortController().signal,
    (phase) => phases.push(phase),
  );

  assert.deepEqual(phases, ['registering', 'waiting-for-dust']);
  assert.deepEqual(calls, ['register', 'finalize', 'submit', 'unsubscribe']);
  assert.equal(result.isDustReady, true);
});

test('rejects preparation when no unregistered tNIGHT is available', async () => {
  const { calls, dependencies } = fixture({
    readSyncedState: async () => state({ coins: [registered] }),
  });
  const capability = createDemoDustPreparation(dependencies);

  await assert.rejects(
    capability.prepare(new AbortController().signal, () => undefined),
    /No unregistered tNIGHT is available/,
  );
  assert.deepEqual(calls, []);
});

test('reverts a booked recipe after a pre-submit failure and sanitizes the error', async () => {
  const { calls, dependencies } = fixture({
    finalize: async () => {
      calls.push('finalize');
      throw new Error('secret upstream payload');
    },
  });
  const capability = createDemoDustPreparation(dependencies);

  await assert.rejects(
    capability.prepare(new AbortController().signal, () => undefined),
    (error: Error) => {
      assert.equal(error.message, 'DUST registration could not be prepared. Refresh and try again.');
      assert.doesNotMatch(error.message, /secret upstream payload/);
      return true;
    },
  );
  assert.deepEqual(calls, ['register', 'finalize', 'revert']);
});

test('does not revert or resubmit after an ambiguous submit failure', async () => {
  const { calls, dependencies } = fixture({
    submit: async () => {
      calls.push('submit');
      throw new Error('network response contained transaction details');
    },
  });
  const capability = createDemoDustPreparation(dependencies);

  await assert.rejects(
    capability.prepare(new AbortController().signal, () => undefined),
    /Registration submission could not be confirmed.*do not register again/i,
  );
  assert.deepEqual(calls, ['register', 'finalize', 'submit']);
});

test('prevents concurrent registration operations', async () => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const { calls, dependencies } = fixture({
    submit: async () => {
      calls.push('submit');
      await pending;
    },
  });
  const capability = createDemoDustPreparation(dependencies);
  const first = capability.prepare(new AbortController().signal, () => undefined);
  await Promise.resolve();
  await Promise.resolve();

  await assert.rejects(
    capability.prepare(new AbortController().signal, () => undefined),
    /already running/i,
  );
  release?.();
  await first;
});

test('times out while waiting without registering again', async () => {
  const { calls, dependencies } = fixture({
    observeState: () => () => calls.push('unsubscribe'),
    waitTimeoutMs: 10,
  });
  const capability = createDemoDustPreparation(dependencies);

  await assert.rejects(
    capability.prepare(new AbortController().signal, () => undefined),
    /still pending.*do not register again/i,
  );
  assert.deepEqual(calls, ['register', 'finalize', 'submit', 'unsubscribe']);
});

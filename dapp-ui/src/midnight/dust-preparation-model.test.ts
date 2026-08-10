import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDustPreparationModel } from './dust-preparation-model.ts';

const funded = {
  tNightBalance: 1_000_000_000n,
  hasEligibleNight: true,
  isDustReady: false,
} as const;

test('maps wallet facts and operation phases to fail-closed DUST states', () => {
  const cases = [
    { input: { snapshot: null, phase: 'idle' as const }, state: 'unavailable' },
    {
      input: {
        snapshot: { tNightBalance: 0n, hasEligibleNight: false, isDustReady: false },
        phase: 'idle' as const,
      },
      state: 'needs-tnight',
    },
    { input: { snapshot: funded, phase: 'idle' as const }, state: 'ready-to-register' },
    { input: { snapshot: funded, phase: 'registering' as const }, state: 'registering' },
    {
      input: {
        snapshot: { ...funded, hasEligibleNight: false },
        phase: 'waiting-for-dust' as const,
      },
      state: 'waiting-for-dust',
    },
    {
      input: {
        snapshot: { ...funded, hasEligibleNight: false, isDustReady: true },
        phase: 'idle' as const,
      },
      state: 'dust-ready',
    },
    {
      input: { snapshot: funded, phase: 'idle' as const, error: 'Preparation failed' },
      state: 'error',
    },
  ] as const;

  for (const fixture of cases) {
    assert.equal(buildDustPreparationModel(fixture.input).state, fixture.state);
  }
});

test('enables registration and contract connection only in their safe states', () => {
  const readyToRegister = buildDustPreparationModel({ snapshot: funded, phase: 'idle' });
  const dustReady = buildDustPreparationModel({
    snapshot: { ...funded, hasEligibleNight: false, isDustReady: true },
    phase: 'idle',
  });
  const waiting = buildDustPreparationModel({
    snapshot: { ...funded, hasEligibleNight: false },
    phase: 'waiting-for-dust',
  });

  assert.equal(readyToRegister.canRegister, true);
  assert.equal(readyToRegister.canConnectContract, false);
  assert.equal(dustReady.canRegister, false);
  assert.equal(dustReady.canConnectContract, true);
  assert.equal(waiting.canRegister, false);
  assert.equal(waiting.canConnectContract, false);
});

test('provides the official faucet only when tNIGHT is required', () => {
  const needsFunds = buildDustPreparationModel({
    snapshot: { tNightBalance: 0n, hasEligibleNight: false, isDustReady: false },
    phase: 'idle',
  });

  assert.equal(
    needsFunds.faucetUrl,
    'https://midnight-tmnight-preprod.nethermind.dev/',
  );
  assert.match(needsFunds.description, /request.*yourself/i);
});

test('states that registration is on-chain and never implies automatic generation', () => {
  const model = buildDustPreparationModel({ snapshot: funded, phase: 'idle' });

  assert.match(model.description, /on-chain/i);
  assert.doesNotMatch(model.description, /automatically request/i);
});

test('disables registration while a refresh is running', () => {
  const model = buildDustPreparationModel({ snapshot: funded, phase: 'refreshing' });

  assert.equal(model.state, 'unavailable');
  assert.equal(model.canRefresh, false);
  assert.equal(model.canRegister, false);
  assert.equal(model.canConnectContract, false);
});

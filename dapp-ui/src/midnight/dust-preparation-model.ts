import type { DemoDustPhase, DemoDustSnapshot } from '../types/index.js';

export type DustPreparationState =
  | 'needs-tnight'
  | 'ready-to-register'
  | 'registering'
  | 'waiting-for-dust'
  | 'dust-ready'
  | 'unavailable'
  | 'error';

export interface DustPreparationModel {
  readonly state: DustPreparationState;
  readonly title: string;
  readonly description: string;
  readonly canRefresh: boolean;
  readonly canRegister: boolean;
  readonly canConnectContract: boolean;
  readonly faucetUrl?: string;
}

export interface DustPreparationModelInput {
  readonly snapshot: DemoDustSnapshot | null;
  readonly phase: DemoDustPhase;
  readonly error?: string | null;
}

const FAUCET_URL = 'https://midnight-tmnight-preprod.nethermind.dev/';

export function buildDustPreparationModel(
  input: DustPreparationModelInput,
): DustPreparationModel {
  if (input.error) {
    return {
      state: 'error',
      title: 'DUST preparation needs attention',
      description: input.error,
      canRefresh: true,
      canRegister: false,
      canConnectContract: false,
    };
  }

  if (input.phase === 'refreshing') {
    return {
      state: 'unavailable',
      title: 'Refreshing DUST readiness',
      description: 'Waiting for the synchronized Demo wallet state.',
      canRefresh: false,
      canRegister: false,
      canConnectContract: false,
    };
  }

  if (input.snapshot?.isDustReady) {
    return {
      state: 'dust-ready',
      title: 'DUST ready',
      description: 'This Demo wallet can pay Preprod transaction fees.',
      canRefresh: true,
      canRegister: false,
      canConnectContract: true,
    };
  }

  if (input.phase === 'registering') {
    return {
      state: 'registering',
      title: 'Registering tNIGHT for DUST',
      description: 'Submitting the one-time on-chain registration.',
      canRefresh: false,
      canRegister: false,
      canConnectContract: false,
    };
  }

  if (input.phase === 'waiting-for-dust') {
    return {
      state: 'waiting-for-dust',
      title: 'Waiting for DUST',
      description: 'Registration was submitted. DUST generation may take several minutes.',
      canRefresh: true,
      canRegister: false,
      canConnectContract: false,
    };
  }

  if (!input.snapshot) {
    return {
      state: 'unavailable',
      title: 'Checking DUST readiness',
      description: 'Refresh the synchronized Demo wallet state before continuing.',
      canRefresh: input.phase !== 'refreshing',
      canRegister: false,
      canConnectContract: false,
    };
  }

  if (input.snapshot.tNightBalance === 0n) {
    return {
      state: 'needs-tnight',
      title: 'Get Preprod tNIGHT',
      description: 'Open the official faucet and request tNIGHT yourself, then refresh this wallet.',
      canRefresh: input.phase !== 'refreshing',
      canRegister: false,
      canConnectContract: false,
      faucetUrl: FAUCET_URL,
    };
  }

  if (input.snapshot.hasEligibleNight) {
    return {
      state: 'ready-to-register',
      title: 'Register tNIGHT for DUST',
      description: 'This submits an on-chain registration for eligible tNIGHT owned by this Demo wallet.',
      canRefresh: true,
      canRegister: true,
      canConnectContract: false,
    };
  }

  return {
    state: 'waiting-for-dust',
    title: 'Waiting for DUST',
    description: 'No unregistered tNIGHT is available. Refresh while DUST generation continues.',
    canRefresh: input.phase !== 'refreshing',
    canRegister: false,
    canConnectContract: false,
  };
}

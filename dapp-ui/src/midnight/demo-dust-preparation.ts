import type {
  DemoDustPhase,
  DemoDustPreparationCapability,
  DemoDustSnapshot,
} from '../types/index.js';

interface NightUtxoLike {
  readonly meta: { readonly registeredForDustGeneration: boolean };
}

interface DemoWalletStateLike {
  readonly unshielded: {
    readonly balances: Readonly<Record<string, bigint>>;
    readonly availableCoins: readonly NightUtxoLike[];
  };
  readonly dust: { readonly balance: (time: Date) => bigint };
}

export interface DemoDustPreparationDependencies {
  readonly nativeToken: string;
  readonly readSyncedState: () => Promise<DemoWalletStateLike>;
  readonly observeState: (listener: (state: DemoWalletStateLike) => void) => () => void;
  readonly register: (
    coins: readonly NightUtxoLike[],
    nightVerifyingKey: unknown,
    sign: (payload: Uint8Array) => unknown,
    dustAddress: unknown,
  ) => Promise<unknown>;
  readonly finalize: (recipe: unknown) => Promise<unknown>;
  readonly submit: (transaction: unknown) => Promise<void>;
  readonly revert: (recipe: unknown) => Promise<void>;
  readonly nightVerifyingKey: unknown;
  readonly sign: (payload: Uint8Array) => unknown;
  readonly dustAddress: unknown;
  readonly now: () => Date;
  readonly waitTimeoutMs?: number;
}

const DEFAULT_WAIT_TIMEOUT_MS = 10 * 60_000;

class SafeDustPreparationError extends Error {}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new SafeDustPreparationError(
      'DUST readiness check was cancelled. Refresh later; do not register again.',
    );
  }
}

function toSnapshot(
  state: DemoWalletStateLike,
  nativeToken: string,
  now: Date,
): DemoDustSnapshot {
  return {
    tNightBalance: state.unshielded.balances[nativeToken] ?? 0n,
    hasEligibleNight: state.unshielded.availableCoins.some(
      (coin) => coin.meta.registeredForDustGeneration === false,
    ),
    isDustReady: state.dust.balance(now) > 0n,
  };
}

function waitForPositiveDust(
  dependencies: DemoDustPreparationDependencies,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => undefined;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      unsubscribe();
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(new SafeDustPreparationError(
      'DUST readiness check was cancelled. Refresh later; do not register again.',
    ));
    const timer = setTimeout(
      () => finish(new SafeDustPreparationError(
        'DUST generation is still pending. Refresh later; do not register again.',
      )),
      dependencies.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS,
    );
    signal.addEventListener('abort', onAbort, { once: true });
    const stopObserving = dependencies.observeState((state) => {
      if (state.dust.balance(dependencies.now()) > 0n) finish();
    });
    unsubscribe = stopObserving;
    if (settled) unsubscribe();
  });
}

export function createDemoDustPreparation(
  dependencies: DemoDustPreparationDependencies,
): DemoDustPreparationCapability {
  let running = false;

  const readStatus = async (): Promise<DemoDustSnapshot> => {
    try {
      const state = await dependencies.readSyncedState();
      return toSnapshot(state, dependencies.nativeToken, dependencies.now());
    } catch {
      throw new SafeDustPreparationError(
        'DUST readiness is unavailable. Refresh and try again.',
      );
    }
  };

  return {
    readStatus,
    async prepare(
      signal: AbortSignal,
      onPhase: (phase: DemoDustPhase) => void,
    ): Promise<DemoDustSnapshot> {
      if (running) throw new SafeDustPreparationError('DUST preparation is already running.');
      running = true;
      let recipe: unknown;
      let submissionStarted = false;
      try {
        throwIfAborted(signal);
        const initialState = await dependencies.readSyncedState();
        const initialSnapshot = toSnapshot(
          initialState,
          dependencies.nativeToken,
          dependencies.now(),
        );
        if (initialSnapshot.isDustReady) return initialSnapshot;
        const eligibleCoins = initialState.unshielded.availableCoins.filter(
          (coin) => coin.meta.registeredForDustGeneration === false,
        );
        if (eligibleCoins.length === 0) {
          throw new SafeDustPreparationError('No unregistered tNIGHT is available. Refresh the wallet.');
        }

        throwIfAborted(signal);
        onPhase('registering');
        recipe = await dependencies.register(
          eligibleCoins,
          dependencies.nightVerifyingKey,
          dependencies.sign,
          dependencies.dustAddress,
        );
        throwIfAborted(signal);
        const finalized = await dependencies.finalize(recipe);
        throwIfAborted(signal);
        submissionStarted = true;
        await dependencies.submit(finalized);
        onPhase('waiting-for-dust');
        await waitForPositiveDust(dependencies, signal);
        const result = await readStatus();
        if (!result.isDustReady) {
          throw new SafeDustPreparationError(
            'DUST generation is still pending. Refresh later; do not register again.',
          );
        }
        return result;
      } catch (error) {
        if (recipe !== undefined && !submissionStarted) {
          await dependencies.revert(recipe).catch(() => undefined);
        }
        if (error instanceof SafeDustPreparationError) throw error;
        if (submissionStarted) {
          throw new SafeDustPreparationError(
            'Registration submission could not be confirmed. Refresh later; do not register again.',
          );
        }
        throw new SafeDustPreparationError(
          'DUST registration could not be prepared. Refresh and try again.',
        );
      } finally {
        running = false;
      }
    },
  };
}

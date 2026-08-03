export type WalletSyncStage = 'startup' | 'sync';
export type WalletSyncTimeoutReason = 'idle' | 'absolute';

export interface WalletSyncCounter {
  readonly current: bigint;
  readonly total: bigint;
  readonly isConnected: boolean;
}

export interface WalletSyncProgressSnapshot {
  readonly shielded: WalletSyncCounter;
  readonly unshielded: WalletSyncCounter;
  readonly dust: WalletSyncCounter;
}

export interface WalletSyncTimeoutOptions {
  readonly idleTimeoutMs: number;
  readonly absoluteTimeoutMs: number;
  readonly onProgress?: (progress: WalletSyncProgressSnapshot) => void;
}

export class WalletSyncTimeoutError extends Error {
  readonly stage: WalletSyncStage;
  readonly timeoutMs: number;
  readonly reason: WalletSyncTimeoutReason;

  constructor(
    stage: WalletSyncStage,
    timeoutMs: number,
    reason: WalletSyncTimeoutReason = 'absolute',
  ) {
    const deadline = timeoutMs >= 1_000
      ? `${timeoutMs / 1_000} seconds`
      : `${timeoutMs} ms`;
    const timeoutDescription = reason === 'idle'
      ? `made no applied progress for ${deadline}`
      : `did not complete before the ${deadline} absolute limit`;
    super(`Preprod wallet ${stage} ${timeoutDescription}. `
      + 'Shielded/DUST synchronization may be delayed; try again later.');
    this.name = 'WalletSyncTimeoutError';
    this.stage = stage;
    this.timeoutMs = timeoutMs;
    this.reason = reason;
  }
}

export function withWalletSyncTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  stage: WalletSyncStage,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(
      () => reject(new WalletSyncTimeoutError(stage, timeoutMs)),
      timeoutMs,
    );
  });

  return Promise.race([operation, timeout]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  });
}

export interface WalletSyncLifecycle<T> {
  start: () => Promise<void>;
  waitForSyncedState: () => Promise<T>;
  stop: () => Promise<void>;
  subscribeProgress?: (
    listener: (progress: WalletSyncProgressSnapshot) => void,
  ) => () => void;
}

function normalizeTimeoutOptions(
  options: number | WalletSyncTimeoutOptions,
): WalletSyncTimeoutOptions {
  if (typeof options === 'number') {
    return { idleTimeoutMs: options, absoluteTimeoutMs: options };
  }
  return options;
}

function appliedPositions(progress: WalletSyncProgressSnapshot): readonly bigint[] {
  return [
    progress.shielded.current,
    progress.unshielded.current,
    progress.dust.current,
  ];
}

function positionsAdvanced(
  previousHighWaterMarks: readonly bigint[] | undefined,
  next: readonly bigint[],
): boolean {
  if (!previousHighWaterMarks) return false;
  return next.some((value, index) => value > previousHighWaterMarks[index]);
}

function updateHighWaterMarks(
  previous: readonly bigint[] | undefined,
  next: readonly bigint[],
): readonly bigint[] {
  if (!previous) return next;
  return next.map((value, index) => value > previous[index] ? value : previous[index]);
}

/**
 * Run wallet startup and synchronization as one bounded lifecycle.
 *
 * The SDK cannot cancel an in-flight start call. If it settles after the
 * deadline, the guard keeps it from entering the sync wait and stops it again.
 */
export async function runWalletSyncLifecycle<T>(
  lifecycle: WalletSyncLifecycle<T>,
  timeoutOptions: number | WalletSyncTimeoutOptions,
): Promise<T> {
  const options = normalizeTimeoutOptions(timeoutOptions);
  let deadlineExceeded = false;
  let timeoutError: WalletSyncTimeoutError | undefined;
  let idleTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let rejectDeadline: ((error: WalletSyncTimeoutError) => void) | undefined;
  let highestAppliedPositions: readonly bigint[] | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    rejectDeadline = reject;
  });

  const failForTimeout = (reason: WalletSyncTimeoutReason, timeoutMs: number) => {
    if (deadlineExceeded) return;
    deadlineExceeded = true;
    timeoutError = new WalletSyncTimeoutError('sync', timeoutMs, reason);
    rejectDeadline?.(timeoutError);
  };

  const scheduleIdleTimeout = () => {
    if (idleTimeoutId !== undefined) clearTimeout(idleTimeoutId);
    idleTimeoutId = setTimeout(
      () => failForTimeout('idle', options.idleTimeoutMs),
      options.idleTimeoutMs,
    );
  };

  const absoluteTimeoutId = setTimeout(
    () => failForTimeout('absolute', options.absoluteTimeoutMs),
    options.absoluteTimeoutMs,
  );
  scheduleIdleTimeout();

  const unsubscribeProgress = lifecycle.subscribeProgress?.((progress) => {
    options.onProgress?.(progress);
    const nextAppliedPositions = appliedPositions(progress);
    const advanced = positionsAdvanced(highestAppliedPositions, nextAppliedPositions);
    highestAppliedPositions = updateHighWaterMarks(
      highestAppliedPositions,
      nextAppliedPositions,
    );
    if (advanced) {
      scheduleIdleTimeout();
    }
  });

  const operation = (async () => {
    await lifecycle.start();
    if (deadlineExceeded) throw timeoutError;
    return lifecycle.waitForSyncedState();
  })();

  try {
    return await Promise.race([operation, deadline]);
  } catch (error) {
    if (deadlineExceeded) {
      void operation
        .finally(async () => {
          try {
            await lifecycle.stop();
          } catch {
            console.error('[Wallet] Late wallet cleanup failed');
          }
        })
        .catch(() => undefined);
    }

    try {
      await lifecycle.stop();
    } catch (cleanupError) {
      const operationMessage = error instanceof Error
        ? error.message
        : 'Wallet synchronization failed';
      throw new AggregateError(
        [error, cleanupError],
        `${operationMessage}. Wallet cleanup also failed.`,
      );
    }
    throw error;
  } finally {
    if (idleTimeoutId !== undefined) clearTimeout(idleTimeoutId);
    if (absoluteTimeoutId !== undefined) clearTimeout(absoluteTimeoutId);
    unsubscribeProgress?.();
  }
}

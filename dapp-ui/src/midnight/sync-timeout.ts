export type WalletSyncStage = 'startup' | 'sync';

export class WalletSyncTimeoutError extends Error {
  readonly stage: WalletSyncStage;
  readonly timeoutMs: number;

  constructor(
    stage: WalletSyncStage,
    timeoutMs: number,
  ) {
    const deadline = timeoutMs >= 1_000
      ? `${timeoutMs / 1_000} seconds`
      : `${timeoutMs} ms`;
    super(
      `Preprod wallet ${stage} did not complete within ${deadline}. `
      + 'Shielded/DUST synchronization may be delayed; try again later.',
    );
    this.name = 'WalletSyncTimeoutError';
    this.stage = stage;
    this.timeoutMs = timeoutMs;
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
}

/**
 * Run wallet startup and synchronization as one bounded lifecycle.
 *
 * The SDK cannot cancel an in-flight start call. If it settles after the
 * deadline, the guard keeps it from entering the sync wait and stops it again.
 */
export async function runWalletSyncLifecycle<T>(
  lifecycle: WalletSyncLifecycle<T>,
  timeoutMs: number,
): Promise<T> {
  let deadlineExceeded = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      deadlineExceeded = true;
      reject(new WalletSyncTimeoutError('sync', timeoutMs));
    }, timeoutMs);
  });

  const operation = (async () => {
    await lifecycle.start();
    if (deadlineExceeded) throw new WalletSyncTimeoutError('sync', timeoutMs);
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
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

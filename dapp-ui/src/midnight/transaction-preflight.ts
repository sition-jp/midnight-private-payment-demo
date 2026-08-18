export interface TransactionErrorPresentation {
  readonly message: string;
  readonly requiresReconnect: boolean;
}

export interface TransactionPreflight {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

type ReconnectReason = 'freshness-unavailable' | 'invalid-dust-spend-proof';

const FRESHNESS_UNAVAILABLE_MESSAGE =
  'Wallet state could not be refreshed before sending. The transaction was not submitted. '
  + 'Return to Wallet, refresh DUST status, and reconnect the contract before trying again. '
  + 'If it remains unavailable, reload the page and reconnect the wallet.';

const INVALID_DUST_SPEND_PROOF_MESSAGE =
  'DUST fee proof was rejected because the wallet state was out of date (error 170). '
  + 'The transaction was not accepted and was not retried. '
  + 'Return to Wallet, refresh DUST status, and reconnect the contract before trying again. '
  + 'If it remains unavailable, reload the page and reconnect the wallet.';

export class TransactionReconnectRequiredError extends Error {
  readonly reason: ReconnectReason;

  constructor(reason: ReconnectReason) {
    super(reason === 'invalid-dust-spend-proof'
      ? INVALID_DUST_SPEND_PROOF_MESSAGE
      : FRESHNESS_UNAVAILABLE_MESSAGE);
    this.name = 'TransactionReconnectRequiredError';
    this.reason = reason;
  }
}

function hasInvalidDustSpendProofCode(
  value: unknown,
  seen: Set<object>,
  depth: number,
): boolean {
  if (depth > 6) return false;
  if (typeof value === 'string') return /\bcustom error:\s*170\b/i.test(value);
  if (typeof value !== 'object' || value === null || seen.has(value)) return false;

  seen.add(value);
  if (value instanceof Error) {
    return hasInvalidDustSpendProofCode(value.message, seen, depth + 1)
      || hasInvalidDustSpendProofCode(value.cause, seen, depth + 1);
  }

  const record = value as Record<string, unknown>;
  return ['message', 'data', 'cause', 'error', 'details']
    .some((key) => hasInvalidDustSpendProofCode(record[key], seen, depth + 1));
}

export function isInvalidDustSpendProofError(error: unknown): boolean {
  return hasInvalidDustSpendProofCode(error, new Set<object>(), 0);
}

export function getTransactionErrorPresentation(error: unknown): TransactionErrorPresentation {
  if (error instanceof TransactionReconnectRequiredError) {
    return { message: error.message, requiresReconnect: true };
  }
  if (isInvalidDustSpendProofError(error)) {
    return {
      message: INVALID_DUST_SPEND_PROOF_MESSAGE,
      requiresReconnect: true,
    };
  }
  return {
    message: error instanceof Error ? error.message : String(error),
    requiresReconnect: false,
  };
}

export function createWalletFreshnessCheck(
  readReadyState: () => Promise<boolean>,
  options: { readonly timeoutMs?: number } = {},
): () => Promise<void> {
  return async () => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutMs = options.timeoutMs ?? 30_000;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(
        () => reject(new TransactionReconnectRequiredError('freshness-unavailable')),
        timeoutMs,
      );
    });
    try {
      if (await Promise.race([readReadyState(), timeout])) return;
    } catch (error) {
      if (error instanceof TransactionReconnectRequiredError) throw error;
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
    throw new TransactionReconnectRequiredError('freshness-unavailable');
  };
}

export function createTransactionPreflight(
  checkFreshness: () => Promise<void>,
): TransactionPreflight {
  let reconnectRequired = false;

  return {
    async run<T>(operation: () => Promise<T>): Promise<T> {
      if (reconnectRequired) {
        throw new TransactionReconnectRequiredError('freshness-unavailable');
      }

      try {
        await checkFreshness();
      } catch (error) {
        reconnectRequired = true;
        if (error instanceof TransactionReconnectRequiredError) throw error;
        throw new TransactionReconnectRequiredError('freshness-unavailable');
      }

      try {
        return await operation();
      } catch (error) {
        if (isInvalidDustSpendProofError(error)) {
          reconnectRequired = true;
          throw new TransactionReconnectRequiredError('invalid-dust-spend-proof');
        }
        throw error;
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface FinalizedTransactionMetadata {
  readonly txHash: string;
  readonly blockHeight?: number;
}

/**
 * Extract only public finalized-transaction metadata. The source envelope may
 * also contain private state and must never be returned or retained.
 */
export function extractFinalizedTransactionMetadata(
  result: unknown,
): FinalizedTransactionMetadata {
  if (!isRecord(result) || !isRecord(result.public)) {
    return { txHash: 'unknown' };
  }

  return {
    txHash: typeof result.public.txHash === 'string' ? result.public.txHash : 'unknown',
    blockHeight: typeof result.public.blockHeight === 'number'
      ? result.public.blockHeight
      : undefined,
  };
}

/**
 * Read only the JS circuit return value from Midnight's privacy-sensitive
 * finalized-call envelope. Never log, serialize, or expose the full private
 * result object.
 */
export function extractCircuitResult(result: unknown): unknown {
  if (!isRecord(result) || !isRecord(result.private)) {
    return undefined;
  }

  return result.private.result;
}

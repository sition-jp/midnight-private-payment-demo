function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

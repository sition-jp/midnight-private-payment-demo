import { deriveContractPublicKey } from './witness.ts';

function defaultRandomBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function generateRandomRecipientHex(
  randomBytes: () => Uint8Array = defaultRandomBytes,
): string {
  const secretKey = randomBytes();
  if (secretKey.length !== 32) {
    throw new Error('Recipient random source must return exactly 32 bytes');
  }

  return Array.from(deriveContractPublicKey(secretKey), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

import { deriveContractPublicKey } from './witness.ts';

function defaultRandomBytes(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function isRecipientPublicKeyHex(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

export function parseRecipientPublicKeyHex(value: string): Uint8Array {
  if (!isRecipientPublicKeyHex(value)) {
    throw new Error('Recipient public key must be exactly 64 hexadecimal characters');
  }

  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
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

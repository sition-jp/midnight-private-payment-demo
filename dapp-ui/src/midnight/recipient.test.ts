import assert from 'node:assert/strict';
import test from 'node:test';

import { generateRandomRecipientHex } from './recipient.ts';
import { deriveContractPublicKey } from './witness.ts';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

test('derives a lowercase 64-character recipient from exactly 32 random bytes', () => {
  const secret = new Uint8Array(32).fill(0xab);
  const recipient = generateRandomRecipientHex(() => secret);

  assert.match(recipient, /^[0-9a-f]{64}$/);
  assert.equal(recipient, hex(deriveContractPublicKey(secret)));
});

test('rejects random byte sources that do not return exactly 32 bytes', () => {
  assert.throws(
    () => generateRandomRecipientHex(() => new Uint8Array(31)),
    /exactly 32 bytes/i,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateRandomRecipientHex,
  isRecipientPublicKeyHex,
  parseRecipientPublicKeyHex,
} from './recipient.ts';
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

test('parses exactly 64 hexadecimal characters into 32 recipient bytes', () => {
  assert.deepEqual(
    parseRecipientPublicKeyHex('ab'.repeat(32)),
    new Uint8Array(32).fill(0xab),
  );
  assert.deepEqual(
    parseRecipientPublicKeyHex('CD'.repeat(32)),
    new Uint8Array(32).fill(0xcd),
  );
});

for (const [label, value] of [
  ['short', 'ab'.repeat(31)],
  ['long', 'ab'.repeat(33)],
  ['non-hex', `${'ab'.repeat(31)}ag`],
  ['leading whitespace', ` ${'ab'.repeat(31)}a`],
  ['trailing whitespace', `${'ab'.repeat(31)}a `],
] as const) {
  test(`rejects ${label} recipient public keys before byte decoding`, () => {
    assert.equal(isRecipientPublicKeyHex(value), false);
    assert.throws(
      () => parseRecipientPublicKeyHex(value),
      /exactly 64 hexadecimal characters/i,
    );
  });
}

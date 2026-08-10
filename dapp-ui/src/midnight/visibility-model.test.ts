import assert from 'node:assert/strict';
import test from 'node:test';

import type { TransferDisclosureSnapshot } from '../types/index.ts';
import {
  buildVisibilityModel,
  type VisibilityRow,
} from './visibility-model.ts';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const senderPublicKey = new Uint8Array(32).fill(0xaa);
const recipientPublicKey = new Uint8Array(32).fill(0xbb);
const senderCommitment = new Uint8Array(32).fill(0xcc);
const recipientCommitment = new Uint8Array(32).fill(0xdd);
const senderSalt = new Uint8Array(32).fill(0xee);
const recipientSalt = new Uint8Array(32).fill(0xff);

const disclosure: TransferDisclosureSnapshot = {
  onChain: {
    senderPublicKey: hex(senderPublicKey),
    recipientPublicKey: hex(recipientPublicKey),
    senderCommitment: hex(senderCommitment),
    recipientCommitment: hex(recipientCommitment),
    txHash: 'synthetic-transaction',
    blockHeight: 42,
  },
  localOnly: {
    amount: 1234567n,
    senderBalanceAfter: 7654321n,
    senderSalt: hex(senderSalt),
    recipientSalt: hex(recipientSalt),
  },
};

const row = (rows: readonly VisibilityRow[], label: string): string | undefined =>
  rows.find((candidate) => candidate.label === label)?.value;

test('places exact transfer values in their disclosure columns', () => {
  const one = buildVisibilityModel(disclosure, 1);

  assert.deepEqual(one.onChain.map((candidate) => candidate.label), [
    'Sender public key',
    'Recipient public key',
    'Sender commitment',
    'Recipient commitment',
    'Transaction hash',
    'Block height',
  ]);
  assert.deepEqual(one.localOnly.map((candidate) => candidate.label), [
    'Transfer amount',
    'Sender balance after transfer',
    'Sender salt',
    'Recipient salt',
  ]);

  assert.equal(row(one.onChain, 'Sender public key'), hex(senderPublicKey));
  assert.equal(row(one.onChain, 'Recipient public key'), hex(recipientPublicKey));
  assert.equal(row(one.localOnly, 'Transfer amount'), '1234567');
  assert.equal(row(one.localOnly, 'Sender balance after transfer'), '7654321');
  assert.equal(row(one.localOnly, 'Sender salt'), hex(senderSalt));
  assert.equal(row(one.localOnly, 'Recipient salt'), hex(recipientSalt));

  const localOnlyJson = JSON.stringify(one.localOnly);
  assert.doesNotMatch(localOnlyJson, new RegExp(hex(senderPublicKey), 'i'));
  assert.doesNotMatch(localOnlyJson, new RegExp(hex(recipientPublicKey), 'i'));

  const onChainJson = JSON.stringify(one.onChain);
  assert.doesNotMatch(onChainJson, new RegExp(hex(senderSalt), 'i'));
  assert.doesNotMatch(onChainJson, new RegExp(hex(recipientSalt), 'i'));
  assert.doesNotMatch(onChainJson, /1234567/);
  assert.doesNotMatch(onChainJson, /7654321/);
});

test('labels the left column as comparison-only in every repetition mode', () => {
  for (const mode of [1, 100] as const) {
    const model = buildVisibilityModel(disclosure, mode);
    assert.ok(model.publicComparisonCaption.length > 0);
    assert.match(model.publicComparisonCaption, /comparison/i);
  }
});

test('marks the repeated view as an illustration of the counterparty trail', () => {
  const repeated = buildVisibilityModel(disclosure, 100);

  assert.match(repeated.lesson, /counterparty-key trail/i);
  assert.equal(repeated.isIllustration, true);
});

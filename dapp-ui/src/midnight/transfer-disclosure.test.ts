import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTransferDisclosure } from './transfer-disclosure.ts';
import type { PrivatePaymentState } from './witness.ts';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const senderPublicKey = new Uint8Array(32).fill(0xaa);
const recipientPublicKey = new Uint8Array(32).fill(0xbb);
const senderCommitment = new Uint8Array(32).fill(0xcc);
const recipientCommitment = new Uint8Array(32).fill(0xdd);
const senderSalt = new Uint8Array(32).fill(0xee);
const recipientSalt = new Uint8Array(32).fill(0xff);

function privateState(overrides?: Partial<PrivatePaymentState>): PrivatePaymentState {
  return {
    secretKey: new Uint8Array(32).fill(0x11),
    balances: new Map([[hex(senderPublicKey), 91n]]),
    salts: new Map([
      [hex(senderPublicKey), senderSalt],
      [hex(recipientPublicKey), recipientSalt],
    ]),
    ...overrides,
  };
}

test('builds an explicit transfer disclosure without carrying secret state', () => {
  const disclosure = buildTransferDisclosure({
    senderPublicKey,
    recipientPublicKey,
    amount: 9n,
    txHash: 'synthetic-hash',
    blockHeight: 42,
    senderCommitment,
    recipientCommitment,
    nextPrivateState: privateState(),
  });

  assert.deepEqual(disclosure.onChain, {
    senderPublicKey: hex(senderPublicKey),
    recipientPublicKey: hex(recipientPublicKey),
    senderCommitment: hex(senderCommitment),
    recipientCommitment: hex(recipientCommitment),
    txHash: 'synthetic-hash',
    blockHeight: 42,
  });
  assert.equal(disclosure.localOnly.amount, 9n);
  assert.equal(disclosure.localOnly.senderBalanceAfter, 91n);
  assert.equal(disclosure.localOnly.senderSalt, hex(senderSalt));
  assert.equal(disclosure.localOnly.recipientSalt, hex(recipientSalt));
  assert.ok(!('secretKey' in disclosure.localOnly));
});

test('fails closed when finalized disclosure data is incomplete', () => {
  const incompleteState = privateState({ balances: new Map() });

  assert.throws(
    () => buildTransferDisclosure({
      senderPublicKey,
      recipientPublicKey,
      amount: 9n,
      txHash: 'synthetic-hash',
      blockHeight: 42,
      senderCommitment,
      recipientCommitment,
      nextPrivateState: incompleteState,
    }),
    /Transfer finalized, but disclosure rendering data is unavailable/,
  );
});

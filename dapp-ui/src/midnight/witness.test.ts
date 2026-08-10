import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearTransferContext,
  createInitialPrivateState,
  createTransferContext,
  createWitnesses,
  setTransferContext,
} from './witness.ts';

const secretKey = new Uint8Array(32).fill(0x11);

function witnessContext() {
  return {
    privateState: createInitialPrivateState(secretKey),
  } as never;
}

test('each witness provider reads only its contract-scoped transfer context', () => {
  const firstContext = createTransferContext();
  const secondContext = createTransferContext();
  const firstWitnesses = createWitnesses(firstContext);
  const secondWitnesses = createWitnesses(secondContext);
  const context = witnessContext();
  const firstRecipient = new Uint8Array(32).fill(0xaa);

  setTransferContext(firstContext, {
    amount: 123n,
    recipient: firstRecipient,
  });

  assert.equal(firstWitnesses.private_amount(context)[1], 123n);
  assert.deepEqual(firstWitnesses.private_recipient(context)[1], firstRecipient);
  assert.equal(secondWitnesses.private_amount(context)[1], 0n);
  assert.deepEqual(secondWitnesses.private_recipient(context)[1], new Uint8Array(32));
});

test('clearing a transfer context removes the amount and recipient bytes', () => {
  const transferContext = createTransferContext();
  const witnesses = createWitnesses(transferContext);
  const context = witnessContext();

  setTransferContext(transferContext, {
    amount: 456n,
    recipient: new Uint8Array(32).fill(0xbb),
  });
  clearTransferContext(transferContext);

  assert.equal(witnesses.private_amount(context)[1], 0n);
  assert.deepEqual(witnesses.private_recipient(context)[1], new Uint8Array(32));
});

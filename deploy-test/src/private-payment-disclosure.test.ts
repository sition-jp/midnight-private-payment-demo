import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import test from 'node:test';

import {
  CompactTypeBytes,
  CompactTypeUnsignedInteger,
  createCircuitContext,
  createConstructorContext,
  dummyContractAddress,
} from '@midnight-ntwrk/compact-runtime';

import {
  Contract,
  ledger as readLedger,
  type Witnesses,
} from '../contracts/managed/private-payment/contract/index.js';
import {
  createInitialPrivateState,
  createTransferContext,
  createWitnesses,
  deriveContractPublicKey,
  type PrivatePaymentState,
} from './private-payment-state.js';

const bytes32 = new CompactTypeBytes(32);
const uint64 = new CompactTypeUnsignedInteger(18_446_744_073_709_551_615n, 8);

function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex');
}

test('G-3b fixes derive_pk and the §2 disclosure boundary', () => {
  const senderSecret = new Uint8Array(32).fill(0x11);
  const recipientSecret = new Uint8Array(32).fill(0x22);
  const depositSalt = new Uint8Array(32).fill(0x31);
  const senderTransferSalt = new Uint8Array(32).fill(0x32);
  const recipientTransferSalt = new Uint8Array(32).fill(0x33);
  const senderPublicKey = deriveContractPublicKey(senderSecret);
  const recipientPublicKey = deriveContractPublicKey(recipientSecret);
  const transfer = createTransferContext();
  transfer.amount = 100n;
  transfer.recipientPublicKey = recipientPublicKey;

  const baseWitnesses = createWitnesses(transfer);
  const senderSalts = [depositSalt, senderTransferSalt];
  const witnesses: Witnesses<PrivatePaymentState> = {
    ...baseWitnesses,
    new_salt(context) {
      const salt = senderSalts.shift();
      assert.ok(salt, 'unexpected sender salt request');
      return [context.privateState, salt];
    },
    new_recipient_salt(context) {
      return [context.privateState, recipientTransferSalt];
    },
  };

  const contract = new Contract(witnesses);
  const initialPrivateState = createInitialPrivateState(senderSecret);
  const initial = contract.initialState(
    createConstructorContext(initialPrivateState, { bytes: new Uint8Array(32) }),
  );
  const context = createCircuitContext(
    dummyContractAddress(),
    initial.currentZswapLocalState,
    initial.currentContractState,
    initial.currentPrivateState,
  );

  const deposit = contract.circuits.deposit(context, 1_000n);
  const afterDeposit = readLedger(deposit.context.currentQueryContext.state);
  assert.deepEqual(
    [...afterDeposit.balance_commitments].map(([key]) => key),
    [senderPublicKey],
    'deriveContractPublicKey must match the contract derive_pk used by deposit',
  );

  const privateTransfer = contract.circuits.private_transfer(deposit.context);
  const publicEntries = [...readLedger(
    privateTransfer.context.currentQueryContext.state,
  ).balance_commitments];
  const publicKeys = publicEntries.map(([key]) => hex(key)).sort();
  assert.deepEqual(
    publicKeys,
    [hex(senderPublicKey), hex(recipientPublicKey)].sort(),
    'sender_pk and recipient_pk must remain public ledger Map keys',
  );

  assert.deepEqual(privateTransfer.proofData.input, { value: [], alignment: [] });
  assert.deepEqual(privateTransfer.proofData.output, { value: [], alignment: [] });
  assert.ok(
    privateTransfer.proofData.privateTranscriptOutputs.some((output) =>
      isDeepStrictEqual(output.value, uint64.toValue(100n))),
    'transfer amount must be a private witness output, not a public input/output',
  );
  assert.ok(
    privateTransfer.proofData.privateTranscriptOutputs.some((output) =>
      isDeepStrictEqual(output.value, uint64.toValue(1_000n))),
    'the sender balance must be supplied through the private transcript',
  );
  for (const salt of [depositSalt, senderTransferSalt, recipientTransferSalt]) {
    assert.ok(
      privateTransfer.proofData.privateTranscriptOutputs.some((output) =>
        isDeepStrictEqual(output.value, bytes32.toValue(salt))),
      'salts used by private_transfer must remain in the private transcript',
    );
  }

  const privateState = privateTransfer.context.currentPrivateState;
  assert.equal(privateState.balances.get(hex(senderPublicKey)), 900n);
  assert.equal(privateState.balances.get(hex(recipientPublicKey)), 100n);
  assert.deepEqual(privateState.salts.get(hex(senderPublicKey)), senderTransferSalt);
  assert.deepEqual(privateState.salts.get(hex(recipientPublicKey)), recipientTransferSalt);
  for (const [, commitment] of publicEntries) {
    assert.equal(commitment.length, 32);
    assert.notDeepEqual(commitment, senderTransferSalt);
    assert.notDeepEqual(commitment, recipientTransferSalt);
  }

  const checkBalance = contract.circuits.check_balance(privateTransfer.context);
  assert.equal(checkBalance.result, 900n);
  assert.deepEqual(checkBalance.proofData.output, {
    value: uint64.toValue(900n),
    alignment: uint64.alignment(),
  }, 'check_balance must disclose the returned balance as a public circuit output');
});

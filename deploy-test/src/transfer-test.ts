/**
 * Execute the proof-of-concept private balance update.
 * The amount is hidden; sender and recipient public keys remain visible on-chain.
 */
import * as crypto from 'node:crypto';

import { openExistingContract } from './contract-runtime.js';
import { deriveContractPublicKey } from './private-payment-state.js';
import { loadWalletSeed } from './runtime-files.js';

function readAmount(): bigint {
  const value = process.env.MIDNIGHT_TRANSFER_AMOUNT ?? '100';
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error('MIDNIGHT_TRANSFER_AMOUNT must be a positive integer');
  }
  return BigInt(value);
}

let session: Awaited<ReturnType<typeof openExistingContract>> | undefined;
try {
  session = await openExistingContract(loadWalletSeed());
  session.transfer.amount = readAmount();
  session.transfer.recipientPublicKey = deriveContractPublicKey(
    crypto.getRandomValues(new Uint8Array(32)),
  );
  await session.contract.callTx.private_transfer();
  console.log('PRIVATE_TRANSFER_OK');
  console.log('Amount hidden; sender and recipient public keys visible on-chain.');
  console.log('PoC only: recipient private-state delivery is not implemented.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`PRIVATE_TRANSFER_FAILED: ${message}`);
  process.exitCode = 1;
} finally {
  if (session) await session.close();
}

/** Initialize or update the demo balance commitment; this does not transfer tNIGHT. */
import { openExistingContract } from './contract-runtime.js';
import { loadWalletSeed } from './runtime-files.js';

function readAmount(): bigint {
  const value = process.env.MIDNIGHT_DEPOSIT_AMOUNT ?? '1000';
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error('MIDNIGHT_DEPOSIT_AMOUNT must be a positive integer');
  }
  return BigInt(value);
}

let session: Awaited<ReturnType<typeof openExistingContract>> | undefined;
try {
  session = await openExistingContract(loadWalletSeed());
  await session.contract.callTx.deposit(readAmount());
  console.log('DEPOSIT_OK');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DEPOSIT_FAILED: ${message}`);
  process.exitCode = 1;
} finally {
  if (session) await session.close();
}

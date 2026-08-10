/** Call check_balance, whose return value is disclosed publicly by the contract. */
import { openExistingContract } from './contract-runtime.js';
import { loadWalletSeed } from './runtime-files.js';

let session: Awaited<ReturnType<typeof openExistingContract>> | undefined;
try {
  session = await openExistingContract(loadWalletSeed());
  await session.contract.callTx.check_balance();
  console.log('CHECK_BALANCE_PUBLIC_DISCLOSURE_OK');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CHECK_BALANCE_FAILED: ${message}`);
  process.exitCode = 1;
} finally {
  if (session) await session.close();
}

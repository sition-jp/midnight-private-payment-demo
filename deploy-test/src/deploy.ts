/** Deploy the current Compact 0.31.1 contract with the shared SDK 4.1.1 wallet runtime. */
import { deployNewContract } from './contract-runtime.js';
import { loadWalletSeed } from './runtime-files.js';

let session: Awaited<ReturnType<typeof deployNewContract>> | undefined;
try {
  session = await deployNewContract(loadWalletSeed());
  console.log('DEPLOYMENT_OK');
  console.log('Deployment metadata saved locally with restricted permissions.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`DEPLOYMENT_FAILED: ${message}`);
  process.exitCode = 1;
} finally {
  if (session) await session.close();
}

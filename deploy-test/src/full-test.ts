/**
 * G-3 preprod integration test.
 *
 * Executes deposit -> private_transfer -> check_balance against an existing
 * deployment without deploying a contract, registering DUST, or moving NIGHT.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';

import {
  createInitialPrivateState,
  createTransferContext,
  createWitnesses,
  deriveContractPublicKey,
} from './private-payment-state.js';
import { loadDeployment, loadWalletSeed } from './runtime-files.js';
import {
  createMidnightProviders,
  createWalletFromSeed,
  installWalletLogRedaction,
  saveWalletCache,
} from './wallet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'private-payment',
);
const contractModulePath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractModulePath)) {
  throw new Error('Contract is not compiled. Run npm run compile:private');
}

const contractModule = await import(pathToFileURL(contractModulePath).href);
const transferContext = createTransferContext();
const compiledContract = (CompiledContract as any)
  .make('private-payment', contractModule.Contract)
  .pipe(
    (CompiledContract as any).withWitnesses(createWitnesses(transferContext)),
    (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
  );

function reportStep(step: string): void {
  console.log(`G3_${step}_OK`);
}

async function waitForWalletSync(walletContext: Awaited<ReturnType<typeof createWalletFromSeed>>): Promise<void> {
  const lastBucket = {
    SHIELDED: -1,
    UNSHIELDED: -1,
    DUST: -1,
  };
  const subscription = walletContext.wallet.state().subscribe((state) => {
    const components = [
      ['SHIELDED', state.shielded.progress],
      ['DUST', state.dust.progress],
    ] as const;
    for (const [name, progress] of components) {
      if (progress.highestRelevantWalletIndex === 0n) continue;
      const percent = Number(
        (progress.appliedIndex * 100n) / progress.highestRelevantWalletIndex,
      );
      const bucket = Math.min(Math.floor(percent / 10) * 10, 100);
      if (bucket > lastBucket[name]) {
        lastBucket[name] = bucket;
        console.log(`G3_${name}_SYNC_PROGRESS=${bucket}%`);
      }
    }
    const unshielded = state.unshielded.progress;
    if (unshielded.highestTransactionId !== 0n) {
      const percent = Number(
        (unshielded.appliedId * 100n) / unshielded.highestTransactionId,
      );
      const bucket = Math.min(Math.floor(percent / 10) * 10, 100);
      if (bucket > lastBucket.UNSHIELDED) {
        lastBucket.UNSHIELDED = bucket;
        console.log(`G3_UNSHIELDED_SYNC_PROGRESS=${bucket}%`);
      }
    }
  });

  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cacheWrite = Promise.resolve();
  const cacheInterval = setInterval(() => {
    cacheWrite = cacheWrite
      .then(async () => {
        if (await saveWalletCache(walletContext)) console.log('WALLET_CACHE_SAVED');
      })
      .catch(() => console.warn('WALLET_CACHE_SAVE_FAILED'));
  }, 60_000);
  try {
    await Promise.race([
      walletContext.wallet.waitForSyncedState(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Wallet sync timed out after 60 minutes')),
          60 * 60 * 1_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    clearInterval(cacheInterval);
    await cacheWrite;
    if (await saveWalletCache(walletContext)) console.log('WALLET_CACHE_SAVED');
    subscription.unsubscribe();
  }
}

async function main(): Promise<void> {
  const restoreWalletLogs = installWalletLogRedaction();
  const deployment = loadDeployment();
  const seed = loadWalletSeed();
  let walletContext: Awaited<ReturnType<typeof createWalletFromSeed>> | undefined;

  try {
    walletContext = await createWalletFromSeed(seed);
    console.log('G3_WALLET_SYNC_START');
    await waitForWalletSync(walletContext);
    console.log('G3_WALLET_SYNC_OK');

    const providers = await createMidnightProviders(
      walletContext,
      zkConfigPath,
      'private-payment-g3-v2',
    );
    const initialContractSecret = crypto.getRandomValues(new Uint8Array(32));
    const contract = await (findDeployedContract as any)(providers, {
      compiledContract,
      contractAddress: deployment.contractAddress,
      privateStateId: 'privatePaymentG3V2',
      initialPrivateState: createInitialPrivateState(initialContractSecret),
    });

    await contract.callTx.deposit(1_000n);
    reportStep('DEPOSIT');

    const recipientSecret = crypto.getRandomValues(new Uint8Array(32));
    transferContext.amount = 100n;
    transferContext.recipientPublicKey = deriveContractPublicKey(recipientSecret);
    await contract.callTx.private_transfer();
    reportStep('PRIVATE_TRANSFER');

    await contract.callTx.check_balance();
    reportStep('CHECK_BALANCE');
    console.log('G3_COMPLETE');
  } finally {
    if (walletContext) await walletContext.wallet.stop();
    restoreWalletLogs();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`G3_FAILED: ${message}`);
  process.exitCode = 1;
});

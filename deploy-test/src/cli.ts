/** Interactive CLI backed by the same SDK 4.1.1 wallet runtime as G-3. */
import * as crypto from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { openExistingContract } from './contract-runtime.js';
import { deriveContractPublicKey } from './private-payment-state.js';
import { loadWalletSeed } from './runtime-files.js';

function parsePositiveInteger(value: string, label: string): bigint {
  if (!/^[1-9][0-9]*$/.test(value.trim())) {
    throw new Error(`${label} must be a positive integer`);
  }
  return BigInt(value.trim());
}

const rl = createInterface({ input, output });
let session: Awaited<ReturnType<typeof openExistingContract>> | undefined;
try {
  session = await openExistingContract(loadWalletSeed());
  console.log('CLI_READY');
  console.log('This PoC hides amounts, not sender or recipient public keys.');

  while (true) {
    const choice = (await rl.question(
      '\n[1] Update demo balance  [2] Private balance update  [3] Publicly disclose balance  [q] Quit\n> ',
    )).trim().toLowerCase();
    if (choice === 'q') break;

    if (choice === '1') {
      const amount = parsePositiveInteger(await rl.question('Demo balance increment: '), 'Amount');
      await session.contract.callTx.deposit(amount);
      console.log('DEPOSIT_OK (no tNIGHT moved)');
      continue;
    }

    if (choice === '2') {
      session.transfer.amount = parsePositiveInteger(
        await rl.question('Hidden transfer amount: '),
        'Amount',
      );
      session.transfer.recipientPublicKey = deriveContractPublicKey(
        crypto.getRandomValues(new Uint8Array(32)),
      );
      await session.contract.callTx.private_transfer();
      console.log('PRIVATE_TRANSFER_OK (recipient public key remains visible on-chain)');
      continue;
    }

    if (choice === '3') {
      await session.contract.callTx.check_balance();
      console.log('CHECK_BALANCE_PUBLIC_DISCLOSURE_OK');
      continue;
    }

    console.log('Unknown selection');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CLI_FAILED: ${message}`);
  process.exitCode = 1;
} finally {
  rl.close();
  if (session) await session.close();
}

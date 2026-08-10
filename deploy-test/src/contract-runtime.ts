import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import {
  deployContract,
  findDeployedContract,
} from '@midnight-ntwrk/midnight-js-contracts';

import {
  createInitialPrivateState,
  createTransferContext,
  createWitnesses,
  type TransferContext,
} from './private-payment-state.js';
import {
  loadDeployment,
  saveDeployment,
} from './runtime-files.js';
import {
  createMidnightProviders,
  createWalletFromSeed,
  installWalletLogRedaction,
  saveWalletCache,
  type WalletContext,
} from './wallet.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(
  __dirname,
  '..',
  'contracts',
  'managed',
  'private-payment',
);
const contractModulePath = path.join(zkConfigPath, 'contract', 'index.js');
const privateStateId = 'privatePaymentCliV2';
const privateStateStoreName = 'private-payment-cli-v2';

type ContractHandle = {
  readonly callTx: {
    readonly deposit: (amount: bigint) => Promise<unknown>;
    readonly private_transfer: () => Promise<unknown>;
    readonly check_balance: () => Promise<unknown>;
  };
};

export interface ContractSession {
  readonly contract: ContractHandle;
  readonly transfer: TransferContext;
  readonly close: () => Promise<void>;
}

interface BaseRuntime {
  readonly walletContext: WalletContext;
  readonly providers: Awaited<ReturnType<typeof createMidnightProviders>>;
  readonly compiledContract: unknown;
  readonly transfer: TransferContext;
  readonly initialPrivateState: ReturnType<typeof createInitialPrivateState>;
  readonly close: () => Promise<void>;
}

function deriveContractSecret(seed: string): Uint8Array {
  return crypto
    .createHash('sha256')
    .update(Buffer.from(seed, 'hex'))
    .update('midnight-private-payment-cli-v2')
    .digest();
}

async function startBaseRuntime(seed: string): Promise<BaseRuntime> {
  if (!fs.existsSync(contractModulePath)) {
    throw new Error('Contract is not compiled. Run npm run compile:private');
  }

  const restoreWalletLogs = installWalletLogRedaction();
  let walletContext: WalletContext | undefined;
  try {
    const contractModule = await import(pathToFileURL(contractModulePath).href);
    const transfer = createTransferContext();
    const compiledContract = (CompiledContract as any)
      .make('private-payment', contractModule.Contract)
      .pipe(
        (CompiledContract as any).withWitnesses(createWitnesses(transfer)),
        (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
      );

    walletContext = await createWalletFromSeed(seed);
    console.log('WALLET_SYNC_START');
    const providers = await createMidnightProviders(
      walletContext,
      zkConfigPath,
      privateStateStoreName,
    );
    console.log('WALLET_SYNC_OK');

    let closed = false;
    return {
      walletContext,
      providers,
      compiledContract,
      transfer,
      initialPrivateState: createInitialPrivateState(deriveContractSecret(seed)),
      async close() {
        if (closed) return;
        closed = true;
        try {
          if (await saveWalletCache(walletContext!)) console.log('WALLET_CACHE_SAVED');
        } catch {
          console.warn('WALLET_CACHE_SAVE_FAILED');
        } finally {
          await walletContext!.wallet.stop();
          restoreWalletLogs();
        }
      },
    };
  } catch (error) {
    if (walletContext) await walletContext.wallet.stop();
    restoreWalletLogs();
    throw error;
  }
}

export async function openExistingContract(seed: string): Promise<ContractSession> {
  const deployment = loadDeployment();
  if (deployment.network && deployment.network !== 'preprod') {
    throw new Error('Deployment network is not preprod');
  }

  const runtime = await startBaseRuntime(seed);
  try {
    const storedPrivateState = await runtime.providers.privateStateProvider.get(privateStateId);
    const options = storedPrivateState == null
      ? {
          compiledContract: runtime.compiledContract,
          contractAddress: deployment.contractAddress,
          privateStateId,
          initialPrivateState: runtime.initialPrivateState,
        }
      : {
          compiledContract: runtime.compiledContract,
          contractAddress: deployment.contractAddress,
          privateStateId,
        };
    const contract = await (findDeployedContract as any)(runtime.providers, options);
    return {
      contract,
      transfer: runtime.transfer,
      close: runtime.close,
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

export async function deployNewContract(seed: string): Promise<ContractSession> {
  const runtime = await startBaseRuntime(seed);
  try {
    const contract = await (deployContract as any)(runtime.providers, {
      compiledContract: runtime.compiledContract,
      privateStateId,
      initialPrivateState: runtime.initialPrivateState,
    });
    saveDeployment({
      contractAddress: contract.deployTxData.public.contractAddress,
      network: 'preprod',
    });
    return {
      contract,
      transfer: runtime.transfer,
      close: runtime.close,
    };
  } catch (error) {
    await runtime.close();
    throw error;
  }
}

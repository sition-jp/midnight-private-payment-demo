/**
 * Non-mutating G-2 compatibility probe for an existing preprod deployment.
 *
 * The deployment address is read from an ignored runtime file. A fresh,
 * temporary private-state database is used so this probe never touches the
 * operator's persisted contract private state or wallet seed.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';

const INDEXER_HTTP = 'https://indexer.preprod.midnight.network/api/v4/graphql';
const INDEXER_WS = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';
const deploymentFile = process.env.MIDNIGHT_DEPLOYMENT_FILE ?? 'deployment.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'private-payment');
const contractModulePath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(deploymentFile)) {
  throw new Error('G2_DEPLOYMENT_FILE_MISSING');
}
if (!fs.existsSync(contractModulePath)) {
  throw new Error('G2_COMPILED_CONTRACT_MISSING');
}

const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8')) as {
  contractAddress?: string;
};
if (!deployment.contractAddress) {
  throw new Error('G2_CONTRACT_ADDRESS_MISSING');
}

const PrivatePayment = await import(pathToFileURL(contractModulePath).href);
const unavailableWitness = () => {
  throw new Error('G2_UNEXPECTED_WITNESS_CALL');
};
const compiledContract = (CompiledContract as any).make('private-payment', PrivatePayment.Contract).pipe(
  (CompiledContract as any).withWitnesses({
    local_secret_key: unavailableWitness,
    private_amount: unavailableWitness,
    private_recipient: unavailableWitness,
    get_balance: unavailableWitness,
    get_salt: unavailableWitness,
    new_salt: unavailableWitness,
    store_balance: unavailableWitness,
    get_recipient_balance: unavailableWitness,
    get_recipient_salt: unavailableWitness,
    new_recipient_salt: unavailableWitness,
    store_recipient_balance: unavailableWitness,
  }),
  (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
);

const temporaryDatabase = fs.mkdtempSync(path.join(os.tmpdir(), 'midnight-demo-v2-g2-'));
const privateStateProvider = levelPrivateStateProvider({
  midnightDbName: path.join(temporaryDatabase, 'private-state'),
  privateStateStoreName: 'private-states',
  signingKeyStoreName: 'signing-keys',
  privateStoragePasswordProvider: () => 'G2_Compatibility#2026Aa',
  accountId: 'g2-compatibility-probe',
});

const unavailableProvider = new Proxy(
  {},
  {
    get: (_target, property) => () => {
      throw new Error(`G2_UNEXPECTED_TRANSACTION_PROVIDER_CALL:${String(property)}`);
    },
  },
);

try {
  await (findDeployedContract as any)(
    {
      privateStateProvider,
      publicDataProvider: indexerPublicDataProvider(INDEXER_HTTP, INDEXER_WS),
      walletProvider: unavailableProvider,
      midnightProvider: unavailableProvider,
      zkConfigProvider: new NodeZkConfigProvider(zkConfigPath),
      proofProvider: unavailableProvider,
    },
    {
      compiledContract,
      contractAddress: deployment.contractAddress,
      privateStateId: 'privatePaymentG2Probe',
      initialPrivateState: {},
    },
  );
  console.log('G2_EXISTING_CONTRACT_COMPATIBLE');
} catch (error) {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const redactedMessage = rawMessage.replaceAll(deployment.contractAddress, '[redacted-contract]');
  console.error(`G2_EXISTING_CONTRACT_PROBE_FAILED: ${redactedMessage}`);
  process.exitCode = 1;
}

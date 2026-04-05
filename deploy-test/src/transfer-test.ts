/**
 * Private transfer test for private-payment contract.
 * Connects to a deployed contract, then executes private_transfer
 * with amount=100 to a randomly generated recipient public key.
 *
 * Prerequisites:
 *   1. npm run deploy      (deploys contract, saves deployment.json)
 *   2. npm run deposit-test (deposits funds so sender has balance)
 *
 * Usage: npm run transfer-test
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';
import * as Rx from 'rxjs';
import { Buffer } from 'buffer';

import { findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { setNetworkId, getNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import * as ledger from '@midnight-ntwrk/ledger-v7';
import { WalletFacade } from '@midnight-ntwrk/wallet-sdk-facade';
import { DustWallet } from '@midnight-ntwrk/wallet-sdk-dust-wallet';
import { HDWallet, Roles } from '@midnight-ntwrk/wallet-sdk-hd';
import { ShieldedWallet } from '@midnight-ntwrk/wallet-sdk-shielded';
import { createKeystore, InMemoryTransactionHistoryStorage, PublicKey, UnshieldedWallet } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import { CompiledContract } from '@midnight-ntwrk/compact-js';

import { createWitnesses, createInitialPrivateState, type PrivatePaymentState } from './deploy.js';
import type { Witnesses, Ledger } from '../contracts/managed/private-payment/contract/index.js';
import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

setNetworkId('preprod');

const CONFIG = {
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
  explorer: 'https://explorer.preprod.midnight.network',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'private-payment');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('\n  Contract not compiled! Run: npm run compile:private\n');
  process.exit(1);
}

const PrivatePayment = await import(pathToFileURL(contractPath).href);

// ─── Transfer Params (set before calling private_transfer) ────────────────────

const TRANSFER_AMOUNT = 100n;
const recipientSecretKey = crypto.getRandomValues(new Uint8Array(32));
// Recipient PK: random 32 bytes (simulates an external user's public key)
const recipientPublicKey = crypto.getRandomValues(new Uint8Array(32));

/**
 * Creates witnesses that override private_amount, private_recipient,
 * get_recipient_balance, and get_recipient_salt to inject transfer parameters.
 * The base witnesses (local_secret_key, get_balance, etc.) are reused from deploy.ts.
 */
function createTransferWitnesses(): Witnesses<PrivatePaymentState> {
  const base = createWitnesses();
  return {
    ...base,
    private_amount(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, bigint] {
      return [context.privateState, TRANSFER_AMOUNT];
    },
    private_recipient(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, recipientPublicKey];
    },
    get_recipient_balance(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, bigint] {
      // New recipient has 0 balance
      return [context.privateState, 0n];
    },
    get_recipient_salt(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, Uint8Array] {
      // New recipient has zero salt (no prior state)
      return [context.privateState, new Uint8Array(32)];
    },
  };
}

const compiledContract = (CompiledContract as any).make('private-payment', PrivatePayment.Contract).pipe(
  (CompiledContract as any).withWitnesses(createTransferWitnesses()),
  (CompiledContract as any).withCompiledFileAssets(zkConfigPath),
);

// ─── Wallet Setup ─────────────────────────────────────────────────────────────

function deriveKeys(seed: string) {
  const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
  if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');
  const result = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust]).deriveKeysAt(0);
  if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
  hdWallet.hdWallet.clear();
  return result.keys;
}

async function createWalletFromSeed(seed: string) {
  const keys = deriveKeys(seed);
  const networkId = getNetworkId();
  const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
  const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
  const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

  const walletConfig = {
    networkId,
    indexerClientConnection: { indexerHttpUrl: CONFIG.indexer, indexerWsUrl: CONFIG.indexerWS },
    provingServerUrl: new URL(CONFIG.proofServer),
    relayURL: new URL(CONFIG.node.replace(/^http/, 'ws')),
  };

  const shieldedWallet = ShieldedWallet(walletConfig).startWithSecretKeys(shieldedSecretKeys);
  const unshieldedWallet = UnshieldedWallet({
    networkId,
    indexerClientConnection: walletConfig.indexerClientConnection,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(),
  }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));
  const dustWallet = DustWallet({
    ...walletConfig,
    costParameters: { additionalFeeOverhead: 300_000_000_000_000n, feeBlocksMargin: 5 },
  }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

  const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
  await wallet.start(shieldedSecretKeys, dustSecretKey);

  return { wallet, shieldedSecretKeys, dustSecretKey, unshieldedKeystore };
}

function signTransactionIntents(tx: { intents?: Map<number, any> }, signFn: (payload: Uint8Array) => ledger.Signature, proofMarker: 'proof' | 'pre-proof'): void {
  if (!tx.intents || tx.intents.size === 0) return;
  for (const segment of tx.intents.keys()) {
    const intent = tx.intents.get(segment);
    if (!intent) continue;
    const cloned = ledger.Intent.deserialize<ledger.SignatureEnabled, ledger.Proofish, ledger.PreBinding>('signature', proofMarker, 'pre-binding', intent.serialize());
    const sigData = cloned.signatureData(segment);
    const signature = signFn(sigData);
    if (cloned.fallibleUnshieldedOffer) {
      const sigs = cloned.fallibleUnshieldedOffer.inputs.map((_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }
    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map((_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature);
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }
    tx.intents.set(segment, cloned);
  }
}

async function createProviders(walletCtx: Awaited<ReturnType<typeof createWalletFromSeed>>) {
  const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  const walletProvider = {
    getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
    getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
    async balanceTx(tx: any, ttl?: Date) {
      const recipe = await walletCtx.wallet.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: walletCtx.shieldedSecretKeys, dustSecretKey: walletCtx.dustSecretKey },
        { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
      );
      const signFn = (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload);
      signTransactionIntents(recipe.baseTransaction, signFn, 'proof');
      if (recipe.balancingTransaction) signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof');
      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
  };

  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

  return {
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'private-payment-state', walletProvider }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        Private Payment - Transfer Test                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // 1. Load deployment info
  if (!fs.existsSync('deployment.json') || !fs.existsSync('.midnight-seed')) {
    console.error('  No deployment found. Run `npm run deploy` first.\n');
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync('deployment.json', 'utf-8'));
  const seed = fs.readFileSync('.midnight-seed', 'utf-8').trim();

  if (!deployment.contractAddress) {
    console.error('  deployment.json has no contractAddress. Run `npm run deploy` first.\n');
    process.exit(1);
  }

  console.log(`  Contract:  ${deployment.contractAddress}`);
  console.log(`  Network:   preprod`);
  console.log(`  Amount:    ${TRANSFER_AMOUNT}`);
  console.log(`  Recipient: ${Buffer.from(recipientPublicKey).toString('hex').slice(0, 16)}...\n`);

  // 2. Setup wallet & providers
  console.log('  Setting up wallet...');
  const walletCtx = await createWalletFromSeed(seed);

  console.log('  Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  console.log('  Setting up providers...');
  const providers = await createProviders(walletCtx);

  // 3. Connect to deployed contract
  console.log('  Connecting to deployed contract...\n');

  const contractSecretKey = crypto.createHash('sha256')
    .update(Buffer.from(seed, 'hex'))
    .update('private-payment-secret-key')
    .digest();

  const contract = await (findDeployedContract as any)(providers, {
    compiledContract,
    contractAddress: deployment.contractAddress,
    privateStateId: 'privatePaymentState',
    initialPrivateState: createInitialPrivateState(new Uint8Array(contractSecretKey)),
  });

  // 4. Execute private_transfer
  console.log('  Executing private_transfer...');
  console.log('  (amount and recipient are hidden via ZKP)\n');

  try {
    const transferResult = await contract.callTx.private_transfer();
    const txHash = (transferResult.public as any)?.txHash ?? (transferResult as any)?.txHash ?? 'unknown';

    console.log('  Transfer submitted!\n');
    console.log(`  Tx Hash:      ${txHash}`);
    console.log(`  Explorer:     ${CONFIG.explorer}/transactions/${txHash}\n`);

    // 5. Check sender balance after transfer
    console.log('  Checking sender balance after transfer...\n');

    try {
      const balanceResult = await contract.callTx.check_balance();
      const balance = (balanceResult.public as any)?.result ?? (balanceResult as any)?.result ?? 'unknown';
      console.log(`  Sender Balance: ${balance}\n`);
    } catch (err: any) {
      console.error('  Balance check failed:', err.message);
    }
  } catch (err: any) {
    console.error('  Transfer failed:', err.message);
    if (err.message?.includes('Insufficient balance')) {
      console.error('\n  Sender has insufficient balance.');
      console.error('  Run `npm run deposit-test` first to fund the account.\n');
    }
    await walletCtx.wallet.stop();
    process.exit(1);
  }

  console.log('─── Transfer Test Complete ─────────────────────────────────────\n');

  await walletCtx.wallet.stop();
}

main().catch((err) => {
  console.error('\n  Error:', err.message || err);
  process.exit(1);
});

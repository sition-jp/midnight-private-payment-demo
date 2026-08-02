/**
 * Full integration test for private-payment contract.
 * Runs deposit → private_transfer → check_balance in a single process
 * so the off-chain private state (balances, salts) persists across calls.
 *
 * Usage: npm run full-test
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
import * as ledger from '@midnight-ntwrk/ledger-v8';
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
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
  explorer: 'https://preprod.midnightexplorer.com',
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(__dirname, '..', 'contracts', 'managed', 'private-payment');
const contractPath = path.join(zkConfigPath, 'contract', 'index.js');

if (!fs.existsSync(contractPath)) {
  console.error('\n  Contract not compiled! Run: npm run compile:private\n');
  process.exit(1);
}

const PrivatePayment = await import(pathToFileURL(contractPath).href);

// ─── Mutable Transfer Context ─────────────────────────────────────────────────
// Set these values before calling private_transfer().
// The witnesses close over this object and read from it at circuit execution time.

const transferContext = {
  amount: 0n,
  recipient: new Uint8Array(32),
  recipientBalance: 0n,
  recipientSalt: new Uint8Array(32),
};

/**
 * Witnesses that use the base implementation from deploy.ts,
 * but override transfer-related witnesses to read from the mutable
 * transferContext object. This allows deposit and private_transfer
 * to share the same compiled contract and private state.
 */
function createFullTestWitnesses(): Witnesses<PrivatePaymentState> {
  const base = createWitnesses();
  return {
    ...base,
    private_amount(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, bigint] {
      return [context.privateState, transferContext.amount];
    },
    private_recipient(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, transferContext.recipient];
    },
    get_recipient_balance(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, bigint] {
      return [context.privateState, transferContext.recipientBalance];
    },
    get_recipient_salt(context: WitnessContext<Ledger, PrivatePaymentState>): [PrivatePaymentState, Uint8Array] {
      return [context.privateState, transferContext.recipientSalt];
    },
  };
}

const compiledContract = (CompiledContract as any).make('private-payment', PrivatePayment.Contract).pipe(
  (CompiledContract as any).withWitnesses(createFullTestWitnesses()),
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
    privateStateProvider: levelPrivateStateProvider({ privateStateStoreName: 'private-payment-full-test', walletProvider }),
    publicDataProvider: indexerPublicDataProvider(CONFIG.indexer, CONFIG.indexerWS),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(CONFIG.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractTxHash(result: any): string {
  return result?.public?.txHash ?? result?.txHash ?? 'unknown';
}

function printTx(label: string, txHash: string) {
  console.log(`  ${label}`);
  console.log(`    Tx Hash:  ${txHash}`);
  console.log(`    Explorer: ${CONFIG.explorer}/transactions/${txHash}\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Private Payment - Full Integration Test                 ║');
  console.log('║     deposit → private_transfer → check_balance             ║');
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

  const recipientPk = crypto.getRandomValues(new Uint8Array(32));

  console.log(`  Contract:   ${deployment.contractAddress}`);
  console.log(`  Network:    preprod`);
  console.log(`  Recipient:  ${Buffer.from(recipientPk).toString('hex').slice(0, 16)}... (random)\n`);

  // 2. Setup wallet & providers
  console.log('  Setting up wallet...');
  const walletCtx = await createWalletFromSeed(seed);

  console.log('  Syncing with network...');
  await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));

  console.log('  Setting up providers...');
  const providers = await createProviders(walletCtx);

  // 3. Connect to deployed contract (fresh private state for this test)
  console.log('  Connecting to deployed contract...\n');

  const contractSecretKey = crypto.createHash('sha256')
    .update(Buffer.from(seed, 'hex'))
    .update('private-payment-secret-key')
    .digest();

  const contract = await (findDeployedContract as any)(providers, {
    compiledContract,
    contractAddress: deployment.contractAddress,
    privateStateId: 'privatePaymentFullTest',
    initialPrivateState: createInitialPrivateState(new Uint8Array(contractSecretKey)),
  });

  // ─── Step 1: Deposit ────────────────────────────────────────────────────────

  const DEPOSIT_AMOUNT = 1000n;
  console.log('━━━ Step 1: Deposit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Depositing ${DEPOSIT_AMOUNT} units...\n`);

  try {
    const depositResult = await contract.callTx.deposit(DEPOSIT_AMOUNT);
    printTx('Deposit successful!', extractTxHash(depositResult));
  } catch (err: any) {
    console.error('  Deposit failed:', err.message);
    await walletCtx.wallet.stop();
    process.exit(1);
  }

  // ─── Step 2: Private Transfer ───────────────────────────────────────────────

  const TRANSFER_AMOUNT = 100n;
  console.log('━━━ Step 2: Private Transfer ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Transferring ${TRANSFER_AMOUNT} units to ${Buffer.from(recipientPk).toString('hex').slice(0, 16)}...`);
  console.log('  (amount and recipient are hidden via ZKP)\n');

  // Set the mutable transfer context before calling private_transfer
  transferContext.amount = TRANSFER_AMOUNT;
  transferContext.recipient = recipientPk;
  transferContext.recipientBalance = 0n;
  transferContext.recipientSalt = new Uint8Array(32);

  try {
    const transferResult = await contract.callTx.private_transfer();
    printTx('Transfer successful!', extractTxHash(transferResult));
  } catch (err: any) {
    console.error('  Transfer failed:', err.message);
    if (err.message?.includes('Insufficient balance')) {
      console.error('  Sender has insufficient balance for this transfer.\n');
    }
    await walletCtx.wallet.stop();
    process.exit(1);
  }

  // ─── Step 3: Check Balance ──────────────────────────────────────────────────

  console.log('━━━ Step 3: Check Balance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Expected: ${DEPOSIT_AMOUNT} - ${TRANSFER_AMOUNT} = ${DEPOSIT_AMOUNT - TRANSFER_AMOUNT}\n`);

  try {
    const balanceResult = await contract.callTx.check_balance();
    const balance = (balanceResult.public as any)?.result ?? (balanceResult as any)?.result ?? 'unknown';
    console.log(`  Actual Balance: ${balance}\n`);

    if (BigInt(balance) === DEPOSIT_AMOUNT - TRANSFER_AMOUNT) {
      console.log('  Result: PASS\n');
    } else {
      console.log(`  Result: MISMATCH (expected ${DEPOSIT_AMOUNT - TRANSFER_AMOUNT})\n`);
    }
  } catch (err: any) {
    console.error('  Balance check failed:', err.message);
  }

  // ─── Summary ────────────────────────────────────────────────────────────────

  console.log('━━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`  Deposited:    ${DEPOSIT_AMOUNT}`);
  console.log(`  Transferred:  ${TRANSFER_AMOUNT} (private)`);
  console.log(`  Recipient:    ${Buffer.from(recipientPk).toString('hex').slice(0, 16)}... (private)`);
  console.log(`  On-chain:     only balance commitment hashes (no amounts/recipients)\n`);
  console.log('─── Full Test Complete ─────────────────────────────────────────\n');

  await walletCtx.wallet.stop();
}

main().catch((err) => {
  console.error('\n  Error:', err.message || err);
  process.exit(1);
});

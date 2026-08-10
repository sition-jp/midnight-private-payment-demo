# 1AM Wallet Transaction Execution - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the DApp's Wallet Mode to execute deposit, private transfer, and balance check transactions using the 1AM wallet's native proving and balancing APIs — eliminating the need for a local Proof Server.

**Architecture:** Dual provider strategy — Demo Mode continues using local WalletFacade + httpClientProofProvider; Wallet Mode uses 1AM DApp Connector API for all operations (proving via `getProvingProvider()`, balancing via `balanceUnsealedTransaction()`, submission via `submitTransaction()`). The 1AM cloud prover at `api-preprod.1am.xyz` handles ZK proof generation.

**Tech Stack:** React 18, TypeScript, Midnight SDK v7, 1AM DApp Connector API v4.0.0, Vite

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `dapp-ui/src/types/index.ts` | Modify | Add `rawWalletApi` to WalletContext |
| `dapp-ui/src/midnight/wallet.ts` | Modify | Fix `connectLace()` to expose full 1AM API + correct balance parsing |
| `dapp-ui/src/midnight/contract.ts` | Modify | Add `create1AMProviders()`, provider selection in `connectToContract()` |
| `dapp-ui/src/components/WalletPanel.tsx` | Modify | Fix balance display for 1AM (native units → human readable) |

Files NOT changed: `config.ts` (1AM config obtained dynamically), `useContract.ts` (no changes needed — provider selection happens inside `connectToContract()`), `useWallet.ts` (no changes needed), `witness.ts`, `InMemoryPrivateStateProvider.ts`.

---

### Task 1: Extend WalletContext Type

**Files:**
- Modify: `dapp-ui/src/types/index.ts`

- [ ] **Step 1: Add rawWalletApi to WalletContext interface**

In `dapp-ui/src/types/index.ts`, add the `rawWalletApi` field to the `WalletContext` interface:

```typescript
export interface WalletContext {
  /** Which mode this wallet was created in */
  readonly mode: WalletMode;
  /** Bech32m encoded wallet address */
  readonly address: string;
  /** Hex-encoded coin public key (used as on-chain identity) */
  readonly coinPublicKey: string;
  /** Hex-encoded encryption public key */
  readonly encryptionPublicKey: string;
  /** Balance a transaction (adds fees, inputs, change) */
  readonly balanceTx: (tx: unknown, ttl?: Date) => Promise<unknown>;
  /** Submit a finalized transaction to the network */
  readonly submitTx: (tx: unknown) => Promise<unknown>;
  /** Stop the wallet (cleanup) */
  readonly stop: () => Promise<void>;
  /** Get current tNight balance (unshielded) */
  readonly getBalance: () => Promise<bigint>;

  // Demo-mode specific fields (undefined for Lace mode)
  /** The seed used to create this wallet (demo mode only) */
  readonly seed?: string;

  // Lace-mode specific fields (undefined for demo mode)
  /** The DApp connector API instance (Lace mode only) */
  readonly laceApi?: DAppConnectorAPI;
  /** The Lace wallet API (Lace mode only) */
  readonly laceWallet?: DAppConnectorWalletAPI;

  // 1AM-mode specific fields
  /** Raw 1AM connected wallet API (17 methods). Used by contract.ts to build providers. */
  readonly rawWalletApi?: any;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from the repository root: `cd dapp-ui && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors introduced (existing errors may be present).

- [ ] **Step 3: Commit**

```bash
cd midnight-private-payment-demo
git add dapp-ui/src/types/index.ts
git commit -m "feat: add rawWalletApi to WalletContext type for 1AM integration"
```

---

### Task 2: Fix `connectLace()` — Full 1AM API Integration

**Files:**
- Modify: `dapp-ui/src/midnight/wallet.ts`

- [ ] **Step 1: Rewrite the `connectLace()` function**

Replace the entire `connectLace()` function (starting at the `/** Connect to wallet browser extension */` comment) with:

```typescript
/** Connect to wallet browser extension (Lace or 1AM) */
export async function connectLace(): Promise<WalletContext> {
  ensureNetworkId();

  const m = window.midnight as Record<string, unknown> | undefined;
  const walletApi = (m?.['1am'] || m?.mnLace) as DAppConnectorAPI | undefined;

  if (!walletApi) {
    throw new Error('Midnight wallet extension not found. Please install 1AM or Lace.');
  }

  const walletExtApi = walletApi as any;

  // 1AM uses connect(), Lace uses enable()
  let connectedWallet: any;
  if (typeof walletExtApi.connect === 'function') {
    connectedWallet = await walletExtApi.connect('preprod');
  } else if (typeof walletExtApi.enable === 'function') {
    connectedWallet = await walletExtApi.enable();
  } else {
    throw new Error('Failed to connect to wallet extension');
  }

  // Get address
  let address = '';
  try {
    if (typeof connectedWallet.getUnshieldedAddress === 'function') {
      const addrResult = await connectedWallet.getUnshieldedAddress();
      address = String(addrResult?.unshieldedAddress ?? addrResult ?? '');
    } else if (typeof connectedWallet.state === 'function') {
      const state = await connectedWallet.state();
      address = String(state.address ?? '');
    }
  } catch {
    address = 'unknown';
  }

  // Get balance — 1AM returns { "0000...0000": "1000000000" }
  const NATIVE_TOKEN = '0'.repeat(64);
  let balance = 0n;
  try {
    if (typeof connectedWallet.getUnshieldedBalances === 'function') {
      const balances = await connectedWallet.getUnshieldedBalances();
      if (balances && typeof balances === 'object') {
        // 1AM returns token-keyed map: { "0000...0000": "1000000000" }
        const raw = balances[NATIVE_TOKEN] ?? balances.totalBalance ?? '0';
        balance = BigInt(raw);
      }
    }
  } catch {
    balance = 0n;
  }

  // Get shielded keys for coin/encryption public keys
  let coinPublicKey = '';
  let encryptionPublicKey = '';
  try {
    if (typeof connectedWallet.getShieldedAddresses === 'function') {
      const shielded = await connectedWallet.getShieldedAddresses();
      coinPublicKey = String(shielded?.shieldedCoinPublicKey ?? '');
      encryptionPublicKey = String(shielded?.shieldedEncryptionPublicKey ?? '');
    }
  } catch {
    // Non-fatal — keys may not be needed for all operations
  }

  return {
    mode: 'lace',
    address,
    coinPublicKey,
    encryptionPublicKey,
    balanceTx: async (tx: unknown) => {
      if (typeof connectedWallet.balanceUnsealedTransaction === 'function') {
        return connectedWallet.balanceUnsealedTransaction(tx);
      }
      return connectedWallet.balanceAndProveTransaction(tx, []);
    },
    submitTx: (tx: unknown) => connectedWallet.submitTransaction(tx),
    stop: async () => {
      // Extension wallets don't need cleanup
    },
    getBalance: async () => {
      // Re-fetch balance each time
      try {
        const balances = await connectedWallet.getUnshieldedBalances();
        if (balances && typeof balances === 'object') {
          const raw = balances[NATIVE_TOKEN] ?? balances.totalBalance ?? '0';
          return BigInt(raw);
        }
      } catch { /* */ }
      return balance;
    },
    rawWalletApi: connectedWallet,
  };
}
```

- [ ] **Step 2: Remove the debug global**

Find and remove the line `(window as any).__1amWallet = connectedWallet;` that was added during API investigation. It was inside the `connectLace()` function that was just replaced, so this is already handled.

- [ ] **Step 3: Verify TypeScript compiles**

Run from the repository root: `cd dapp-ui && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
cd midnight-private-payment-demo
git add dapp-ui/src/midnight/wallet.ts
git commit -m "feat: rewrite connectLace() with full 1AM API integration and balance fix"
```

---

### Task 3: Add 1AM Provider Factory in contract.ts

**Files:**
- Modify: `dapp-ui/src/midnight/contract.ts`

- [ ] **Step 1: Add `create1AMProviders()` function**

Add this function after the existing `createBrowserProviders()` function:

```typescript
// ─── 1AM Wallet Providers ────────────────────────────────────────────────────

/**
 * Assemble providers using 1AM wallet's native APIs.
 * Uses 1AM's cloud prover (api-preprod.1am.xyz) instead of local proof server.
 * Uses 1AM's balanceUnsealedTransaction for tx balancing.
 */
async function create1AMProviders(walletCtx: WalletContext): Promise<MidnightProviders> {
  const api = walletCtx.rawWalletApi;
  if (!api) {
    throw new Error('1AM wallet API not available. rawWalletApi is undefined.');
  }

  // Get 1AM's proof provider (returns { check, prove })
  const proofProvider = await api.getProvingProvider();

  // Get network config from 1AM for correct indexer URLs (v4)
  let indexerUrl = MIDNIGHT_CONFIG.indexer;
  let indexerWsUrl = MIDNIGHT_CONFIG.indexerWS;
  try {
    const config = await api.getConfiguration();
    if (config.indexerUri) indexerUrl = config.indexerUri;
    if (config.indexerWsUri) indexerWsUrl = config.indexerWsUri;
  } catch {
    // Fall back to hardcoded v3 URLs
  }

  // ZK config provider still loads circuit files from our static assets
  const zkConfigProvider = new FetchZkConfigProvider<PrivatePaymentCircuitKeys>(
    window.location.origin + '/contracts/private-payment',
    fetch.bind(window),
  );

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(indexerUrl, indexerWsUrl),
    zkConfigProvider: zkConfigProvider as any,
    proofProvider: proofProvider as any,
    walletProvider: {
      getCoinPublicKey: () => walletCtx.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.encryptionPublicKey,
      balanceTx: (tx: unknown) => api.balanceUnsealedTransaction(tx),
      submitTx: (tx: unknown) => api.submitTransaction(tx),
    } as unknown as MidnightProviders['walletProvider'],
    midnightProvider: {
      submitTx: (tx: unknown) => api.submitTransaction(tx),
    } as unknown as MidnightProviders['midnightProvider'],
  };
}
```

- [ ] **Step 2: Modify `connectToContract()` to select provider based on mode**

Change the provider creation line in `connectToContract()` from:

```typescript
  const providers = createBrowserProviders(walletCtx);
```

To:

```typescript
  const providers = walletCtx.mode === 'lace' && walletCtx.rawWalletApi
    ? await create1AMProviders(walletCtx)
    : createBrowserProviders(walletCtx);
```

- [ ] **Step 3: Verify TypeScript compiles**

Run from the repository root: `cd dapp-ui && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
cd midnight-private-payment-demo
git add dapp-ui/src/midnight/contract.ts
git commit -m "feat: add create1AMProviders() for Proof Server-free wallet mode"
```

---

### Task 4: Fix Balance Display in WalletPanel

**Files:**
- Modify: `dapp-ui/src/components/WalletPanel.tsx`

- [ ] **Step 1: Update `formatBalance()` to handle 1AM native units**

1AM returns balances in native units (1 tNIGHT = 1,000,000 native units based on the observed value of 1000000000 for 1000 tNIGHT, meaning 1 tNIGHT = 1,000,000 native units). Update the `formatBalance` function:

```typescript
function formatBalance(bal: bigint): string {
  // 1AM returns balance in native units (1 tNIGHT = 1,000,000 native units)
  // Demo mode may return raw amounts without this scaling
  if (bal >= 1_000_000n) {
    const whole = bal / 1_000_000n;
    const frac = bal % 1_000_000n;
    if (frac === 0n) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '');
    return `${whole.toLocaleString()}.${fracStr}`;
  }
  return bal.toLocaleString();
}
```

Wait — let me verify the actual unit conversion. From the API investigation:
- 1AM `getUnshieldedBalances()` returned `"1000000000"` for 1000 tNIGHT displayed in the wallet
- So 1 tNIGHT = 1,000,000 native units? No: 1000 tNIGHT = 1,000,000,000 → 1 tNIGHT = 1,000,000

Actually, I should not hardcode a conversion factor. The Demo mode wallet returns raw units too. Let me check what Demo mode returns for comparison.

Better approach: pass the mode into the formatting, or let the wallet layer normalize. Since Demo mode `getBalance()` returns `s.unshielded.balances[unshieldedToken().raw]` which is also in native units, the issue is actually that the current `formatBalance` is correct for demo but the balance was never properly fetched for 1AM.

The real fix is already done in Task 2 (balance now properly parsed from the token-keyed map). The `formatBalance` function should handle the native unit conversion consistently for both modes.

Replace the `formatBalance` function:

```typescript
function formatBalance(bal: bigint): string {
  // Midnight native token uses 6 decimal places (1 tNIGHT = 1,000,000 native units)
  const DECIMALS = 6n;
  const DIVISOR = 10n ** DECIMALS;
  const whole = bal / DIVISOR;
  const frac = bal % DIVISOR;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}.${fracStr}`;
}
```

- [ ] **Step 2: Test in browser**

1. Open `http://localhost:5173`
2. Switch to Wallet Mode
3. Connect 1AM wallet
4. Verify balance shows `1000` (or `1,000`) instead of `0` or `1000000000`

- [ ] **Step 3: Commit**

```bash
cd midnight-private-payment-demo
git add dapp-ui/src/components/WalletPanel.tsx
git commit -m "fix: format tNight balance with correct decimal places"
```

---

### Task 5: Integration Test — Connect to Contract via 1AM

**Files:** No new files — manual browser testing.

- [ ] **Step 1: Start the DApp dev server**

Run from the repository root: `cd dapp-ui && npm run dev`

Verify: Dev server starts on `http://localhost:5173`

- [ ] **Step 2: Connect 1AM wallet**

1. Open `http://localhost:5173` in Chrome
2. Click "Wallet Mode"
3. Click "Connect Wallet Extension"
4. Approve in 1AM popup
5. Verify only the connection state and `1AM` mode; do not record or publish the address or balance.

- [ ] **Step 3: Connect to Contract**

1. Click "Connect to Contract" button
2. Wait for contract connection (this calls `findDeployedContract` with 1AM providers)
3. Expected: Green "Contract connected — Ready for transactions" banner appears
4. If error: Check browser console for details. Common issues:
   - Indexer v4 incompatibility → fallback to v3 URLs
   - `getProvingProvider()` interface mismatch → may need adapter
   - Missing coinPublicKey/encryptionPublicKey → check if bech32m keys work

- [ ] **Step 4: If contract connection fails, diagnose and fix**

Check console for the specific error. Potential fixes:

**If indexer v4 fails:** In `create1AMProviders()`, force v3 URLs:
```typescript
// Override 1AM's v4 URLs with our v3 URLs
indexerUrl = MIDNIGHT_CONFIG.indexer;
indexerWsUrl = MIDNIGHT_CONFIG.indexerWS;
```

**If proofProvider interface mismatch:** Wrap 1AM's proof provider:
```typescript
const rawProofProvider = await api.getProvingProvider();
const proofProvider = {
  check: rawProofProvider.check,
  prove: async (circuitId: string, ...args: unknown[]) => rawProofProvider.prove(circuitId, ...args),
};
```

**If coinPublicKey format issue (bech32m vs hex):** The bech32m-encoded keys from `getShieldedAddresses()` may need to be passed as-is if midnight-js-contracts handles the decoding, or we may need to strip the `mn_shield-cpk_preprod1` prefix.

- [ ] **Step 5: Commit any fixes**

```bash
cd midnight-private-payment-demo
git add -A
git commit -m "fix: resolve 1AM provider integration issues"
```

---

### Task 6: Full Transaction Flow Test

**Files:** No new files — manual browser testing.

- [ ] **Step 1: Execute Deposit**

1. With wallet + contract connected, click "Deposit" tab
2. Enter amount: `100` (or smallest reasonable amount)
3. Click "Deposit" button
4. Wait for transaction to complete (may take 30-120 seconds for proof generation + confirmation)
5. Expected: Transaction hash displayed with explorer link
6. If error: Check console. Common issues:
   - `balanceUnsealedTransaction` format mismatch
   - Insufficient tNIGHT for fees
   - Proof generation timeout

- [ ] **Step 2: Execute Private Transfer**

1. Click "Private Transfer" tab
2. Enter transfer details (amount, recipient)
3. Click "Transfer" button
4. Wait for completion
5. Expected: Transaction hash with explorer link; amount hidden, sender and recipient public keys visible on-chain

- [ ] **Step 3: Check Balance**

1. Click "Balance" tab
2. Click "Check Balance"
3. Expected: Shows deposited amount minus transferred amount

- [ ] **Step 4: Verify on Explorer**

1. Click explorer link from any transaction
2. Verify transaction appears on `preprod.midnightexplorer.com`
3. Verify private transfer shows commitment hashes (not plaintext amounts)

- [ ] **Step 5: Commit final state**

```bash
cd midnight-private-payment-demo
git add -A
git commit -m "feat: 1AM wallet transaction execution verified end-to-end"
```

---

### Task 7: Cleanup

**Files:**
- Modify: `dapp-ui/src/midnight/wallet.ts` (if debug code remains)

- [ ] **Step 1: Remove any remaining debug code**

Search for and remove:
- Any `console.log` statements added during debugging
- Any `(window as any).__` global assignments
- Any commented-out code

- [ ] **Step 2: Final compile check**

Run from the repository root: `cd dapp-ui && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Final commit**

```bash
cd midnight-private-payment-demo
git add -A
git commit -m "chore: cleanup debug code from 1AM integration"
```

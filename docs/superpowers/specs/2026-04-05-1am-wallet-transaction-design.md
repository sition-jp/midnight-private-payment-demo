# 1AM Wallet Transaction Execution - Design Spec

## Overview

Integrate the 1AM DApp Connector API into the existing Private Payment Demo DApp so that Wallet Mode uses 1AM's native proving, balancing, and submission — eliminating the need for a local Proof Server. This enables anyone with a 1AM wallet to use the DApp directly from a hosted URL.

## Architecture

### Dual Mode Provider Strategy

```
Demo Mode (dev/testing):
  Browser → WalletFacade (seed-based) → httpClientProofProvider (localhost:6300)

Wallet Mode (production/users):
  Browser → 1AM DApp Connector API → 1AM Cloud Prover (api-preprod.1am.xyz)
```

### 1AM API Discovery (Verified)

Connected wallet object exposes 17 methods:

| Method | Purpose | Used In |
|---|---|---|
| `getProvingProvider()` | Returns `{ check, prove }` — ProofProvider interface | Contract proving |
| `balanceUnsealedTransaction(tx)` | Balance a transaction with wallet UTXOs | Tx balancing |
| `submitTransaction(tx)` | Submit balanced+proved tx to network | Tx submission |
| `getUnshieldedBalances()` | Returns token balances (BigInt, 1e9 units) | Balance display |
| `getUnshieldedAddress()` | Returns `{ unshieldedAddress: string }` | Address display |
| `getShieldedBalances()` | Shielded token balances | Balance display |
| `getConfiguration()` | Network config (indexer URLs, prover URL, networkId) | Provider config |
| `getConnectionStatus()` | `{ status, networkId }` | Connection check |
| `getDustBalance()` | Dust balance | Fee display |
| `getDustAddress()` | Dust address | Fee handling |
| `getShieldedAddresses()` | Shielded addresses | Private transfers |
| `getTxHistory()` | Transaction history | History display |
| `balanceSealedTransaction(tx)` | Balance sealed (shielded) transactions | Future use |
| `makeTransfer()` | Direct transfer (non-contract) | Future use |
| `makeIntent()` | Create intent | Future use |
| `signData()` | Sign arbitrary data | Future use |
| `hintUsage()` | Usage hints for wallet | UX |

### 1AM Configuration (from `getConfiguration()`)

```json
{
  "indexerUri": "https://indexer.preprod.midnight.network/api/v4/graphql",
  "indexerWsUri": "wss://indexer.preprod.midnight.network/api/v4/graphql/ws",
  "proverServerUri": "https://api-preprod.1am.xyz",
  "networkId": "preprod"
}
```

Note: 1AM uses indexer **v4**, current DApp config uses **v3**. Need to handle both.

## Changes

### 1. `wallet.ts` — Extend WalletContext with 1AM API

**Problem:** Current `connectLace()` returns a minimal WalletContext that doesn't expose the raw 1AM API methods needed by the contract provider layer.

**Solution:** Store the full connected wallet API reference in WalletContext so `contract.ts` can build providers from it.

```typescript
// Add to WalletContext type
interface WalletContext {
  // ... existing fields
  rawWalletApi?: any;  // 1AM connected wallet API (17 methods)
}
```

In `connectLace()`:
- Store `connectedWallet` as `rawWalletApi` in returned context
- Fix balance parsing: `BigInt(balances[TOKEN_KEY]) / 1_000_000_000n` or keep raw and format in UI
- Use `getConfiguration()` to get correct indexer URLs
- Remove debug `__1amWallet` global

### 2. `contract.ts` — Add 1AM Provider Factory

**Problem:** `createBrowserProviders()` hardcodes `getDemoWalletProvider()` and `httpClientProofProvider`, which require a local Proof Server.

**Solution:** Add `create1AMProviders()` that builds providers entirely from 1AM API.

```typescript
function create1AMProviders(walletCtx: WalletContext): MidnightProviders {
  const api = walletCtx.rawWalletApi;

  return {
    privateStateProvider: inMemoryPrivateStateProvider(),
    publicDataProvider: indexerPublicDataProvider(
      config.indexerUri,   // from 1AM getConfiguration()
      config.indexerWsUri,
    ),
    zkConfigProvider: new FetchZkConfigProvider(
      window.location.origin + '/contracts/private-payment',
      fetch.bind(window),
    ),
    proofProvider: api.getProvingProvider(),  // { check, prove }
    walletProvider: {
      getCoinPublicKey: () => walletCtx.coinPublicKey,
      getEncryptionPublicKey: () => walletCtx.encryptionPublicKey,
      balanceTx: (tx) => api.balanceUnsealedTransaction(tx),
      submitTx: (tx) => api.submitTransaction(tx),
    },
    midnightProvider: {
      submitTx: (tx) => api.submitTransaction(tx),
    },
  };
}
```

Key decision: `proofProvider` uses `getProvingProvider()` directly (returns `{ check, prove }` which matches the ProofProvider interface).

### 3. `contract.ts` — `connectToContract()` Provider Selection

```typescript
export async function connectToContract(walletCtx, contractAddress, secretKey) {
  const providers = walletCtx.mode === 'lace'
    ? await create1AMProviders(walletCtx)
    : createBrowserProviders(walletCtx);
  // ... rest unchanged
}
```

### 4. `wallet.ts` — Fix Balance Display

**Problem:** `getUnshieldedBalances()` returns `{ "0000...0000": "1000000000" }` but DApp shows "0".

**Fix:** Parse the token-keyed balance map correctly.

```typescript
const NATIVE_TOKEN = '0'.repeat(64);
const balances = await connectedWallet.getUnshieldedBalances();
const rawBalance = BigInt(balances?.[NATIVE_TOKEN] ?? '0');
// Store raw (in native units), format in UI
```

### 5. `wallet.ts` — Get Coin/Encryption Public Keys

**Problem:** Current `connectLace()` sets `coinPublicKey` and `encryptionPublicKey` to empty strings. These are needed by `walletProvider.getCoinPublicKey()`.

**Solution:** Use `getShieldedAddresses()` to retrieve these values.

```typescript
const shieldedAddrs = await connectedWallet.getShieldedAddresses();
// Extract coinPublicKey and encryptionPublicKey from shielded address data
```

### 6. `config.ts` — Indexer Version Handling

Add support for v4 indexer URLs when connected via 1AM:

```typescript
export const MIDNIGHT_CONFIG = {
  // ... existing v3 URLs as defaults
  indexerV4: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWSV4: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
};
```

Or preferably, use the URLs from `getConfiguration()` dynamically.

## Transaction Flow (Wallet Mode)

```
User clicks "Initialize demo balance (100)"
  → contract.callTx.deposit(100n)
    → updates the demo balance commitment; no wallet tNIGHT moves into the contract
    → midnight-js-contracts builds unsigned transaction
    → walletProvider.balanceTx(tx)
      → 1AM balanceUnsealedTransaction(tx)  ← 1AM handles UTXO selection + signing
    → proofProvider.prove(circuit, inputs)
      → 1AM getProvingProvider().prove()    ← 1AM cloud prover generates ZK proof
    → midnightProvider.submitTx(tx)
      → 1AM submitTransaction(tx)           ← 1AM submits to network
  → txHash returned
  → Display explorer link
```

## Risk & Unknowns

1. **`getProvingProvider()` interface compatibility** — The `{ check, prove }` methods may expect different argument shapes than `httpClientProofProvider`. Need to verify the exact function signatures match what `midnight-js-contracts` calls internally.

2. **`balanceUnsealedTransaction()` input format** — May expect a different transaction format than what `WalletFacade.balanceUnboundTransaction()` produces. The `midnight-js-contracts` library calls `walletProvider.balanceTx()` with a specific format.

3. **Coin/Encryption public keys from 1AM** — `getShieldedAddresses()` return shape is unknown. If unavailable, the private state initialization may need adjustment.

4. **Indexer v3 vs v4** — The compiled contract and `findDeployedContract` may have expectations about indexer version.

## Verification Plan

1. Connect 1AM wallet → verify address + balance display correctly
2. Connect to contract → verify `findDeployedContract` works with 1AM providers
3. Execute Deposit → verify full tx flow through 1AM
4. Execute Private Transfer → verify ZK proof generation via 1AM cloud prover
5. Check Balance → verify on-chain state
6. Verify on explorer (explorer.preprod.midnight.network)

## Out of Scope

- Hosting/deployment (Vercel) — separate task
- CLI mode changes — already working, no changes needed
- New UI features — only fixing balance display
- Lace wallet support — focusing on 1AM only

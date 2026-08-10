# Demo DUST Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:test-driven-development` and complete each RED-GREEN-REFACTOR
> cycle before moving to the next task.

**Goal:** Add a fail-closed Demo Mode workflow that registers only the
connected wallet's eligible Preprod tNIGHT for DUST and waits until the wallet
can pay transaction fees.

**Architecture:** A pure presentation model owns the UI gates. A narrow,
Demo-only capability retained by `WalletContext` adapts the existing
`WalletFacade`, keystore, and DUST key to the SDK registration flow. A small
latest-operation lifecycle prevents stale React updates. Contract connection is
blocked until the capability reports positive DUST. Wallet-extension mode is
unchanged.

**Tech Stack:** TypeScript 5.9, React 19, Node `node:test`, RxJS 7.8,
Midnight wallet SDK facade 4.0.1, Midnight JS 4.1.1.

## Global constraints

- Do not change the Compact contract.
- Do not touch Mainnet or operate 1AM/Lace.
- Do not move or re-register already registered NIGHT.
- Do not request faucet funds automatically.
- Do not add dependencies or change pinned versions.
- Do not log or persist seeds, complete addresses, UTXOs, transaction IDs,
  balances, sync counters, or other operational identifiers.
- Preserve the two unrelated pre-existing untracked demo files.
- Do not push.

### Task 1: Pure DUST readiness and UI model

**Files:**
- Create: `dapp-ui/src/midnight/dust-preparation-model.ts`
- Create: `dapp-ui/src/midnight/dust-preparation-model.test.ts`
- Modify: `dapp-ui/src/types/index.ts`

- [ ] Define sanitized `DemoDustSnapshot`, `DemoDustPhase`,
  `DemoDustPreparationCapability`, and `DustPreparationModel` types. The
  snapshot exposes tNIGHT balance, `hasEligibleNight`, and `isDustReady`; it
  exposes no UTXO or transaction identifiers.
- [ ] Write table-driven tests for `needs-tnight`, `ready-to-register`,
  `registering`, `waiting-for-dust`, `dust-ready`, `unavailable`, and `error`.
- [ ] Assert only `ready-to-register` enables registration and only
  `dust-ready` enables contract connection.
- [ ] Run
  `node --experimental-strip-types --test src/midnight/dust-preparation-model.test.ts`
  from `dapp-ui` and observe RED because the model is absent.
- [ ] Implement the minimum pure model, including the official Preprod faucet
  URL and copy stating that registration is an on-chain action.
- [ ] Rerun the focused test GREEN.

### Task 2: Demo wallet DUST registration capability

**Files:**
- Create: `dapp-ui/src/midnight/demo-dust-preparation.ts`
- Create: `dapp-ui/src/midnight/demo-dust-preparation.test.ts`
- Modify: `dapp-ui/src/midnight/wallet.ts`
- Modify: `dapp-ui/src/types/index.ts`

- [ ] Write dependency-injected tests proving status reads use strict synced
  state and map only the native tNIGHT balance, positive DUST, and the existence
  of an available unregistered UTXO.
- [ ] Write tests proving registration selects only available UTXOs with
  `registeredForDustGeneration === false`, uses the retained wallet's own
  `DustAddress`, signs with the retained unshielded keystore, then finalizes and
  submits exactly once.
- [ ] Add tests for zero eligible UTXOs, single-flight rejection, abort,
  positive-DUST completion, waiting timeout without resubmission, and sanitized
  failure messages.
- [ ] Assert a pre-submit failure reverts the booked recipe once. Treat a submit
  failure as ambiguous: refresh state and surface an error, but never resubmit
  or make the UTXO immediately reusable.
- [ ] Run the focused test and observe RED because the adapter is absent.
- [ ] Implement the dependency-injected adapter and DUST wait helper. Use an
  `AbortSignal`, a ten-minute absolute wait limit, and no automatic registration
  retry.
- [ ] In `createWalletFromSeed`, construct the capability from the already
  retained `WalletFacade`, `unshieldedKeystore`, and `dustSecretKey`; never
  rederive a wallet or request the seed.
- [ ] Attach the capability only to Demo Mode `WalletContext` and rerun focused
  tests GREEN.

### Task 3: Latest-operation lifecycle in the wallet hook

**Files:**
- Create: `dapp-ui/src/midnight/dust-preparation-lifecycle.ts`
- Create: `dapp-ui/src/midnight/dust-preparation-lifecycle.test.ts`
- Modify: `dapp-ui/src/hooks/useWallet.ts`

- [ ] Write tests proving only one refresh/registration operation can run,
  disconnect aborts the active operation, and a late result from an old wallet
  generation cannot update the current wallet.
- [ ] Run the focused lifecycle test and observe RED.
- [ ] Implement the smallest generation-based lifecycle with `AbortController`.
- [ ] Extend `UseWalletReturn` with sanitized DUST state, phase, error,
  `refreshDustStatus`, and `prepareDust`.
- [ ] On accepted Demo wallet connection, read initial DUST status. During
  refresh/registration, publish only model phases and sanitized errors.
- [ ] On disconnect, mode change, or unmount, abort the DUST operation and clear
  its state before stopping the wallet.
- [ ] Keep existing tNIGHT balance state synchronized with the refreshed
  snapshot and rerun focused tests GREEN.

### Task 4: DUST preparation card and transaction gate

**Files:**
- Modify: `dapp-ui/src/components/WalletPanel.tsx`
- Modify: `dapp-ui/src/App.tsx`
- Modify: `dapp-ui/src/midnight/privacy-copy.test.ts`

- [ ] Extend the source/privacy test to require the official faucet URL,
  explicit on-chain registration wording, and the DUST-ready contract gate;
  reject claims that faucet funding, registration, or DUST generation is
  automatic.
- [ ] Run the focused privacy test and observe RED.
- [ ] Render the pure model in a Demo-only DUST preparation card:
  official faucet link, Refresh, Register, progress, ready, timeout, and retry
  states. Do not render UTXO counts, DUST quantities, or transaction IDs.
- [ ] Disable `Connect to Contract` in Demo Mode until `dust-ready`, with an
  explanatory label. Preserve current Wallet Mode behavior.
- [ ] Route refresh and registration handlers through `App.tsx`. If a contract
  is already connected when readiness becomes false, disconnect it and reset
  dependent demo state.
- [ ] Rerun privacy and all focused DUST tests GREEN.

### Task 5: Verification, operator check, and commit

**Files:**
- Modify: `README.md` only if the local operator flow needs one short DUST note
- Append: private WORKLOG outside this public repository

- [ ] Run the full UI test suite three consecutive times with `npm test`.
- [ ] Run `npm run lint`, `npx tsc --noEmit`, and `npm run build` from
  `dapp-ui`.
- [ ] Inspect the complete diff and scan for seed-like hex, complete addresses,
  UTXO data, transaction identifiers, runtime balances/counters, local paths,
  and accidental unrelated files.
- [ ] Run a local browser smoke test without submitting a registration: Demo
  reconnect from cache, status refresh, faucet link, disabled contract button,
  and Wallet Mode unchanged.
- [ ] Append one private WORKLOG entry without operational identifiers.
- [ ] Commit only intended files on `codex/demo-dust-preparation` and report the
  exact verification results. Keep push and live registration as separate user
  approvals.

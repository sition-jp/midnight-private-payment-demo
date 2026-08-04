# G-6 Visibility Panel and G-7 Automatic Payment Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision:** v1.1 — 2026-08-04 review P1×2 incorporated before implementation

**Goal:** Add an accurate three-column transfer visibility panel and a deterministic automatic payment policy that records its decision and fires one approved Preprod transfer.

**Architecture:** The contract adapter sanitizes Midnight finalized-call data into a narrow `TransactionResult` and an ephemeral `TransferDisclosureSnapshot`. A pure visibility model maps that snapshot into the three workshop columns. A pure policy evaluator and injected runner decide whether to call the existing transfer path; React panels only collect inputs and render these tested models.

**Tech Stack:** TypeScript 5.9, React 19, Tailwind CSS 4, Node `node:test`, midnight-js 4.1.1, generated Compact contract ledger view.

## Global Constraints

- G-6 must pass before starting G-7.
- The transfer amount, balance values, and salts are not on-chain; sender and recipient public keys are on-chain.
- `check_balance` publicly discloses its returned balance.
- Describe the contract as a private-balance-update proof of concept, not a complete two-party payment.
- Use deterministic policy approach A; do not call it an AI agent and do not add an external model or API.
- Do not change the Compact contract, operate 1AM, touch mainnet, move registered assets, or push.
- Do not commit real addresses, transaction identifiers, block heights, balances, salts, synchronization counters, or other operational values. Tests use synthetic fixtures.
- Never log, persist, or retain the full Midnight finalized-call private envelope.
- Use exact dependency versions already present; do not add packages.

---

## File structure

### New files

- `dapp-ui/src/midnight/transfer-disclosure.ts` — pure construction and validation of sanitized disclosure snapshots.
- `dapp-ui/src/midnight/transfer-disclosure.test.ts` — finalized-call sanitization and disclosure mapping tests.
- `dapp-ui/src/midnight/visibility-model.ts` — pure mapping from snapshot to three display columns and repetition lesson.
- `dapp-ui/src/midnight/visibility-model.test.ts` — exact §2 column-placement tests.
- `dapp-ui/src/components/VisibilityPanel.tsx` — G-6 presentation only.
- `dapp-ui/src/agent/policy.ts` — pure deterministic decision rules.
- `dapp-ui/src/agent/runner.ts` — decision log and injected transfer orchestration.
- `dapp-ui/src/midnight/policy.test.ts` — policy and runner behavior tests under the existing test glob.
- `dapp-ui/src/midnight/recipient.ts` — deterministic-testable recipient public-key generation helper.
- `dapp-ui/src/midnight/recipient.test.ts` — recipient helper test.
- `dapp-ui/src/components/PolicyPanel.tsx` — G-7 inputs and decision-log rendering.

### Modified files

- `dapp-ui/src/types/index.ts` — sanitized result, disclosure, and contract context types.
- `dapp-ui/src/midnight/contract-result.ts` — public metadata extraction without carrying the source envelope.
- `dapp-ui/src/midnight/contract-result.test.ts` — metadata sanitization regression.
- `dapp-ui/src/midnight/contract.ts` — retain the private-state provider, build snapshots, and expose local balance read.
- `dapp-ui/src/hooks/useTransaction.ts` — consume the typed scalar result and sanitized transfer result.
- `dapp-ui/src/components/TransferPanel.tsx` — use the shared recipient helper.
- `dapp-ui/src/App.tsx` — add Visibility and Policy tabs, preserve policy logs, and route successful transfers.
- `dapp-ui/src/midnight/privacy-copy.test.ts` — source-level workshop copy invariants.
- `/Users/sition/Documents/SITION/WORKLOG.md` — private completion entry only; never include runtime identifiers.

---

### Task 1: Sanitize finalized transaction results and build disclosure snapshots

**Files:**
- Modify: `dapp-ui/src/types/index.ts:49-88`
- Modify: `dapp-ui/src/midnight/contract-result.ts`
- Modify: `dapp-ui/src/midnight/contract-result.test.ts`
- Create: `dapp-ui/src/midnight/transfer-disclosure.ts`
- Create: `dapp-ui/src/midnight/transfer-disclosure.test.ts`
- Modify: `dapp-ui/src/midnight/contract.ts:55-262`
- Modify: `dapp-ui/src/hooks/useTransaction.ts:97-110`

**Interfaces:**
- Produces: `TransferDisclosureSnapshot`, `extractFinalizedTransactionMetadata(result)`, `buildTransferDisclosure(input)`, and `ContractContext.readPrivateBalance()`.
- Consumers: Tasks 2, 4, and 5.

- [ ] **Step 1: Write failing metadata sanitization tests**

Add to `contract-result.test.ts`:

```ts
import { extractFinalizedTransactionMetadata } from './contract-result.ts';

test('extracts only public finalized transaction metadata', () => {
  const source = {
    public: { txHash: 'synthetic-hash', blockHeight: 42 },
    private: { result: 7n, nextPrivateState: { secretKey: 'must-not-escape' } },
  };

  assert.deepEqual(extractFinalizedTransactionMetadata(source), {
    txHash: 'synthetic-hash',
    blockHeight: 42,
  });
  assert.doesNotMatch(JSON.stringify(extractFinalizedTransactionMetadata(source)), /secretKey/);
});
```

- [ ] **Step 2: Run the metadata test and verify RED**

Run:

```bash
cd dapp-ui
node --experimental-strip-types --test src/midnight/contract-result.test.ts
```

Expected: FAIL because `extractFinalizedTransactionMetadata` is not exported.

- [ ] **Step 3: Implement minimal public metadata extraction**

Add to `contract-result.ts`:

```ts
export interface FinalizedTransactionMetadata {
  readonly txHash: string;
  readonly blockHeight?: number;
}

export function extractFinalizedTransactionMetadata(
  result: unknown,
): FinalizedTransactionMetadata {
  if (!isRecord(result) || !isRecord(result.public)) {
    return { txHash: 'unknown' };
  }
  return {
    txHash: typeof result.public.txHash === 'string' ? result.public.txHash : 'unknown',
    blockHeight: typeof result.public.blockHeight === 'number'
      ? result.public.blockHeight
      : undefined,
  };
}
```

- [ ] **Step 4: Add failing disclosure construction tests**

Create `transfer-disclosure.test.ts` with synthetic byte arrays and a synthetic `PrivatePaymentState`. Assert:

```ts
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const disclosure = buildTransferDisclosure({
  senderPublicKey,
  recipientPublicKey,
  amount: 9n,
  txHash: 'synthetic-hash',
  blockHeight: 42,
  senderCommitment,
  recipientCommitment,
  nextPrivateState,
});

assert.equal(disclosure.onChain.senderPublicKey, hex(senderPublicKey));
assert.equal(disclosure.onChain.recipientPublicKey, hex(recipientPublicKey));
assert.equal(disclosure.localOnly.amount, 9n);
assert.equal(disclosure.localOnly.senderBalanceAfter, 91n);
assert.ok(!('secretKey' in disclosure.localOnly));
```

Add a second test that omits a sender balance or salt and expects:

```ts
assert.throws(
  () => buildTransferDisclosure(incompleteInput),
  /Transfer finalized, but disclosure rendering data is unavailable/,
);
```

- [ ] **Step 5: Run disclosure tests and verify RED**

Run:

```bash
node --experimental-strip-types --test src/midnight/transfer-disclosure.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 6: Add the sanitized types and minimal disclosure builder**

Define in `types/index.ts`:

```ts
export interface TransferDisclosureSnapshot {
  readonly onChain: {
    readonly senderPublicKey: string;
    readonly recipientPublicKey: string;
    readonly senderCommitment: string;
    readonly recipientCommitment: string;
    readonly txHash: string;
    readonly blockHeight: number;
  };
  readonly localOnly: {
    readonly amount: bigint;
    readonly senderBalanceAfter: bigint;
    readonly senderSalt: string;
    readonly recipientSalt: string;
  };
}

export interface TransactionResult {
  readonly txHash: string;
  readonly status: TxStatus;
  readonly blockHeight?: number;
  readonly result?: bigint;
  readonly disclosure?: TransferDisclosureSnapshot;
  readonly explorerUrl: string;
}
```

Add to `ContractContext`:

```ts
readonly readPrivateBalance: () => Promise<bigint>;
```

Implement `transfer-disclosure.ts` as a pure validator. Convert all byte arrays with a local lowercase hex helper. Lookup private maps by the sender and recipient hex keys. Return only the fields declared in `TransferDisclosureSnapshot`.

- [ ] **Step 7: Narrow `contract.ts` and retain the provider explicitly**

Refactor provider constructors to accept one typed in-memory private-state provider rather than constructing their own. In `connectToContract`:

```ts
const privateStateProvider = inMemoryPrivateStateProvider<string, PrivatePaymentState>();
const senderPublicKey = deriveContractPublicKey(secretKey);
const { compiledContract, contractModule } = await buildCompiledContract();
```

Make `buildCompiledContract()` return both values. Update `makeTransactionResult` to use `extractFinalizedTransactionMetadata` and never assign the raw `result` object.

Add these fail-closed local helpers in `contract.ts`:

```ts
function requireRecord(value: unknown, message: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null) throw new Error(message);
  return value as Record<string, unknown>;
}

function getPublicNextContractState(result: unknown): unknown {
  const root = requireRecord(result, 'Finalized transfer result is unavailable');
  const publicData = requireRecord(root.public, 'Finalized public transfer data is unavailable');
  if (publicData.nextContractState == null) {
    throw new Error('Finalized public contract state is unavailable');
  }
  return publicData.nextContractState;
}

function getPrivateNextState(result: unknown): PrivatePaymentState {
  const root = requireRecord(result, 'Finalized transfer result is unavailable');
  const privateData = requireRecord(root.private, 'Finalized private transfer data is unavailable');
  return privateData.nextPrivateState as PrivatePaymentState;
}

function requireBlockHeight(value: number | undefined): number {
  if (value == null) {
    throw new Error('Transfer finalized, but its block height is unavailable');
  }
  return value;
}
```

Before awaiting `private_transfer`, copy the mutable transfer context. After finalization:

```ts
const publicState = getPublicNextContractState(result);
const privateState = getPrivateNextState(result);
const ledgerView = contractModule.ledger(
  publicState as Parameters<typeof contractModule.ledger>[0],
);
const disclosure = buildTransferDisclosure({
  senderPublicKey,
  recipientPublicKey: submitted.recipient,
  amount: submitted.amount,
  txHash: metadata.txHash,
  blockHeight: requireBlockHeight(metadata.blockHeight),
  senderCommitment: ledgerView.balance_commitments.lookup(senderPublicKey),
  recipientCommitment: ledgerView.balance_commitments.lookup(submitted.recipient),
  nextPrivateState: privateState,
});
```

Return `{ ...makeTransactionResult(result), disclosure }`. For `check_balance`, retain only `extractCircuitResult(result)` after validating it is `bigint`.

Implement `readPrivateBalance()` by reading `privatePaymentBrowser` from the retained provider and looking up the derived sender key. Throw `Local contract balance is unavailable` if state is missing.

- [ ] **Step 8: Run focused and full tests**

Run:

```bash
node --experimental-strip-types --test src/midnight/contract-result.test.ts src/midnight/transfer-disclosure.test.ts
npm test
npx tsc --noEmit
```

Expected: all PASS and no type errors.

- [ ] **Step 9: Verify the retained provider wiring in the real browser with a boolean-only probe**

Temporarily add this hook immediately after `useContract` connects successfully. Never commit it:

```ts
(window as unknown as Record<string, unknown>).__demoBalancePositive =
  async () => (await ctx.readPrivateBalance()) > 0n;
```

With the existing private runtime configuration and disposable Demo wallet, connect the wallet and contract, then perform one deposit. In DevTools evaluate:

```js
await __demoBalancePositive()
```

Expected: `true` only. Do not print, inspect, or retain the balance value. If the result is `false` or throws, stop before Task 3 and investigate the retained-provider wiring. Task 2 may proceed while this runtime check is pending, but Task 3/4 must not begin until it passes.

Remove the temporary hook immediately and verify:

```bash
git diff -- dapp-ui/src/hooks/useContract.ts
```

Expected: empty output.

- [ ] **Step 10: Commit Task 1**

```bash
git add dapp-ui/src/types/index.ts dapp-ui/src/midnight/contract-result.ts dapp-ui/src/midnight/contract-result.test.ts dapp-ui/src/midnight/transfer-disclosure.ts dapp-ui/src/midnight/transfer-disclosure.test.ts dapp-ui/src/midnight/contract.ts dapp-ui/src/hooks/useTransaction.ts
git commit -m "fix(ui): sanitize transfer disclosure state"
```

---

### Task 2: Build and pass G-6 visibility panel

**Files:**
- Create: `dapp-ui/src/midnight/visibility-model.ts`
- Create: `dapp-ui/src/midnight/visibility-model.test.ts`
- Create: `dapp-ui/src/components/VisibilityPanel.tsx`
- Modify: `dapp-ui/src/App.tsx:12-153`
- Modify: `dapp-ui/src/midnight/privacy-copy.test.ts:9-26`

**Interfaces:**
- Consumes: `TransferDisclosureSnapshot` from Task 1.
- Produces: `buildVisibilityModel(disclosure, repetition)` and a new `visibility` tab.

- [ ] **Step 1: Write failing column-placement tests**

Use these fixed fixtures so byte-derived hex values contain only `a`–`f` and cannot accidentally match the decimal amount or balance digit runs:

```ts
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');
const senderPublicKey = new Uint8Array(32).fill(0xaa);
const recipientPublicKey = new Uint8Array(32).fill(0xbb);
const senderCommitment = new Uint8Array(32).fill(0xcc);
const recipientCommitment = new Uint8Array(32).fill(0xdd);
const senderSalt = new Uint8Array(32).fill(0xee);
const recipientSalt = new Uint8Array(32).fill(0xff);

const disclosure: TransferDisclosureSnapshot = {
  onChain: {
    senderPublicKey: hex(senderPublicKey),
    recipientPublicKey: hex(recipientPublicKey),
    senderCommitment: hex(senderCommitment),
    recipientCommitment: hex(recipientCommitment),
    txHash: 'synthetic-transaction',
    blockHeight: 42,
  },
  localOnly: {
    amount: 1234567n,
    senderBalanceAfter: 7654321n,
    senderSalt: hex(senderSalt),
    recipientSalt: hex(recipientSalt),
  },
};

const row = (rows: readonly VisibilityRow[], label: string) =>
  rows.find((candidate) => candidate.label === label)?.value;

const one = buildVisibilityModel(disclosure, 1);
assert.deepEqual(one.onChain.map((row) => row.label), [
  'Sender public key',
  'Recipient public key',
  'Sender commitment',
  'Recipient commitment',
  'Transaction hash',
  'Block height',
]);
assert.deepEqual(one.localOnly.map((row) => row.label), [
  'Transfer amount',
  'Sender balance after transfer',
  'Sender salt',
  'Recipient salt',
]);

assert.equal(row(one.onChain, 'Sender public key'), hex(senderPublicKey));
assert.equal(row(one.onChain, 'Recipient public key'), hex(recipientPublicKey));
assert.equal(row(one.localOnly, 'Transfer amount'), '1234567');
assert.equal(row(one.localOnly, 'Sender balance after transfer'), '7654321');
assert.equal(row(one.localOnly, 'Sender salt'), hex(senderSalt));
assert.equal(row(one.localOnly, 'Recipient salt'), hex(recipientSalt));

const localOnlyJson = JSON.stringify(one.localOnly);
assert.doesNotMatch(localOnlyJson, new RegExp(hex(senderPublicKey), 'i'));
assert.doesNotMatch(localOnlyJson, new RegExp(hex(recipientPublicKey), 'i'));

const onChainJson = JSON.stringify(one.onChain);
assert.doesNotMatch(onChainJson, new RegExp(hex(senderSalt), 'i'));
assert.doesNotMatch(onChainJson, new RegExp(hex(recipientSalt), 'i'));
assert.doesNotMatch(onChainJson, /1234567/);
assert.doesNotMatch(onChainJson, /7654321/);

for (const mode of [1, 100] as const) {
  const model = buildVisibilityModel(disclosure, mode);
  assert.ok(model.publicComparisonCaption.length > 0);
  assert.match(model.publicComparisonCaption, /comparison/i);
}

const repeated = buildVisibilityModel(disclosure, 100);
assert.match(repeated.lesson, /counterparty-key trail/i);
assert.equal(repeated.isIllustration, true);
```

`VisibilityRow.value` is always a string. Do not call `JSON.stringify` on `TransferDisclosureSnapshot`, because its local amount fields are `bigint`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/midnight/visibility-model.test.ts
```

Expected: FAIL because the model module does not exist.

- [ ] **Step 3: Implement the pure visibility model**

Define:

```ts
export type RepetitionMode = 1 | 100;
export interface VisibilityRow { readonly label: string; readonly value: string }
export interface VisibilityModel {
  readonly publicComparison: readonly VisibilityRow[];
  readonly publicComparisonCaption: string;
  readonly onChain: readonly VisibilityRow[];
  readonly localOnly: readonly VisibilityRow[];
  readonly lesson: string;
  readonly isIllustration: boolean;
}
export function buildVisibilityModel(
  disclosure: TransferDisclosureSnapshot,
  repetition: RepetitionMode,
): VisibilityModel;
```

Map keys only to `onChain`; map amount, post-transfer balance, and both salts only to `localOnly`. Row values for amount and balance are unformatted decimal strings from `.toString()`; digit grouping is a panel-only concern. Set `publicComparisonCaption` to a non-empty comparison disclaimer for both repetition modes. For repetition `100`, keep the same single snapshot values but replace the lesson with an explicitly illustrative repeated-trail explanation.

- [ ] **Step 4: Add failing source-copy assertions**

Extend `privacy-copy.test.ts` to read `VisibilityPanel.tsx` and assert the three headings, `Public keys remain visible`, `Amounts remain hidden`, `Illustration only`, and no claim matching `recipient.*hidden on-chain`. Add this binding assertion so the panel cannot replace the tested model caption with independent JSX copy:

```ts
assert.match(visibilityPanel, /publicComparisonCaption/);
```

Run:

```bash
node --experimental-strip-types --test src/midnight/privacy-copy.test.ts
```

Expected: FAIL because `VisibilityPanel.tsx` does not exist.

- [ ] **Step 5: Implement `VisibilityPanel`**

Props:

```ts
interface VisibilityPanelProps {
  readonly disclosure: TransferDisclosureSnapshot | null;
}
```

Render an empty state when null. Otherwise render `1 transfer` and `×100 transfers` buttons, the three responsive columns, the exact public/private lesson, and the proof-of-concept limitation. Keep the three column headings static. Directly render `model.publicComparisonCaption` beneath the left heading without reconstructing or branching the caption in JSX. Use a display-only `shortHex` helper for long hex values and panel-only grouping for decimal values; do not add copy-to-clipboard or persistence.

- [ ] **Step 6: Wire the Visibility tab**

In `App.tsx`:

```ts
type Tab = 'wallet' | 'deposit' | 'transfer' | 'visibility' | 'explorer';
```

Add the tab and render `lastTransferResult?.disclosure ?? null`. After a successful transfer with a disclosure, store the result and call `setActiveTab('visibility')`. On disconnect, clear both last transaction results and return to `wallet`.

- [ ] **Step 7: Run G-6 automated checks**

```bash
node --experimental-strip-types --test src/midnight/visibility-model.test.ts src/midnight/privacy-copy.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all PASS. The existing large-chunk build warning is non-blocking; no new errors are allowed.

- [ ] **Step 8: Commit G-6 code**

```bash
git add dapp-ui/src/midnight/visibility-model.ts dapp-ui/src/midnight/visibility-model.test.ts dapp-ui/src/components/VisibilityPanel.tsx dapp-ui/src/App.tsx dapp-ui/src/midnight/privacy-copy.test.ts
git commit -m "feat(ui): add transfer visibility panel"
```

- [ ] **Step 9: Pass the G-6 browser gate before continuing**

Using the existing private runtime configuration and disposable Demo wallet, run one Preprod deposit and one transfer. Do not print or save runtime values. Verify in the browser DOM only:

- three columns are present;
- sender and recipient public-key rows are in `Midnight put on-chain`;
- amount, post-transfer balance, and salts are in `Not put on-chain`;
- both commitments, transaction hash, and block height are present;
- `×100 transfers` changes to the illustration lesson and does not submit a transaction.

If any item fails, stop before Task 3 and fix G-6 with a new failing test.

---

### Task 3: Implement deterministic policy and runner

**Files:**
- Create: `dapp-ui/src/agent/policy.ts`
- Create: `dapp-ui/src/agent/runner.ts`
- Create: `dapp-ui/src/midnight/policy.test.ts`

**Interfaces:**
- Produces: `evaluatePaymentPolicy(input)` and `runAutomaticPaymentPolicy(input, deps, onLog)`.
- Consumers: Task 4.

- [ ] **Step 1: Write failing policy tests**

Define expected cases with synthetic values:

```ts
assert.equal(evaluatePaymentPolicy({
  availableBalance: 100n,
  requestedAmount: 20n,
  perTransferLimit: 25n,
}).code, 'approved');

assert.equal(evaluatePaymentPolicy({
  availableBalance: 10n,
  requestedAmount: 20n,
  perTransferLimit: 25n,
}).code, 'insufficient_balance');

assert.equal(evaluatePaymentPolicy({
  availableBalance: 100n,
  requestedAmount: 30n,
  perTransferLimit: 25n,
}).code, 'over_limit');
```

Add zero/negative amount and zero/negative limit cases expecting `invalid_amount` or `invalid_limit`.

- [ ] **Step 2: Run and verify RED**

```bash
node --experimental-strip-types --test src/midnight/policy.test.ts
```

Expected: FAIL because `agent/policy.ts` does not exist.

- [ ] **Step 3: Implement the pure policy**

Use these exact public types:

```ts
export type PolicyReasonCode =
  | 'approved'
  | 'invalid_amount'
  | 'invalid_limit'
  | 'insufficient_balance'
  | 'over_limit';

export interface PaymentPolicyInput {
  readonly availableBalance: bigint;
  readonly requestedAmount: bigint;
  readonly perTransferLimit: bigint;
}

export interface PaymentPolicyDecision {
  readonly approved: boolean;
  readonly amount: bigint;
  readonly code: PolicyReasonCode;
  readonly summary: string;
  readonly input: PaymentPolicyInput;
}
```

Evaluate invalid values first, then insufficient balance, then per-transfer limit, then approval.

- [ ] **Step 4: Add failing runner tests**

Tests must use a real async function counter rather than a mocking library:

```ts
let transfers = 0;
const result = await runAutomaticPaymentPolicy(
  { requestedAmount: 20n, perTransferLimit: 25n, recipientHex: syntheticRecipient },
  {
    readBalance: async () => 100n,
    transfer: async () => {
      transfers += 1;
      return syntheticTransactionResult;
    },
  },
  (entry) => entries.push(entry),
);

assert.equal(transfers, 1);
assert.deepEqual(entries.map((entry) => entry.stage), [
  'evaluated', 'approved', 'submitted', 'confirmed',
]);
assert.equal(result.transaction, syntheticTransactionResult);
```

Add a rejection case asserting zero transfers and stages `evaluated`, `rejected`. Add a `transfer` returning null case asserting final stage `failed` and no confirmed transaction.

- [ ] **Step 5: Implement the runner minimally**

Define log stages and sequential entries without wall-clock timestamps:

```ts
export type PolicyLogStage =
  | 'evaluated'
  | 'approved'
  | 'rejected'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface PolicyLogEntry {
  readonly sequence: number;
  readonly stage: PolicyLogStage;
  readonly code: string;
  readonly message: string;
  readonly localInputs?: PaymentPolicyInput;
}

export interface PolicyRunInput {
  readonly requestedAmount: bigint;
  readonly perTransferLimit: bigint;
  readonly recipientHex: string;
}

export interface PolicyRunnerDependencies {
  readonly readBalance: () => Promise<bigint>;
  readonly transfer: (
    amount: bigint,
    recipientHex: string,
  ) => Promise<TransactionResult | null>;
}

export interface PolicyRunResult {
  readonly decision: PaymentPolicyDecision;
  readonly transaction: TransactionResult | null;
  readonly logs: readonly PolicyLogEntry[];
}

export async function runAutomaticPaymentPolicy(
  input: PolicyRunInput,
  dependencies: PolicyRunnerDependencies,
  onLog?: (entry: PolicyLogEntry) => void,
): Promise<PolicyRunResult>;
```

The runner must not place `recipientHex`, transaction hash, address, private state, or SDK results in the log.

- [ ] **Step 6: Run focused and full tests, then commit**

```bash
node --experimental-strip-types --test src/midnight/policy.test.ts
npm test
npx tsc --noEmit
git add dapp-ui/src/agent/policy.ts dapp-ui/src/agent/runner.ts dapp-ui/src/midnight/policy.test.ts
git commit -m "feat(ui): add automatic payment policy"
```

---

### Task 4: Build and pass G-7 policy UI

**Files:**
- Create: `dapp-ui/src/midnight/recipient.ts`
- Create: `dapp-ui/src/midnight/recipient.test.ts`
- Create: `dapp-ui/src/components/PolicyPanel.tsx`
- Modify: `dapp-ui/src/components/TransferPanel.tsx:13-18,83-108`
- Modify: `dapp-ui/src/App.tsx:1-153`
- Modify: `dapp-ui/src/midnight/privacy-copy.test.ts`

**Interfaces:**
- Consumes: `ContractContext.readPrivateBalance`, `runAutomaticPaymentPolicy`, `PolicyLogEntry`, and the existing `handleTransfer` path.
- Produces: the `policy` tab and persistent-in-App decision log.

- [ ] **Step 1: Write failing deterministic recipient-helper test**

Create `recipient.test.ts` using an injected 32-byte generator. Assert the result is exactly 64 lowercase hexadecimal characters and equals `deriveContractPublicKey` applied to the supplied synthetic secret.

Run:

```bash
node --experimental-strip-types --test src/midnight/recipient.test.ts
```

Expected: FAIL because `recipient.ts` does not exist.

- [ ] **Step 2: Implement and share recipient generation**

Expose:

```ts
export function generateRandomRecipientHex(
  randomBytes?: () => Uint8Array,
): string;
```

Default to `crypto.getRandomValues(new Uint8Array(32))`; reject any injected value not exactly 32 bytes. Replace the duplicate local generator in `TransferPanel` with this helper.

- [ ] **Step 3: Add failing policy-copy assertions**

Extend `privacy-copy.test.ts` to read `PolicyPanel.tsx` and assert:

```ts
assert.match(policyPanel, /Automatic Payment Policy/);
assert.match(policyPanel, /local policy inputs.*not put on-chain/i);
assert.match(policyPanel, /not a complete two-party payment/i);
assert.doesNotMatch(policyPanel, /AI agent/i);
assert.match(policyPanel, /type="password"/);
```

Expected initial result: FAIL because the component does not exist.

- [ ] **Step 4: Implement `PolicyPanel` as a controlled component**

Props:

```ts
interface PolicyPanelProps {
  readonly contract: ContractContext | null;
  readonly hasDeposited: boolean;
  readonly isRunning: boolean;
  readonly logs: readonly PolicyLogEntry[];
  readonly onRun: (input: {
    requestedAmount: bigint;
    perTransferLimit: bigint;
    recipientHex: string;
  }) => Promise<void>;
}
```

Use decimal strings for both numeric inputs and parse only on submit. Reject empty, negative, or non-integer values locally. Generate the recipient through the shared helper and render it with `type="password"`. Render logs in sequence order and label `localInputs` as local-only values.

- [ ] **Step 5: Wire the runner in `App.tsx`**

Extend the tab union with `policy`. Add App-level `policyLogs`, `isPolicyRunning`, and a `policyRunRef` so logs survive the automatic switch to Visibility and same-tick re-entry is impossible.

Implement one re-entry-guarded callback:

```ts
const handlePolicyRun = useCallback(async (input: PolicyRunInput) => {
  if (!contractHook.contract || policyRunRef.current) return;
  policyRunRef.current = true;
  setIsPolicyRunning(true);
  setPolicyLogs([]);
  try {
    await runAutomaticPaymentPolicy(
      input,
      {
        readBalance: contractHook.contract.readPrivateBalance,
        transfer: handleTransfer,
      },
      (entry) => setPolicyLogs((current) => [...current, entry]),
    );
  } finally {
    policyRunRef.current = false;
    setIsPolicyRunning(false);
  }
}, [contractHook.contract, handleTransfer]);
```

Keep policy rejection on the Policy tab. The existing successful transfer handler switches to Visibility only when a confirmed transaction contains a disclosure snapshot. Clear policy logs on disconnect.

- [ ] **Step 6: Run G-7 automated checks**

```bash
node --experimental-strip-types --test src/midnight/recipient.test.ts src/midnight/policy.test.ts src/midnight/privacy-copy.test.ts
npm test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all PASS with no new warnings other than the existing build chunk/deprecation warnings.

- [ ] **Step 7: Commit G-7 UI**

```bash
git add dapp-ui/src/midnight/recipient.ts dapp-ui/src/midnight/recipient.test.ts dapp-ui/src/components/PolicyPanel.tsx dapp-ui/src/components/TransferPanel.tsx dapp-ui/src/App.tsx dapp-ui/src/midnight/privacy-copy.test.ts
git commit -m "feat(ui): connect automatic payment policy"
```

- [ ] **Step 8: Pass the G-7 browser gate**

With the already synchronized disposable Demo wallet and Preprod contract:

1. Enter a request above the limit and verify `rejected` appears with no pending transaction.
2. Enter an approved request and verify log stages `evaluated → approved → submitted → confirmed`.
3. Verify exactly one new transfer is confirmed.
4. Verify the UI switches to Visibility and its disclosure snapshot corresponds to the policy transfer.
5. Return to Policy and verify the decision log remains visible.

Do not print, screenshot, record, or commit runtime identifiers or private values during acceptance.

---

### Task 5: Final regression, private worklog, and branch handoff

**Files:**
- Modify: `/Users/sition/Documents/SITION/WORKLOG.md`

**Interfaces:**
- Consumes: completed G-6/G-7 code and browser evidence.
- Produces: clean unpushed branch and a private handoff record.

- [ ] **Step 1: Run the full suite three consecutive times**

```bash
cd dapp-ui
npm test
npm test
npm test
```

Expected each run: identical test count, zero failures.

- [ ] **Step 2: Run static verification**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all exit zero. Existing Vite chunk/deprecation warnings may remain; no new errors.

- [ ] **Step 3: Audit the exact diff**

```bash
cd ..
git diff --check
git status --short
git log --oneline -8
```

Search only source/docs text for forbidden concrete runtime material. Do not scan or print private runtime files.

- [ ] **Step 4: Append the private WORKLOG entry**

Record G-6 and G-7 pass/fail, automated test counts, and commit IDs. Do not record any address, transaction identifier, block height, balance, salt, synchronization counter, seed, or asset quantity. Do not commit the parent repository WORKLOG with this public branch.

- [ ] **Step 5: Final status check**

```bash
git status --short --branch
```

Expected: clean `codex/midnight-demo-v2-implementation`. Do not push.

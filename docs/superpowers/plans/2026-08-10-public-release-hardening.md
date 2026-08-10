# Midnight Demo v2 Public-Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development and complete every RED-GREEN-REFACTOR cycle before moving to the next task.

**Goal:** Resolve the five important review findings, then finish the public copy, dependency pin, and Indexer freshness preflight without operating mainnet, 1AM, or publishing the branch.

**Architecture:** A contract-scoped witness input and FIFO queue serialize calls. Finalized results carry typed post-finalization issues instead of being reclassified as failures. A latest-generation wallet lifecycle cancels stale connections. Shared pure validators enforce secret-field and recipient rules. A small offline-testable preflight parser validates public Indexer freshness.

**Tech Stack:** TypeScript 5.9, React 19, Node `node:test`, Midnight JS 4.1.1, Python 3 standard library, POSIX shell.

## Global constraints

- Do not change the Compact contract.
- Do not touch mainnet or operate the 1AM extension.
- Do not copy private design/risk documents into this public repository.
- Do not commit secrets or operational identifiers.
- Preserve the two unrelated pre-existing untracked demo files.
- Do not push.

### Task 1: Contract-scoped transfer context and FIFO serialization

**Files:**
- Modify: `dapp-ui/src/midnight/witness.ts`
- Modify: `dapp-ui/src/midnight/contract.ts`
- Modify: `dapp-ui/src/types/index.ts`
- Create: `dapp-ui/src/midnight/contract-serialization.ts`
- Create: `dapp-ui/src/midnight/contract-serialization.test.ts`
- Create: `dapp-ui/src/midnight/witness.test.ts`

- [ ] Write tests proving two witness contexts cannot observe each other's values.
- [ ] Run the focused tests and observe RED against the module-level context.
- [ ] Write tests proving a second call does not start until the first settles and that a rejected call does not wedge the queue.
- [ ] Run the focused tests and observe RED because the queue does not exist.
- [ ] Add the minimum contract-scoped context and FIFO queue implementation.
- [ ] Route deposit, transfer, and check-balance calls through the same queue; clear transfer input in `finally`.
- [ ] Run focused tests and the full UI suite GREEN.

### Task 2: Preserve confirmed status when disclosure enrichment fails

**Files:**
- Modify: `dapp-ui/src/types/index.ts`
- Modify: `dapp-ui/src/midnight/contract-result.ts`
- Modify: `dapp-ui/src/midnight/contract-result.test.ts`
- Modify: `dapp-ui/src/midnight/contract.ts`
- Modify: `dapp-ui/src/components/TxResult.tsx`

- [ ] Write tests proving an enrichment exception returns a confirmed result with a typed issue and no disclosure.
- [ ] Run the focused test and observe RED.
- [ ] Add the minimum result-enrichment helper and typed issue.
- [ ] Build the base confirmed result before disclosure extraction and use the helper in the live transfer path.
- [ ] Render a warning without changing the confirmed status.
- [ ] Run focused and full UI tests GREEN.

### Task 3: Cancel stale wallet connections

**Files:**
- Create: `dapp-ui/src/midnight/wallet-connection-lifecycle.ts`
- Create: `dapp-ui/src/midnight/wallet-connection-lifecycle.test.ts`
- Modify: `dapp-ui/src/midnight/sync-timeout.ts`
- Modify: `dapp-ui/src/midnight/sync-timeout.test.ts`
- Modify: `dapp-ui/src/midnight/wallet.ts`
- Modify: `dapp-ui/src/hooks/useWallet.ts`
- Modify: `dapp-ui/src/App.tsx`

- [ ] Write tests proving disconnect aborts a pending factory and stops a late resource.
- [ ] Write tests proving a newer generation is the only accepted result.
- [ ] Write a sync-lifecycle test proving abort stops an active wallet without waiting for timeout.
- [ ] Run focused tests and observe RED.
- [ ] Add the latest-generation lifecycle and `AbortSignal` support.
- [ ] Wire connect, mode change, disconnect, and unmount through the lifecycle.
- [ ] Reset dependent UI on every mode change/disconnect, including while connect is pending.
- [ ] Run focused and full UI tests GREEN.

### Task 4: Minimize disposable seed exposure

**Files:**
- Create: `dapp-ui/src/midnight/secret-input.ts`
- Create: `dapp-ui/src/midnight/secret-input.test.ts`
- Modify: `dapp-ui/src/components/WalletPanel.tsx`
- Modify: `dapp-ui/src/hooks/useWallet.ts`
- Modify: `dapp-ui/src/types/index.ts`
- Modify: `dapp-ui/src/midnight/privacy-copy.test.ts`

- [ ] Write a focused test for hidden-by-default and explicit-reveal input attributes.
- [ ] Extend the lifecycle test to require seed clearing after accept and disconnect through the hook-owned reset path.
- [ ] Run focused tests and observe RED.
- [ ] Add the masked field, reveal control, autocomplete protection, and disposable-only warning.
- [ ] Clear the seed after successful initialization, disconnect, and mode change; remove it from `WalletContext`.
- [ ] Run focused and full UI tests GREEN.

### Task 5: Strict recipient public-key decoding

**Files:**
- Modify: `dapp-ui/src/midnight/recipient.ts`
- Modify: `dapp-ui/src/midnight/recipient.test.ts`
- Modify: `dapp-ui/src/hooks/useTransaction.ts`
- Modify: `dapp-ui/src/components/TransferPanel.tsx`
- Modify: `dapp-ui/src/components/PolicyPanel.tsx`

- [ ] Add table-driven tests for valid upper/lowercase input and invalid length, character, and whitespace cases.
- [ ] Run the focused test and observe RED.
- [ ] Implement one exact 64-hex parser and validator.
- [ ] Use it in UI enablement and at the transaction boundary.
- [ ] Run focused and full UI tests GREEN.

### Task 6: Correct the public deposit description and pin MCP

**Files:**
- Modify: `dapp-ui/src/components/DepositPanel.tsx`
- Modify: `dapp-ui/src/App.tsx`
- Modify: `dapp-ui/src/midnight/privacy-copy.test.ts`
- Modify public README/manual/script files only where they repeat the inaccurate wording.
- Modify: `.mcp.json`

- [ ] Add a public-copy regression that rejects claims that demo deposit moves wallet tNIGHT.
- [ ] Run it and observe RED.
- [ ] Replace the label and explanation with demo balance initialization/commitment wording.
- [ ] Determine the reviewed MCP version from authoritative package metadata and pin it exactly.
- [ ] Run public-source scans and UI tests GREEN.

### Task 7: Fail-closed Indexer freshness preflight

**Files:**
- Create: `demo/check-indexer-freshness.py`
- Create: `demo/test_check_indexer_freshness.py`
- Modify: `demo/run-local-demo.sh`

- [ ] Establish the v4 public tip query from authoritative documentation/schema evidence.
- [ ] Write offline tests for fresh, stale, malformed, and future-skewed synthetic responses.
- [ ] Run the focused tests and observe RED.
- [ ] Implement the parser with no dependencies and boolean/status-only output.
- [ ] Add the query before local service startup and fail closed on stale/malformed data.
- [ ] Run offline tests and `bash -n` GREEN; do not call the live endpoint in automated tests.

### Task 8: Final verification and handoff

- [ ] Run all UI tests three times.
- [ ] Run `npx tsc --noEmit`, lint, and production build.
- [ ] Run deploy-test tests/build checks supported by the repository.
- [ ] Run Python preflight tests and shell syntax validation.
- [ ] Inspect the complete diff and scan for secrets, runtime values, local paths, and accidental unrelated files.
- [ ] Append one private `WORKLOG.md` entry without operational identifiers.
- [ ] Commit only intended files on the feature branch.
- [ ] Report exact verification and remaining push/publication gate.

# G-6 Visibility Panel and G-7 Automatic Payment Policy Design

**Status:** APPROVED — implementation GO received 2026-08-04

**Scope:** Preprod workshop UI only

## Purpose

Finish the two workshop gates that follow the working transaction flow:

- G-6 shows exactly which transfer fields are public and which remain local.
- G-7 evaluates a deterministic payment policy, records its decision, and submits an approved transfer.

The UI must make the central lesson explicit: the transfer amount is hidden, while sender and recipient public keys remain visible. This is a private-balance-update proof of concept, not a complete two-party payment system.

## Non-goals

- No Compact contract changes.
- No mainnet or 1AM operations.
- No external model or API call.
- No claim that the policy engine is an AI agent.
- No recipient private-state delivery.
- No persistence of contract private state, disclosure snapshots, or policy logs.
- No real wallet address, transaction identifier, block height, balance, salt, or other operational value in committed source, tests, or documentation. Tests use synthetic fixtures only.

## Safety boundary

Midnight finalized-call results contain a privacy-sensitive `private` envelope. Transaction conversion will retain only explicitly selected values:

- public transaction metadata needed by the UI;
- the scalar return value from `check_balance`;
- a purpose-built transfer disclosure snapshot.

The full SDK result, secret key, unproven transaction, witness transcript, and next private state must never be logged, serialized, persisted, or stored in React state. Private values used by the visibility panel are copied into an ephemeral, typed snapshot and discarded on reload.

## G-6 architecture

### Transfer disclosure snapshot

After a successful transfer, the contract adapter creates a typed snapshot with two explicit sections:

1. `onChain`
   - sender public key;
   - recipient public key;
   - sender commitment hash;
   - recipient commitment hash;
   - transaction hash and block height.
2. `localOnly`
   - transfer amount;
   - sender balance after transfer;
   - sender and recipient salts.

The sender key is derived locally from the contract secret. The recipient key and amount come from the submitted transfer context. Commitment hashes are read from the generated contract ledger view over the finalized public contract state. Balances and salts are copied from the finalized private state without retaining the surrounding SDK result.

If any required field is unavailable, snapshot construction fails closed with a clear UI error. The transfer may already be finalized, so the error must say that disclosure rendering failed rather than claiming that the transaction failed.

### Visibility panel

A new `Visibility` tab displays the latest successful transfer in three columns:

| Public chain comparison | Midnight put on-chain | Not put on-chain |
|---|---|---|
| sender identifier | sender public key | transfer amount |
| recipient identifier | recipient public key | sender balance after transfer |
| amount and resulting balance | two commitment hashes | sender and recipient salts |
| transaction trail | transaction hash and block height | — |

The first column is an explicitly labelled comparison, not a transaction sent to another chain. The second and third columns use the ephemeral snapshot. Public keys must appear only in the visible/on-chain column. Amount, balance, and salts must appear only in the local/not-on-chain column.

After a successful manual or policy transfer, the UI switches to the Visibility tab. Before the first transfer, the panel shows an instructional empty state.

### Repetition toggle

`1 transfer` and `×100 transfers` controls change only the explanatory view; they never submit additional transactions. The repeated view explains:

- a public chain exposes a value-linked activity trail;
- Midnight still exposes the counterparty-key trail;
- amounts remain hidden for each transfer.

The UI must label this as an illustration so that it cannot be mistaken for 100 observed transactions.

## G-7 architecture

### Deterministic policy

`agent/policy.ts` exports a pure evaluator. Its inputs are:

- locally available sender balance;
- requested transfer amount;
- per-transfer limit.

It rejects non-positive values, amounts above the available balance, and amounts above the configured limit. Otherwise it approves the exact requested amount. The output contains a stable reason code and a short factual explanation. It does not contain model-generated reasoning or chain-of-thought.

### Runner

`agent/runner.ts` coordinates one policy attempt:

1. read the sender balance from the contract's local private-state provider without calling `check_balance`;
2. evaluate the pure policy;
3. record the evaluation and decision;
4. if approved, invoke the existing transfer path once;
5. record submission and confirmation or failure.

A rejected policy must never call the transfer function. Concurrent runs are blocked. A failed submission remains retryable and preserves an accurate failure log.

### Policy panel

A new `Policy` tab provides:

- requested amount;
- per-transfer limit;
- a masked, generated recipient public key;
- an `Evaluate and transfer` action;
- a chronological decision log.

The log labels balance, amount, and limit as local policy inputs that are not put on-chain by the transfer. The panel calls this feature an **Automatic Payment Policy**, never an AI agent. It also repeats the proof-of-concept limitation about recipient private-state delivery.

On confirmation, the resulting disclosure snapshot becomes the G-6 panel input and the UI switches to Visibility.

## Error handling

- Invalid numeric or recipient input is rejected before evaluation.
- Policy rejection is a successful decision outcome, not a transaction error.
- Missing local private state fails closed and does not call the circuit.
- Disclosure extraction failure is distinct from transaction failure.
- No error path prints or serializes the SDK result or private state.
- Existing wallet and transaction retry behavior remains available.

## Testing and gate acceptance

All new logic uses the existing `node:test` setup.

### Automated tests

- finalized-call sanitization does not retain the full private envelope;
- disclosure extraction maps synthetic public/private data to the correct columns;
- missing disclosure fields fail closed;
- the policy approves, rejects for insufficient balance, rejects over the limit, and rejects invalid values;
- the runner calls transfer exactly once only when approved;
- the runner records confirmation and failure accurately;
- source-level disclosure assertions keep public keys in the on-chain column and amount, balance, and salts in the not-on-chain column;
- workshop copy never calls the deterministic policy an AI agent.

### G-6 acceptance

- A real Preprod transfer populates all three columns.
- Sender and recipient public keys appear in the middle column.
- Amount, post-transfer balance, and salts appear only in the right column.
- The `×100` illustration accurately distinguishes value trails from counterparty trails.

### G-7 acceptance

- A rejected decision produces a log and no transaction.
- An approved decision produces a log and fires one real Preprod transfer.
- The resulting confirmed transfer feeds the G-6 panel.

Before completion, run the full test suite three consecutive times, TypeScript checking, ESLint, production build, and browser verification. No push is included.

## Implementation order

1. Narrow the transaction-result privacy boundary with failing tests first.
2. Add disclosure extraction and G-6 UI with failing tests first; pass G-6 before continuing.
3. Add the pure policy, runner, and G-7 UI with failing tests first.
4. Perform real Preprod acceptance, update the private WORKLOG, and commit exact scope.

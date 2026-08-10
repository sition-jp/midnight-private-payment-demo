# Midnight Demo v2 Public-Release Hardening Design

**Status:** APPROVED — implementation GO received 2026-08-10

**Scope:** Preprod workshop UI and local operator preflight only

## Purpose

Close the five important correctness and privacy findings from the pre-publication
review, then make the public copy and local startup preflight accurately describe
and validate the demo.

## Safety boundaries

- Keep the Compact contract unchanged.
- Keep mainnet and the 1AM transaction path closed.
- Never commit a seed, address, transaction identifier, block height, balance,
  salt, synchronization counter, or other operator-specific value.
- Preserve the disclosure lesson: transfer amount, balance values, and salts are
  hidden; sender and recipient public keys remain visible.
- Describe the project as a private-balance-update proof of concept, not a
  complete two-party payment.
- Do not push as part of this implementation gate.

## 1. Contract-call isolation

Each connected contract gets its own mutable transfer input object. The compiled
witness provider closes over that object; there is no module-level transfer
input shared by unrelated contract instances.

Every state-changing contract call runs through one FIFO queue owned by that
`ContractContext`. A transfer sets its local witness input inside the queued
critical section and clears the amount and recipient bytes in `finally`. Deposit,
transfer, and balance-disclosure calls therefore cannot overlap or replace one
another's witness inputs.

## 2. Finalization and disclosure are separate outcomes

Once Midnight returns a finalized transfer result, the transaction is reported
as confirmed. Visibility-snapshot construction is a post-finalization enrichment
step. If that enrichment fails, the adapter returns the confirmed transaction
with a typed `transfer-disclosure-unavailable` issue. It must not throw through
the transaction path or present the finalized transfer as failed.

The UI renders this issue as a warning: the transfer is confirmed, but the
Visibility lesson is unavailable for that result.

## 3. Wallet lifecycle ownership

A latest-operation lifecycle owns one wallet connection attempt at a time.
Starting a new connection, switching modes, disconnecting, or unmounting:

1. increments the operation generation;
2. aborts the prior attempt;
3. prevents stale results from entering React state; and
4. stops any stale wallet resource that eventually resolves.

Demo-wallet synchronization accepts an `AbortSignal`. Cancellation stops the
active wallet lifecycle; it does not wait for the normal idle or absolute
timeout. Mode changes reset wallet and contract-dependent UI state even when a
wallet context has not yet been published.

## 4. Disposable seed handling

The Demo seed field is masked by default and can be revealed only by an explicit
local control. Browser autocomplete is disabled. The UI states that only a
disposable Preprod demo seed is permitted and that a real wallet seed must never
be used.

The seed remains local React input only while needed to initialize the wallet.
It is cleared after a successful connection, on disconnect, and on mode change.
`WalletContext` does not expose or retain it.

## 5. Strict recipient decoding

One shared parser accepts exactly 64 hexadecimal characters and returns exactly
32 bytes. Invalid characters, short or long values, whitespace, and partial
`parseInt` results are rejected before a contract call. Manual and policy paths
use the same validation boundary.

## 6. Public surface and operator preflight

The public UI and documentation call `deposit` a demo balance initialization or
commitment update. They explicitly state that it does not transfer wallet
tNIGHT into the contract.

The MCP command uses an exact reviewed version rather than `latest`.

The local runner checks the configured Preprod Indexer before starting the UI.
It queries the public chain tip timestamp, calculates age locally, prints only
boolean/status information, and fails closed when the response is malformed or
older than the configured freshness limit. Tests use synthetic responses and no
network.

## Verification

Each behavior is implemented with a strict RED-GREEN-REFACTOR cycle. Completion
requires focused tests for each finding, the full UI unit suite, TypeScript,
lint, production build, deploy-test tests, and shell syntax checks. Public-source
scans must find no secret or operator-specific values.

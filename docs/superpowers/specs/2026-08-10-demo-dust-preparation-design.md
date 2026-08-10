# Demo DUST Preparation Design

**Date:** 2026-08-10

## Goal

Let a synchronized Demo Mode wallet prepare enough Preprod DUST to submit the
demo contract transactions without changing its seed or IndexedDB cache.

The workflow is limited to newly funded, unregistered Preprod tNIGHT owned by
the connected Demo wallet. It does not support Mainnet, browser-extension
wallets, or automatic faucet requests.

## User flow

The Wallet screen shows a DUST preparation card after Demo Mode synchronization.

1. Read the current tNIGHT and DUST state.
2. If tNIGHT is zero, offer the official Preprod faucet link and a refresh
   action. The user requests tNIGHT outside the application.
3. If unregistered tNIGHT UTXOs exist, offer **Register tNIGHT for DUST** with
   an explicit explanation that it submits an on-chain registration.
4. Submit one registration containing only currently available UTXOs whose
   `registeredForDustGeneration` flag is false.
5. Continue observing the synchronized wallet state until DUST becomes
   positive, then show **DUST ready**.

Contract connection remains disabled until Demo Mode reports positive DUST.
Because transaction panels require a contract connection, this prevents the
known `Wallet.InsufficientFunds: could not balance dust` failure before proving.
Wallet-extension mode keeps its existing behavior.

## Wallet capability

`WalletContext` gains an optional Demo-only DUST preparation capability. The
implementation retains the already-created `WalletFacade`, unshielded keystore,
and DUST secret key; it does not derive a second wallet or request the seed
again.

The capability exposes:

- a sanitized readiness snapshot containing tNIGHT balance, DUST readiness,
  and whether an eligible unregistered UTXO exists;
- a refresh operation that reads the latest strictly synchronized state;
- a single-flight registration operation;
- progress notifications for registration and DUST-generation waiting.

Registration uses the installed SDK's
`registerNightUtxosForDustGeneration`, signs with the retained unshielded
keystore, sends DUST to the wallet's own `DustAddress`, finalizes the recipe,
and submits it through the same wallet facade.

## State model

A pure model maps wallet facts and operation state to these UI states:

- `needs-tnight`
- `ready-to-register`
- `registering`
- `waiting-for-dust`
- `dust-ready`
- `unavailable`
- `error`

The model controls labels, enabled actions, and explanatory copy. The React
component renders the model rather than reconstructing safety decisions.

## Safety and failure handling

- Fail closed unless strict wallet synchronization has completed.
- Never register already-registered or pending tNIGHT UTXOs.
- Prevent concurrent refresh or registration operations.
- Never call the faucet, initialize the contract balance, or retry registration
  automatically.
- Do not expose or log the seed, full address, UTXO data, transaction identifier,
  balance history, or synchronization counters.
- A failed submission returns the UTXOs to wallet control when supported by the
  SDK and presents a sanitized retryable error.
- Waiting for generated DUST uses wallet-state progress with an absolute limit;
  a timeout does not imply that registration failed and does not resubmit it.
- Disconnect cancels observers and late state updates.

## Testing

Implementation follows TDD:

1. Pure model tests cover every state and action gate.
2. Wallet tests assert selection of only eligible UTXOs, own-address
   registration, signing/finalization/submission order, single-flight behavior,
   timeout behavior, and sanitized errors.
3. Hook/lifecycle tests cover disconnect and stale-completion races.
4. Source/privacy tests ensure the public copy does not claim that faucet use or
   DUST generation is automatic.
5. Full unit tests, lint, and production build must pass before commit.

## Non-goals

- Mainnet DUST operations
- 1AM/Lace DUST registration
- Moving existing registered NIGHT
- Contract changes
- Automatic faucet requests
- Persisting new secrets or operational identifiers

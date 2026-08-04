# Midnight Private Payment Demo v2 — Local Preprod Checklist

This checklist covers the public workshop flow in **Preprod / Demo Mode**.
It intentionally excludes wallet identifiers, transaction identifiers, balances,
seeds, synchronization counters, and operator-specific environment details.

## 1. Safety boundary

- Use a disposable demo seed created for Preprod testing only.
- Never paste a seed into chat, screenshots, logs, issues, commits, or recordings.
- Do not reuse a real wallet or switch this workflow to mainnet.
- The proof of concept hides transfer amounts, balance values, and salts.
- Sender and recipient public keys remain visible on-chain.
- `check_balance` publicly discloses its returned balance.
- Recipient private state is not delivered, so this is not a complete two-party payment.

To reuse a previously synchronized Demo wallet, keep the same browser profile,
origin, and disposable seed. A new seed or browser storage reset requires a fresh
Preprod synchronization.

## 2. Start the local demo

From the repository root:

```bash
bash demo/run-local-demo.sh --check
bash demo/run-local-demo.sh
```

The preflight verifies that:

- the local proof server responds;
- the deployment metadata identifies Preprod;
- a contract address is present without printing it;
- the fixed local port is available.

If the ignored deployment file is stored elsewhere, provide it explicitly:

```bash
MIDNIGHT_DEPLOYMENT_JSON=/absolute/path/to/deployment.json \
  bash demo/run-local-demo.sh
```

## 3. Workshop flow

Open `http://localhost:5173` in the browser profile used for the Demo wallet.
The application exposes six tabs:

1. **Wallet**
   - Select Demo Mode.
   - Enter the disposable seed locally and connect.
   - Wait until Shielded, Unshielded, and DUST synchronization reaches the exact tip.
   - Connect to the deployed contract.
2. **Deposit**
   - Submit a Preprod deposit.
   - Explain that the deposit amount is public while the stored balance value is hidden.
3. **Private Transfer**
   - Generate a disposable recipient public key.
   - Submit one hidden-amount transfer.
   - Explain that the amount is hidden but both public keys remain visible.
4. **Visibility**
   - Compare the public-chain example, on-chain Midnight data, and local-only values.
   - Switch to the `×100 transfers` illustration and confirm that it does not submit transactions.
5. **Policy**
   - Run an over-limit request and confirm `evaluated → rejected` with no transfer.
   - Run an allowed request and confirm
     `evaluated → approved → submitted → confirmed` for exactly one transfer.
   - Confirm the UI opens Visibility and preserves the decision log when returning to Policy.
6. **Balance**
   - Call `check_balance` only when intentionally demonstrating public balance disclosure.

## 4. Acceptance checks

- Visibility always labels the left column as a comparison, not a submitted transaction.
- Public keys and commitments appear only in the intended on-chain column.
- Amount, post-transfer balance, and salts appear only in the local-only column.
- Policy logs do not contain the recipient, transaction hash, address, private state, or SDK result objects.
- Errors and workshop notes do not record runtime identifiers or private values.

If the live Preprod path is unavailable, use the approved backup recording in
`demo/backup-recording/` and clearly state that it is a recording.

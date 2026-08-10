import { useState } from 'react';
import type { ContractContext, TransactionResult } from '../types/index.js';
import type { CurrentTx } from '../hooks/useTransaction.js';
import {
  generateRandomRecipientHex,
  isRecipientPublicKeyHex,
} from '../midnight/recipient.js';
import { TxResult } from './TxResult.js';

interface TransferPanelProps {
  contract: ContractContext | null;
  onTransfer: (amount: bigint, recipientHex: string) => Promise<TransactionResult | null>;
  currentTx: CurrentTx | null;
  lastResult: TransactionResult | null;
  hasDeposited: boolean;
}

export function TransferPanel({
  contract,
  onTransfer,
  currentTx,
  lastResult,
  hasDeposited,
}: TransferPanelProps) {
  const [amount, setAmount] = useState('100');
  const [recipient, setRecipient] = useState('');
  const [result, setResult] = useState<TransactionResult | null>(lastResult);
  const isRecipientValid = isRecipientPublicKeyHex(recipient);

  const isDisabled =
    !contract ||
    !hasDeposited ||
    (currentTx !== null && currentTx.status === 'pending') ||
    !isRecipientValid;

  const handleTransfer = async () => {
    const amountBigint = BigInt(amount || '0');
    if (amountBigint <= 0n || !isRecipientValid) return;
    const txResult = await onTransfer(amountBigint, recipient);
    if (txResult) {
      setResult(txResult);
    }
  };

  const transferTx = currentTx?.type === 'transfer' ? currentTx : null;

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">Private Transfer</h2>
        <p className="text-sm text-[#cccccc] mb-4">
          Update committed balances with a Zero-Knowledge Proof. The amount is hidden; sender and
          recipient public keys remain visible on-chain.
        </p>
        <p className="text-xs text-yellow-400 mb-4">
          Proof of concept: recipient private state is not delivered, so this is not a complete
          two-party payment.
        </p>

        {/* ZKP Badge */}
        <div className="bg-[#0066ff]/20 text-[#0066ff] px-3 py-1.5 rounded-full text-sm inline-block mb-4">
          This transfer is protected by Zero-Knowledge Proof
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#cccccc] block mb-1">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="1"
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono focus:border-[#0066ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-[#cccccc] block mb-1">
              Recipient (64-char hex public key)
            </label>
            <input
              type="password"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Enter 64-character hex recipient..."
              autoComplete="off"
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono text-sm placeholder-[#666] focus:border-[#0066ff] focus:outline-none"
              maxLength={64}
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[#666]">{recipient.length}/64 characters</p>
              <button
                onClick={() => setRecipient(generateRandomRecipientHex())}
                className="text-xs text-[#0066ff] hover:text-[#0052cc]"
              >
                Generate Random
              </button>
            </div>
            {recipient.length > 0 && !isRecipientValid && (
              <p className="mt-1 text-xs text-red-400">
                Recipient must be exactly 64 hexadecimal characters.
              </p>
            )}
          </div>

          <button
            onClick={handleTransfer}
            disabled={isDisabled}
            className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!contract
              ? 'Connect wallet & contract first'
              : !hasDeposited
                ? 'Initialize demo balance first'
                : 'Submit Hidden-Amount Transfer'}
          </button>

          {transferTx?.status === 'pending' && (
            <p className="text-xs text-[#cccccc] text-center">
              ZKP proof generation may take 2-5 minutes. Please wait...
            </p>
          )}
        </div>
      </div>

      {/* Transaction Progress / Result */}
      {(transferTx || result) && (
        <div className="space-y-2">
          <TxResult
            currentTx={transferTx}
            tx={transferTx?.status !== 'pending' ? result ?? undefined : undefined}
          />
          {result && (
            <div className="flex gap-2">
              <span className="bg-[#0066ff]/20 text-[#0066ff] px-3 py-1 rounded-full text-xs">
                Amount: PRIVATE
              </span>
              <span className="bg-[#0066ff]/20 text-[#0066ff] px-3 py-1 rounded-full text-xs">
                Recipient: PUBLIC
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

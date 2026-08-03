import { useState } from 'react';
import type { ContractContext } from '../types/index.js';
import type { CurrentTx } from '../hooks/useTransaction.js';
import type { TransactionResult } from '../types/index.js';
import { TxResult } from './TxResult.js';

interface DepositPanelProps {
  contract: ContractContext | null;
  onDeposit: (amount: bigint) => Promise<TransactionResult | null>;
  currentTx: CurrentTx | null;
  lastResult: TransactionResult | null;
}

export function DepositPanel({ contract, onDeposit, currentTx, lastResult }: DepositPanelProps) {
  const [amount, setAmount] = useState('1000');
  const [result, setResult] = useState<TransactionResult | null>(lastResult);

  const isDisabled = !contract || (currentTx !== null && currentTx.status === 'pending');

  const handleDeposit = async () => {
    const amountBigint = BigInt(amount || '0');
    if (amountBigint <= 0n) return;
    const txResult = await onDeposit(amountBigint);
    if (txResult) {
      setResult(txResult);
    }
  };

  const depositTx = currentTx?.type === 'deposit' ? currentTx : null;

  return (
    <div className="space-y-4">
      <div className="bg-[#16213e] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">Deposit tNight</h2>
        <p className="text-sm text-[#cccccc] mb-4">
          The deposit amount is public. The contract stores a commitment keyed by your public key;
          the balance value remains hidden.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#cccccc] block mb-1">Amount</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000"
              min="1"
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono focus:border-[#0066ff] focus:outline-none"
            />
          </div>

          <button
            onClick={handleDeposit}
            disabled={isDisabled}
            className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!contract ? 'Connect wallet & contract first' : 'Deposit'}
          </button>
        </div>
      </div>

      {/* Transaction Progress / Result */}
      {(depositTx || result) && (
        <TxResult
          currentTx={depositTx}
          tx={depositTx?.status !== 'pending' ? result ?? undefined : undefined}
        />
      )}
    </div>
  );
}

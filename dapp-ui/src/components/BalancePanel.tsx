import type { ContractContext, TransactionResult } from '../types/index.js';
import type { CurrentTx } from '../hooks/useTransaction.js';
import { TxResult } from './TxResult.js';

interface BalancePanelProps {
  contract: ContractContext | null;
  onCheckBalance: () => Promise<TransactionResult | null>;
  currentTx: CurrentTx | null;
  balance: bigint | null;
  transactions: TransactionResult[];
}

function txTypeLabel(tx: TransactionResult): string {
  const hash = tx.txHash;
  // Simple heuristic: we can't reliably determine type from the result alone,
  // so we show the hash and status
  return hash === 'unknown' ? 'Operation' : `Tx ${hash.slice(0, 8)}...`;
}

export function BalancePanel({
  contract,
  onCheckBalance,
  currentTx,
  balance,
  transactions,
}: BalancePanelProps) {
  const isDisabled = !contract || (currentTx !== null && currentTx.status === 'pending');
  const balanceTx = currentTx?.type === 'balance' ? currentTx : null;

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-[#16213e] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">Contract Balance</h2>
        <p className="text-sm text-[#cccccc] mb-4">
          The circuit verifies the committed value, but check_balance publicly discloses the
          returned balance.
        </p>

        <div className="bg-[#1a1a2e] rounded-lg p-4 mb-4">
          <label className="text-sm text-[#cccccc]">Current Balance</label>
          <p className="text-3xl font-bold text-white font-mono mt-1">
            {balance !== null ? balance.toLocaleString() : '---'}
          </p>
        </div>

        <button
          onClick={onCheckBalance}
          disabled={isDisabled}
          className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!contract ? 'Connect wallet & contract first' : 'Check Balance'}
        </button>
      </div>

      {/* Balance Check Progress */}
      {balanceTx && <TxResult currentTx={balanceTx} />}

      {/* Transaction History */}
      {transactions.length > 0 && (
        <div className="bg-[#16213e] rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-3">Transaction History</h3>
          <div className="space-y-2">
            {transactions.map((tx, i) => (
              <div
                key={`${tx.txHash}-${i}`}
                className="flex items-center justify-between bg-[#1a1a2e] rounded p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{tx.status === 'confirmed' ? '✅' : '❌'}</span>
                  <span className="text-white font-mono">{txTypeLabel(tx)}</span>
                </div>
                <a
                  href={tx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0066ff] hover:text-[#0052cc] text-xs"
                >
                  Explorer
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

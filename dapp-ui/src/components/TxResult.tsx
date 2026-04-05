import type { TransactionResult } from '../types/index.js';
import type { CurrentTx } from '../hooks/useTransaction.js';

interface TxResultProps {
  tx?: TransactionResult;
  currentTx?: CurrentTx | null;
}

function truncateHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    // fallback: ignore
  });
}

function statusIcon(status: string): string {
  if (status === 'pending') return '⏳';
  if (status === 'confirmed') return '✅';
  return '❌';
}

function typeLabel(type: string): string {
  if (type === 'deposit') return 'Deposit';
  if (type === 'transfer') return 'Private Transfer';
  if (type === 'balance') return 'Check Balance';
  return type;
}

export function TxResult({ tx, currentTx }: TxResultProps) {
  // Show current in-progress transaction
  if (currentTx && currentTx.status === 'pending') {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-[#333]">
        <div className="flex items-center gap-3">
          <span className="text-xl animate-pulse">{statusIcon('pending')}</span>
          <div className="flex-1">
            <p className="text-white font-medium">{typeLabel(currentTx.type)}</p>
            <p className="text-sm text-[#cccccc]">
              {currentTx.type === 'transfer'
                ? 'Generating ZKP proof...'
                : 'Submitting transaction...'}
            </p>
          </div>
          <div className="text-sm text-[#cccccc] font-mono">{currentTx.elapsed}s</div>
        </div>
      </div>
    );
  }

  // Show failed result
  if (currentTx && currentTx.status === 'failed') {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-red-900">
        <div className="flex items-center gap-3">
          <span className="text-xl">{statusIcon('failed')}</span>
          <div className="flex-1">
            <p className="text-white font-medium">{typeLabel(currentTx.type)}</p>
            <p className="text-sm text-red-400">{currentTx.error ?? 'Transaction failed'}</p>
          </div>
          <div className="text-sm text-[#cccccc] font-mono">{currentTx.elapsed}s</div>
        </div>
      </div>
    );
  }

  // Show confirmed transaction result
  if (tx) {
    return (
      <div className="bg-[#1a1a2e] rounded-lg p-4 border border-green-900/50">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl">{statusIcon(tx.status)}</span>
          <p className="text-white font-medium flex-1">Transaction Confirmed</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[#cccccc]">Tx Hash:</span>
            <code className="text-white font-mono">{truncateHash(tx.txHash)}</code>
            <button
              onClick={() => copyToClipboard(tx.txHash)}
              className="text-[#0066ff] hover:text-[#0052cc] text-xs"
            >
              Copy
            </button>
          </div>
          <div>
            <a
              href={tx.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0066ff] hover:text-[#0052cc] text-sm"
            >
              View on Explorer &rarr;
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

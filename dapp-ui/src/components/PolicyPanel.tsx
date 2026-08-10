import { useState } from 'react';
import type { PolicyLogEntry } from '../agent/runner.js';
import {
  generateRandomRecipientHex,
  isRecipientPublicKeyHex,
  parseRecipientPublicKeyHex,
} from '../midnight/recipient.js';
import type { ContractContext } from '../types/index.js';

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

function parsePositiveInteger(value: string, label: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  const parsed = BigInt(value);
  if (parsed <= 0n) {
    throw new Error(`${label} must be a positive whole number.`);
  }
  return parsed;
}

export function PolicyPanel({
  contract,
  hasDeposited,
  isRunning,
  logs,
  onRun,
}: PolicyPanelProps) {
  const [requestedAmount, setRequestedAmount] = useState('10');
  const [perTransferLimit, setPerTransferLimit] = useState('25');
  const [recipientHex, setRecipientHex] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const canRun =
    contract !== null &&
    hasDeposited &&
    !isRunning &&
    isRecipientPublicKeyHex(recipientHex);

  const handleSubmit = async () => {
    setValidationError(null);
    try {
      const input = {
        requestedAmount: parsePositiveInteger(requestedAmount, 'Requested amount'),
        perTransferLimit: parsePositiveInteger(perTransferLimit, 'Per-transfer limit'),
        recipientHex: recipientHex.toLowerCase(),
      };
      parseRecipientPublicKeyHex(input.recipientHex);
      await onRun(input);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div className="space-y-4">
      <section className="bg-[#16213e] rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">Automatic Payment Policy</h2>
        <p className="text-sm text-[#cccccc] mb-2">
          A deterministic local rule checks the request, available private balance, and transfer
          limit before it may submit exactly one hidden-amount transfer.
        </p>
        <p className="text-xs text-[#66d9ef] mb-2">
          Local policy inputs are evaluated here and are not put on-chain.
        </p>
        <p className="text-xs text-yellow-400 mb-4">
          Proof of concept: recipient private state is not delivered, so this is not a complete two-party payment.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[#cccccc] block mb-1">Requested amount</label>
            <input
              type="number"
              value={requestedAmount}
              onChange={(event) => setRequestedAmount(event.target.value)}
              min="1"
              step="1"
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono focus:border-[#0066ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-[#cccccc] block mb-1">Per-transfer limit</label>
            <input
              type="number"
              value={perTransferLimit}
              onChange={(event) => setPerTransferLimit(event.target.value)}
              min="1"
              step="1"
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono focus:border-[#0066ff] focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-[#cccccc] block mb-1">
              Recipient (64-char hex public key)
            </label>
            <input
              type="password"
              value={recipientHex}
              onChange={(event) => setRecipientHex(event.target.value)}
              placeholder="Enter 64-character hex recipient..."
              autoComplete="off"
              maxLength={64}
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono text-sm placeholder-[#666] focus:border-[#0066ff] focus:outline-none"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-[#666]">{recipientHex.length}/64 characters</p>
              <button
                type="button"
                onClick={() => setRecipientHex(generateRandomRecipientHex())}
                className="text-xs text-[#0066ff] hover:text-[#0052cc]"
              >
                Generate Random
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canRun}
            className="w-full bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {!contract
              ? 'Connect wallet & contract first'
              : !hasDeposited
                ? 'Make a deposit first'
                : isRunning
                  ? 'Evaluating & submitting...'
                  : 'Evaluate Policy'}
          </button>

          {validationError && (
            <p className="text-sm text-red-400 border border-red-500/40 rounded p-3">
              {validationError}
            </p>
          )}
        </div>
      </section>

      {logs.length > 0 && (
        <section className="bg-[#16213e] rounded-lg p-6" aria-label="Policy decision log">
          <h3 className="text-lg font-semibold text-white mb-3">Decision log</h3>
          <ol className="space-y-3">
            {[...logs].sort((left, right) => left.sequence - right.sequence).map((entry) => (
              <li key={entry.sequence} className="border border-[#333] rounded p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#888]">#{entry.sequence}</span>
                  <span className="font-mono text-sm text-[#66d9ef]">{entry.stage}</span>
                  <span className="text-xs text-[#888]">{entry.code}</span>
                </div>
                <p className="text-sm text-[#cccccc] mt-1">{entry.message}</p>
                {entry.localInputs && (
                  <p className="text-xs text-[#888] mt-2">
                    Local-only values — requested: {entry.localInputs.requestedAmount.toString()},
                    limit: {entry.localInputs.perTransferLimit.toString()}, available balance:{' '}
                    {entry.localInputs.availableBalance.toString()}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

import { useState } from 'react';

import {
  buildVisibilityModel,
  type RepetitionMode,
  type VisibilityRow,
} from '../midnight/visibility-model.js';
import type { TransferDisclosureSnapshot } from '../types/index.js';

interface VisibilityPanelProps {
  readonly disclosure: TransferDisclosureSnapshot | null;
  readonly explorerUrl: string | null;
}

function shortHex(value: string): string {
  return value.length > 24 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function displayValue(row: VisibilityRow): string {
  if (row.label === 'Transfer amount' || row.label === 'Sender balance after transfer') {
    return BigInt(row.value).toLocaleString('en-US');
  }
  return shortHex(row.value);
}

function VisibilityRows({ rows }: { readonly rows: readonly VisibilityRow[] }) {
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div key={row.label} className="border-b border-[#333]/70 pb-3 last:border-0 last:pb-0">
          <dt className="text-xs text-[#888]">{row.label}</dt>
          <dd className="mt-1 break-all font-mono text-sm text-white">{displayValue(row)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function VisibilityPanel({ disclosure, explorerUrl }: VisibilityPanelProps) {
  const [repetition, setRepetition] = useState<RepetitionMode>(1);

  if (!disclosure) {
    return (
      <div className="rounded-lg bg-[#16213e] p-6">
        <h2 className="text-xl font-bold text-white">Transfer Visibility</h2>
        <p className="mt-2 text-sm text-[#cccccc]">
          Complete a private transfer to compare what Midnight puts on-chain with values kept in
          local private state.
        </p>
      </div>
    );
  }

  const model = buildVisibilityModel(disclosure, repetition);

  return (
    <div className="space-y-4">
      <section className="rounded-lg bg-[#16213e] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Transfer Visibility</h2>
            <p className="mt-2 text-sm text-[#cccccc]">
              Public keys remain visible. Amounts remain hidden behind commitments.
            </p>
          </div>
          <div className="flex rounded-lg border border-[#333] p-1">
            {([1, 100] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRepetition(mode)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  repetition === mode
                    ? 'bg-[#0066ff] text-white'
                    : 'text-[#cccccc] hover:text-white'
                }`}
              >
                {mode === 1 ? '1 transfer' : '×100 transfers'}
              </button>
            ))}
          </div>
        </div>

        {model.isIllustration && (
          <div className="mt-4 inline-flex rounded-full bg-yellow-400/15 px-3 py-1 text-xs font-medium text-yellow-300">
            Illustration only — no additional transactions are submitted
          </div>
        )}

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <article className="rounded-lg border border-[#333] bg-[#1a1a2e] p-4">
            <h3 className="font-semibold text-white">Public chain comparison</h3>
            <p className="mb-4 mt-1 text-xs text-[#888]">{model.publicComparisonCaption}</p>
            <VisibilityRows rows={model.publicComparison} />
          </article>

          <article className="rounded-lg border border-[#0066ff]/50 bg-[#1a1a2e] p-4">
            <h3 className="font-semibold text-[#66a3ff]">Midnight put on-chain</h3>
            <p className="mb-4 mt-1 text-xs text-[#888]">Visible to public observers</p>
            <VisibilityRows rows={model.onChain} />
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View this transaction on Midnight Explorer"
                className="mt-4 flex w-full items-center justify-center rounded bg-[#0066ff] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0052cc] focus:outline-none focus:ring-2 focus:ring-[#66a3ff]"
              >
                View on Explorer &rarr;
              </a>
            )}
          </article>

          <article className="rounded-lg border border-green-900/60 bg-[#1a1a2e] p-4">
            <h3 className="font-semibold text-green-400">Not put on-chain</h3>
            <p className="mb-4 mt-1 text-xs text-[#888]">Available only in local private state</p>
            <VisibilityRows rows={model.localOnly} />
          </article>
        </div>

        <p className="mt-5 rounded-lg bg-[#0066ff]/10 p-4 text-sm text-[#cccccc]">
          {model.lesson}
        </p>
        <p className="mt-3 text-xs text-yellow-400">
          Proof of concept: recipient private state is not delivered, so this is not a complete
          two-party payment.
        </p>
      </section>
    </div>
  );
}

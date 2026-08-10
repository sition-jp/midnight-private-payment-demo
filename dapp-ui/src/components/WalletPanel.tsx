import { useState } from 'react';
import type {
  DemoDustPhase,
  DemoDustSnapshot,
  WalletMode,
  WalletContext,
} from '../types/index.js';
import { getDetectedWalletName } from '../midnight/wallet.js';
import { getSecretInputAttributes } from '../midnight/secret-input.js';
import type { ContractContext } from '../types/index.js';
import type { WalletSyncProgressSnapshot } from '../midnight/sync-timeout.js';
import { buildDustPreparationModel } from '../midnight/dust-preparation-model.js';

interface WalletPanelProps {
  mode: WalletMode;
  seed: string;
  onSeedChange: (seed: string) => void;
  onGenerateSeed: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onConnectContract: () => void;
  onRefreshDustStatus: () => void;
  onPrepareDust: () => void;
  walletContext: WalletContext | null;
  contract: ContractContext | null;
  isConnectingWallet: boolean;
  syncProgress: WalletSyncProgressSnapshot | null;
  syncElapsedMs: number;
  isConnectingContract: boolean;
  walletBalance: bigint | null;
  dustSnapshot: DemoDustSnapshot | null;
  dustPhase: DemoDustPhase;
  dustError: string | null;
  walletError: string | null;
  contractError: string | null;
  laceAvailable: boolean;
}

function truncateAddress(addr: unknown): string {
  const s = String(addr ?? '');
  if (s.length <= 20) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function formatBalance(bal: bigint): string {
  // Midnight native token uses 6 decimal places (1 tNIGHT = 1,000,000 native units)
  const DECIMALS = 6n;
  const DIVISOR = 10n ** DECIMALS;
  const whole = bal / DIVISOR;
  const frac = bal % DIVISOR;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(Number(DECIMALS), '0').replace(/0+$/, '');
  return `${whole.toLocaleString()}.${fracStr}`;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function WalletPanel({
  mode,
  seed,
  onSeedChange,
  onGenerateSeed,
  onConnect,
  onDisconnect,
  onConnectContract,
  onRefreshDustStatus,
  onPrepareDust,
  walletContext,
  contract,
  isConnectingWallet,
  syncProgress,
  syncElapsedMs,
  isConnectingContract,
  walletBalance,
  dustSnapshot,
  dustPhase,
  dustError,
  walletError,
  contractError,
  laceAvailable,
}: WalletPanelProps) {
  const [isSeedRevealed, setIsSeedRevealed] = useState(false);
  const seedInputAttributes = getSecretInputAttributes(isSeedRevealed);
  const dustModel = buildDustPreparationModel({
    snapshot: dustSnapshot,
    phase: dustPhase,
    error: dustError,
  });

  // Connected state
  if (walletContext) {
    return (
      <div className="space-y-4">
        {/* Wallet Info Card */}
        <div className="bg-[#16213e] rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Wallet Connected</h2>
            <button
              onClick={onDisconnect}
              className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 rounded px-3 py-1"
            >
              Disconnect
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-[#cccccc]">Address</label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-white font-mono text-sm bg-[#1a1a2e] px-3 py-1.5 rounded flex-1 truncate">
                  {truncateAddress(walletContext.address)}
                </code>
                <button
                  onClick={() => copyToClipboard(walletContext.address)}
                  className="text-[#0066ff] hover:text-[#0052cc] text-sm px-2 py-1.5 bg-[#1a1a2e] rounded"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#cccccc]">tNight Balance</label>
                <p className="text-white font-mono text-lg mt-1">
                  {walletBalance !== null ? formatBalance(walletBalance) : '...'}
                </p>
              </div>
              <div>
                <label className="text-sm text-[#cccccc]">Mode</label>
                <p className="text-white mt-1">{walletContext.mode === 'demo' ? 'Demo' : getDetectedWalletName()}</p>
              </div>
            </div>
            <div>
              <label className="text-sm text-[#cccccc]">Contract</label>
              <p className="text-white mt-1">Configured at runtime</p>
            </div>
          </div>
        </div>

        {walletContext.mode === 'demo' && (
          <div
            className="bg-[#16213e] rounded-lg p-6"
            aria-live="polite"
          >
            <h3 className="text-lg font-bold text-white mb-2">DUST Preparation</h3>
            <p className="text-sm font-medium text-white">{dustModel.title}</p>
            <p className="text-sm text-[#cccccc] mt-1">{dustModel.description}</p>
            {dustModel.state === 'ready-to-register' && (
              <p className="text-xs text-yellow-300 mt-3">
                Continue only if you intend to submit this on-chain registration.
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-4">
              {dustModel.faucetUrl && (
                <a
                  href={dustModel.faucetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium"
                >
                  Open official Preprod faucet
                </a>
              )}
              {dustModel.canRefresh && (
                <button
                  type="button"
                  onClick={onRefreshDustStatus}
                  className="bg-[#1a1a2e] border border-[#333] hover:border-[#0066ff] text-[#cccccc] hover:text-white rounded px-4 py-2 text-sm"
                >
                  Refresh DUST status
                </button>
              )}
              {dustModel.canRegister && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(
                      'Register eligible tNIGHT for DUST? This submits an on-chain transaction.',
                    )) onPrepareDust();
                  }}
                  className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium"
                >
                  Register tNIGHT for DUST
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contract Connection */}
        {!contract && (
          <div className="bg-[#16213e] rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-3">Connect to Contract</h3>
            <p className="text-sm text-[#cccccc] mb-4">
              Connect to the deployed private-payment contract to start making transactions.
            </p>
            <button
              onClick={onConnectContract}
              disabled={isConnectingContract
                || (walletContext.mode === 'demo' && !dustModel.canConnectContract)}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnectingContract
                ? 'Connecting to contract...'
                : walletContext.mode === 'demo' && !dustModel.canConnectContract
                  ? 'Prepare DUST first'
                  : 'Connect to Contract'}
            </button>
            {contractError && (
              <p className="text-red-400 text-sm mt-3">{contractError}</p>
            )}
          </div>
        )}

        {contract && (
          <div className="bg-green-900/20 border border-green-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-green-400 text-sm font-medium">
                Contract connected — Ready for transactions
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected - show connection form
  return (
    <div className="bg-[#16213e] rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4">Connect Wallet</h2>

      {mode === 'demo' ? (
        <div className="space-y-4">
          <div>
            <div className="mb-3 rounded border border-yellow-900/50 bg-yellow-900/20 p-3">
              <p className="text-xs text-yellow-300">
                Use a disposable Preprod demo seed only. Never use a real wallet seed.
              </p>
            </div>
            <label className="text-sm text-[#cccccc] block mb-1">
              Seed (64-character hex)
            </label>
            <div className="flex gap-2">
              <input
                {...seedInputAttributes}
                value={seed}
                onChange={(e) => {
                  if (seed.length === 0) setIsSeedRevealed(false);
                  onSeedChange(e.target.value);
                }}
                placeholder="Enter 64-character hex seed..."
                aria-label="Disposable demo seed"
                autoCapitalize="none"
                spellCheck={false}
                className="min-w-0 flex-1 bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono text-sm placeholder-[#666] focus:border-[#0066ff] focus:outline-none"
                maxLength={64}
              />
              <button
                type="button"
                onClick={() => setIsSeedRevealed((current) => !current)}
                aria-pressed={isSeedRevealed}
                className="bg-[#1a1a2e] border border-[#333] hover:border-[#0066ff] text-[#cccccc] rounded px-3 py-2 text-xs"
              >
                {isSeedRevealed ? 'Hide seed' : 'Show seed'}
              </button>
            </div>
            <p className="text-xs text-[#666] mt-1">{seed.length}/64 characters</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setIsSeedRevealed(false);
                onGenerateSeed();
              }}
              className="bg-[#1a1a2e] border border-[#333] hover:border-[#0066ff] text-[#cccccc] hover:text-white rounded px-4 py-2 text-sm"
            >
              Generate Random Seed
            </button>
            <button
              onClick={() => {
                setIsSeedRevealed(false);
                onConnect();
              }}
              disabled={isConnectingWallet || seed.length !== 64}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {isConnectingWallet ? 'Connecting & Syncing...' : 'Connect'}
            </button>
          </div>
          {isConnectingWallet && (
            <div
              className="bg-[#1a1a2e] border border-[#333] rounded p-4 space-y-2"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-white">Synchronizing Preprod wallet</p>
                <span className="text-xs font-mono text-[#cccccc]">
                  {formatElapsed(syncElapsedMs)}
                </span>
              </div>
              <p className="text-xs text-[#888]">
                Shielded sync scans chain events to discover private state. Applied progress must reach the exact tip.
              </p>
              {syncProgress ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
                  <dt className="text-[#888]">Shielded</dt>
                  <dd className="text-[#cccccc]">
                    {syncProgress.shielded.current.toString()} / {syncProgress.shielded.total.toString()}
                  </dd>
                  <dt className="text-[#888]">Unshielded</dt>
                  <dd className="text-[#cccccc]">
                    {syncProgress.unshielded.current.toString()} / {syncProgress.unshielded.total.toString()}
                  </dd>
                  <dt className="text-[#888]">DUST</dt>
                  <dd className="text-[#cccccc]">
                    {syncProgress.dust.current.toString()} / {syncProgress.dust.total.toString()}
                  </dd>
                </dl>
              ) : (
                <p className="text-xs font-mono text-[#888]">Starting wallet services...</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {laceAvailable ? (
            <>
              <p className="text-sm text-[#cccccc]">
                Midnight wallet extension detected. Click below to connect.
              </p>
              <button
                onClick={onConnect}
                disabled={isConnectingWallet}
                className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed w-full"
              >
                {isConnectingWallet ? 'Connecting...' : 'Connect Wallet Extension'}
              </button>
            </>
          ) : (
            <div className="bg-[#1a1a2e] rounded p-4 border border-yellow-900/50">
              <p className="text-yellow-400 text-sm">
                Midnight wallet extension not detected.
              </p>
              <p className="text-[#cccccc] text-xs mt-2">
                Please install the 1AM or Lace wallet browser extension and reload the page.
              </p>
            </div>
          )}
        </div>
      )}

      {walletError && (
        <div className="mt-4 bg-red-900/20 border border-red-900/50 rounded p-3">
          <p className="text-red-400 text-sm">{walletError}</p>
        </div>
      )}
    </div>
  );
}

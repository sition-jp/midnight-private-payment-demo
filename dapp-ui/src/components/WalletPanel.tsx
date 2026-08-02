import type { WalletMode, WalletContext } from '../types/index.js';
import { getDetectedWalletName } from '../midnight/wallet.js';
import type { ContractContext } from '../types/index.js';

interface WalletPanelProps {
  mode: WalletMode;
  seed: string;
  onSeedChange: (seed: string) => void;
  onGenerateSeed: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onConnectContract: () => void;
  walletContext: WalletContext | null;
  contract: ContractContext | null;
  isConnectingWallet: boolean;
  isConnectingContract: boolean;
  walletBalance: bigint | null;
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

export function WalletPanel({
  mode,
  seed,
  onSeedChange,
  onGenerateSeed,
  onConnect,
  onDisconnect,
  onConnectContract,
  walletContext,
  contract,
  isConnectingWallet,
  isConnectingContract,
  walletBalance,
  walletError,
  contractError,
  laceAvailable,
}: WalletPanelProps) {
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

        {/* Contract Connection */}
        {!contract && (
          <div className="bg-[#16213e] rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-3">Connect to Contract</h3>
            <p className="text-sm text-[#cccccc] mb-4">
              Connect to the deployed private-payment contract to start making transactions.
            </p>
            <button
              onClick={onConnectContract}
              disabled={isConnectingContract}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnectingContract ? 'Connecting to contract...' : 'Connect to Contract'}
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
            <label className="text-sm text-[#cccccc] block mb-1">
              Seed (64-character hex)
            </label>
            <input
              type="text"
              value={seed}
              onChange={(e) => onSeedChange(e.target.value)}
              placeholder="Enter 64-character hex seed..."
              className="w-full bg-[#1a1a2e] border border-[#333] rounded px-3 py-2 text-white font-mono text-sm placeholder-[#666] focus:border-[#0066ff] focus:outline-none"
              maxLength={64}
            />
            <p className="text-xs text-[#666] mt-1">{seed.length}/64 characters</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onGenerateSeed}
              className="bg-[#1a1a2e] border border-[#333] hover:border-[#0066ff] text-[#cccccc] hover:text-white rounded px-4 py-2 text-sm"
            >
              Generate Random Seed
            </button>
            <button
              onClick={onConnect}
              disabled={isConnectingWallet || seed.length !== 64}
              className="bg-[#0066ff] hover:bg-[#0052cc] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex-1"
            >
              {isConnectingWallet ? 'Connecting & Syncing...' : 'Connect'}
            </button>
          </div>
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

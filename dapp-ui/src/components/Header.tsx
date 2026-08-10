import type { WalletMode, WalletContext } from '../types/index.js';

interface HeaderProps {
  mode: WalletMode;
  onModeChange: (mode: WalletMode) => void;
  walletContext: WalletContext | null;
}

function truncateAddress(addr: unknown): string {
  const s = String(addr ?? '');
  if (s.length <= 20) return s;
  return `${s.slice(0, 10)}...${s.slice(-8)}`;
}

export function Header({ mode, onModeChange, walletContext }: HeaderProps) {
  return (
    <header className="border-b border-[#16213e] px-6 py-4">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/logos/midnight-logo.png" alt="Midnight" className="h-8" />
          <div>
            <h1 className="text-xl font-bold text-[#0066ff]">Private Payment Demo</h1>
            <p className="text-xs text-[#cccccc]">ZKP-Protected Transactions on Preprod</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Mode Toggle */}
          <div className="flex bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#333]">
            <button
              onClick={() => onModeChange('demo')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                mode === 'demo'
                  ? 'bg-[#0066ff] text-white'
                  : 'text-[#cccccc] hover:text-white'
              }`}
            >
              Demo Mode
            </button>
            <button
              onClick={() => onModeChange('lace')}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                mode === 'lace'
                  ? 'bg-[#0066ff] text-white'
                  : 'text-[#cccccc] hover:text-white'
              }`}
            >
              Wallet Mode
            </button>
          </div>
          {/* Connection Status */}
          {walletContext && (
            <div className="flex items-center gap-2 bg-[#16213e] px-3 py-1.5 rounded text-xs">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-[#cccccc] font-mono">
                {walletContext.mode === 'demo' ? 'Demo connected' : truncateAddress(walletContext.address)}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

import { useState, useCallback } from 'react';
import { useWallet } from './hooks/useWallet.js';
import { useContract } from './hooks/useContract.js';
import { useTransaction } from './hooks/useTransaction.js';
import { Header } from './components/Header.js';
import { WalletPanel } from './components/WalletPanel.js';
import { DepositPanel } from './components/DepositPanel.js';
import { TransferPanel } from './components/TransferPanel.js';
import { VisibilityPanel } from './components/VisibilityPanel.js';
import { BalancePanel } from './components/BalancePanel.js';
import type { TransactionResult } from './types/index.js';

type Tab = 'wallet' | 'deposit' | 'transfer' | 'visibility' | 'explorer';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('wallet');
  const [hasDeposited, setHasDeposited] = useState(false);
  const [lastDepositResult, setLastDepositResult] = useState<TransactionResult | null>(null);
  const [lastTransferResult, setLastTransferResult] = useState<TransactionResult | null>(null);

  const wallet = useWallet();
  const contractHook = useContract();
  const txHook = useTransaction();

  const handleConnectContract = useCallback(() => {
    if (wallet.walletContext) {
      contractHook.connect(wallet.walletContext);
    }
  }, [wallet.walletContext, contractHook]);

  const handleDeposit = useCallback(
    async (amount: bigint) => {
      if (!contractHook.contract) return null;
      const result = await txHook.deposit(contractHook.contract, amount);
      if (result) {
        setHasDeposited(true);
        setLastDepositResult(result);
      }
      return result;
    },
    [contractHook.contract, txHook],
  );

  const handleTransfer = useCallback(
    async (amount: bigint, recipientHex: string) => {
      if (!contractHook.contract) return null;
      const result = await txHook.transfer(contractHook.contract, amount, recipientHex);
      if (result) {
        setLastTransferResult(result);
        if (result.disclosure) {
          setActiveTab('visibility');
        }
      }
      return result;
    },
    [contractHook.contract, txHook],
  );

  const handleCheckBalance = useCallback(async () => {
    if (!contractHook.contract) return null;
    return txHook.checkBalance(contractHook.contract);
  }, [contractHook.contract, txHook]);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'wallet', label: 'Wallet', icon: '\uD83D\uDC5B' },
    { key: 'deposit', label: 'Deposit', icon: '\uD83D\uDCB0' },
    { key: 'transfer', label: 'Private Transfer', icon: '\uD83D\uDD12' },
    { key: 'visibility', label: 'Visibility', icon: '\uD83D\uDC41' },
    { key: 'explorer', label: 'Balance', icon: '\uD83D\uDD0D' },
  ];

  return (
    <div className="min-h-screen bg-[#1a1a2e]">
      <Header
        mode={wallet.mode}
        onModeChange={(m) => {
          wallet.setMode(m);
          if (wallet.walletContext) {
            wallet.disconnect();
            contractHook.disconnect();
            setHasDeposited(false);
            setLastDepositResult(null);
            setLastTransferResult(null);
            setActiveTab('wallet');
          }
        }}
        walletContext={wallet.walletContext}
      />

      {/* Tab Navigation */}
      <nav className="border-b border-[#16213e]">
        <div className="max-w-4xl mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-[#0066ff] border-b-2 border-[#0066ff]'
                  : 'text-[#cccccc] hover:text-white'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6">
        {activeTab === 'wallet' && (
          <WalletPanel
            mode={wallet.mode}
            seed={wallet.seed}
            onSeedChange={wallet.setSeed}
            onGenerateSeed={wallet.generateRandomSeed}
            onConnect={wallet.connect}
            onDisconnect={() => {
              wallet.disconnect();
              contractHook.disconnect();
              setHasDeposited(false);
              setLastDepositResult(null);
              setLastTransferResult(null);
              setActiveTab('wallet');
            }}
            onConnectContract={handleConnectContract}
            walletContext={wallet.walletContext}
            contract={contractHook.contract}
            isConnectingWallet={wallet.isConnecting}
            syncProgress={wallet.syncProgress}
            syncElapsedMs={wallet.syncElapsedMs}
            isConnectingContract={contractHook.isConnecting}
            walletBalance={wallet.balance}
            walletError={wallet.error}
            contractError={contractHook.error}
            laceAvailable={wallet.laceAvailable}
          />
        )}
        {activeTab === 'deposit' && (
          <DepositPanel
            contract={contractHook.contract}
            onDeposit={handleDeposit}
            currentTx={txHook.currentTx}
            lastResult={lastDepositResult}
          />
        )}
        {activeTab === 'transfer' && (
          <TransferPanel
            contract={contractHook.contract}
            onTransfer={handleTransfer}
            currentTx={txHook.currentTx}
            lastResult={lastTransferResult}
            hasDeposited={hasDeposited}
          />
        )}
        {activeTab === 'visibility' && (
          <VisibilityPanel disclosure={lastTransferResult?.disclosure ?? null} />
        )}
        {activeTab === 'explorer' && (
          <BalancePanel
            contract={contractHook.contract}
            onCheckBalance={handleCheckBalance}
            currentTx={txHook.currentTx}
            balance={txHook.balance}
            transactions={txHook.transactions}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#16213e] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="https://sition.jp/" target="_blank" rel="noopener noreferrer"><img src="/logos/sition-logo.png" alt="SITION" className="h-8 hover:opacity-80 transition-opacity" /></a>
            <a href="https://sipo.tokyo/" target="_blank" rel="noopener noreferrer"><img src="/logos/sipo-logo.png" alt="SIPO" className="h-14 hover:opacity-80 transition-opacity" /></a>
            <span className="text-xs text-[#888]">Midnight Ambassador</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://x.com/SITIONjp" target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#0066ff] transition-colors">@SITIONjp</a>
            <a href="https://x.com/SIPO_Tokyo" target="_blank" rel="noopener noreferrer" className="text-xs text-[#888] hover:text-[#0066ff] transition-colors">@SIPO_Tokyo</a>
            <span className="text-xs text-[#555]">|</span>
            <span className="text-xs text-[#888]">Powered by Midnight Network</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;

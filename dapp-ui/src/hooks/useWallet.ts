import { useState, useCallback } from 'react';
import type { WalletMode, WalletContext } from '../types/index.js';
import {
  generateSeed,
  createWalletFromSeed,
  connectLace,
  isLaceAvailable,
} from '../midnight/wallet.js';

export interface UseWalletReturn {
  mode: WalletMode;
  setMode: (mode: WalletMode) => void;
  seed: string;
  setSeed: (seed: string) => void;
  generateRandomSeed: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  walletContext: WalletContext | null;
  isConnecting: boolean;
  balance: bigint | null;
  error: string | null;
  laceAvailable: boolean;
}

export function useWallet(): UseWalletReturn {
  const [mode, setMode] = useState<WalletMode>('demo');
  const [seed, setSeed] = useState('');
  const [walletContext, setWalletContext] = useState<WalletContext | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  const laceAvailable = isLaceAvailable();

  const generateRandomSeed = useCallback(() => {
    setSeed(generateSeed());
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      let ctx: WalletContext;
      if (mode === 'demo') {
        if (!seed || seed.length !== 64) {
          throw new Error('Please provide a valid 64-character hex seed');
        }
        ctx = await createWalletFromSeed(seed);
      } else {
        ctx = await connectLace();
      }
      setWalletContext(ctx);
      const bal = await ctx.getBalance();
      setBalance(bal);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  }, [mode, seed]);

  const disconnect = useCallback(async () => {
    if (walletContext) {
      await walletContext.stop();
      setWalletContext(null);
      setBalance(null);
      setError(null);
    }
  }, [walletContext]);

  return {
    mode,
    setMode,
    seed,
    setSeed,
    generateRandomSeed,
    connect,
    disconnect,
    walletContext,
    isConnecting,
    balance,
    error,
    laceAvailable,
  };
}

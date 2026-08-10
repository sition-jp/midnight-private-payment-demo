import { useState, useCallback, useEffect, useRef } from 'react';
import type { WalletMode, WalletContext } from '../types/index.js';
import type { WalletSyncProgressSnapshot } from '../midnight/sync-timeout.js';
import {
  generateSeed,
  createWalletFromSeed,
  connectLace,
  isLaceAvailable,
} from '../midnight/wallet.js';
import {
  createLatestWalletConnection,
  type LatestWalletConnection,
} from '../midnight/wallet-connection-lifecycle.js';

export interface UseWalletReturn {
  mode: WalletMode;
  setMode: (mode: WalletMode) => Promise<void>;
  seed: string;
  setSeed: (seed: string) => void;
  generateRandomSeed: () => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  walletContext: WalletContext | null;
  isConnecting: boolean;
  syncProgress: WalletSyncProgressSnapshot | null;
  syncElapsedMs: number;
  balance: bigint | null;
  error: string | null;
  laceAvailable: boolean;
}

export function useWallet(): UseWalletReturn {
  const [mode, setModeState] = useState<WalletMode>('demo');
  const [seed, setSeed] = useState('');
  const [walletContext, setWalletContext] = useState<WalletContext | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncProgress, setSyncProgress] = useState<WalletSyncProgressSnapshot | null>(null);
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null);
  const [syncElapsedMs, setSyncElapsedMs] = useState(0);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  interface ConnectedWalletResource {
    readonly context: WalletContext;
    readonly balance: bigint;
    stop(): Promise<void>;
  }
  const lifecycleRef = useRef<LatestWalletConnection<ConnectedWalletResource> | null>(null);
  if (lifecycleRef.current === null) {
    lifecycleRef.current = createLatestWalletConnection<ConnectedWalletResource>();
  }

  const laceAvailable = isLaceAvailable();

  useEffect(() => {
    if (!isConnecting || mode !== 'demo' || syncStartedAt === null) return undefined;
    const updateElapsed = () => setSyncElapsedMs(Date.now() - syncStartedAt);
    updateElapsed();
    const interval = setInterval(updateElapsed, 1_000);
    return () => clearInterval(interval);
  }, [isConnecting, mode, syncStartedAt]);

  const generateRandomSeed = useCallback(() => {
    setSeed(generateSeed());
  }, []);

  const connect = useCallback(async () => {
    const attempt = ++attemptRef.current;
    setIsConnecting(true);
    setError(null);
    setSyncProgress(null);
    setSyncElapsedMs(0);
    setSyncStartedAt(mode === 'demo' ? Date.now() : null);
    try {
      await lifecycleRef.current?.connect(async (signal) => {
        let ctx: WalletContext;
        if (mode === 'demo') {
          if (!seed || seed.length !== 64) {
            throw new Error('Please provide a valid 64-character hex seed');
          }
          ctx = await createWalletFromSeed(seed, {
            onProgress: (progress) => {
              if (attempt === attemptRef.current) setSyncProgress(progress);
            },
            signal,
          });
        } else {
          ctx = await connectLace(signal);
        }
        try {
          const connectedBalance = await ctx.getBalance();
          return {
            context: ctx,
            balance: connectedBalance,
            stop: ctx.stop,
          };
        } catch (connectionError) {
          await ctx.stop();
          throw connectionError;
        }
      }, (resource) => {
        setWalletContext(resource.context);
        setBalance(resource.balance);
        setSeed('');
      });
    } catch (err) {
      if (attempt === attemptRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (attempt === attemptRef.current) {
        setIsConnecting(false);
        setSyncStartedAt(null);
      }
    }
  }, [mode, seed]);

  const disconnect = useCallback(async () => {
    attemptRef.current += 1;
    setIsConnecting(false);
    setSyncStartedAt(null);
    setWalletContext(null);
    setBalance(null);
    setError(null);
    setSyncProgress(null);
    setSyncElapsedMs(0);
    setSeed('');
    try {
      await lifecycleRef.current?.disconnect();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error
        ? disconnectError.message
        : String(disconnectError));
    }
  }, []);

  const setMode = useCallback(async (nextMode: WalletMode) => {
    attemptRef.current += 1;
    setModeState(nextMode);
    setIsConnecting(false);
    setSyncStartedAt(null);
    setWalletContext(null);
    setBalance(null);
    setError(null);
    setSyncProgress(null);
    setSyncElapsedMs(0);
    setSeed('');
    try {
      await lifecycleRef.current?.disconnect();
    } catch (disconnectError) {
      setError(disconnectError instanceof Error
        ? disconnectError.message
        : String(disconnectError));
    }
  }, []);

  useEffect(() => () => {
    attemptRef.current += 1;
    void lifecycleRef.current?.disconnect();
  }, []);

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
    syncProgress,
    syncElapsedMs,
    balance,
    error,
    laceAvailable,
  };
}

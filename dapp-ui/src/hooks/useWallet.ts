import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  DemoDustPhase,
  DemoDustSnapshot,
  WalletMode,
  WalletContext,
} from '../types/index.js';
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
import {
  createLatestDustOperation,
  type LatestDustOperation,
} from '../midnight/dust-preparation-lifecycle.js';

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
  dustSnapshot: DemoDustSnapshot | null;
  dustPhase: DemoDustPhase;
  dustError: string | null;
  refreshDustStatus: () => Promise<void>;
  prepareDust: () => Promise<void>;
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
  const [dustSnapshot, setDustSnapshot] = useState<DemoDustSnapshot | null>(null);
  const [dustPhase, setDustPhase] = useState<DemoDustPhase>('idle');
  const [dustError, setDustError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);
  const dustAttemptRef = useRef(0);

  interface ConnectedWalletResource {
    readonly context: WalletContext;
    readonly balance: bigint;
    readonly dustSnapshot: DemoDustSnapshot | null;
    stop(): Promise<void>;
  }
  const dustLifecycleRef = useRef<LatestDustOperation<DemoDustSnapshot> | null>(null);
  if (dustLifecycleRef.current === null) {
    dustLifecycleRef.current = createLatestDustOperation<DemoDustSnapshot>();
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
    dustAttemptRef.current += 1;
    dustLifecycleRef.current?.cancel();
    setDustSnapshot(null);
    setDustPhase('idle');
    setDustError(null);
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
          const connectedDustSnapshot = ctx.dustPreparation
            ? await ctx.dustPreparation.readStatus()
            : null;
          return {
            context: ctx,
            balance: connectedBalance,
            dustSnapshot: connectedDustSnapshot,
            stop: ctx.stop,
          };
        } catch (connectionError) {
          await ctx.stop();
          throw connectionError;
        }
      }, (resource) => {
        setWalletContext(resource.context);
        setBalance(resource.balance);
        setDustSnapshot(resource.dustSnapshot);
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

  const refreshDustStatus = useCallback(async () => {
    const capability = walletContext?.dustPreparation;
    if (!capability) return;
    let attempt: number | null = null;
    try {
      await dustLifecycleRef.current?.run(
        async (signal) => {
          attempt = ++dustAttemptRef.current;
          setDustPhase('refreshing');
          setDustError(null);
          if (signal.aborted) throw new Error('DUST refresh cancelled');
          return capability.readStatus();
        },
        (snapshot) => {
          if (attempt !== dustAttemptRef.current) return;
          setDustSnapshot(snapshot);
          setBalance(snapshot.tNightBalance);
        },
      );
    } catch (refreshError) {
      if (attempt !== null && attempt === dustAttemptRef.current) {
        setDustError(refreshError instanceof Error
          ? refreshError.message
          : 'DUST readiness could not be refreshed.');
      }
    } finally {
      if (attempt !== null && attempt === dustAttemptRef.current) setDustPhase('idle');
    }
  }, [walletContext]);

  const prepareDust = useCallback(async () => {
    const capability = walletContext?.dustPreparation;
    if (!capability) return;
    let attempt: number | null = null;
    try {
      await dustLifecycleRef.current?.run(
        (signal) => {
          attempt = ++dustAttemptRef.current;
          setDustError(null);
          return capability.prepare(signal, (phase) => {
            if (attempt === dustAttemptRef.current) setDustPhase(phase);
          });
        },
        (snapshot) => {
          if (attempt !== dustAttemptRef.current) return;
          setDustSnapshot(snapshot);
          setBalance(snapshot.tNightBalance);
        },
      );
    } catch (preparationError) {
      if (attempt !== null && attempt === dustAttemptRef.current) {
        setDustError(preparationError instanceof Error
          ? preparationError.message
          : 'DUST preparation failed. Refresh before trying again.');
      }
    } finally {
      if (attempt !== null && attempt === dustAttemptRef.current) setDustPhase('idle');
    }
  }, [walletContext]);

  const disconnect = useCallback(async () => {
    attemptRef.current += 1;
    dustAttemptRef.current += 1;
    dustLifecycleRef.current?.cancel();
    setIsConnecting(false);
    setSyncStartedAt(null);
    setWalletContext(null);
    setBalance(null);
    setDustSnapshot(null);
    setDustPhase('idle');
    setDustError(null);
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
    dustAttemptRef.current += 1;
    dustLifecycleRef.current?.cancel();
    setModeState(nextMode);
    setIsConnecting(false);
    setSyncStartedAt(null);
    setWalletContext(null);
    setBalance(null);
    setDustSnapshot(null);
    setDustPhase('idle');
    setDustError(null);
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
    dustAttemptRef.current += 1;
    dustLifecycleRef.current?.cancel();
    void lifecycleRef.current?.disconnect().catch(() => undefined);
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
    dustSnapshot,
    dustPhase,
    dustError,
    refreshDustStatus,
    prepareDust,
    error,
    laceAvailable,
  };
}

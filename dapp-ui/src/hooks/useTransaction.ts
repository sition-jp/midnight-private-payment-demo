import { useState, useCallback, useRef } from 'react';
import type { ContractContext, TransactionResult } from '../types/index.js';
import { executePrivateTransfer } from '../midnight/contract.js';
import { parseRecipientPublicKeyHex } from '../midnight/recipient.js';
import { getTransactionErrorPresentation } from '../midnight/transaction-preflight.js';

export interface CurrentTx {
  type: 'deposit' | 'transfer' | 'balance';
  status: 'pending' | 'confirmed' | 'failed';
  elapsed: number;
  error?: string;
}

export interface UseTransactionReturn {
  deposit: (contract: ContractContext, amount: bigint) => Promise<TransactionResult | null>;
  transfer: (
    contract: ContractContext,
    amount: bigint,
    recipientHex: string,
  ) => Promise<TransactionResult | null>;
  checkBalance: (contract: ContractContext) => Promise<TransactionResult | null>;
  transactions: TransactionResult[];
  currentTx: CurrentTx | null;
  balance: bigint | null;
  requiresReconnect: boolean;
  resetConnectionRequirement: () => void;
}

export function useTransaction(): UseTransactionReturn {
  const [transactions, setTransactions] = useState<TransactionResult[]>([]);
  const [currentTx, setCurrentTx] = useState<CurrentTx | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [requiresReconnect, setRequiresReconnect] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback((type: CurrentTx['type']) => {
    const startTime = Date.now();
    setCurrentTx({ type, status: 'pending', elapsed: 0 });
    timerRef.current = setInterval(() => {
      setCurrentTx((prev) =>
        prev ? { ...prev, elapsed: Math.floor((Date.now() - startTime) / 1000) } : null,
      );
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetConnectionRequirement = useCallback(() => {
    setRequiresReconnect(false);
  }, []);

  const deposit = useCallback(
    async (contract: ContractContext, amount: bigint): Promise<TransactionResult | null> => {
      startTimer('deposit');
      try {
        const result = await contract.deposit(amount);
        stopTimer();
        setCurrentTx((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
        setTransactions((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        stopTimer();
        const failure = getTransactionErrorPresentation(err);
        if (failure.requiresReconnect) setRequiresReconnect(true);
        setCurrentTx((prev) =>
          prev ? { ...prev, status: 'failed', error: failure.message } : null,
        );
        return null;
      }
    },
    [startTimer, stopTimer],
  );

  const transfer = useCallback(
    async (
      contract: ContractContext,
      amount: bigint,
      recipientHex: string,
    ): Promise<TransactionResult | null> => {
      startTimer('transfer');
      try {
        const recipientBytes = parseRecipientPublicKeyHex(recipientHex);
        const result = await executePrivateTransfer(contract, amount, recipientBytes);
        stopTimer();
        setCurrentTx((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
        setTransactions((prev) => [result, ...prev]);
        return result;
      } catch (err) {
        stopTimer();
        const failure = getTransactionErrorPresentation(err);
        if (failure.requiresReconnect) setRequiresReconnect(true);
        setCurrentTx((prev) =>
          prev ? { ...prev, status: 'failed', error: failure.message } : null,
        );
        return null;
      }
    },
    [startTimer, stopTimer],
  );

  const checkBalance = useCallback(
    async (contract: ContractContext): Promise<TransactionResult | null> => {
      startTimer('balance');
      try {
        const result = await contract.checkBalance();
        stopTimer();
        setCurrentTx((prev) => (prev ? { ...prev, status: 'confirmed' } : null));
        setTransactions((prev) => [result, ...prev]);
        if (result.result != null) {
          setBalance(result.result);
        }
        return result;
      } catch (err) {
        stopTimer();
        const failure = getTransactionErrorPresentation(err);
        if (failure.requiresReconnect) setRequiresReconnect(true);
        setCurrentTx((prev) =>
          prev ? { ...prev, status: 'failed', error: failure.message } : null,
        );
        return null;
      }
    },
    [startTimer, stopTimer],
  );

  return {
    deposit,
    transfer,
    checkBalance,
    transactions,
    currentTx,
    balance,
    requiresReconnect,
    resetConnectionRequirement,
  };
}

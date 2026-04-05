import { useState, useCallback } from 'react';
import type { WalletContext, ContractContext } from '../types/index.js';
import { connectToContract } from '../midnight/contract.js';
import { MIDNIGHT_CONFIG } from '../midnight/config.js';

export interface UseContractReturn {
  connect: (walletContext: WalletContext) => Promise<void>;
  disconnect: () => void;
  contract: ContractContext | null;
  isConnecting: boolean;
  error: string | null;
}

export function useContract(): UseContractReturn {
  const [contract, setContract] = useState<ContractContext | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (walletContext: WalletContext) => {
    setIsConnecting(true);
    setError(null);
    try {
      // Generate a random secret key for the private state
      const secretKey = crypto.getRandomValues(new Uint8Array(32));
      const ctx = await connectToContract(
        walletContext,
        MIDNIGHT_CONFIG.contractAddress,
        secretKey,
      );
      setContract(ctx);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setContract(null);
    setError(null);
  }, []);

  return {
    connect,
    disconnect,
    contract,
    isConnecting,
    error,
  };
}

import { useState, useCallback, useRef } from 'react';
import type { WalletContext, ContractContext } from '../types/index.js';
import { connectToContract } from '../midnight/contract.js';
import { requireContractAddress } from '../midnight/config.js';

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
  const generationRef = useRef(0);

  const connect = useCallback(async (walletContext: WalletContext) => {
    const generation = ++generationRef.current;
    setIsConnecting(true);
    setError(null);
    try {
      // Generate a random secret key for the private state
      const secretKey = crypto.getRandomValues(new Uint8Array(32));
      const ctx = await connectToContract(
        walletContext,
        requireContractAddress(),
        secretKey,
      );
      if (generation === generationRef.current) setContract(ctx);
    } catch (err) {
      if (generation === generationRef.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (generation === generationRef.current) setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    generationRef.current += 1;
    setContract(null);
    setIsConnecting(false);
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

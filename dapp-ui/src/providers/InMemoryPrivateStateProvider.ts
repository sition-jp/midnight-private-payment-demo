/**
 * In-memory private state provider for browser environments.
 *
 * Replaces LevelDB-based levelPrivateStateProvider with a simple Map-based
 * implementation. State is lost on page reload (acceptable for demo).
 *
 * Implements the PrivateStateProvider interface from @midnight-ntwrk/midnight-js-types.
 */
import type {
  ImportPrivateStatesResult,
  ImportSigningKeysResult,
  PrivateStateExport,
  PrivateStateId,
  PrivateStateProvider,
  SigningKeyExport,
} from '@midnight-ntwrk/midnight-js-types';
import type { ContractAddress, SigningKey } from '@midnight-ntwrk/compact-runtime';

/**
 * Creates an in-memory PrivateStateProvider suitable for browser use.
 *
 * @returns A PrivateStateProvider backed by in-memory Maps.
 */
export function inMemoryPrivateStateProvider<
  PSI extends PrivateStateId = PrivateStateId,
  PS = unknown,
>(): PrivateStateProvider<PSI, PS> {
  const stateStore = new Map<string, PS>();
  const signingKeyStore = new Map<string, SigningKey>();
  let activeContractAddress: string | undefined;

  const scopedKey = (privateStateId: PSI): string => {
    if (!activeContractAddress) {
      throw new Error('Contract address must be set before private state access');
    }
    return `${activeContractAddress}:${privateStateId}`;
  };

  const unsupported = (): never => {
    throw new Error('Export/import is unavailable for the in-memory workshop provider');
  };

  return {
    setContractAddress(address: ContractAddress): void {
      activeContractAddress = String(address);
    },

    async set(privateStateId: PSI, state: PS): Promise<void> {
      stateStore.set(scopedKey(privateStateId), state);
    },

    async get(privateStateId: PSI): Promise<PS | null> {
      return stateStore.get(scopedKey(privateStateId)) ?? null;
    },

    async remove(privateStateId: PSI): Promise<void> {
      stateStore.delete(scopedKey(privateStateId));
    },

    async clear(): Promise<void> {
      stateStore.clear();
    },

    async setSigningKey(address: ContractAddress, signingKey: SigningKey): Promise<void> {
      signingKeyStore.set(address, signingKey);
    },

    async getSigningKey(address: ContractAddress): Promise<SigningKey | null> {
      return signingKeyStore.get(address) ?? null;
    },

    async removeSigningKey(address: ContractAddress): Promise<void> {
      signingKeyStore.delete(address);
    },

    async clearSigningKeys(): Promise<void> {
      signingKeyStore.clear();
    },

    async exportPrivateStates(): Promise<PrivateStateExport> {
      return unsupported();
    },

    async importPrivateStates(): Promise<ImportPrivateStatesResult> {
      return unsupported();
    },

    async exportSigningKeys(): Promise<SigningKeyExport> {
      return unsupported();
    },

    async importSigningKeys(): Promise<ImportSigningKeysResult> {
      return unsupported();
    },
  };
}

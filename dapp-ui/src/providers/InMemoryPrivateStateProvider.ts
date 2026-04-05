/**
 * In-memory private state provider for browser environments.
 *
 * Replaces LevelDB-based levelPrivateStateProvider with a simple Map-based
 * implementation. State is lost on page reload (acceptable for demo).
 *
 * Implements the PrivateStateProvider interface from @midnight-ntwrk/midnight-js-types.
 */
import type { PrivateStateProvider, PrivateStateId } from '@midnight-ntwrk/midnight-js-types';
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
  const stateStore = new Map<PSI, PS>();
  const signingKeyStore = new Map<string, SigningKey>();

  return {
    async set(privateStateId: PSI, state: PS): Promise<void> {
      stateStore.set(privateStateId, state);
    },

    async get(privateStateId: PSI): Promise<PS | null> {
      return stateStore.get(privateStateId) ?? null;
    },

    async remove(privateStateId: PSI): Promise<void> {
      stateStore.delete(privateStateId);
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
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isWalletSyncProgressStrictlyReady,
  readRequiredWalletState,
} from './wallet-readiness.ts';

test('wallet authorization is not ready when a required state read fails', async () => {
  const nativeToken = '0'.repeat(64);
  const connectedWallet = {
    getUnshieldedAddress: async () => {
      throw new Error('wallet is still syncing');
    },
    getUnshieldedBalances: async () => ({ [nativeToken]: '1000000' }),
    getShieldedAddresses: async () => ({
      shieldedCoinPublicKey: 'coin-public-key',
      shieldedEncryptionPublicKey: 'encryption-public-key',
    }),
    getProvingProvider: async () => ({}),
    balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
    submitTransaction: async () => undefined,
  };

  await assert.rejects(
    readRequiredWalletState(connectedWallet),
    /required wallet state is unavailable/i,
  );
});

test('wallet authorization is ready only with address, balance, and shielded keys', async () => {
  const nativeToken = '0'.repeat(64);
  const result = await readRequiredWalletState({
    getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
    getUnshieldedBalances: async () => ({ [nativeToken]: '1000000' }),
    getShieldedAddresses: async () => ({
      shieldedCoinPublicKey: 'coin-public-key',
      shieldedEncryptionPublicKey: 'encryption-public-key',
    }),
    getProvingProvider: async () => ({}),
    balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
    submitTransaction: async () => undefined,
  });

  assert.deepEqual(result, {
    address: 'mn_addr_test',
    balance: 1000000n,
    coinPublicKey: 'coin-public-key',
    encryptionPublicKey: 'encryption-public-key',
  });
});

test('wallet authorization is not transaction-ready without connector transaction capabilities', async () => {
  const nativeToken = '0'.repeat(64);

  await assert.rejects(
    readRequiredWalletState({
      getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
      getUnshieldedBalances: async () => ({ [nativeToken]: '1000000' }),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: 'coin-public-key',
        shieldedEncryptionPublicKey: 'encryption-public-key',
      }),
    }),
    /transaction capabilities are unavailable/i,
  );
});

test('wallet authorization rejects a malformed token balance map', async () => {
  await assert.rejects(
    readRequiredWalletState({
      getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
      getUnshieldedBalances: async () => ({ unexpected: 'value' }),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: 'coin-public-key',
        shieldedEncryptionPublicKey: 'encryption-public-key',
      }),
      getProvingProvider: async () => ({}),
      balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
      submitTransaction: async () => undefined,
    }),
    /required wallet state is unavailable/i,
  );
});

test('an empty token balance map explicitly means zero native balance', async () => {
  const result = await readRequiredWalletState({
    getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
    getUnshieldedBalances: async () => ({}),
    getShieldedAddresses: async () => ({
      shieldedCoinPublicKey: 'coin-public-key',
      shieldedEncryptionPublicKey: 'encryption-public-key',
    }),
    getProvingProvider: async () => ({}),
    balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
    submitTransaction: async () => undefined,
  });

  assert.equal(result.balance, 0n);
});

for (const invalidBalance of ['', ' ', '-1', '0x10', -1n]) {
  test(`wallet authorization rejects invalid native balance ${String(invalidBalance)}`, async () => {
    const nativeToken = '0'.repeat(64);

    await assert.rejects(
      readRequiredWalletState({
        getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
        getUnshieldedBalances: async () => ({ [nativeToken]: invalidBalance }),
        getShieldedAddresses: async () => ({
          shieldedCoinPublicKey: 'coin-public-key',
          shieldedEncryptionPublicKey: 'encryption-public-key',
        }),
        getProvingProvider: async () => ({}),
        balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
        submitTransaction: async () => undefined,
      }),
      /required wallet state is unavailable/i,
    );
  });
}

test('wallet authorization rejects a non-string address', async () => {
  await assert.rejects(
    readRequiredWalletState({
      getUnshieldedAddress: async () => ({}),
      getUnshieldedBalances: async () => ({}),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: 'coin-public-key',
        shieldedEncryptionPublicKey: 'encryption-public-key',
      }),
      getProvingProvider: async () => ({}),
      balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
      submitTransaction: async () => undefined,
    }),
    /required wallet state is unavailable/i,
  );
});

test('wallet authorization rejects non-string shielded keys', async () => {
  await assert.rejects(
    readRequiredWalletState({
      getUnshieldedAddress: async () => ({ unshieldedAddress: 'mn_addr_test' }),
      getUnshieldedBalances: async () => ({}),
      getShieldedAddresses: async () => ({
        shieldedCoinPublicKey: 123,
        shieldedEncryptionPublicKey: { value: 'encryption-public-key' },
      }),
      getProvingProvider: async () => ({}),
      balanceUnsealedTransaction: async () => ({ tx: 'balanced-transaction' }),
      submitTransaction: async () => undefined,
    }),
    /required wallet state is unavailable/i,
  );
});

test('wallet sync readiness requires every wallet to be connected at exact gap zero', () => {
  assert.equal(isWalletSyncProgressStrictlyReady({
    shielded: { current: 100n, total: 100n, isConnected: true },
    unshielded: { current: 50n, total: 50n, isConnected: true },
    dust: { current: 75n, total: 75n, isConnected: true },
  }), true);
});

test('wallet sync readiness rejects an allowed-looking gap of one', () => {
  assert.equal(isWalletSyncProgressStrictlyReady({
    shielded: { current: 99n, total: 100n, isConnected: true },
    unshielded: { current: 50n, total: 50n, isConnected: true },
    dust: { current: 75n, total: 75n, isConnected: true },
  }), false);
});

test('wallet sync readiness rejects exact counters without a live connection', () => {
  assert.equal(isWalletSyncProgressStrictlyReady({
    shielded: { current: 100n, total: 100n, isConnected: false },
    unshielded: { current: 50n, total: 50n, isConnected: true },
    dust: { current: 75n, total: 75n, isConnected: true },
  }), false);
});

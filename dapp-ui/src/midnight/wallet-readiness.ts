const NATIVE_TOKEN = '0'.repeat(64);

export interface WalletStateReader {
  getUnshieldedAddress?: () => Promise<unknown>;
  getUnshieldedBalances?: () => Promise<unknown>;
  getShieldedAddresses?: () => Promise<unknown>;
  getProvingProvider?: (...args: unknown[]) => Promise<unknown>;
  balanceUnsealedTransaction?: (...args: unknown[]) => Promise<unknown>;
  submitTransaction?: (...args: unknown[]) => Promise<unknown>;
}

export interface RequiredWalletState {
  address: string;
  balance: bigint;
  coinPublicKey: string;
  encryptionPublicKey: string;
}

export class WalletStateUnavailableError extends Error {
  constructor() {
    super(
      'Wallet authorized, but required wallet state is unavailable. '
      + 'Wait for 1AM to finish shielded/DUST synchronization, then reconnect.',
    );
    this.name = 'WalletStateUnavailableError';
  }
}

export class WalletCapabilitiesUnavailableError extends Error {
  constructor() {
    super(
      'Wallet authorized, but required transaction capabilities are unavailable. '
      + 'Update 1AM and reconnect.',
    );
    this.name = 'WalletCapabilitiesUnavailableError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asTokenBalanceRecord(value: unknown): Record<string, bigint | string> | null {
  const record = asRecord(value);
  if (!record) return null;

  for (const [tokenType, balance] of Object.entries(record)) {
    if (!/^[0-9a-f]{64}$/i.test(tokenType)) return null;
    if (typeof balance === 'bigint') {
      if (balance < 0n) return null;
      continue;
    }
    if (typeof balance !== 'string' || !/^(0|[1-9][0-9]*)$/.test(balance)) {
      return null;
    }
  }
  return record as Record<string, bigint | string>;
}

export async function readRequiredWalletState(
  wallet: WalletStateReader,
): Promise<RequiredWalletState> {
  try {
    if (
      typeof wallet.getProvingProvider !== 'function'
      || typeof wallet.balanceUnsealedTransaction !== 'function'
      || typeof wallet.submitTransaction !== 'function'
    ) {
      throw new WalletCapabilitiesUnavailableError();
    }

    if (
      typeof wallet.getUnshieldedAddress !== 'function'
      || typeof wallet.getUnshieldedBalances !== 'function'
      || typeof wallet.getShieldedAddresses !== 'function'
    ) {
      throw new Error('required wallet methods are unavailable');
    }

    const addressResult = await wallet.getUnshieldedAddress();
    const addressRecord = asRecord(addressResult);
    const addressValue = addressRecord?.unshieldedAddress;
    if (typeof addressValue !== 'string') throw new Error('wallet address is unavailable');
    const address = addressValue.trim();
    if (!address || address === 'unknown') throw new Error('wallet address is unavailable');

    const balanceResult = asTokenBalanceRecord(await wallet.getUnshieldedBalances());
    if (!balanceResult) throw new Error('wallet balances are unavailable');
    const nativeBalance = balanceResult[NATIVE_TOKEN];
    // The connector API returns a token map; an absent NIGHT entry means zero NIGHT.
    const balance = BigInt(nativeBalance ?? '0');

    const shieldedResult = asRecord(await wallet.getShieldedAddresses());
    const coinPublicKeyValue = shieldedResult?.shieldedCoinPublicKey;
    const encryptionPublicKeyValue = shieldedResult?.shieldedEncryptionPublicKey;
    if (
      typeof coinPublicKeyValue !== 'string'
      || typeof encryptionPublicKeyValue !== 'string'
    ) {
      throw new Error('shielded wallet keys are unavailable');
    }
    const coinPublicKey = coinPublicKeyValue.trim();
    const encryptionPublicKey = encryptionPublicKeyValue.trim();
    if (!coinPublicKey || !encryptionPublicKey) {
      throw new Error('shielded wallet keys are unavailable');
    }

    return { address, balance, coinPublicKey, encryptionPublicKey };
  } catch (error) {
    if (
      error instanceof WalletStateUnavailableError
      || error instanceof WalletCapabilitiesUnavailableError
    ) {
      throw error;
    }
    throw new WalletStateUnavailableError();
  }
}

export const MIDNIGHT_CONFIG = {
  network: 'preprod' as const,
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://127.0.0.1:6300',
  faucetUrl: 'https://midnight-tmnight-preprod.nethermind.dev/',
  explorerUrl: 'https://preprod.midnightexplorer.com',
  contractAddress: (import.meta.env.VITE_MIDNIGHT_CONTRACT_ADDRESS ?? '').trim(),
};

export function requireContractAddress(): string {
  if (!/^[0-9a-fA-F]{64}$/.test(MIDNIGHT_CONFIG.contractAddress)) {
    throw new Error('Set VITE_MIDNIGHT_CONTRACT_ADDRESS to a 64-character contract address');
  }
  return MIDNIGHT_CONFIG.contractAddress;
}

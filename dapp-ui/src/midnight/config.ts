export const MIDNIGHT_CONFIG = {
  network: 'preprod' as const,
  indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  proofServer: 'http://localhost:6300',  // Direct connection to Docker proof server
  faucetUrl: 'https://faucet.preprod.midnight.network/',
  explorerUrl: 'https://preprod.midnightexplorer.com',
  contractAddress: '489067b2c29c99b314ad85b988fbb4de8f404b4bf565021d302da7dfbe8b76a9',
};

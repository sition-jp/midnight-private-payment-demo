import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DeploymentInfo {
  readonly contractAddress: string;
  readonly network?: string;
}

function resolveRuntimeFile(envName: string, fallback: string): string {
  return path.resolve(process.env[envName] ?? fallback);
}

export function loadDeployment(): DeploymentInfo {
  const file = resolveRuntimeFile('MIDNIGHT_DEPLOYMENT_FILE', 'deployment.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found. Set MIDNIGHT_DEPLOYMENT_FILE or provide ${file}`);
  }
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<DeploymentInfo>;
  if (!parsed.contractAddress) {
    throw new Error('Deployment file does not contain contractAddress');
  }
  return { contractAddress: parsed.contractAddress, network: parsed.network };
}

export function loadWalletSeed(): string {
  const file = resolveRuntimeFile('MIDNIGHT_SEED_FILE', '.midnight-seed');
  if (!fs.existsSync(file)) {
    throw new Error(`Wallet seed file not found. Set MIDNIGHT_SEED_FILE or provide ${file}`);
  }
  const storedSeed = fs.readFileSync(file, 'utf8').trim();
  // The April demo seed file has a legacy "%%" terminator. Node's former
  // Buffer.from(value, 'hex') path silently ignored it; normalize it explicitly.
  const seed = storedSeed.endsWith('%%') ? storedSeed.slice(0, -2) : storedSeed;
  if (!/^[0-9a-fA-F]{64}$/.test(seed)) {
    throw new Error('Wallet seed must be a 32-byte hexadecimal value');
  }
  return seed;
}

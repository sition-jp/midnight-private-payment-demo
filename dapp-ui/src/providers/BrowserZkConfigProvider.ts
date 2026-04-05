/**
 * Browser-compatible ZK config provider.
 *
 * Replaces NodeZkConfigProvider (which uses fs.readFile) with a fetch()-based
 * implementation that loads prover keys, verifier keys, and ZKIR files from
 * the public directory served by Vite.
 *
 * Files are expected at:
 *   /contracts/private-payment/keys/{circuitId}.prover
 *   /contracts/private-payment/keys/{circuitId}.verifier
 *   /contracts/private-payment/zkir/{circuitId}.zkir
 */
import {
  ZKConfigProvider,
  createProverKey,
  createVerifierKey,
  createZKIR,
} from '@midnight-ntwrk/midnight-js-types';
import type { ProverKey, VerifierKey, ZKIR } from '@midnight-ntwrk/midnight-js-types';

export class BrowserZkConfigProvider<K extends string> extends ZKConfigProvider<K> {
  private readonly basePath: string;

  constructor(basePath: string) {
    super();
    this.basePath = basePath;
  }

  /**
   * Fetch a binary file and return it as Uint8Array.
   */
  private async fetchFile(subDir: string, circuitId: K, ext: string): Promise<Uint8Array> {
    const url = `${this.basePath}/${subDir}/${circuitId}.${ext}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `BrowserZkConfigProvider: failed to fetch ${url} (${response.status} ${response.statusText})`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async getProverKey(circuitId: K): Promise<ProverKey> {
    const data = await this.fetchFile('keys', circuitId, 'prover');
    return createProverKey(data);
  }

  async getVerifierKey(circuitId: K): Promise<VerifierKey> {
    const data = await this.fetchFile('keys', circuitId, 'verifier');
    return createVerifierKey(data);
  }

  async getZKIR(circuitId: K): Promise<ZKIR> {
    const data = await this.fetchFile('zkir', circuitId, 'zkir');
    return createZKIR(data);
  }
}

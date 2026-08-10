import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import test from 'node:test';

import { loadDeployment, saveDeployment } from './runtime-files.js';

test('deployment metadata is written to the configured runtime file with restricted permissions', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'midnight-runtime-files-'));
  const deploymentFile = path.join(temporaryDirectory, 'deployment.json');
  const previous = process.env.MIDNIGHT_DEPLOYMENT_FILE;
  process.env.MIDNIGHT_DEPLOYMENT_FILE = deploymentFile;

  try {
    const deployment = {
      contractAddress: 'ab'.repeat(32),
      network: 'preprod',
    } as const;
    saveDeployment(deployment);

    assert.deepEqual(loadDeployment(), deployment);
    assert.equal(fs.statSync(deploymentFile).mode & 0o777, 0o600);
    assert.equal(
      fs.readFileSync(deploymentFile, 'utf8'),
      `${JSON.stringify(deployment, null, 2)}\n`,
    );
  } finally {
    if (previous === undefined) delete process.env.MIDNIGHT_DEPLOYMENT_FILE;
    else process.env.MIDNIGHT_DEPLOYMENT_FILE = previous;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('deployment metadata tightens permissions on an existing runtime file', () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'midnight-runtime-files-'));
  const deploymentFile = path.join(temporaryDirectory, 'deployment.json');
  const previous = process.env.MIDNIGHT_DEPLOYMENT_FILE;
  process.env.MIDNIGHT_DEPLOYMENT_FILE = deploymentFile;

  try {
    fs.writeFileSync(deploymentFile, '{}\n', { mode: 0o644 });
    saveDeployment({
      contractAddress: 'cd'.repeat(32),
      network: 'preprod',
    });

    assert.equal(fs.statSync(deploymentFile).mode & 0o777, 0o600);
  } finally {
    if (previous === undefined) delete process.env.MIDNIGHT_DEPLOYMENT_FILE;
    else process.env.MIDNIGHT_DEPLOYMENT_FILE = previous;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

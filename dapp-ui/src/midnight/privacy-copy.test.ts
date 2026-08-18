import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('workshop UI states the exact disclosure boundary', () => {
  const depositPanel = read('../components/DepositPanel.tsx');
  const transferPanel = read('../components/TransferPanel.tsx');
  const balancePanel = read('../components/BalancePanel.tsx');
  const header = read('../components/Header.tsx');
  const txResult = read('../components/TxResult.tsx');
  const walletPanel = read('../components/WalletPanel.tsx');

  assert.match(depositPanel, /initialization amount is public/i);
  assert.match(depositPanel, /does not move wallet tNIGHT into the contract/i);
  assert.match(depositPanel, /balance value remains\s+hidden/i);
  assert.match(depositPanel, /Initialize Demo Balance/);
  assert.doesNotMatch(depositPanel, /Deposit tNight/i);
  assert.match(transferPanel, /amount is hidden; sender and\s+recipient public keys remain visible on-chain/i);
  assert.match(transferPanel, /not a complete\s+two-party payment/i);
  assert.match(transferPanel, /type="password"/);
  assert.match(balancePanel, /check_balance publicly discloses the\s+returned balance/i);
  assert.doesNotMatch(balancePanel, /Query your private balance/i);
  assert.doesNotMatch(balancePanel, /hash\.slice/);
  assert.match(header, /walletContext\.mode === 'demo'\s*\? 'Demo connected'/);
  assert.doesNotMatch(txResult, /Tx Hash:/);
  assert.match(walletPanel, /disposable Preprod demo seed/i);
  assert.match(walletPanel, /never use a real wallet seed/i);
  assert.match(walletPanel, /getSecretInputAttributes/);
  assert.match(walletPanel, /onPrepareDust/);
  assert.match(walletPanel, /on-chain registration/i);
  assert.match(walletPanel, /dustModel\.canConnectContract/);
  assert.doesNotMatch(walletPanel, /automatically (?:request|register|generate)/i);
});

test('public MCP instructions pin the reviewed package instead of a moving tag', () => {
  const sources = [
    '../../../.mcp.json',
    '../../../docs/manual.md',
    '../../../docs/create-manual-slides.js',
    '../../../docs/create-manual-v2-slides.js',
    '../../../demo/demo-script.md',
  ] as const;

  for (const relativePath of sources) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /midnight-mcp@latest/);
    assert.match(source, /midnight-mcp@0\.3\.0/);
  }
});

test('visibility panel binds the tested comparison caption and disclosure copy', () => {
  const visibilityPanel = read('../components/VisibilityPanel.tsx');

  assert.match(visibilityPanel, /Public chain comparison/);
  assert.match(visibilityPanel, /Midnight put on-chain/);
  assert.match(visibilityPanel, /Not put on-chain/);
  assert.match(visibilityPanel, /Public keys remain visible/);
  assert.match(visibilityPanel, /Amounts remain hidden/);
  assert.match(visibilityPanel, /Illustration only/);
  assert.match(visibilityPanel, /publicComparisonCaption/);
  assert.doesNotMatch(visibilityPanel, /recipient.*hidden on-chain/i);
});

test('automatic payment policy states its local-only boundary and PoC limitation', () => {
  const policyPanel = read('../components/PolicyPanel.tsx');

  assert.match(policyPanel, /Automatic Payment Policy/);
  assert.match(policyPanel, /local policy inputs.*not put on-chain/i);
  assert.match(policyPanel, /not a complete two-party payment/i);
  assert.doesNotMatch(policyPanel, /AI agent/i);
  assert.match(policyPanel, /type="password"/);
  assert.match(policyPanel, /entry\.explorerUrl/);
  assert.match(policyPanel, /View on Explorer/);
});

test('workshop script does not claim recipient anonymity or complete payment delivery', () => {
  const script = read('../../../demo/demo-script.md');

  assert.match(script, /金額は消える、相手は残る/);
  assert.match(script, /秘匿残高更新の概念実証/);
  assert.doesNotMatch(script, /送金額と送金先を非公開/);
  assert.doesNotMatch(script, /送金先アドレスもない/);
  assert.doesNotMatch(script, /誰に送ったかは誰にもわからない/);
});

test('all public workshop sources preserve the contract disclosure boundary', () => {
  const publicSources = [
    '../../../README.md',
    '../../../demo/demo-script.md',
    '../../../deploy-test/README.md',
    '../../../deploy-test/src/transfer-test.ts',
    '../../../docs/manual.md',
    '../../../docs/create-manual-slides.js',
    '../../../docs/create-manual-v2-slides.js',
    '../../../docs/create-slides.js',
    '../../../docs/superpowers/plans/2026-04-05-1am-wallet-transactions.md',
  ] as const;

  for (const relativePath of publicSources) {
    const normalized = read(relativePath).replaceAll('\\n', ' ').replace(/\s+/g, ' ');

    assert.doesNotMatch(
      normalized,
      /送金額.{0,30}送金先.{0,30}(?:非公開|見せない)/,
      `${relativePath} must not claim that the recipient is hidden`,
    );
    assert.doesNotMatch(
      normalized,
      /送金先(?:アドレス|（recipient）)?.{0,30}(?:チェーン非公開|非公開（witness）)/,
      `${relativePath} must not describe the recipient public key as chain-private`,
    );
    assert.doesNotMatch(
      normalized,
      /金額.{0,20}(?:相手先|宛先).{0,30}(?:非公開|秘匿)/,
      `${relativePath} must not group the public recipient key with the hidden amount`,
    );
    assert.doesNotMatch(
      normalized,
      /(?:amount and recipient|recipient).{0,40}hidden(?: via ZKP| on-chain)?/i,
      `${relativePath} must not claim recipient anonymity in English`,
    );
    assert.doesNotMatch(
      normalized,
      /check_balance.{0,50}(?:プライベート(?:な)?残高|非公開(?:の)?残高|private balance)/i,
      `${relativePath} must state that check_balance discloses its result`,
    );
  }
});

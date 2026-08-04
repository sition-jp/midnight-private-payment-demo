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

  assert.match(depositPanel, /deposit amount is public/i);
  assert.match(depositPanel, /balance value remains hidden/i);
  assert.match(transferPanel, /amount is hidden; sender and\s+recipient public keys remain visible on-chain/i);
  assert.match(transferPanel, /not a complete\s+two-party payment/i);
  assert.match(transferPanel, /type="password"/);
  assert.match(balancePanel, /check_balance publicly discloses the\s+returned balance/i);
  assert.doesNotMatch(balancePanel, /Query your private balance/i);
  assert.doesNotMatch(balancePanel, /hash\.slice/);
  assert.match(header, /walletContext\.mode === 'demo'\s*\? 'Demo connected'/);
  assert.doesNotMatch(txResult, /Tx Hash:/);
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

test('workshop script does not claim recipient anonymity or complete payment delivery', () => {
  const script = read('../../../demo/demo-script.md');

  assert.match(script, /金額は消える、相手は残る/);
  assert.match(script, /秘匿残高更新の概念実証/);
  assert.doesNotMatch(script, /送金額と送金先を非公開/);
  assert.doesNotMatch(script, /送金先アドレスもない/);
  assert.doesNotMatch(script, /誰に送ったかは誰にもわからない/);
});

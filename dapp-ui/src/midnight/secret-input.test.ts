import assert from 'node:assert/strict';
import test from 'node:test';

import { getSecretInputAttributes } from './secret-input.ts';

test('secret input is masked by default and blocks browser autocomplete', () => {
  assert.deepEqual(getSecretInputAttributes(false), {
    type: 'password',
    autoComplete: 'new-password',
  });
});

test('secret input becomes visible only for an explicit reveal state', () => {
  assert.deepEqual(getSecretInputAttributes(true), {
    type: 'text',
    autoComplete: 'new-password',
  });
});

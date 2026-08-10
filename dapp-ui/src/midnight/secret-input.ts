export interface SecretInputAttributes {
  readonly type: 'password' | 'text';
  readonly autoComplete: 'new-password';
}

export function getSecretInputAttributes(revealed: boolean): SecretInputAttributes {
  return {
    type: revealed ? 'text' : 'password',
    autoComplete: 'new-password',
  };
}

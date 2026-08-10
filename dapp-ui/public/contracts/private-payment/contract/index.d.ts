import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
  local_secret_key(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  private_amount(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  private_recipient(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  get_balance(context: __compactRuntime.WitnessContext<Ledger, PS>,
              pk_0: Uint8Array): [PS, bigint];
  get_salt(context: __compactRuntime.WitnessContext<Ledger, PS>,
           pk_0: Uint8Array): [PS, Uint8Array];
  new_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_balance(context: __compactRuntime.WitnessContext<Ledger, PS>,
                pk_0: Uint8Array,
                balance_0: bigint,
                salt_0: Uint8Array): [PS, []];
  get_recipient_balance(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, bigint];
  get_recipient_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  new_recipient_salt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  store_recipient_balance(context: __compactRuntime.WitnessContext<Ledger, PS>,
                          pk_0: Uint8Array,
                          balance_0: bigint,
                          salt_0: Uint8Array): [PS, []];
}

export type ImpureCircuits<PS> = {
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  private_transfer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  check_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type ProvableCircuits<PS> = {
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  private_transfer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  check_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  deposit(context: __compactRuntime.CircuitContext<PS>, amount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  private_transfer(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, []>;
  check_balance(context: __compactRuntime.CircuitContext<PS>): __compactRuntime.CircuitResults<PS, bigint>;
}

export type Ledger = {
  balance_commitments: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;

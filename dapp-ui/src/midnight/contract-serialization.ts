export interface ContractCallQueue {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export function createContractCallQueue(): ContractCallQueue {
  let tail: Promise<void> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

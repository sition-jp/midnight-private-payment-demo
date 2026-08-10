export interface LatestDustOperation<T> {
  run(
    factory: (signal: AbortSignal) => Promise<T>,
    onAccepted: (value: T) => void,
  ): Promise<boolean>;
  cancel(): void;
}

export function createLatestDustOperation<T>(): LatestDustOperation<T> {
  let generation = 0;
  let controller: AbortController | null = null;
  let running = false;

  return {
    async run(factory, onAccepted): Promise<boolean> {
      if (running) throw new Error('A DUST operation is already running.');
      running = true;
      const myGeneration = ++generation;
      const myController = new AbortController();
      controller = myController;
      try {
        const value = await factory(myController.signal);
        if (myController.signal.aborted || myGeneration !== generation) return false;
        onAccepted(value);
        return true;
      } catch (error) {
        if (myController.signal.aborted || myGeneration !== generation) return false;
        throw error;
      } finally {
        if (myGeneration === generation) {
          controller = null;
          running = false;
        }
      }
    },

    cancel(): void {
      generation += 1;
      controller?.abort();
      controller = null;
      running = false;
    },
  };
}

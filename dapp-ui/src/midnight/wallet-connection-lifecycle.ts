export interface StoppableWalletResource {
  stop(): Promise<void>;
}

export interface LatestWalletConnection<T extends StoppableWalletResource> {
  connect(
    factory: (signal: AbortSignal) => Promise<T>,
    onAccepted: (resource: T) => void,
  ): Promise<boolean>;
  disconnect(): Promise<void>;
}

/**
 * Own one wallet generation at a time. Stale factories may finish, but their
 * resources are stopped and never published to the application.
 */
export function createLatestWalletConnection<
  T extends StoppableWalletResource,
>(): LatestWalletConnection<T> {
  let generation = 0;
  let current: T | null = null;
  let pendingController: AbortController | null = null;

  return {
    async connect(factory, onAccepted): Promise<boolean> {
      const myGeneration = ++generation;
      pendingController?.abort();

      const previous = current;
      current = null;
      if (previous) {
        await previous.stop();
        if (myGeneration !== generation) return false;
      }

      const controller = new AbortController();
      pendingController = controller;
      let resource: T;
      try {
        resource = await factory(controller.signal);
      } catch (error) {
        if (controller.signal.aborted || myGeneration !== generation) return false;
        throw error;
      }

      if (controller.signal.aborted || myGeneration !== generation) {
        await resource.stop();
        return false;
      }

      pendingController = null;
      current = resource;
      onAccepted(resource);
      return true;
    },

    async disconnect(): Promise<void> {
      generation += 1;
      pendingController?.abort();
      pendingController = null;
      const resource = current;
      current = null;
      await resource?.stop();
    },
  };
}

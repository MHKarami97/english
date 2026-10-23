export interface StorageUsage {
  readonly usage: number;
  readonly quota: number;
}

export class StorageEstimator {
  async estimate(): Promise<StorageUsage | null> {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  }

  /** null means the browser does not support persistent storage. */
  async persist(): Promise<boolean | null> {
    if (!navigator.storage?.persist) return null;
    return navigator.storage.persist();
  }

  async isPersisted(): Promise<boolean | null> {
    if (!navigator.storage?.persisted) return null;
    return navigator.storage.persisted();
  }
}

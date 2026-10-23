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
}

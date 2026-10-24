import type { DownloadRecord } from '@/domain/download/models';
import type { MediaManifestRepository } from '@/domain/download/ports';

export interface OrphanReconcilerPort {
  reconcile(bookId: string): Promise<{ readonly removed: number; readonly restored: number }>;
}

export interface DownloadMaintenance {
  prune(bookId: string): Promise<number>;
  reconcile(bookId: string): Promise<readonly DownloadRecord[]>;
}

export interface MaintenanceReport {
  readonly orphansRemoved: number;
  readonly orphansRestored: number;
  readonly prunedFiles: number;
  readonly records: readonly DownloadRecord[];
}

/** Runs after a book's text content was re-imported with new content. */
export class ContentMaintenanceService {
  constructor(
    private readonly orphans: OrphanReconcilerPort,
    private readonly manifests: MediaManifestRepository,
    private readonly downloads: DownloadMaintenance,
  ) {}

  async afterContentRefresh(bookId: string): Promise<MaintenanceReport> {
    const orphan = await this.orphans.reconcile(bookId);
    this.manifests.invalidate(bookId);
    let prunedFiles = 0;
    let records: readonly DownloadRecord[] = [];
    try {
      prunedFiles = await this.downloads.prune(bookId);
      records = await this.downloads.reconcile(bookId);
    } catch {
      // Offline or no manifest yet: the next successful reconcile fixes the records.
    }
    return { orphansRemoved: orphan.removed, orphansRestored: orphan.restored, prunedFiles, records };
  }
}

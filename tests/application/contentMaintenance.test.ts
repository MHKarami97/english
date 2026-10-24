import { describe, expect, it } from 'vitest';
import { ContentMaintenanceService } from '@/application/ContentMaintenanceService';
import type { MediaManifestRepository } from '@/domain/download/ports';

function build(prune: () => Promise<number>) {
  const calls: string[] = [];
  const manifests: MediaManifestRepository = {
    get: async () => {
      throw new Error('not used');
    },
    invalidate: (bookId) => {
      calls.push(`invalidate:${bookId}`);
    },
  };
  const service = new ContentMaintenanceService(
    {
      reconcile: async (bookId) => {
        calls.push(`orphans:${bookId}`);
        return { removed: 2, restored: 1 };
      },
    },
    manifests,
    { prune, reconcile: async () => [] },
  );
  return { service, calls };
}

describe('ContentMaintenanceService', () => {
  it('handles orphans first, then refreshes the manifest, then cleans up downloads', async () => {
    const { service, calls } = build(async () => 3);
    const report = await service.afterContentRefresh('b');
    expect(calls).toEqual(['orphans:b', 'invalidate:b']);
    expect(report).toEqual({ orphansRemoved: 2, orphansRestored: 1, prunedFiles: 3, records: [] });
  });

  it('still reports the orphan work when the download cleanup fails offline', async () => {
    const { service } = build(async () => {
      throw new Error('offline');
    });
    const report = await service.afterContentRefresh('b');
    expect(report.orphansRemoved).toBe(2);
    expect(report.prunedFiles).toBe(0);
  });
});

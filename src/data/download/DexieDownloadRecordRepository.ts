import type { DownloadRecord } from '@/domain/download/models';
import type { DownloadRecordRepository } from '@/domain/download/ports';
import type { LexiDatabase } from '../db/LexiDatabase';

export class DexieDownloadRecordRepository implements DownloadRecordRepository {
  constructor(private readonly db: LexiDatabase) {}

  listByBook(bookId: string): Promise<readonly DownloadRecord[]> {
    return this.db.downloadRecords.where('bookId').equals(bookId).toArray();
  }

  async putMany(records: readonly DownloadRecord[]): Promise<void> {
    await this.db.downloadRecords.bulkPut([...records]);
  }

  async deleteMany(unitIds: readonly string[]): Promise<void> {
    await this.db.downloadRecords.bulkDelete([...unitIds]);
  }

  async deleteByBook(bookId: string): Promise<void> {
    await this.db.downloadRecords.where('bookId').equals(bookId).delete();
  }
}

import Dexie from 'dexie';
import { LexiDatabase } from '@/data/db/LexiDatabase';

let counter = 0;

export async function openTestDb(): Promise<LexiDatabase> {
  counter += 1;
  const db = new LexiDatabase(`test-db-${counter}-${Math.random().toString(36).slice(2)}`);
  await db.open();
  return db;
}

export async function dropDb(db: LexiDatabase): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
}

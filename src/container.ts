import { BootstrapService } from '@/application/BootstrapService';
import { LibraryService } from '@/application/LibraryService';
import { ProgressService } from '@/application/ProgressService';
import { SearchService } from '@/application/SearchService';
import { StudyService } from '@/application/StudyService';
import { HttpBookIndex } from '@/data/content/HttpBookIndex';
import { HttpContentPack } from '@/data/content/HttpContentPack';
import { LexiDatabase } from '@/data/db/LexiDatabase';
import { BookImporter } from '@/data/import/BookImporter';
import {
  DexieBookRepository,
  DexieProgressRepository,
  DexieSettingsRepository,
  DexieUnitRepository,
  DexieWordRepository,
} from '@/data/repositories';
import { AudioPlayer } from '@/infrastructure/audio/AudioPlayer';
import { MediaUrlResolver } from '@/infrastructure/media/MediaUrlResolver';
import { StorageEstimator } from '@/infrastructure/storage/StorageEstimator';

// Composition root: the only place that knows which concrete classes implement the domain contracts.
const db = new LexiDatabase();
const bookRepository = new DexieBookRepository(db);
const unitRepository = new DexieUnitRepository(db);
const wordRepository = new DexieWordRepository(db);
const progressRepository = new DexieProgressRepository(db);
const settingsRepository = new DexieSettingsRepository(db);

export const container = {
  settings: settingsRepository,
  media: new MediaUrlResolver(),
  audio: new AudioPlayer(),
  storage: new StorageEstimator(),
  bootstrap: new BootstrapService(
    bookRepository,
    new BookImporter(db),
    new HttpBookIndex(),
    (book) => new HttpContentPack(book),
  ),
  library: new LibraryService(unitRepository, wordRepository, progressRepository),
  progress: new ProgressService(progressRepository, settingsRepository),
  study: new StudyService(unitRepository, wordRepository, progressRepository, settingsRepository),
  search: new SearchService(unitRepository, wordRepository),
} as const;

export type Container = typeof container;

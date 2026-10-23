import type { StudyCalendar } from './StudyCalendar';

interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDayKey(dayKey: string): readonly [number, number, number] {
  const match = DAY_KEY.exec(dayKey);
  if (!match) throw new Error(`Invalid day key: ${dayKey}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

const toDayKey = (utcMillis: number): string => new Date(utcMillis).toISOString().slice(0, 10);

/**
 * Uses Intl.DateTimeFormat for wall-clock conversion so DST and historical offset changes come
 * from the platform's IANA data instead of hand-written offsets.
 */
export class ZonedStudyCalendar implements StudyCalendar {
  private readonly formatter: Intl.DateTimeFormat;

  constructor(
    readonly timeZone: string,
    readonly rolloverHour: number,
  ) {
    this.formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  dayKey(timestamp: number): string {
    const wall = this.wallClock(timestamp);
    const dayShift = wall.hour < this.rolloverHour ? -1 : 0;
    return toDayKey(Date.UTC(wall.year, wall.month - 1, wall.day + dayShift));
  }

  addDays(dayKey: string, days: number): string {
    const [year, month, day] = parseDayKey(dayKey);
    return toDayKey(Date.UTC(year, month - 1, day + days));
  }

  startOfDay(dayKey: string): number {
    const [year, month, day] = parseDayKey(dayKey);
    const wall = Date.UTC(year, month - 1, day, this.rolloverHour);
    // Two passes: the offset at the guessed instant can differ from the offset at the real one.
    const firstGuess = wall - this.offsetAt(wall);
    return wall - this.offsetAt(firstGuess);
  }

  dueAt(from: number, days: number): number {
    return this.startOfDay(this.addDays(this.dayKey(from), days));
  }

  private wallClock(timestamp: number): WallClock {
    const values = new Map<string, number>();
    for (const part of this.formatter.formatToParts(new Date(timestamp))) {
      if (part.type !== 'literal') values.set(part.type, Number(part.value));
    }
    const read = (type: string): number => {
      const value = values.get(type);
      if (value === undefined) throw new Error(`Missing ${type} for ${this.timeZone}`);
      return value;
    };
    return {
      year: read('year'),
      month: read('month'),
      day: read('day'),
      hour: read('hour'),
      minute: read('minute'),
      second: read('second'),
    };
  }

  private offsetAt(timestamp: number): number {
    const wall = this.wallClock(timestamp);
    const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
    return wallAsUtc - Math.floor(timestamp / 1000) * 1000;
  }
}

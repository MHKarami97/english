export class StorageQuotaError extends Error {
  constructor() {
    super('The device ran out of storage space.');
    this.name = 'StorageQuotaError';
  }
}

export class SizeMismatchError extends Error {
  constructor(
    readonly url: string,
    readonly expected: number,
    readonly actual: number,
  ) {
    super(`${url} has ${actual} bytes, expected ${expected}`);
    this.name = 'SizeMismatchError';
  }
}

export class HttpStatusError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`${url} answered with HTTP ${status}`);
    this.name = 'HttpStatusError';
  }
}

export class NotCacheableError extends Error {
  constructor(readonly url: string) {
    super(`${url} cannot be stored (opaque or partial response)`);
    this.name = 'NotCacheableError';
  }
}

export class ManifestUnavailableError extends Error {
  constructor(readonly bookId: string) {
    super(`The media manifest for ${bookId} is not available`);
    this.name = 'ManifestUnavailableError';
  }
}

export type AudioStatus = 'idle' | 'playing' | 'error';

export interface AudioState {
  readonly status: AudioStatus;
  readonly url: string | null;
}

type Listener = (state: AudioState) => void;

/** Facade over HTMLAudioElement: a single shared element guarantees one active sound at a time. */
export class AudioPlayer {
  private readonly element = new Audio();
  private readonly listeners = new Set<Listener>();
  private readonly preloaded = new Set<string>();
  private state: AudioState = { status: 'idle', url: null };

  constructor() {
    this.element.preload = 'auto';
    this.element.addEventListener('ended', () => this.setState('idle', null));
    this.element.addEventListener('error', () => this.setState('error', this.state.url));
  }

  getState(): AudioState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async play(url: string): Promise<boolean> {
    this.stop();
    this.element.src = url;
    this.setState('playing', url);
    try {
      await this.element.play();
      return true;
    } catch {
      // A newer play() call interrupts this one; only report errors for the current url.
      if (this.state.url === url) this.setState('error', url);
      return false;
    }
  }

  stop(): void {
    this.element.pause();
    if (this.state.status !== 'idle') this.setState('idle', null);
  }

  /**
   * A full GET (not an <audio> range request) lets the service worker cache a complete 200
   * response, which Workbox needs in order to answer later Range requests offline.
   */
  preload(url: string | null): void {
    if (!url || this.preloaded.has(url) || !navigator.onLine) return;
    this.preloaded.add(url);
    void fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('miss'))))
      .catch(() => this.preloaded.delete(url));
  }

  private setState(status: AudioStatus, url: string | null): void {
    this.state = { status, url };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

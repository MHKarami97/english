interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

export type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Chromium fires beforeinstallprompt once, early. The listener is registered when the container is
 * created, so the event is kept until a screen asks for it.
 */
export class InstallPromptSource {
  private event: BeforeInstallPromptEvent | null = null;
  private readonly listeners = new Set<() => void>();

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.event = event as BeforeInstallPromptEvent;
      this.notify();
    });
    window.addEventListener('appinstalled', () => {
      this.event = null;
      this.notify();
    });
  }

  get available(): boolean {
    return this.event !== null;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async prompt(): Promise<InstallResult> {
    const event = this.event;
    if (!event) return 'unavailable';
    this.event = null;
    await event.prompt();
    const choice = await event.userChoice;
    this.notify();
    return choice.outcome;
  }

  isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
  }

  /** Safari on iPhone and iPad has no install prompt; the user has to use the Share sheet. */
  isIosSafari(): boolean {
    const agent = navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(agent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safari = /safari/i.test(agent) && !/crios|fxios|edgios|opios/i.test(agent);
    return ios && safari;
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }
}

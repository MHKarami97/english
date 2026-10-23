export type InstallUi = 'none' | 'prompt' | 'ios-instructions';

export interface InstallContext {
  readonly standalone: boolean;
  /** A captured beforeinstallprompt event is ready to use (Chromium). */
  readonly promptAvailable: boolean;
  readonly iosSafari: boolean;
  readonly dismissed: boolean;
}

export function decideInstallUi(context: InstallContext): InstallUi {
  if (context.standalone || context.dismissed) return 'none';
  if (context.promptAvailable) return 'prompt';
  if (context.iosSafari) return 'ios-instructions';
  return 'none';
}

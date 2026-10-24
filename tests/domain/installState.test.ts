import { describe, expect, it } from 'vitest';
import { decideInstallUi } from '@/domain/install/installState';

const none = { standalone: false, promptAvailable: false, iosSafari: false, dismissed: false };

describe('decideInstallUi', () => {
  it('shows nothing when the app is already installed or the user dismissed it', () => {
    expect(decideInstallUi({ ...none, standalone: true, promptAvailable: true })).toBe('none');
    expect(decideInstallUi({ ...none, dismissed: true, promptAvailable: true })).toBe('none');
  });

  it('offers the install prompt when the browser provides one', () => {
    expect(decideInstallUi({ ...none, promptAvailable: true })).toBe('prompt');
    expect(decideInstallUi({ ...none, promptAvailable: true, iosSafari: true })).toBe('prompt');
  });

  it('explains the Share sheet on iPhone and iPad Safari', () => {
    expect(decideInstallUi({ ...none, iosSafari: true })).toBe('ios-instructions');
  });

  it('shows nothing where installing is not possible', () => {
    expect(decideInstallUi(none)).toBe('none');
  });
});

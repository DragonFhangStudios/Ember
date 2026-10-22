import { describe, expect, it } from 'vitest';
import { DiagnosticsInfo, formatDiagnostics } from './diagnostics';

// Diagnostics for feedback (#32): app and browser details only.

const info: DiagnosticsInfo = {
  appVersion: 'abc1234',
  builtAt: '2026-10-22T10:00:00.000Z',
  saveVersion: 9,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130',
  language: 'en-US',
  screen: '412×915 @2.63x',
  viewport: '412×839',
  displayMode: 'standalone',
  colorScheme: 'dark',
  reducedMotion: true,
  storage: 'may-clear',
  indexedDB: true,
  online: false,
};

describe('diagnostics', () => {
  it('lists the build, browser, screen, appearance and storage, one per line', () => {
    expect(formatDiagnostics(info)).toBe(
      [
        'Ember diagnostics',
        'App version: abc1234 (built 2026-10-22T10:00:00.000Z)',
        'Save format: v9',
        'Browser: Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130',
        'Language: en-US',
        'Screen: 412×915 @2.63x; window 412×839',
        'Opened as: home-screen app',
        'Appearance: dark theme, reduced motion',
        'Storage: may be cleared by the browser; IndexedDB available',
        'Online: no',
      ].join('\n'),
    );
  });

  it('describes every storage state and both display modes plainly', () => {
    expect(formatDiagnostics({ ...info, storage: 'kept', displayMode: 'browser', reducedMotion: false, colorScheme: 'light' })).toMatch(
      /Opened as: browser tab\nAppearance: light theme\nStorage: kept by the browser/,
    );
    expect(formatDiagnostics({ ...info, storage: 'unsupported', indexedDB: false })).toMatch(/persistence not supported; IndexedDB unavailable/);
  });

  it('takes nothing from the save (it has no way to)', () => {
    expect(Object.keys(info).sort()).toEqual(
      ['appVersion', 'builtAt', 'colorScheme', 'displayMode', 'indexedDB', 'language', 'online', 'reducedMotion', 'saveVersion', 'screen', 'storage', 'userAgent', 'viewport'],
    );
  });
});

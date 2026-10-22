import { APP_VERSION, BUILT_AT } from './buildInfo';
import { SAVE_VERSION } from './progression';
import { StorageProtection, storageProtection } from './persistence';

// Diagnostics a player can copy into a bug report (#32). Built only from the
// build and the browser, never from the save: no check-ins, notes, quests,
// names or progress can end up here. Nothing is sent anywhere; the player
// copies the text and decides where it goes.

export interface DiagnosticsInfo {
  appVersion: string;
  builtAt: string;
  saveVersion: number;
  userAgent: string;
  language: string;
  screen: string; // "412×915 @2.6x"
  viewport: string; // "412×839"
  displayMode: 'standalone' | 'browser';
  colorScheme: 'dark' | 'light';
  reducedMotion: boolean;
  storage: StorageProtection;
  indexedDB: boolean;
  online: boolean;
}

export function formatDiagnostics(info: DiagnosticsInfo): string {
  return [
    'Ember diagnostics',
    `App version: ${info.appVersion} (built ${info.builtAt})`,
    `Save format: v${info.saveVersion}`,
    `Browser: ${info.userAgent}`,
    `Language: ${info.language}`,
    `Screen: ${info.screen}; window ${info.viewport}`,
    `Opened as: ${info.displayMode === 'standalone' ? 'home-screen app' : 'browser tab'}`,
    `Appearance: ${info.colorScheme} theme${info.reducedMotion ? ', reduced motion' : ''}`,
    `Storage: ${info.storage === 'kept' ? 'kept by the browser' : info.storage === 'may-clear' ? 'may be cleared by the browser' : 'persistence not supported'}; IndexedDB ${info.indexedDB ? 'available' : 'unavailable'}`,
    `Online: ${info.online ? 'yes' : 'no'}`,
  ].join('\n');
}

/** The current browser's diagnostics. */
export async function collectDiagnostics(): Promise<string> {
  const media = (query: string) => window.matchMedia(query).matches;
  const ratio = Math.round(window.devicePixelRatio * 100) / 100;
  return formatDiagnostics({
    appVersion: APP_VERSION,
    builtAt: BUILT_AT,
    saveVersion: SAVE_VERSION,
    userAgent: navigator.userAgent,
    language: navigator.language,
    screen: `${window.screen.width}×${window.screen.height} @${ratio}x`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    displayMode: media('(display-mode: standalone)') || (navigator as { standalone?: boolean }).standalone ? 'standalone' : 'browser',
    colorScheme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
    reducedMotion: media('(prefers-reduced-motion: reduce)'),
    storage: await storageProtection(),
    indexedDB: typeof indexedDB !== 'undefined',
    online: navigator.onLine,
  });
}

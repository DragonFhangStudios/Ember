// Which build this is, for bug reports and save files (set at build time; see vite.config.ts).
export const APP_VERSION: string = __APP_VERSION__;
export const BUILT_AT: string = __APP_BUILT_AT__;

/** "abc1234, built Oct 22, 2026" */
export function versionLabel(): string {
  const built = new Date(BUILT_AT);
  const date = Number.isNaN(built.getTime()) ? '' : `, built ${built.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  return `${APP_VERSION}${date}`;
}

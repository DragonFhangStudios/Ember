// Asking the browser to keep Ember's data (#32). Best effort only: browsers
// decide for themselves (Chrome by engagement, Safari mostly for home-screen
// apps, Firefox by asking the player), and a granted request can still be
// undone by the player clearing site data. Nothing here is ever a guarantee.

export type StorageProtection = 'kept' | 'may-clear' | 'unsupported';

const storage = () => (typeof navigator !== 'undefined' ? navigator.storage : undefined);

/** Whether this browser currently promises to keep the data (no prompt). */
export async function storageProtection(): Promise<StorageProtection> {
  const s = storage();
  if (!s?.persisted) return 'unsupported';
  try {
    return (await s.persisted()) ? 'kept' : 'may-clear';
  } catch {
    return 'may-clear';
  }
}

/**
 * Asks the browser to keep Ember's data. Only on the player's request: some
 * browsers show a permission prompt for this.
 */
export async function requestStorageProtection(): Promise<StorageProtection> {
  const s = storage();
  if (!s?.persist) return 'unsupported';
  try {
    return (await s.persist()) ? 'kept' : 'may-clear';
  } catch {
    return 'may-clear';
  }
}

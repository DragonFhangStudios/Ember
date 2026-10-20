// Ember's authoritative save store: one IndexedDB record updated with atomic
// read-modify-write transactions. IndexedDB serializes readwrite transactions
// on the same object store across tabs, so every update applies to the latest
// committed save and two tabs can never interleave (exactly-once is a property
// of this local store; future cloud sync will need its own guarantees).
//
// Rules that keep transactions safe:
// - The update function runs synchronously inside the transaction's first
//   request callback, so the transaction can't go inactive mid-update.
// - A promise resolves only after the transaction commits ("complete"), so the
//   UI never shows a change that wasn't saved.
// - Other tabs are notified over BroadcastChannel only after the commit.

export const DB_NAME = 'ember';
export const DB_VERSION = 1;
const STORE = 'saves';
const KEY = 'player';
const CHANNEL = 'ember-save';

export interface SaveRecord<T> {
  state: T;
  rev: number; // increments on every committed change
  migratedFromLocalStorage?: boolean;
}

export interface StoreResult<T> {
  state: T;
  rev: number;
  changed: boolean;
}

export interface EmberStore<T> {
  /** Reads the latest committed save. */
  read(): Promise<StoreResult<T>>;
  /**
   * Atomically applies `fn` to the latest committed save. `fn` must be pure
   * and synchronous; returning the same object means "no change" (no write).
   */
  update(fn: (current: T) => T): Promise<StoreResult<T>>;
  /** Called with the new save whenever another tab commits a change. */
  subscribe(listener: (result: StoreResult<T>) => void): () => void;
  close(): void;
}

export class StoreUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StoreUnavailableError';
  }
}

export interface OpenStoreOptions<T> {
  /** Normalizes any stored or legacy value into the current state shape. Pure and synchronous. */
  migrate: (raw: unknown) => T;
  /** Reads the legacy localStorage save (raw JSON value), or null. Called synchronously, read-only. */
  readLegacy: () => unknown;
  /** Called if this tab must close the database (another tab is upgrading it). */
  onVersionChange?: () => void;
  /** Called while opening is blocked by another tab holding an older version. */
  onBlocked?: () => void;
  indexedDB?: IDBFactory;
  dbName?: string;
  /** For tests of future schema upgrades; defaults to DB_VERSION. */
  dbVersion?: number;
}

function requestToPromise<T>(request: IDBOpenDBRequest, onBlocked?: () => void): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
    request.onblocked = () => onBlocked?.();
  });
}

/**
 * Opens the store and makes sure a save record exists. If none exists yet, the
 * legacy localStorage save is migrated inside the same readwrite transaction,
 * so concurrent first opens in several tabs migrate exactly once. The legacy
 * localStorage value is only read, never changed, and stays as a backup.
 */
export async function openStore<T>(options: OpenStoreOptions<T>): Promise<{ store: EmberStore<T>; initial: StoreResult<T> }> {
  const factory = options.indexedDB ?? (typeof indexedDB !== 'undefined' ? indexedDB : undefined);
  if (!factory) throw new StoreUnavailableError('IndexedDB is not available in this browser.');

  let db: IDBDatabase;
  try {
    const request = factory.open(options.dbName ?? DB_NAME, options.dbVersion ?? DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
    };
    db = await requestToPromise<IDBDatabase>(request, options.onBlocked);
  } catch (error) {
    throw new StoreUnavailableError('Could not open IndexedDB.', error);
  }

  db.onversionchange = () => {
    db.close();
    options.onVersionChange?.();
  };

  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${CHANNEL}:${options.dbName ?? DB_NAME}`) : null;

  /** Runs one readwrite (or readonly) transaction over the save record. */
  function transact(
    mode: IDBTransactionMode,
    apply: (record: SaveRecord<T> | undefined) => SaveRecord<T> | undefined,
  ): Promise<SaveRecord<T>> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, mode);
      } catch (error) {
        reject(error);
        return;
      }
      const objectStore = tx.objectStore(STORE);
      let result: SaveRecord<T> | undefined;
      let failure: unknown;
      const get = objectStore.get(KEY);
      get.onsuccess = () => {
        try {
          const stored = get.result as SaveRecord<T> | undefined;
          const next = apply(stored);
          if (next && next !== stored) objectStore.put(next, KEY);
          result = next ?? stored;
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => (result ? resolve(result) : reject(new Error('Save record missing.')));
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Save transaction aborted.'));
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Save transaction failed.'));
    });
  }

  const toResult = (record: SaveRecord<T>, changed: boolean): StoreResult<T> => ({
    state: options.migrate(record.state),
    rev: record.rev,
    changed,
  });

  // Ensure the record exists (atomic, idempotent legacy migration).
  let created = false;
  let initialRecord: SaveRecord<T>;
  try {
    initialRecord = await transact('readwrite', stored => {
      if (stored && typeof stored === 'object' && 'state' in stored) return stored;
      let legacy: unknown = null;
      try {
        legacy = options.readLegacy();
      } catch {
        legacy = null;
      }
      created = true;
      return { state: options.migrate(legacy), rev: 1, migratedFromLocalStorage: legacy != null };
    });
  } catch (error) {
    db.close();
    channel?.close();
    throw new StoreUnavailableError('Could not read or create the Ember save.', error);
  }

  const store: EmberStore<T> = {
    async read() {
      return toResult(await transact('readonly', stored => stored), false);
    },
    async update(fn) {
      let changed = false;
      const record = await transact('readwrite', stored => {
        if (!stored) throw new Error('Save record missing.');
        const current = options.migrate(stored.state);
        const next = fn(current);
        if (next === current) return stored;
        changed = true;
        return { ...stored, state: next, rev: stored.rev + 1 };
      });
      // Committed: only now tell other tabs.
      if (changed) channel?.postMessage({ rev: record.rev });
      return { state: changed ? record.state : options.migrate(record.state), rev: record.rev, changed };
    },
    subscribe(listener) {
      if (!channel) return () => {};
      const onMessage = () => {
        store.read().then(listener, () => {});
      };
      channel.addEventListener('message', onMessage);
      return () => channel.removeEventListener('message', onMessage);
    },
    close() {
      channel?.close();
      db.close();
    },
  };

  if (created) channel?.postMessage({ rev: initialRecord.rev });
  return { store, initial: toResult(initialRecord, created) };
}

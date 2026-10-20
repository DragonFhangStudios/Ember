import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { UserState } from '../types';
import { bondTotal } from './evolution';
import { FOCUS_DURATION_MS } from './focusTimer';
import { pauseFocus, resetFocus, settle, startFocus } from './focusSession';
import { REWARDS, advanceQuest, createInitialState, migrateState } from './progression';
import { EmberStore, LegacySaveUnreadableError, StoreUnavailableError, openStore } from './store';

// fake-indexeddb implements IndexedDB's transaction scheduling: readwrite
// transactions on the same store are serialized across connections, like
// separate tabs in a real browser.

const NOW = new Date(2026, 9, 20, 10);
let dbCounter = 0;

function harness(legacy: unknown = null) {
  const idb = new IDBFactory();
  const dbName = `ember-test-${++dbCounter}`;
  const readLegacy = vi.fn(() => legacy);
  const open = (extra: Partial<Parameters<typeof openStore<UserState>>[0]> = {}) =>
    openStore<UserState>({ indexedDB: idb, dbName, readLegacy, migrate: raw => migrateState(raw, NOW), ...extra });
  return { idb, dbName, readLegacy, open };
}

/** One "tab": settle + action inside a single store transaction, like App.commit. */
const act = (store: EmberStore<UserState>, now: Date, action?: (s: UserState) => UserState) =>
  store.update(saved => {
    let next = settle(saved, now).state;
    if (action) next = action(next);
    return next;
  });

const tick = () => new Promise(r => setTimeout(r, 20));

describe('opening and migrating', () => {
  it('migrates the legacy localStorage save once and leaves it as a backup', async () => {
    const legacy = { ...createInitialState(NOW), version: 6, goldenScales: 123, focus: undefined };
    const h = harness(legacy);
    const { store, initial } = await h.open();
    expect(initial.state.goldenScales).toBe(123);
    expect(initial.rev).toBe(1);
    expect(initial.changed).toBe(true);
    store.close();
    const again = await h.open();
    expect(again.initial.state.goldenScales).toBe(123);
    expect(again.initial.changed).toBe(false);
    expect(h.readLegacy).toHaveBeenCalledTimes(1); // only read while creating the record
    expect(legacy.goldenScales).toBe(123); // the backup object is untouched
    again.store.close();
  });

  it('migration is atomic and idempotent when several tabs open at once', async () => {
    const h = harness({ ...createInitialState(NOW), goldenScales: 7 });
    const opened = await Promise.all(Array.from({ length: 5 }, () => h.open()));
    expect(opened.filter(o => o.initial.changed)).toHaveLength(1);
    expect(new Set(opened.map(o => o.initial.rev))).toEqual(new Set([1]));
    expect(opened.every(o => o.initial.state.goldenScales === 7)).toBe(true);
    expect(h.readLegacy).toHaveBeenCalledTimes(1);
    opened.forEach(o => o.store.close());
  });

  it('a genuinely absent legacy save starts a new save', async () => {
    const h = harness(null);
    const { store, initial } = await h.open();
    expect(initial.changed).toBe(true);
    expect(initial.state.goldenScales).toBe(0);
    store.close();
  });

  it.each([
    ['storage access fails', new DOMException('The operation is insecure.', 'SecurityError')],
    ['the legacy save is corrupt', new SyntaxError('Unexpected token')],
  ])('when %s, nothing is created and the error is surfaced', async (_case, failure) => {
    const h = harness();
    h.readLegacy.mockImplementation(() => {
      throw failure;
    });
    const error = await h.open().catch(e => e);
    expect(error).toBeInstanceOf(LegacySaveUnreadableError);
    expect(error.cause).toBe(failure);
    // No authoritative save was written in its place.
    const dbs = await h.idb.databases();
    const peek = await new Promise<unknown>((resolve, reject) => {
      const r = h.idb.open(h.dbName);
      r.onsuccess = () => {
        const g = r.result.transaction('saves').objectStore('saves').get('player');
        g.onsuccess = () => {
          r.result.close();
          resolve(g.result);
        };
      };
      r.onerror = () => reject(r.error);
    });
    expect(dbs.some(d => d.name === h.dbName)).toBe(true);
    expect(peek).toBeUndefined();
  });

  it('a retry after a transient failure migrates the real legacy save', async () => {
    const h = harness();
    h.readLegacy.mockImplementationOnce(() => {
      throw new DOMException('busy', 'InvalidStateError');
    });
    await expect(h.open()).rejects.toBeInstanceOf(LegacySaveUnreadableError);
    h.readLegacy.mockImplementation(() => ({ ...createInitialState(NOW), goldenScales: 88, bond: { legacy: 40 } }));
    const { store, initial } = await h.open();
    expect(initial.state.goldenScales).toBe(88);
    expect(bondTotal(initial.state.bond)).toBe(40);
    store.close();
  });

  it('several tabs hitting a failed read all fail safely, then one retry migrates once', async () => {
    const h = harness();
    h.readLegacy.mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    const results = await Promise.allSettled([h.open(), h.open(), h.open()]);
    expect(results.every(r => r.status === 'rejected' && r.reason instanceof LegacySaveUnreadableError)).toBe(true);
    h.readLegacy.mockReset();
    h.readLegacy.mockImplementation(() => ({ ...createInitialState(NOW), goldenScales: 5 }));
    const opened = await Promise.all([h.open(), h.open()]);
    expect(opened.filter(o => o.initial.changed)).toHaveLength(1);
    expect(opened.every(o => o.initial.state.goldenScales === 5)).toBe(true);
    opened.forEach(o => o.store.close());
  });

  it('starting fresh happens only by explicit choice, and is recorded', async () => {
    const h = harness();
    h.readLegacy.mockImplementation(() => {
      throw new SyntaxError('corrupt');
    });
    await expect(h.open()).rejects.toBeInstanceOf(LegacySaveUnreadableError);
    const { store, initial } = await h.open({ startFreshIfLegacyUnreadable: true });
    expect(initial.changed).toBe(true);
    expect(initial.state.goldenScales).toBe(0);
    store.close();
    // Later opens use the new save and never try the unreadable legacy save again.
    h.readLegacy.mockClear();
    const again = await h.open();
    expect(h.readLegacy).not.toHaveBeenCalled();
    expect(again.initial.changed).toBe(false);
    again.store.close();
  });

  it('a failing legacy read never matters once a save exists', async () => {
    const h = harness({ ...createInitialState(NOW), goldenScales: 3 });
    (await h.open()).store.close();
    h.readLegacy.mockImplementation(() => {
      throw new Error('should not be read');
    });
    const { store, initial } = await h.open();
    expect(initial.state.goldenScales).toBe(3);
    store.close();
  });

  it('repairs a corrupt stored save on read', async () => {
    const h = harness({ ...createInitialState(NOW), focus: { garbage: 1 }, bond: { a: 'x', b: 2 } });
    const { store, initial } = await h.open();
    expect(initial.state.focus).toBeNull();
    expect(initial.state.bond).toEqual({ b: 2 });
    store.close();
  });

  it('reports a clear error when IndexedDB is unavailable', async () => {
    // No IndexedDB at all (the test environment has no global indexedDB).
    await expect(openStore({ readLegacy: () => null, migrate: x => x })).rejects.toBeInstanceOf(StoreUnavailableError);
    const broken = { open: () => { throw new DOMException('denied', 'SecurityError'); } } as unknown as IDBFactory;
    await expect(openStore({ indexedDB: broken, readLegacy: () => null, migrate: x => x })).rejects.toBeInstanceOf(StoreUnavailableError);
  });
});

describe('atomic updates across tabs', () => {
  it('interleaved updates from two tabs are never lost', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => (i % 2 ? a : b).store.update(s => ({ ...s, energy: s.energy + 1 }))),
    );
    const final = await a.store.read();
    expect(final.state.energy).toBe(50 + 100);
    expect(final.rev).toBe(1 + 100);
    a.store.close();
    b.store.close();
  });

  it('two tabs settling the same finished session reward it exactly once', async () => {
    const h = harness();
    const [a, b, c] = await Promise.all([h.open(), h.open(), h.open()]);
    await act(a.store, NOW, s => startFocus(s, 'shared', NOW));
    const end = new Date(NOW.getTime() + FOCUS_DURATION_MS);
    const results = await Promise.all([act(a.store, end), act(b.store, end), act(c.store, end), act(a.store, end)]);
    expect(results.filter(r => r.changed)).toHaveLength(1);
    const final = await b.store.read();
    expect(bondTotal(final.state.bond)).toBe(REWARDS.focus.growth);
    expect(final.state.completedFocusSessions).toEqual(['shared']);
    [a, b, c].forEach(t => t.store.close());
  });

  it('the completion id and its reward are written together (never one without the other)', async () => {
    const h = harness();
    const { store } = await h.open();
    await act(store, NOW, s => startFocus(s, 'x', NOW));
    const end = new Date(NOW.getTime() + FOCUS_DURATION_MS);
    // A transaction that fails after settling must leave neither the id nor the reward behind.
    await expect(store.update(s => {
      settle(s, end);
      throw new Error('boom');
    })).rejects.toThrow('boom');
    let saved = (await store.read()).state;
    expect(saved.completedFocusSessions).toEqual([]);
    expect(bondTotal(saved.bond)).toBe(0);
    await act(store, end);
    saved = (await store.read()).state;
    expect(saved.completedFocusSessions).toEqual(['x']);
    expect(bondTotal(saved.bond)).toBe(REWARDS.focus.growth);
    store.close();
  });

  it('a stale tab acts on the latest save, not its old copy', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    await act(a.store, NOW, s => startFocus(s, 'old', NOW));
    const staleViewInB = (await b.store.read()).state.focus!.id; // B saw 'old'
    await act(a.store, NOW, s => startFocus(resetFocus(s, 'old'), 'new', NOW)); // A replaced it
    await act(b.store, NOW, s => pauseFocus(s, staleViewInB, NOW)); // B's stale pause
    const saved = (await a.store.read()).state;
    expect(saved.focus).toMatchObject({ id: 'new', status: 'running' });
    a.store.close();
    b.store.close();
  });

  it('concurrent quest taps in two tabs are applied once each, with daily limits intact', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    await Promise.all([
      act(a.store, NOW, s => advanceQuest(s, 'q1', NOW).state),
      act(b.store, NOW, s => advanceQuest(s, 'q1', NOW).state),
      act(a.store, NOW, s => advanceQuest(s, 'q2', NOW).state),
      act(b.store, NOW, s => advanceQuest(s, 'q2', NOW).state),
    ]);
    const saved = (await a.store.read()).state;
    expect(saved.energy).toBe(50 + 10 + 25);
    expect(saved.goldenScales).toBe(REWARDS.medication.scales);
    a.store.close();
    b.store.close();
  });
});

describe('commit semantics', () => {
  it('a failed update rejects, changes nothing, and notifies no one', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    const heard = vi.fn();
    b.store.subscribe(heard);
    const before = await a.store.read();
    await expect(a.store.update(() => { throw new Error('nope'); })).rejects.toThrow('nope');
    await tick();
    const after = await a.store.read();
    expect(after.rev).toBe(before.rev);
    expect(after.state).toEqual(before.state);
    expect(heard).not.toHaveBeenCalled();
    a.store.close();
    b.store.close();
  });

  it('an update with no change writes nothing and notifies no one', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    const heard = vi.fn();
    b.store.subscribe(heard);
    const r = await a.store.update(s => s);
    await tick();
    expect(r.changed).toBe(false);
    expect((await a.store.read()).rev).toBe(r.rev);
    expect(heard).not.toHaveBeenCalled();
    a.store.close();
    b.store.close();
  });

  it('other tabs are notified after the commit, with the committed save', async () => {
    const h = harness();
    const [a, b] = await Promise.all([h.open(), h.open()]);
    const heard: number[] = [];
    b.store.subscribe(r => heard.push(r.state.goldenScales));
    const committed = await a.store.update(s => ({ ...s, goldenScales: 42 }));
    await tick();
    expect(committed.changed).toBe(true);
    expect(heard).toEqual([42]);
    a.store.close();
    b.store.close();
  });
});

describe('cross-tab notifications are best-effort', () => {
  it('a committed update still succeeds when broadcasting fails', async () => {
    const h = harness();
    const { store } = await h.open();
    const post = vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation(() => {
      throw new DOMException('BroadcastChannel is closed.', 'InvalidStateError');
    });
    try {
      const result = await store.update(s => ({ ...s, goldenScales: 77 }));
      expect(post).toHaveBeenCalled();
      expect(result.changed).toBe(true);
      expect(result.state.goldenScales).toBe(77);
      expect((await store.read()).state.goldenScales).toBe(77);
    } finally {
      post.mockRestore();
      store.close();
    }
  });

  it('creating the first save still succeeds when broadcasting fails', async () => {
    const h = harness({ ...createInitialState(NOW), goldenScales: 12 });
    const post = vi.spyOn(BroadcastChannel.prototype, 'postMessage').mockImplementation(() => {
      throw new DOMException('BroadcastChannel is closed.', 'InvalidStateError');
    });
    try {
      const { store, initial } = await h.open();
      expect(post).toHaveBeenCalled();
      expect(initial.state.goldenScales).toBe(12);
      store.close();
    } finally {
      post.mockRestore();
    }
  });
});

describe('database replacement', () => {
  it('a deleted database notifies this tab, and a reopened store starts again at revision 1', async () => {
    const h = harness();
    const onVersionChange = vi.fn();
    const first = await h.open({ onVersionChange });
    for (let i = 0; i < 5; i++) await first.store.update(s => ({ ...s, energy: s.energy + 1 }));
    expect((await first.store.read()).rev).toBe(6);
    await new Promise<void>((resolve, reject) => {
      const del = h.idb.deleteDatabase(h.dbName);
      del.onsuccess = () => resolve();
      del.onerror = () => reject(del.error);
      del.onblocked = () => reject(new Error('blocked: the open tab did not close'));
    });
    expect(onVersionChange).toHaveBeenCalled();
    const second = await h.open();
    expect(second.initial.rev).toBe(1); // a new store's revisions restart: the UI must not compare across stores
    second.store.close();
  });
});

describe('database upgrades', () => {
  it('closes this tab\'s connection when another tab upgrades the database', async () => {
    const h = harness();
    const onVersionChange = vi.fn();
    const { store } = await h.open({ onVersionChange });
    const upgrade = h.idb.open(h.dbName, 2);
    await new Promise((resolve, reject) => {
      upgrade.onsuccess = resolve;
      upgrade.onerror = () => reject(upgrade.error);
      upgrade.onblocked = () => reject(new Error('blocked: our tab did not close'));
    });
    expect(onVersionChange).toHaveBeenCalledTimes(1);
    await expect(store.update(s => ({ ...s, energy: 1 }))).rejects.toBeTruthy();
    upgrade.result.close();
  });

  it('reports a blocked upgrade and finishes once the old tab closes', async () => {
    const h = harness();
    const old = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = h.idb.open(h.dbName, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('saves');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    old.onversionchange = () => {}; // an old tab that doesn't close itself
    const onBlocked = vi.fn();
    const opening = h.open({ dbVersion: 2, onBlocked });
    await tick();
    expect(onBlocked).toHaveBeenCalled();
    old.close();
    const { store } = await opening;
    expect((await store.read()).rev).toBe(1);
    store.close();
  });
});

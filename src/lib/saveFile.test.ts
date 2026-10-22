import { describe, expect, it } from 'vitest';
import { DragonStage, SymptomLog, UserState } from '../types';
import { bondTotal } from './evolution';
import { settle, startFocus } from './focusSession';
import { FOCUS_DURATION_MS } from './focusTimer';
import { SAVE_VERSION, advanceQuest, createInitialState, dayKey, logCheckIn, migrateState } from './progression';
import {
  SAVE_FILE_FORMAT,
  SAVE_FILE_MAX_BYTES,
  SAVE_FILE_VERSION,
  canonicalJson,
  createSaveFile,
  progressLost,
  readSaveFile,
  saveFileName,
  summarizeSave,
} from './saveFile';

// Save export and import (#32): a file keeps everything permanent, and only an
// intact Ember save this version can read is ever accepted.

const NOW = new Date(2026, 9, 22, 9, 30);
const LATER = new Date(2026, 9, 25, 18, 0);

/** A player with real progress in every permanent field. */
function seasoned(): UserState {
  let s: UserState = {
    ...createInitialState(new Date(2026, 9, 1)),
    stage: DragonStage.DRAKE,
    bond: { 'device-a': 120.5, legacy: 40 },
    goldenScales: 77,
    energy: 345,
    inventory: ['hat_wizard', 'nest_moss'],
    equipped: { hat: 'hat_wizard' },
    currentStreak: 6,
    bestStreak: 12,
    lastActiveDay: dayKey(NOW),
    petCount: 31,
    focusSessionsCompleted: 9,
    completedFocusSessions: ['a', 'b', 'c'],
    activity: { days: ['2026-10-20', '2026-10-21', '2026-10-22'], legacy: [{ floor: 40, before: '2026-10-01' }] },
    themeColor: '#F5F3FF',
    theme: 'dark',
    deviceId: 'device-a',
    lastLogin: dayKey(NOW),
  };
  s = { ...s, badges: s.badges.map(b => (b.id === 'badge_hatch' ? { ...b, unlockedAt: '2026-10-02T10:00:00.000Z' } : b)) };
  s = logCheckIn(s, 2, 4, NOW, 'Slept better. <b>not bold</b>').state;
  s = advanceQuest(s, 'q5', NOW).state;
  s = { ...s, quests: [...s.quests, { id: 'custom_1', title: 'Stretch', description: '', type: 'custom', completed: false, points: 30, isDaily: true, isCustom: true, progress: 1, target: 3 }] };
  return s;
}

const roundTrip = async (state: UserState, at = NOW, now = LATER) => readSaveFile(await createSaveFile(state, at), now);
const permanent = (s: UserState) => ({
  dragonName: s.dragonName,
  stage: s.stage,
  bond: bondTotal(s.bond),
  goldenScales: s.goldenScales,
  energy: s.energy,
  inventory: s.inventory,
  equipped: s.equipped,
  bestStreak: s.bestStreak,
  petCount: s.petCount,
  focusSessionsCompleted: s.focusSessionsCompleted,
  completedFocusSessions: s.completedFocusSessions,
  activity: s.activity,
  badges: s.badges.filter(b => b.unlockedAt).map(b => [b.id, b.unlockedAt]),
  symptomLogs: s.symptomLogs,
  customQuests: s.quests.filter(q => q.isCustom),
  themeColor: s.themeColor,
  theme: s.theme,
});

describe('exporting a save', () => {
  it('writes a versioned, checksummed file without this device id', async () => {
    const s = seasoned();
    const file = JSON.parse(await createSaveFile(s, NOW, 'abc1234'));
    expect(file).toMatchObject({ format: SAVE_FILE_FORMAT, formatVersion: SAVE_FILE_VERSION, saveVersion: SAVE_VERSION, exportedAt: NOW.toISOString(), appVersion: 'abc1234' });
    expect(file.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(file.state).not.toHaveProperty('deviceId');
    expect(file.state.bond, "every device's Bond entry stays").toEqual(s.bond);
    expect(Object.keys(file.state.bond)).toEqual(['device-a', 'legacy']);
  });

  it('gives the same checksum for the same save, whatever the key order', async () => {
    const s = seasoned();
    const reordered = Object.fromEntries(Object.entries(s).reverse()) as unknown as UserState;
    const a = JSON.parse(await createSaveFile(s, NOW));
    const b = JSON.parse(await createSaveFile(reordered, NOW));
    expect(b.checksum).toBe(a.checksum);
    expect(canonicalJson({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
  });

  it('names files by local date and time', () => {
    expect(saveFileName(NOW)).toBe('ember-save-2026-10-22-0930.json');
  });
});

describe('importing a save', () => {
  it('round-trips every permanent field, today’s ledger, and notes', async () => {
    const s = seasoned();
    const result = await roundTrip(s, NOW, NOW);
    expect(result.ok).toBe(true);
    if (result.ok === false) return;
    expect(permanent(result.state)).toEqual(permanent(migrateState(JSON.parse(JSON.stringify(s)), NOW)));
    expect(result.state.daily).toEqual(s.daily);
    expect(result.state.symptomLogs.at(-1)?.notes).toBe('Slept better. <b>not bold</b>');
    expect(result.state).not.toHaveProperty('deviceId');
    expect(result.exportedAt).toBe(NOW.toISOString());
  });

  it('keeps exactly-once rewards: a running focus session pays once after import, however often it settles', async () => {
    const running = startFocus(seasoned(), 'session-x', NOW);
    const result = await roundTrip(running, NOW, LATER);
    if (result.ok === false) throw new Error(result.message);
    const end = new Date(NOW.getTime() + FOCUS_DURATION_MS + 1);
    let s = settle(result.state, end).state;
    const once = { bond: bondTotal(s.bond), count: s.focusSessionsCompleted };
    for (let i = 0; i < 3; i++) s = settle(s, new Date(end.getTime() + i * 60_000)).state;
    expect({ bond: bondTotal(s.bond), count: s.focusSessionsCompleted }).toEqual(once);
    expect(once.count).toBe(10);
  });

  it("keeps today's reward ledger: an imported completed quest can't pay again today", async () => {
    let s = advanceQuest(seasoned(), 'q1', NOW).state;
    const result = await roundTrip(s, NOW, NOW);
    if (result.ok === false) throw new Error(result.message);
    s = result.state;
    const energy = s.energy;
    s = advanceQuest({ ...s, quests: s.quests.map(q => (q.id === 'q1' ? { ...q, completed: false, progress: 0 } : q)) }, 'q1', NOW).state;
    expect(s.energy).toBe(energy);
  });

  it('migrates a file holding an older save version', async () => {
    const old = JSON.parse(JSON.stringify({ ...seasoned(), version: 8 }));
    delete old.focusSessionsCompleted;
    delete old.daily.questRewards;
    const file = JSON.parse(await createSaveFile(old as UserState, NOW));
    expect(file.saveVersion).toBe(8);
    const result = await readSaveFile(JSON.stringify(file), NOW);
    expect(result.ok && result.state.version).toBe(SAVE_VERSION);
    expect(result.ok && result.state.focusSessionsCompleted).toBe(3);
  });

  const problems: [string, (text: string) => string, string][] = [
    ['not JSON', () => '{"format": "ember-save", ', 'not-json'],
    ['an empty file', () => '', 'not-json'],
    ['another JSON file', () => JSON.stringify({ hello: 'world' }), 'not-ember'],
    ['a JSON array', () => '[1,2,3]', 'not-ember'],
    ['a newer file format', t => JSON.stringify({ ...JSON.parse(t), formatVersion: SAVE_FILE_VERSION + 1 }), 'newer-format'],
    ['a newer save version', t => JSON.stringify({ ...JSON.parse(t), saveVersion: SAVE_VERSION + 1 }), 'newer-save'],
    ['an edited save', t => JSON.stringify({ ...JSON.parse(t), state: { ...JSON.parse(t).state, goldenScales: 999999 } }), 'damaged'],
    ['a missing checksum', t => JSON.stringify({ ...JSON.parse(t), checksum: undefined }), 'damaged'],
    ['a truncated file', t => t.slice(0, Math.floor(t.length / 2)), 'not-json'],
  ];
  for (const [name, make, problem] of problems) {
    it(`refuses ${name}`, async () => {
      const text = make(await createSaveFile(seasoned(), NOW));
      const result = await readSaveFile(text, NOW);
      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.problem).toBe(problem);
        expect(result.message.length).toBeGreaterThan(10);
      }
    });
  }

  it('refuses a newer save hidden inside an older file layout, and a state that is not a save', async () => {
    const newer = JSON.parse(await createSaveFile({ ...seasoned(), version: SAVE_VERSION + 1 }, NOW));
    delete newer.saveVersion;
    expect(await readSaveFile(JSON.stringify(newer), NOW)).toMatchObject({ ok: false, problem: 'newer-save' });
    const junk = JSON.parse(await createSaveFile({ hello: 1 } as unknown as UserState, NOW));
    expect(await readSaveFile(JSON.stringify(junk), NOW)).toMatchObject({ ok: false, problem: 'unrecognized' });
  });

  it("never takes a device id from a file (a hand-made one can't claim this device's Bond)", async () => {
    const file = JSON.parse(await createSaveFile(seasoned(), NOW));
    file.state.deviceId = 'device-from-file';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalJson(file.state)));
    file.checksum = `sha256:${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
    const result = await readSaveFile(JSON.stringify(file), NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.state).not.toHaveProperty('deviceId');
  });

  it(`refuses files over ${SAVE_FILE_MAX_BYTES / 1024 / 1024} MB without parsing them`, async () => {
    const result = await readSaveFile('x'.repeat(SAVE_FILE_MAX_BYTES + 1), NOW);
    expect(result).toMatchObject({ ok: false, problem: 'too-large' });
  });
});

describe('comparing saves before replacing', () => {
  it('summarizes what a player recognizes', () => {
    const s = seasoned();
    expect(summarizeSave(s)).toMatchObject({ dragonName: 'Ember', stage: DragonStage.DRAKE, bond: Math.floor(bondTotal(s.bond)), activeDays: 43, currentStreak: 6, bestStreak: 12, badges: 1, checkIns: 1, focusSessions: 9, goldenScales: 77 });
  });

  const kinds = (current: UserState, incoming: UserState) => progressLost(current, incoming).map(l => l.kind);
  const textOf = (current: UserState, incoming: UserState, kind: string) => progressLost(current, incoming).find(l => l.kind === kind)?.text;
  const withLogs = (s: UserState, symptomLogs: SymptomLog[]) => ({ ...s, symptomLogs });
  const log = (date: string, notes?: string, energy = 3, mood = 3): SymptomLog => ({ date, energy, mood, ...(notes ? { notes } : {}) });

  it('lists everything a replacement would set back, most personal first', () => {
    const current = seasoned();
    const fresh = createInitialState(NOW);
    const names: Record<string, string> = { hat_wizard: 'Tiny Wizard Hat', nest_moss: 'Soft Moss Nest' };
    expect(progressLost(current, fresh, id => names[id])).toEqual([
      { kind: 'check-ins', text: '1 check-in (1 with a note)' },
      { kind: 'stage', text: 'the Drake stage (it has Egg)' },
      { kind: 'streak', text: 'your 6-day streak (it has 0)' },
      { kind: 'best-streak', text: 'your best streak of 12 days (it has 0)' },
      { kind: 'bond', text: `some Bond (0 instead of ${Math.floor(bondTotal(current.bond))})` },
      { kind: 'active-days', text: 'some active days (0 instead of 43)' },
      { kind: 'milestones', text: 'the First Hatch milestone' },
      { kind: 'cosmetics', text: 'your Tiny Wizard Hat and Soft Moss Nest' },
      { kind: 'golden-scales', text: 'some Golden Scales (0 instead of 77)' },
      { kind: 'energy', text: `some energy (${fresh.energy} instead of ${current.energy})` },
      { kind: 'focus-sessions', text: 'some focus sessions (0 instead of 9)' },
    ]);
  });

  it('finds nothing to lose when the incoming save has as much or more', () => {
    const current = seasoned();
    const fresh = createInitialState(NOW);
    expect(progressLost(fresh, current)).toEqual([]);
    expect(progressLost(current, current)).toEqual([]);
    expect(progressLost(current, structuredClone(current)), 'a copy (as after export and import)').toEqual([]);
    const more = { ...current, currentStreak: 9, energy: 999, inventory: [...current.inventory, 'hat_crown'], symptomLogs: [...current.symptomLogs, log('2026-10-23T08:00:00.000Z', 'New')] };
    expect(progressLost(current, more)).toEqual([]);
  });

  it('warns about a shorter current or best streak on its own', () => {
    const current = seasoned();
    expect(progressLost(current, { ...current, currentStreak: 2 })).toEqual([{ kind: 'streak', text: 'your 6-day streak (it has 2)' }]);
    expect(progressLost(current, { ...current, bestStreak: 1 })).toEqual([{ kind: 'best-streak', text: 'your best streak of 12 days (it has 1)' }]);
    expect(textOf({ ...current, currentStreak: 1 }, { ...current, currentStreak: 0 }, 'streak')).toBe('your 1-day streak (it has 0)');
  });

  it('warns about less energy and missing cosmetics, even when the number owned is the same', () => {
    const current = seasoned(); // owns hat_wizard and nest_moss
    expect(progressLost(current, { ...current, energy: 300 })).toEqual([{ kind: 'energy', text: `some energy (300 instead of ${current.energy})` }]);
    const swapped = { ...current, inventory: ['hat_wizard', 'hat_crown'] };
    expect(progressLost(current, swapped)).toEqual([{ kind: 'cosmetics', text: 'your nest_moss' }]);
    expect(progressLost(current, swapped, id => (id === 'nest_moss' ? 'Soft Moss Nest' : id))[0].text).toBe('your Soft Moss Nest');
  });

  it('names earned milestones that are missing, even when the number earned is the same', () => {
    const current = seasoned(); // has First Hatch
    const other = { ...current, badges: current.badges.map(b => (b.id === 'badge_hatch' ? { ...b, unlockedAt: undefined } : b.id === 'badge_pet_10' ? { ...b, unlockedAt: NOW.toISOString() } : b)) };
    expect(summarizeSave(other).badges).toBe(summarizeSave(current).badges);
    expect(progressLost(current, other)).toEqual([{ kind: 'milestones', text: 'the First Hatch milestone' }]);
    const two = { ...current, badges: current.badges.map(b => (['badge_hatch', 'badge_streak_3', 'badge_focus_5'].includes(b.id) ? { ...b, unlockedAt: NOW.toISOString() } : b)) };
    expect(textOf(two, current, 'milestones')).toBe('the Consistent Companion and Zen Master milestones');
  });

  it('warns about check-ins that are missing, even when the number of check-ins is the same', () => {
    const current = withLogs(seasoned(), [log('2026-10-20T08:00:00.000Z', 'Rough night'), log('2026-10-21T08:00:00.000Z')]);
    const other = withLogs(current, [log('2026-10-20T08:00:00.000Z', 'Rough night'), log('2026-10-22T08:00:00.000Z', 'Different day')]);
    expect(summarizeSave(other).checkIns).toBe(summarizeSave(current).checkIns);
    expect(progressLost(current, other)).toEqual([{ kind: 'check-ins', text: '1 check-in' }]);
    expect(textOf(current, withLogs(current, []), 'check-ins')).toBe('2 check-ins (1 with a note)');
    const noted = withLogs(current, [log('2026-10-20T08:00:00.000Z', 'A'), log('2026-10-21T08:00:00.000Z', 'B')]);
    expect(textOf(noted, withLogs(current, []), 'check-ins')).toBe('2 check-ins (2 with notes)');
  });

  it("warns when a check-in's note or ratings would be replaced by a different version", () => {
    const current = withLogs(seasoned(), [log('2026-10-20T08:00:00.000Z', 'Rough night', 2, 2), log('2026-10-21T08:00:00.000Z', undefined, 4, 4)]);
    const noteGone = withLogs(current, [log('2026-10-20T08:00:00.000Z', undefined, 2, 2), current.symptomLogs[1]]);
    expect(progressLost(current, noteGone)).toEqual([{ kind: 'check-ins-changed', text: "this device's notes or ratings for 1 check-in" }]);
    const noteEdited = withLogs(current, [log('2026-10-20T08:00:00.000Z', 'Older wording', 2, 2), current.symptomLogs[1]]);
    expect(kinds(current, noteEdited)).toEqual(['check-ins-changed']);
    const rated = withLogs(current, [current.symptomLogs[0], log('2026-10-21T08:00:00.000Z', undefined, 1, 4)]);
    expect(progressLost(current, rated)).toEqual([{ kind: 'check-ins-changed', text: "this device's ratings for 1 check-in" }]);
    const spaces = withLogs(current, [log('2026-10-20T08:00:00.000Z', ' Rough night ', 2, 2), current.symptomLogs[1]]);
    expect(progressLost(current, spaces), 'surrounding spaces are not a different note').toEqual([]);
  });

  it('matches check-ins logged at the same moment one for one', () => {
    const at = '2026-10-20T08:00:00.000Z';
    const current = withLogs(seasoned(), [log(at, 'First'), log(at)]);
    expect(progressLost(current, withLogs(current, [log(at, 'First')]))).toEqual([{ kind: 'check-ins', text: '1 check-in' }]);
  });

  it('gives the same answer every time and leaves both saves untouched', () => {
    const current = withLogs(seasoned(), [log('2026-10-20T08:00:00.000Z', 'Note'), log('2026-10-21T08:00:00.000Z')]);
    const incoming = withLogs(createInitialState(NOW), [log('2026-10-21T08:00:00.000Z', undefined, 5, 5)]);
    const [before, beforeIncoming] = [structuredClone(current), structuredClone(incoming)];
    const first = progressLost(current, incoming);
    expect(progressLost(current, incoming)).toEqual(first);
    expect([current, incoming]).toEqual([before, beforeIncoming]);
  });
});

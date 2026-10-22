import { describe, expect, it } from 'vitest';
import { DragonStage, UserState } from '../types';
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

  it('lists everything a replacement would set back', () => {
    const current = seasoned();
    const fresh = createInitialState(NOW);
    const lost = progressLost(current, fresh);
    expect(lost.join(' | ')).toMatch(/earlier stage.*active days.*less Bond.*fewer milestones.*Golden Scales.*check-ins.*focus sessions/);
    expect(progressLost(fresh, current)).toEqual([]);
    expect(progressLost(current, current)).toEqual([]);
  });
});

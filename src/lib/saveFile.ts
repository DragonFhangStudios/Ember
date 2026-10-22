import { DragonStage, SymptomLog, UserState } from '../types';
import { bondTotal, lifetimeActiveDays } from './evolution';
import { checkLegacySave } from './legacySave';
import { SAVE_VERSION, migrateState } from './progression';

// Save files (#32): a player-made copy of their save, for keeping it safe or
// moving it to another device by hand. Pure logic; the store does the swap.
// There is no sync: importing replaces this device's save (with a backup),
// it never merges.

export const SAVE_FILE_FORMAT = 'ember-save';
/** Bump when the file layout changes; older layouts stay readable. */
export const SAVE_FILE_VERSION = 1;
/** Real saves are well under 1 MB; anything far bigger isn't one. */
export const SAVE_FILE_MAX_BYTES = 5 * 1024 * 1024;

export interface SaveFile {
  format: typeof SAVE_FILE_FORMAT;
  formatVersion: number;
  exportedAt: string;
  /** The app build that wrote it, when known. */
  appVersion?: string;
  /** The save's own version (`UserState.version`). */
  saveVersion: number;
  /** SHA-256 of the canonical JSON of `state`, so damage or edits are caught. */
  checksum: string;
  state: unknown;
}

/** JSON with object keys sorted at every level, so the same save always gives the same text. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(v => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .filter(key => (value as Record<string, unknown>)[key] !== undefined)
      .map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return `sha256:${[...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

/** The text of a save file for `state`. This install's device id is left out (each device has its own). */
export async function createSaveFile(state: UserState, now: Date, appVersion?: string): Promise<string> {
  const { deviceId: _thisDevice, ...saved } = state;
  const clean = JSON.parse(JSON.stringify(saved)) as unknown;
  const file: SaveFile = {
    format: SAVE_FILE_FORMAT,
    formatVersion: SAVE_FILE_VERSION,
    exportedAt: now.toISOString(),
    ...(appVersion ? { appVersion } : {}),
    saveVersion: state.version ?? SAVE_VERSION,
    checksum: await sha256(canonicalJson(clean)),
    state: clean,
  };
  return JSON.stringify(file, null, 2);
}

/** A file name like `ember-save-2026-10-22-0930.json` (local time). */
export function saveFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `ember-save-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export type SaveFileProblem = 'too-large' | 'not-json' | 'not-ember' | 'newer-format' | 'newer-save' | 'damaged' | 'unrecognized';

export const SAVE_FILE_PROBLEMS: Record<SaveFileProblem, string> = {
  'too-large': "That file is too large to be an Ember save.",
  'not-json': "That file isn't an Ember save (it couldn't be read as one).",
  'not-ember': "That file isn't an Ember save.",
  'newer-format': 'That save was made by a newer version of Ember. Update Ember, then try again.',
  'newer-save': 'That save was made by a newer version of Ember. Update Ember, then try again.',
  damaged: 'That save file has been changed or damaged, so it was not used.',
  unrecognized: "That file doesn't contain a recognizable Ember save.",
};

export type ReadSaveFileResult =
  | { ok: true; state: UserState; exportedAt: string; appVersion?: string; saveVersion: number }
  | { ok: false; problem: SaveFileProblem; message: string };

const fail = (problem: SaveFileProblem): ReadSaveFileResult => ({ ok: false, problem, message: SAVE_FILE_PROBLEMS[problem] });

/**
 * Checks a save file and returns the save it holds, migrated to the current
 * shape. Never throws. Refuses anything that isn't an intact Ember save this
 * version can read: wrong format, a newer save or file version, a checksum
 * that doesn't match (damaged or edited), or no recognizable save inside.
 */
export async function readSaveFile(text: string, now: Date): Promise<ReadSaveFileResult> {
  if (new TextEncoder().encode(text).length > SAVE_FILE_MAX_BYTES) return fail('too-large');
  let file: Partial<SaveFile> & Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fail('not-ember');
    file = parsed as Partial<SaveFile> & Record<string, unknown>;
  } catch {
    return fail('not-json');
  }
  if (file.format !== SAVE_FILE_FORMAT) return fail('not-ember');
  if (typeof file.formatVersion !== 'number' || !Number.isInteger(file.formatVersion) || file.formatVersion < 1) return fail('not-ember');
  if (file.formatVersion > SAVE_FILE_VERSION) return fail('newer-format');
  if (typeof file.saveVersion === 'number' && file.saveVersion > SAVE_VERSION) return fail('newer-save');
  if (typeof file.checksum !== 'string' || !file.state || typeof file.state !== 'object') return fail('damaged');
  try {
    if ((await sha256(canonicalJson(file.state))) !== file.checksum) return fail('damaged');
  } catch {
    return fail('damaged');
  }
  const check = checkLegacySave(file.state);
  if (check.recognized === false) {
    return /newer version/.test(check.reason) ? fail('newer-save') : fail('unrecognized');
  }
  try {
    const state = migrateState(file.state, now);
    const { deviceId: _untrusted, ...rest } = state;
    return {
      ok: true,
      state: rest as UserState,
      exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : '',
      ...(typeof file.appVersion === 'string' ? { appVersion: file.appVersion } : {}),
      saveVersion: typeof file.saveVersion === 'number' ? file.saveVersion : SAVE_VERSION,
    };
  } catch {
    return fail('unrecognized');
  }
}

const STAGE_ORDER = [DragonStage.EGG, DragonStage.HATCHLING, DragonStage.FLEDGLING, DragonStage.DRAKE, DragonStage.ANCIENT];

/** What a player recognizes their save by. */
export interface SaveSummary {
  dragonName: string;
  stage: DragonStage;
  bond: number;
  activeDays: number;
  currentStreak: number;
  bestStreak: number;
  badges: number;
  checkIns: number;
  focusSessions: number;
  goldenScales: number;
  lastPlayed: string;
}

export function summarizeSave(state: UserState): SaveSummary {
  return {
    dragonName: state.dragonName,
    stage: state.stage,
    bond: Math.floor(bondTotal(state.bond)),
    activeDays: lifetimeActiveDays(state.activity),
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    badges: state.badges.filter(b => b.unlockedAt).length,
    checkIns: state.symptomLogs.length,
    focusSessions: state.focusSessionsCompleted,
    goldenScales: state.goldenScales,
    lastPlayed: state.lastLogin,
  };
}

/** Something on this device that a replacement would set back or leave out. */
export type SaveLossKind =
  | 'check-ins'
  | 'check-ins-changed'
  | 'stage'
  | 'streak'
  | 'best-streak'
  | 'bond'
  | 'active-days'
  | 'milestones'
  | 'cosmetics'
  | 'golden-scales'
  | 'energy'
  | 'focus-sessions';

export interface SaveLoss {
  kind: SaveLossKind;
  /** What's missing, as a short phrase following "It doesn't have…" (e.g. "your 6-day streak (it has 2)"). */
  text: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const names = (list: string[]) => (list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);

/** Check-ins on this device that the incoming save leaves out, or has in a different version (matched by when they were logged). */
function checkInLosses(current: UserState, incoming: UserState) {
  const byDate = new Map<string, SymptomLog[]>();
  for (const log of incoming.symptomLogs) byDate.set(log.date, [...(byDate.get(log.date) ?? []), log]);
  const missing: SymptomLog[] = [];
  let changed = 0;
  let notesChanged = 0;
  for (const log of current.symptomLogs) {
    const match = byDate.get(log.date)?.shift();
    if (!match) {
      missing.push(log);
      continue;
    }
    const noteDiffers = (match.notes ?? '').trim() !== (log.notes ?? '').trim();
    if (noteDiffers || match.energy !== log.energy || match.mood !== log.mood) changed++;
    if (noteDiffers) notesChanged++;
  }
  return { missing, changed, notesChanged };
}

const hasNote = (log: SymptomLog) => !!log.notes?.trim();

/**
 * What `incoming` doesn't have that `current` does: what replacing would set
 * back or leave out, most personal first (check-ins and their notes can't be
 * earned again). Empty when nothing would be lost. Comparison only: the
 * replacement itself is all or nothing, and the replaced save is kept as a backup.
 */
export function progressLost(current: UserState, incoming: UserState, cosmeticName: (id: string) => string = id => id): SaveLoss[] {
  const a = summarizeSave(current);
  const b = summarizeSave(incoming);
  const lost: SaveLoss[] = [];
  const add = (kind: SaveLossKind, text: string) => lost.push({ kind, text });

  const { missing, changed, notesChanged } = checkInLosses(current, incoming);
  if (missing.length) {
    const noted = missing.filter(hasNote).length;
    add('check-ins', `${plural(missing.length, 'check-in')}${noted ? ` (${noted === 1 ? '1 with a note' : `${noted} with notes`})` : ''}`);
  }
  if (changed) add('check-ins-changed', `this device's ${notesChanged ? 'notes or ratings' : 'ratings'} for ${plural(changed, 'check-in')}`);
  if (STAGE_ORDER.indexOf(b.stage) < STAGE_ORDER.indexOf(a.stage)) add('stage', `the ${a.stage} stage (it has ${b.stage})`);
  if (b.currentStreak < a.currentStreak) add('streak', `your ${a.currentStreak}-day streak (it has ${b.currentStreak})`);
  if (b.bestStreak < a.bestStreak) add('best-streak', `your best streak of ${plural(a.bestStreak, 'day')} (it has ${b.bestStreak})`);
  if (b.bond < a.bond) add('bond', `some Bond (${b.bond} instead of ${a.bond})`);
  if (b.activeDays < a.activeDays) add('active-days', `some active days (${b.activeDays} instead of ${a.activeDays})`);
  const earned = new Set(incoming.badges.filter(x => x.unlockedAt).map(x => x.id));
  const badgesGone = current.badges.filter(x => x.unlockedAt && !earned.has(x.id)).map(x => x.name);
  if (badgesGone.length) add('milestones', `the ${names(badgesGone)} ${badgesGone.length === 1 ? 'milestone' : 'milestones'}`);
  const owned = new Set(incoming.inventory);
  const cosmeticsGone = [...new Set(current.inventory)].filter(id => !owned.has(id)).map(cosmeticName);
  if (cosmeticsGone.length) add('cosmetics', `your ${names(cosmeticsGone)}`);
  if (b.goldenScales < a.goldenScales) add('golden-scales', `some Golden Scales (${b.goldenScales} instead of ${a.goldenScales})`);
  if (incoming.energy < current.energy) add('energy', `some energy (${incoming.energy} instead of ${current.energy})`);
  if (b.focusSessions < a.focusSessions) add('focus-sessions', `some focus sessions (${b.focusSessions} instead of ${a.focusSessions})`);
  return lost;
}

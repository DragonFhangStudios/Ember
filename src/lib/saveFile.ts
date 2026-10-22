import { DragonStage, UserState } from '../types';
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

/**
 * Where the incoming save has less than the current one: replacing would set
 * these back (they're in the backup, but the player should know first).
 */
export function progressLost(current: UserState, incoming: UserState): string[] {
  const a = summarizeSave(current);
  const b = summarizeSave(incoming);
  const lost: string[] = [];
  if (STAGE_ORDER.indexOf(b.stage) < STAGE_ORDER.indexOf(a.stage)) lost.push(`an earlier stage (${b.stage} instead of ${a.stage})`);
  if (b.activeDays < a.activeDays) lost.push(`fewer active days (${b.activeDays} instead of ${a.activeDays})`);
  if (b.bond < a.bond) lost.push(`less Bond (${b.bond} instead of ${a.bond})`);
  if (b.badges < a.badges) lost.push(`fewer milestones (${b.badges} instead of ${a.badges})`);
  if (b.goldenScales < a.goldenScales) lost.push(`fewer Golden Scales (${b.goldenScales} instead of ${a.goldenScales})`);
  if (b.checkIns < a.checkIns) lost.push(`fewer check-ins (${b.checkIns} instead of ${a.checkIns})`);
  if (b.focusSessions < a.focusSessions) lost.push(`fewer focus sessions (${b.focusSessions} instead of ${a.focusSessions})`);
  return lost;
}

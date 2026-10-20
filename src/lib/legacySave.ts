import { DragonStage } from '../types';
import { SAVE_VERSION } from './progression';

// Recognizes a genuine Ember save in the pre-IndexedDB localStorage slot
// before it is migrated. The check is deliberately minimal: older and
// partially damaged saves still count, but data that isn't recognizably an
// Ember save goes to the recovery flow instead of silently becoming a new
// profile.

/** Thrown when the legacy slot holds data that isn't a recognizable Ember save. */
export class UnrecognizedLegacySaveError extends Error {
  constructor(readonly reason: string) {
    super(`The saved data is not a recognizable Ember save: ${reason}.`);
    this.name = 'UnrecognizedLegacySaveError';
  }
}

/** How many correctly typed Ember fields a save must have. Real saves have ~15. */
export const MIN_RECOGNIZED_FIELDS = 2;

const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);

// Fields every Ember save version has written, with their expected types.
const SIGNATURE: Record<string, (v: unknown) => boolean> = {
  dragonName: v => typeof v === 'string',
  stage: v => Object.values(DragonStage).includes(v as DragonStage),
  lastLogin: v => typeof v === 'string',
  energy: finite,
  goldenScales: finite,
  growthProgress: finite, // pre-v6
  petCount: finite,
  currentStreak: finite,
  quests: Array.isArray,
  badges: Array.isArray,
  symptomLogs: Array.isArray,
  inventory: Array.isArray,
  bond: isObject, // v6+
  activity: isObject, // v6+
};

export type LegacySaveCheck = { recognized: true } | { recognized: false; reason: string };

export function checkLegacySave(raw: unknown): LegacySaveCheck {
  if (!isObject(raw)) return { recognized: false, reason: 'not a save object' };
  const save = raw as Record<string, unknown>;

  // Saves from v3 on record their version; older ones don't have the field.
  if ('version' in save) {
    const v = save.version;
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { recognized: false, reason: 'invalid save version' };
    if (v > SAVE_VERSION) return { recognized: false, reason: `saved by a newer version of Ember (v${v})` };
  }

  const fields = Object.entries(SIGNATURE).filter(([key, valid]) => key in save && valid(save[key])).length;
  if (fields < MIN_RECOGNIZED_FIELDS) return { recognized: false, reason: 'no recognizable Ember data' };
  return { recognized: true };
}

/**
 * Parses the legacy localStorage value. Returns null only when there is no
 * legacy save at all. Throws for corrupt JSON or unrecognizable data, so the
 * caller treats it as a failed read (recovery), never as "no save".
 */
export function parseLegacySave(stored: string | null): unknown {
  if (stored === null) return null;
  const parsed: unknown = JSON.parse(stored);
  const check = checkLegacySave(parsed);
  if (check.recognized === false) throw new UnrecognizedLegacySaveError(check.reason);
  return parsed;
}

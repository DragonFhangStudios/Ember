import { ActivityLog, BondLedger, DragonStage, LegacyActiveDayCredit } from '../types';

// Evolution follows cumulative active days; Bond is permanent, uncapped care.
// Both are stored in shapes that merge safely across devices later (#8):
// - ActivityLog: a set of ISO dates (merge = union) plus lower-bound legacy
//   claims (merge = keep all), so overlapping histories never double count.
// - BondLedger: per-source totals (merge = per-key max, total = sum), so
//   progress earned independently on two offline devices is preserved.

/** Cumulative active days required for each stage, highest first. Tune during playtesting. */
export const EVOLUTION_THRESHOLDS: ReadonlyArray<readonly [DragonStage, number]> = [
  [DragonStage.ANCIENT, 50],
  [DragonStage.DRAKE, 24],
  [DragonStage.FLEDGLING, 8],
  [DragonStage.HATCHLING, 2],
  [DragonStage.EGG, 0],
];

export const STAGE_ORDER: readonly DragonStage[] = [
  DragonStage.EGG,
  DragonStage.HATCHLING,
  DragonStage.FLEDGLING,
  DragonStage.DRAKE,
  DragonStage.ANCIENT,
];

/**
 * Bond needed to go from level n to n+1 is `firstLevel + increase * (n - 1)`.
 * Levels never end. Tune during playtesting.
 */
export const BOND_LEVELS = {
  firstLevel: 20,
  increase: 5,
};

/** Ledger key for Bond carried over from saves made before Bond existed. */
export const LEGACY_BOND_KEY = 'legacy';
/** Ledger key used when no device id has been assigned (e.g. in tests). */
export const LOCAL_BOND_KEY = 'local';

// Keeps fractional rewards (0.5, 2/3) from drifting when summed.
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Local calendar date as YYYY-MM-DD (locale independent, sorts chronologically). */
export function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Parses a stored date (ISO timestamp or Date.toDateString()) into a local ISO day. */
export function toIsoDay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (ISO_DAY.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : isoDay(date);
}

// ---------------------------------------------------------------- stages

export function stageForActiveDays(activeDays: number): DragonStage {
  return EVOLUTION_THRESHOLDS.find(([, min]) => activeDays >= min)![0];
}

export function activeDaysThreshold(stage: DragonStage): number {
  return EVOLUTION_THRESHOLDS.find(([s]) => s === stage)?.[1] ?? 0;
}

/** Stages only ever move forward. */
export function higherStage(a: DragonStage, b: DragonStage): DragonStage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}

export function nextStage(stage: DragonStage): DragonStage | undefined {
  return STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
}

/** Evolution status for display: how far along, and what's next. */
export function evolutionProgress(stage: DragonStage, activeDays: number) {
  const next = nextStage(stage);
  return {
    stage,
    activeDays,
    next: next ? { stage: next, at: activeDaysThreshold(next) } : undefined,
  };
}

// ---------------------------------------------------------------- active days

export const emptyActivity = (): ActivityLog => ({ days: [], legacy: [] });

/** Records a calendar day. Idempotent: the same day twice counts once. */
export function addActiveDay(log: ActivityLog, day: string): ActivityLog {
  if (log.days.includes(day)) return log;
  return { ...log, days: [...log.days, day].sort() };
}

/**
 * Lifetime active days. Each legacy claim says at least `floor` days happened
 * before its date; known days on or after that date are added on top. Every
 * claim is a valid lower bound, so taking the best one never inflates.
 */
export function lifetimeActiveDays(log: ActivityLog): number {
  let best = log.days.length;
  for (const claim of log.legacy) {
    const before = log.days.filter(d => d < claim.before).length;
    best = Math.max(best, Math.max(claim.floor, before) + (log.days.length - before));
  }
  return best;
}

function normalizeClaims(claims: LegacyActiveDayCredit[]): LegacyActiveDayCredit[] {
  const byDate = new Map<string, number>();
  for (const c of claims) byDate.set(c.before, Math.max(byDate.get(c.before) ?? 0, c.floor));
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([before, floor]) => ({ floor, before }));
}

/** Merges two activity logs (e.g. from two devices). Commutative and idempotent. */
export function mergeActivity(a: ActivityLog, b: ActivityLog): ActivityLog {
  return {
    days: [...new Set([...a.days, ...b.days])].sort(),
    legacy: normalizeClaims([...a.legacy, ...b.legacy]),
  };
}

export function sanitizeActivity(raw: unknown): ActivityLog {
  if (!raw || typeof raw !== 'object') return emptyActivity();
  const r = raw as Partial<ActivityLog>;
  const days = Array.isArray(r.days) ? r.days.filter((d): d is string => typeof d === 'string' && ISO_DAY.test(d)) : [];
  const legacy = Array.isArray(r.legacy)
    ? r.legacy.filter(
        (c): c is LegacyActiveDayCredit =>
          !!c && typeof c.floor === 'number' && Number.isFinite(c.floor) && c.floor >= 0 &&
          typeof c.before === 'string' && ISO_DAY.test(c.before),
      )
    : [];
  return { days: [...new Set(days)].sort(), legacy: normalizeClaims(legacy) };
}

// ---------------------------------------------------------------- bond

export function bondTotal(ledger: BondLedger): number {
  return round(Object.values(ledger).reduce((sum, v) => sum + v, 0));
}

export function addBond(ledger: BondLedger, key: string, amount: number): BondLedger {
  if (!(amount > 0)) return ledger;
  return { ...ledger, [key]: round((ledger[key] ?? 0) + amount) };
}

/**
 * Merges two ledgers. Each source only ever grows its own entry, so per-key max
 * keeps every device's progress while a stale copy never double counts.
 */
export function mergeBond(a: BondLedger, b: BondLedger): BondLedger {
  const merged: BondLedger = { ...a };
  for (const [key, value] of Object.entries(b)) merged[key] = Math.max(merged[key] ?? 0, value);
  return merged;
}

export function sanitizeBond(raw: unknown): BondLedger {
  if (!raw || typeof raw !== 'object') return {};
  const ledger: BondLedger = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) ledger[key] = value;
  }
  return ledger;
}

const levelCost = (level: number) => Math.max(1, BOND_LEVELS.firstLevel + BOND_LEVELS.increase * (level - 1));

/** Bond level (starting at 1, unbounded) and progress toward the next level. */
export function bondLevel(total: number): { level: number; intoLevel: number; toNext: number } {
  let level = 1;
  let remaining = total;
  while (remaining >= levelCost(level)) {
    remaining -= levelCost(level);
    level++;
  }
  return { level, intoLevel: round(remaining), toNext: levelCost(level) };
}

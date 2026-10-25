import { DragonStage, DailyRewards, Quest, QuestReward, QuestType, SymptomLog, UserState } from '../types';
import { themePreferenceOf } from './theme';
import { INITIAL_QUESTS, BADGES } from '../constants';
import { sanitizeFocusSession } from './focusTimer';
import {
  LEGACY_BOND_KEY,
  LOCAL_BOND_KEY,
  activeDaysThreshold,
  addActiveDay,
  addBond,
  emptyActivity,
  higherStage,
  isoDay,
  lifetimeActiveDays,
  sanitizeActivity,
  sanitizeBond,
  stageForActiveDays,
  toIsoDay,
} from './evolution';

// Ember's progression rules, kept pure so they can be unit tested.
// Philosophy: progress is permanent. Missing days may break a streak or make
// Ember nap, but never takes away Bond, stages, or earned rewards.
// Evolution follows cumulative active days (see ./evolution); "growth"
// rewards add to Bond, which is uncapped and never affects evolution.
// A day counts toward the streak with one meaningful activity: completing a
// quest, finishing a focus session, or logging a check-in (not petting/feeding).

export const SAVE_VERSION = 9;

/** Completed focus-session ids kept for de-duplication (see focusSession.ts for why pruning is safe). */
export const COMPLETED_FOCUS_SESSIONS_KEPT = 200;

// Pre-v6 rules (evolution by growth, capped at 100). Only used to migrate old saves.
const LEGACY_MAX_GROWTH = 100;
const LEGACY_GROWTH_THRESHOLDS: ReadonlyArray<readonly [DragonStage, number]> = [
  [DragonStage.ANCIENT, 91],
  [DragonStage.DRAKE, 66],
  [DragonStage.FLEDGLING, 41],
  [DragonStage.HATCHLING, 21],
  [DragonStage.EGG, 0],
];

// Tune these during playtesting.
export const DAILY_LIMITS = {
  feeds: 3,
  focusRewards: 3,
  /** Max growth per calendar day from custom quests. Streak credit is unaffected. */
  customQuestGrowth: 4,
  /** Max energy per calendar day from all custom quests combined. Streak credit is unaffected. */
  customQuestEnergy: 40,
};

/** Lifetime completed focus sessions for the Zen Master badge. */
export const ZEN_MASTER_SESSIONS = 5;

/** Custom quests earn this much energy per step (so a quest's points are this times its target). */
export const CUSTOM_QUEST_ENERGY_PER_STEP = 10;
export const CUSTOM_QUEST_TARGET_MAX = 100;
/** Longest check-in note kept, in characters. */
export const CHECK_IN_NOTE_MAX = 280;

export const REWARDS = {
  pet: { energy: 5, growth: 2 },
  incubate: { energy: 10, growth: 5 },
  feed: { energy: 10, growth: 0.5 },
  focus: { energy: 15, growth: 3 },
  checkIn: { energy: 5, growth: 1 },
  questGrowth: 2,
  medication: { scales: 10, growth: 5 },
};

/** Days of inactivity (calendar days between visits) after which Ember naps. */
export const NAP_AFTER_DAYS_AWAY = 2;

export interface ActionResult {
  state: UserState;
  message?: string;
}

export const dayKey = (date: Date): string => date.toDateString();

/** Whole calendar days from the day `fromKey` names to `now` (DST-safe). */
export function daysBetween(fromKey: string, now: Date): number {
  const from = new Date(fromKey);
  if (Number.isNaN(from.getTime())) return Infinity;
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((b - a) / 86_400_000);
}

// Keeps fractional per-step growth (e.g. 2/3) from drifting when summed.
const roundGrowth = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Growth a custom quest granted for `progress` steps under the pre-v5 rules
 * (before the daily cap and before #10, when custom Vitality quests still
 * paid the medication bonus). Only used to migrate old saves accurately.
 */
function customQuestGrowthEarned(quest: Quest, progress: number): number {
  const perStep = REWARDS.questGrowth / quest.target;
  // Medication quests swap the final step's growth for a completion bonus.
  if (quest.type === 'medication' && progress >= quest.target) {
    return perStep * (quest.target - 1) + REWARDS.medication.growth;
  }
  return perStep * progress;
}

function legacyStageForGrowth(growth: number): DragonStage {
  return LEGACY_GROWTH_THRESHOLDS.find(([, min]) => growth >= min)![0];
}

function legacyGrowthThreshold(stage: DragonStage): number {
  return LEGACY_GROWTH_THRESHOLDS.find(([s]) => s === stage)?.[1] ?? 0;
}

export function activeDaysOf(state: UserState): number {
  return lifetimeActiveDays(state.activity);
}

export function freshDaily(date: string): DailyRewards {
  return {
    date,
    feeds: 0,
    focusRewards: 0,
    checkInRewarded: false,
    meaningfulActivity: false,
    customQuestGrowth: 0,
    customQuestEnergy: 0,
    questRewards: {},
    autoCompletedQuests: [],
  };
}

/**
 * Today's reward counters, treating counters from an earlier day as empty. If
 * the clock moved backwards (rollOverDay keeps the save on its later day), the
 * save's own day still applies, so changing the clock never refills a limit.
 */
export function dailyFor(state: UserState, now: Date): DailyRewards {
  const today = dayKey(now);
  if (state.daily?.date === today) return state.daily;
  if (state.daily?.date === state.lastLogin && daysBetween(state.lastLogin, now) < 0) return state.daily;
  return freshDaily(today);
}

const NO_REWARD: QuestReward = { energy: 0, growth: 0, scales: 0 };

const maxReward = (...rewards: QuestReward[]): QuestReward => ({
  energy: Math.max(...rewards.map(r => r.energy)),
  growth: Math.max(...rewards.map(r => r.growth)),
  scales: Math.max(...rewards.map(r => r.scales)),
});

/**
 * What reaching `progress` steps of `quest` is worth in total, before any
 * daily cap. Only the built-in Vitality quest pays the medication bonus (its
 * final step's growth becomes the bonus). A custom quest's category is
 * cosmetic, so custom quests always earn standard rewards.
 */
export function questRewardAt(quest: Quest, progress: number): QuestReward {
  const steps = Math.max(0, Math.min(progress, quest.target));
  const perStep = REWARDS.questGrowth / quest.target;
  const energy = (quest.points / quest.target) * steps;
  if (quest.type === 'medication' && !quest.isCustom && steps === quest.target) {
    return { energy, growth: roundGrowth(perStep * (quest.target - 1) + REWARDS.medication.growth), scales: REWARDS.medication.scales };
  }
  return { energy, growth: roundGrowth(perStep * steps), scales: 0 };
}

/**
 * What a quest has already paid today: its ledger entry, and never less than
 * the progress it shows (so progress that arrived some other way, such as a
 * focus session, an edit, or a save from before the ledger, is never paid
 * again).
 */
function questPaid(daily: DailyRewards, quest: Quest): QuestReward {
  return maxReward(daily.questRewards[quest.id] ?? NO_REWARD, questRewardAt(quest, quest.progress));
}

/** Adds rewards. `growth` goes to this device's Bond entry; it never changes the stage. */
export function grantRewards(
  state: UserState,
  { energy = 0, growth = 0, scales = 0 }: { energy?: number; growth?: number; scales?: number },
): UserState {
  return {
    ...state,
    energy: Math.round(state.energy + energy),
    goldenScales: state.goldenScales + scales,
    bond: addBond(state.bond, state.deviceId ?? LOCAL_BOND_KEY, growth),
    isNapping: false,
  };
}

/**
 * Records `day` as an active day: adds it to lifetime active days and, if it
 * comes after the last active day, continues or restarts the streak. A day
 * already counted, or earlier than the last active day, never changes or
 * removes the streak.
 */
export function recordActiveDay(state: UserState, day: Date): { state: UserState; gap: number } {
  const gap = state.lastActiveDay ? daysBetween(state.lastActiveDay, day) : Infinity;
  const activity = addActiveDay(state.activity, isoDay(day));
  const stage = higherStage(state.stage, stageForActiveDays(lifetimeActiveDays(activity)));
  if (gap <= 0) return { state: { ...state, activity, stage }, gap };
  const currentStreak = gap === 1 ? state.currentStreak + 1 : 1;
  return {
    state: {
      ...state,
      activity,
      stage,
      currentStreak,
      bestStreak: Math.max(state.bestStreak, currentStreak),
      lastActiveDay: dayKey(day),
    },
    gap,
  };
}

/**
 * Counts today toward the streak and lifetime active days. Only the first
 * meaningful activity of a day changes anything; later ones are no-ops.
 * Continues the streak when the last active day was yesterday, otherwise
 * starts a fresh one. Evolution follows the lifetime active-day count.
 */
export function creditMeaningfulActivity(state: UserState, now: Date): { state: UserState; message?: string } {
  const daily = dailyFor(state, now);
  if (daily.meaningfulActivity) return { state };

  // Clock moved backwards past the last active day: don't touch the streak.
  if (state.lastActiveDay && daysBetween(state.lastActiveDay, now) < 0) return { state };

  const recorded = recordActiveDay(state, now);
  const { gap } = recorded;
  const continues = gap === 1;
  const currentStreak = recorded.state.currentStreak;
  const stage = recorded.state.stage;
  const next: UserState = { ...recorded.state, daily: { ...daily, meaningfulActivity: true } };

  let message: string | undefined;
  if (continues && currentStreak > 1) {
    message = `🔥 ${currentStreak}-day streak! ${state.dragonName} is so proud of you.`;
  } else if (state.lastActiveDay && gap >= 2) {
    message = `Welcome back! Today counts, and ${state.dragonName} is happy you're here.`;
  } else if (gap !== 0) {
    message = `Today counts! ${state.dragonName} is happy you're here.`;
  }
  if (stage !== state.stage) {
    message = `✨ ${state.dragonName} grew into a ${stage}! ${message ?? ''}`.trim();
  }
  return { state: next, message };
}

/** Combines an action's own message with a streak message. */
function withStreakCredit(result: ActionResult, now: Date): ActionResult {
  const credited = creditMeaningfulActivity(result.state, now);
  const message = [credited.message, result.message].filter(Boolean).join(' ') || undefined;
  return { state: credited.state, message };
}

export function createInitialState(now: Date): UserState {
  const today = dayKey(now);
  return {
    version: SAVE_VERSION,
    dragonName: 'Ember',
    stage: DragonStage.EGG,
    energy: 50,
    goldenScales: 0,
    bond: {},
    activity: emptyActivity(),
    lastLogin: today,
    isNapping: false,
    quests: INITIAL_QUESTS,
    symptomLogs: [],
    inventory: [],
    equipped: {},
    badges: BADGES,
    petCount: 0,
    customQuestTypes: [],
    currentStreak: 0,
    bestStreak: 0,
    daily: freshDaily(today),
    focus: null,
    completedFocusSessions: [],
    focusSessionsCompleted: 0,
    theme: 'system',
  };
}

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

function sanitizeQuestRewards(value: unknown): Record<string, QuestReward> {
  const out: Record<string, QuestReward> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    out[id] = { energy: Math.max(0, num(e.energy, 0)), growth: Math.max(0, num(e.growth, 0)), scales: Math.max(0, num(e.scales, 0)) };
  }
  return out;
}

/** A check-in note as stored: plain text, trimmed, bounded; empty means none. */
export function normalizeNote(note: unknown): string | undefined {
  if (typeof note !== 'string') return undefined;
  const text = note
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, CHECK_IN_NOTE_MAX)
    .trim();
  return text || undefined;
}

/** Keeps a saved log as it is, except a note that isn't text. */
function sanitizeLogNote(log: SymptomLog): SymptomLog {
  if (!log || typeof log !== 'object' || log.notes === undefined || typeof log.notes === 'string') return log;
  const { notes: _notText, ...rest } = log;
  return rest;
}

/**
 * Upgrades any previously saved state to the current shape without losing
 * progress. Stages never go down: pre-v6 saves keep their stage through a
 * legacy active-day credit, and their growth becomes Bond.
 */
export function migrateState(raw: unknown, now: Date): UserState {
  const base = createInitialState(now);
  if (!raw || typeof raw !== 'object') return base;
  const saved = raw as Partial<UserState> & Record<string, unknown>;

  const quests: Quest[] = Array.isArray(saved.quests)
    ? saved.quests.map(q => ({
        ...q,
        target: q.target ?? 1,
        progress: q.progress ?? (q.completed ? (q.target ?? 1) : 0),
      }))
    : base.quests;

  const savedBadges = Array.isArray(saved.badges) ? saved.badges : [];
  const badges = BADGES.map(def => {
    const unlockedAt = savedBadges.find(b => b.id === def.id)?.unlockedAt;
    return unlockedAt ? { ...def, unlockedAt } : def;
  });

  const savedStage = Object.values(DragonStage).includes(saved.stage as DragonStage)
    ? (saved.stage as DragonStage)
    : DragonStage.EGG;

  const lastLogin = typeof saved.lastLogin === 'string' ? saved.lastLogin : base.lastLogin;
  const daily: DailyRewards =
    saved.daily && typeof saved.daily === 'object' && typeof saved.daily.date === 'string'
      ? { ...freshDaily(saved.daily.date), ...saved.daily }
      : {
          // Pre-v3 saves: infer today's claimed rewards from completed quests.
          ...freshDaily(lastLogin),
          focusRewards: quests.some(q => q.type === 'focus' && q.completed) ? 1 : 0,
          checkInRewarded: quests.some(q => q.type === 'symptom' && q.completed),
        };

  // Pre-v5 saves had no custom-quest growth cap: count growth already earned
  // today from custom quests so the cap can't be bypassed by upgrading.
  if (num(saved.version, 0) < 5 && daily.date === lastLogin) {
    const earned = quests
      .filter(q => q.isCustom && q.isDaily)
      .reduce((sum, q) => sum + customQuestGrowthEarned(q, Math.min(q.progress, q.target)), 0);
    daily.customQuestGrowth = roundGrowth(Math.min(DAILY_LIMITS.customQuestGrowth, earned));
  }
  daily.customQuestGrowth = num(daily.customQuestGrowth, 0);

  // v9: per-quest reward ledger, custom-quest energy cap, auto-completed quests.
  daily.questRewards = sanitizeQuestRewards(daily.questRewards);
  daily.autoCompletedQuests = Array.isArray(daily.autoCompletedQuests)
    ? daily.autoCompletedQuests.filter((id): id is string => typeof id === 'string')
    : [];
  daily.customQuestEnergy = num(daily.customQuestEnergy, 0);
  if (num(saved.version, 0) < 9 && daily.date === lastLogin) {
    // Everything today's quests already show was rewarded before the upgrade,
    // so none of it can pay again, and custom-quest energy already earned
    // today counts toward the new cap (it's kept even if it's over).
    for (const quest of quests) {
      if (quest.progress > 0) {
        daily.questRewards[quest.id] = maxReward(daily.questRewards[quest.id] ?? NO_REWARD, questRewardAt(quest, quest.progress));
      }
    }
    daily.customQuestEnergy = roundGrowth(
      quests.filter(q => q.isCustom && q.isDaily).reduce((sum, q) => sum + questRewardAt(q, q.progress).energy, 0),
    );
    // How a focus or check-in quest was completed wasn't recorded: treat it as
    // completed by the focus session or check-in, so it can't be "corrected".
    daily.autoCompletedQuests = quests.filter(q => q.completed && (q.type === 'focus' || q.type === 'symptom')).map(q => q.id);
  }

  // Pre-v4 saves counted a streak day only at the next rollover, so a live
  // streak covered days up to the day before lastLogin. Carry it over, then
  // credit lastLogin itself if anything meaningful already happened that day.
  // This can only keep or raise an existing streak.
  let currentStreak = num(saved.currentStreak, 0);
  let lastActiveDay = typeof saved.lastActiveDay === 'string' ? saved.lastActiveDay : undefined;
  if (num(saved.version, 0) < 4) {
    const lastLoginDate = new Date(lastLogin);
    if (currentStreak > 0 && !lastActiveDay && !Number.isNaN(lastLoginDate.getTime())) {
      lastLoginDate.setDate(lastLoginDate.getDate() - 1);
      lastActiveDay = dayKey(lastLoginDate);
    }
    const activeOnLastLogin =
      quests.some(q => q.isDaily && q.completed) || daily.checkInRewarded || daily.focusRewards > 0;
    if (activeOnLastLogin && daily.date === lastLogin && !daily.meaningfulActivity) {
      currentStreak = lastActiveDay && daysBetween(lastActiveDay, new Date(lastLogin)) === 1 ? currentStreak + 1 : 1;
      lastActiveDay = lastLogin;
      daily.meaningfulActivity = true;
    }
  }

  // v6: evolution by active days, growth becomes Bond.
  let bond = sanitizeBond(saved.bond);
  let activity = sanitizeActivity(saved.activity);
  let stage = savedStage;
  if (num(saved.version, 0) < 6) {
    // Older saves could have their stage forced back to Egg, so the higher of
    // saved growth and the saved stage's growth threshold is kept (as before).
    const legacyGrowth = Math.min(
      LEGACY_MAX_GROWTH,
      Math.max(num(saved.growthProgress, 0), legacyGrowthThreshold(savedStage)),
    );
    stage = legacyStageForGrowth(legacyGrowth);
    bond = legacyGrowth > 0 ? { [LEGACY_BOND_KEY]: legacyGrowth } : {};

    // Seed real, known active dates, then add a lower-bound credit so the
    // current stage is always kept.
    for (const day of [
      ...(Array.isArray(saved.symptomLogs) ? saved.symptomLogs : []).map(l => toIsoDay(l?.date)),
      toIsoDay(lastActiveDay),
    ]) {
      if (day) activity = addActiveDay(activity, day);
    }
    // The old stage already reflects everything earned up to the upgrade,
    // including any activity earlier on the upgrade day itself. In that case
    // the credit covers today too, so upgrading never adds an extra day; if
    // today had no activity yet, a new one after upgrading counts once.
    const floor = activeDaysThreshold(stage);
    if (floor > 0) {
      const today = isoDay(now);
      const tomorrow = isoDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      activity = { ...activity, legacy: [{ floor, before: activity.days.includes(today) ? tomorrow : today }] };
    }
  }
  stage = higherStage(stage, stageForActiveDays(lifetimeActiveDays(activity)));

  const completedFocusSessions = Array.isArray(saved.completedFocusSessions)
    ? [...new Set(saved.completedFocusSessions.filter((id): id is string => typeof id === 'string'))].slice(-COMPLETED_FOCUS_SESSIONS_KEPT)
    : [];

  const {
    growthProgress: _legacyGrowth,
    deviceId: _untrustedDeviceId,
    isDarkMode: _replacedByTheme,
    ...rest
  } = saved as Record<string, unknown>;
  return {
    ...base,
    ...(rest as Partial<UserState>),
    version: SAVE_VERSION,
    quests,
    badges,
    bond,
    activity,
    stage,
    energy: num(saved.energy, base.energy),
    goldenScales: num(saved.goldenScales, 0),
    petCount: num(saved.petCount, 0),
    currentStreak,
    bestStreak: Math.max(num(saved.bestStreak, 0), currentStreak),
    lastActiveDay,
    symptomLogs: Array.isArray(saved.symptomLogs) ? saved.symptomLogs.map(sanitizeLogNote) : [],
    inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
    equipped: saved.equipped && typeof saved.equipped === 'object' ? saved.equipped : {},
    customQuestTypes: Array.isArray(saved.customQuestTypes) ? saved.customQuestTypes : [],
    lastLogin,
    isNapping: !!saved.isNapping,
    daily,
    // v7: the shared focus session and its de-duplication ledger.
    focus: sanitizeFocusSession(saved.focus, now.getTime()),
    completedFocusSessions,
    // v9: lifetime completed focus sessions (Zen Master). Every id in the
    // ledger is a completed session, so it's at least that many; earlier
    // sessions weren't recorded and aren't guessed. Never lowered.
    focusSessionsCompleted: Math.max(Math.floor(num(saved.focusSessionsCompleted, 0)), completedFocusSessions.length),
    // v8: light/dark preference (isDarkMode before).
    theme: themePreferenceOf(saved),
  };
}

/**
 * Starts a new calendar day if needed: resets daily quests and reward limits
 * and updates the streak. Growth and stage are never touched. Returns the same
 * object when it is still the same day, so it is safe to call often.
 */
export function rollOverDay(state: UserState, now: Date): UserState {
  const today = dayKey(now);
  if (state.lastLogin === today) return state;

  const daysAway = daysBetween(state.lastLogin, now);
  // Clock moved backwards: don't hand out a fresh day.
  if (daysAway < 0) return state;

  // The streak survives as long as yesterday (or today) counted; a full missed
  // day resets only the current streak. Best streak and badges are kept.
  const sinceActive = state.lastActiveDay ? daysBetween(state.lastActiveDay, now) : Infinity;
  const currentStreak = sinceActive <= 1 ? state.currentStreak : 0;

  return {
    ...state,
    lastLogin: today,
    quests: state.quests.map(q => (q.isDaily ? { ...q, completed: false, progress: 0 } : q)),
    currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak),
    isNapping: daysAway >= NAP_AFTER_DAYS_AWAY,
    daily: freshDaily(today),
  };
}

/** What custom quests can still earn today, together (shown to the player; never negative). */
export function customQuestAllowanceLeft(state: UserState, now: Date): { energy: number; bond: number } {
  const daily = dailyFor(state, now);
  return {
    energy: Math.max(0, DAILY_LIMITS.customQuestEnergy - daily.customQuestEnergy),
    bond: roundGrowth(Math.max(0, DAILY_LIMITS.customQuestGrowth - daily.customQuestGrowth)),
  };
}

interface StepReward extends QuestReward {
  /** What the quest has already paid today, and what reaching the new progress is worth (for the ledger). */
  paid: QuestReward;
  worth: QuestReward;
  /** Nothing to pay because this progress was already rewarded today (a corrected or edited step). */
  alreadyRewarded: boolean;
  /** A custom quest's shared daily allowance cut the reward short. */
  capped: boolean;
}

/**
 * What reaching `progress` on `quest` pays today: only what goes beyond the
 * quest's ledger, and for custom quests no more than the shared allowance has
 * left. The one calculation behind both advanceQuest and what the screen shows.
 */
function stepReward(daily: DailyRewards, quest: Quest, progress: number): StepReward {
  const paid = questPaid(daily, quest);
  const worth = questRewardAt(quest, progress);
  let energy = Math.max(0, worth.energy - paid.energy);
  let growth = roundGrowth(Math.max(0, worth.growth - paid.growth));
  const scales = Math.max(0, worth.scales - paid.scales);
  const alreadyRewarded = energy === 0 && growth === 0 && scales === 0;
  let capped = false;
  if (quest.isCustom) {
    const energyLeft = Math.max(0, DAILY_LIMITS.customQuestEnergy - daily.customQuestEnergy);
    const growthLeft = Math.max(0, DAILY_LIMITS.customQuestGrowth - daily.customQuestGrowth);
    capped = energy > energyLeft || growth > growthLeft;
    energy = Math.min(energy, energyLeft);
    growth = Math.min(growth, growthLeft);
  }
  return { energy, growth, scales, paid, worth, alreadyRewarded, capped };
}

/** What the next tap on a quest would pay, and whether it would also count the day toward the streak. */
export interface NextStepReward extends QuestReward {
  /** This step was already rewarded today (after a correction or an edit): it pays nothing. */
  alreadyRewarded: boolean;
  /** Completing it would count today for the streak (nothing meaningful has counted today yet). */
  countsForStreak: boolean;
}

/** What tapping `quest` once more would pay right now, exactly as advanceQuest would (see stepReward). */
export function nextStepReward(state: UserState, quest: Quest, now: Date): NextStepReward {
  const current = rollOverDay(state, now);
  const fresh = current.quests.find(q => q.id === quest.id) ?? quest;
  const daily = dailyFor(current, now);
  const progress = Math.min(fresh.target, fresh.progress + 1);
  const { energy, growth, scales, alreadyRewarded } = stepReward(daily, fresh, progress);
  return { energy, growth, scales, alreadyRewarded, countsForStreak: progress === fresh.target && !daily.meaningfulActivity };
}

/**
 * One step (or more) on a quest. Each step pays only what goes beyond what the
 * quest has already been worth today (the daily ledger), so redoing a
 * corrected step, or changing a quest's target, never pays twice. Custom
 * quests share daily energy and growth allowances: a step that would exceed
 * one gets only what's left, and still counts for the streak.
 */
export function advanceQuest(state: UserState, id: string, now: Date, increment = 1): ActionResult {
  const current = rollOverDay(state, now);
  const quest = current.quests.find(q => q.id === id);
  if (!quest || quest.completed) return { state: current };

  const progress = Math.min(quest.target, quest.progress + increment);
  const completed = progress === quest.target;
  const daily = dailyFor(current, now);
  const step = stepReward(daily, quest, progress);
  const { energy, growth, scales } = step;
  const alreadyEarned = progress > quest.progress && step.alreadyRewarded;

  let nextDaily: DailyRewards = { ...daily, questRewards: { ...daily.questRewards, [id]: maxReward(step.paid, step.worth) } };
  let message: string | undefined;
  if (quest.isCustom) {
    nextDaily = {
      ...nextDaily,
      customQuestEnergy: roundGrowth(daily.customQuestEnergy + energy),
      customQuestGrowth: roundGrowth(daily.customQuestGrowth + growth),
    };
    if (step.capped) {
      const energyDone = nextDaily.customQuestEnergy >= DAILY_LIMITS.customQuestEnergy;
      const bondDone = nextDaily.customQuestGrowth >= DAILY_LIMITS.customQuestGrowth;
      message =
        energyDone && bondDone
          ? "You've earned today's energy and Bond from custom quests. They still count toward your streak!"
          : energyDone
            ? "You've earned today's energy from custom quests. They still count for Bond and your streak!"
            : "You've earned today's Bond from custom quests. They still count for energy and your streak!";
    }
  }
  if (alreadyEarned) message = "Done again! You'd already earned this step today.";

  const withQuest: UserState = {
    ...current,
    quests: current.quests.map(q => (q.id === id ? { ...q, progress, completed } : q)),
    daily: nextDaily,
  };
  const result: ActionResult = { state: grantRewards(withQuest, { energy, growth, scales }), message };
  return completed ? withStreakCredit(result, now) : result;
}

/**
 * Whether a quest's last step can be corrected: a daily quest with progress
 * made today by tapping (not completed by a focus session or check-in).
 */
export function canCorrectQuest(state: UserState, quest: Quest, now: Date): boolean {
  return (
    quest.isDaily &&
    quest.progress > 0 &&
    state.lastLogin === dayKey(now) &&
    !dailyFor(state, now).autoCompletedQuests.includes(quest.id)
  );
}

/**
 * Corrects a mistaken tap: takes one step off the quest (so a one-step quest
 * is "not done" again). Only the displayed progress changes. Nothing earned is
 * taken back, and the ledger keeps what the step was worth, so redoing it pays
 * nothing. `seenProgress` is the progress the player was correcting: if the
 * quest changed since (another tab, or a new day), nothing happens.
 */
export function correctQuest(state: UserState, id: string, seenProgress: number, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const quest = current.quests.find(q => q.id === id);
  if (!quest || quest.progress !== seenProgress || !canCorrectQuest(current, quest, now)) {
    return { state: current, message: 'That quest has already changed, so there was nothing to correct.' };
  }
  const daily = dailyFor(current, now);
  const progress = quest.progress - 1;
  return {
    state: {
      ...current,
      quests: current.quests.map(q => (q.id === id ? { ...q, progress, completed: false } : q)),
      daily: { ...daily, questRewards: { ...daily.questRewards, [id]: questPaid(daily, quest) } },
    },
    message:
      quest.target === 1
        ? `Marked "${quest.title}" as not done. Everything you earned stays yours.`
        : `Took one step off "${quest.title}". Everything you earned stays yours.`,
  };
}

export interface CustomQuestDetails {
  title: string;
  description: string;
  type: QuestType;
  target: number;
}

/** A custom quest's target: a whole number from 1 to CUSTOM_QUEST_TARGET_MAX. */
export const customQuestTarget = (target: number) =>
  Number.isFinite(target) ? Math.min(CUSTOM_QUEST_TARGET_MAX, Math.max(1, Math.round(target))) : 1;

/**
 * Edits a custom quest, keeping its id (so today's ledger still applies). If
 * the new target is below its progress, the progress is shown as complete,
 * and that progress counts as already rewarded: an edit never pays anything,
 * now or after a correction.
 */
export function editCustomQuest(state: UserState, id: string, details: CustomQuestDetails, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const quest = current.quests.find(q => q.id === id);
  const title = details.title.trim();
  if (!quest?.isCustom) return { state: current, message: "That quest isn't here anymore, so nothing was changed." };
  if (!title) return { state: current };

  const target = customQuestTarget(details.target);
  const progress = Math.min(quest.progress, target);
  const edited: Quest = {
    ...quest,
    title,
    description: details.description.trim(),
    type: details.type,
    target,
    points: CUSTOM_QUEST_ENERGY_PER_STEP * target,
    progress,
    completed: progress >= target,
  };
  const daily = dailyFor(current, now);
  const questRewards =
    quest.progress > 0
      ? { ...daily.questRewards, [id]: maxReward(questPaid(daily, quest), questRewardAt(edited, progress)) }
      : daily.questRewards;
  return {
    state: { ...current, quests: current.quests.map(q => (q.id === id ? edited : q)), daily: { ...daily, questRewards } },
    message: `Saved your changes to "${title}".`,
  };
}

/**
 * Deletes a custom quest. Everything it earned stays: energy, Bond, scales,
 * streak and active-day credit, badges. Today's ledger and daily allowances
 * keep counting it, so deleting and re-adding can't earn more today.
 */
export function deleteCustomQuest(state: UserState, id: string, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const quest = current.quests.find(q => q.id === id);
  if (!quest?.isCustom) return { state: current };
  return {
    state: { ...current, quests: current.quests.filter(q => q.id !== id) },
    message: `Deleted "${quest.title}". Everything you earned from it stays yours.`,
  };
}

export function petDragon(state: UserState, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const isEgg = current.stage === DragonStage.EGG;
  if (current.lastPetAt && dayKey(new Date(current.lastPetAt)) === dayKey(now)) {
    return {
      state: current,
      message: isEgg
        ? 'The egg is already clean and hydrated for today.'
        : `${current.dragonName} has already had plenty of cuddles today.`,
    };
  }
  const next = grantRewards(
    { ...current, petCount: current.petCount + 1, lastPetAt: now.toISOString() },
    REWARDS.pet,
  );
  return {
    state: next,
    message: isEgg
      ? `You carefully clean the shell and ensure it's hydrated. ${current.dragonName} pulses warmly.`
      : `${current.dragonName} chirps happily and leans into your touch.`,
  };
}

/** Incubates the egg (once per day) or feeds a hatched dragon (limited per day). */
export function feedDragon(state: UserState, now: Date): ActionResult {
  const current = rollOverDay(state, now);

  if (current.stage === DragonStage.EGG) {
    if (current.lastIncubateAt && dayKey(new Date(current.lastIncubateAt)) === dayKey(now)) {
      return { state: current, message: "The egg has already been incubated today. It's glowing steadily." };
    }
    return {
      state: grantRewards({ ...current, lastIncubateAt: now.toISOString() }, REWARDS.incubate),
      message: 'You provide a spark of warmth. The egg glows with life!',
    };
  }

  const daily = dailyFor(current, now);
  if (daily.feeds >= DAILY_LIMITS.feeds) {
    return { state: current, message: `${current.dragonName} is full and happy. Come back tomorrow for more treats!` };
  }
  return {
    state: grantRewards({ ...current, daily: { ...daily, feeds: daily.feeds + 1 } }, REWARDS.feed),
    message: `${current.dragonName} munches happily.`,
  };
}

/** A completed focus session. Always counts the quest; rewards are capped per day. */
export function completeFocusSession(state: UserState, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const daily = autoComplete(dailyFor(current, now), current, 'focus');
  const withQuest = {
    ...current,
    quests: current.quests.map(q => (q.type === 'focus' ? { ...q, progress: q.target, completed: true } : q)),
    daily,
  };

  if (daily.focusRewards >= DAILY_LIMITS.focusRewards) {
    return withStreakCredit({
      state: { ...withQuest, isNapping: false },
      message: "Great focus! You've earned all of today's focus Bond. Ember is proud of you.",
    }, now);
  }
  return withStreakCredit({
    state: grantRewards({ ...withQuest, daily: { ...daily, focusRewards: daily.focusRewards + 1 } }, REWARDS.focus),
  }, now);
}

/**
 * A focus session that ended at `completedAt` but is only processed `now`
 * (Ember was closed or suspended). The activity counts on the day it
 * happened, recorded before today's rollover so a legitimate streak isn't
 * broken; energy and Bond are paid against the processing day's limits.
 */
export function completeFocusSessionLate(state: UserState, completedAt: Date, now: Date): ActionResult {
  if (dayKey(completedAt) === dayKey(now)) return completeFocusSession(state, now);

  const credited = recordActiveDay(state, completedAt).state;
  const current = rollOverDay(credited, now);
  const daily = dailyFor(current, now);
  const away = `Your focus session finished while you were away. ${current.dragonName} is proud of you!`;
  if (daily.focusRewards >= DAILY_LIMITS.focusRewards) {
    return {
      state: { ...current, daily, isNapping: false },
      message: `${away} You've already earned all of today's focus Bond.`,
    };
  }
  return {
    state: grantRewards({ ...current, daily: { ...daily, focusRewards: daily.focusRewards + 1 } }, REWARDS.focus),
    message: away,
  };
}

/** The quests a focus session or check-in completes are recorded as such (they can't be "corrected"). */
function autoComplete(daily: DailyRewards, state: UserState, type: 'focus' | 'symptom'): DailyRewards {
  const ids = state.quests.filter(q => q.type === type && !daily.autoCompletedQuests.includes(q.id)).map(q => q.id);
  return ids.length ? { ...daily, autoCompletedQuests: [...daily.autoCompletedQuests, ...ids] } : daily;
}

/**
 * Logs today's check-in, with an optional private note. A second check-in on
 * the same day updates the log (including its note) without extra rewards.
 */
export function logCheckIn(state: UserState, energy: number, mood: number, now: Date, note?: string): ActionResult {
  const current = rollOverDay(state, now);
  const daily = dailyFor(current, now);
  const notes = normalizeNote(note);
  const log: SymptomLog = { date: now.toISOString(), energy, mood, ...(notes ? { notes } : {}) };

  const todayIndex = current.symptomLogs.map(l => dayKey(new Date(l.date))).lastIndexOf(dayKey(now));
  if (daily.checkInRewarded && todayIndex !== -1) {
    const symptomLogs = current.symptomLogs.map((l, i) => (i === todayIndex ? log : l));
    return { state: { ...current, symptomLogs, daily }, message: "Updated today's check-in." };
  }

  const withLog = {
    ...current,
    symptomLogs: [...current.symptomLogs, log],
    quests: current.quests.map(q => (q.type === 'symptom' ? { ...q, progress: q.target, completed: true } : q)),
    daily: { ...autoComplete(daily, current, 'symptom'), checkInRewarded: true },
  };
  return withStreakCredit(
    { state: daily.checkInRewarded ? { ...withLog, isNapping: false } : grantRewards(withLog, REWARDS.checkIn) },
    now,
  );
}

export function hasCheckedInToday(state: UserState, now: Date): boolean {
  return dailyFor(state, now).checkInRewarded;
}

/** Unlocks any newly earned badges. Returns the same object when nothing changed. */
export function evaluateBadges(state: UserState, now: Date): UserState {
  let changed = false;
  const badges = state.badges.map(badge => {
    if (badge.unlockedAt) return badge;
    const unlocked =
      (badge.id === 'badge_hatch' && state.stage !== DragonStage.EGG) ||
      (badge.id === 'badge_pet_10' && state.petCount >= 10) ||
      (badge.id === 'badge_focus_5' && state.focusSessionsCompleted >= ZEN_MASTER_SESSIONS) ||
      (badge.id === 'badge_streak_3' && state.bestStreak >= 3) ||
      (badge.id === 'badge_streak_7' && state.bestStreak >= 7) ||
      (badge.id === 'badge_days_100' && activeDaysOf(state) >= 100) ||
      (badge.id === 'badge_days_200' && activeDaysOf(state) >= 200) ||
      (badge.id === 'badge_days_365' && activeDaysOf(state) >= 365);
    if (!unlocked) return badge;
    changed = true;
    return { ...badge, unlockedAt: now.toISOString() };
  });
  return changed ? { ...state, badges } : state;
}

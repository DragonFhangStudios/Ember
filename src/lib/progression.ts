import { DragonStage, DailyRewards, Quest, SymptomLog, UserState } from '../types';
import { INITIAL_QUESTS, BADGES } from '../constants';

// Ember's progression rules, kept pure so they can be unit tested.
// Philosophy: growth is permanent. Missing days may break a streak or make
// Ember nap, but never takes away growth, stages, or earned rewards.
// A day counts toward the streak with one meaningful activity: completing a
// quest, finishing a focus session, or logging a check-in (not petting/feeding).

export const SAVE_VERSION = 5;
export const MAX_GROWTH = 100;

// Minimum growth required for each stage, highest first.
export const STAGE_THRESHOLDS: ReadonlyArray<readonly [DragonStage, number]> = [
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
  /** Max growth per calendar day from custom quests. Energy and streak credit are unaffected. */
  customQuestGrowth: 4,
};

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

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
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

export function stageForGrowth(growth: number): DragonStage {
  return STAGE_THRESHOLDS.find(([, min]) => growth >= min)![0];
}

export function stageThreshold(stage: DragonStage): number {
  return STAGE_THRESHOLDS.find(([s]) => s === stage)?.[1] ?? 0;
}

export function freshDaily(date: string): DailyRewards {
  return { date, feeds: 0, focusRewards: 0, checkInRewarded: false, meaningfulActivity: false, customQuestGrowth: 0 };
}

/** Today's reward counters, treating counters from another day as empty. */
export function dailyFor(state: UserState, now: Date): DailyRewards {
  const today = dayKey(now);
  return state.daily?.date === today ? state.daily : freshDaily(today);
}

/** Adds rewards. Growth only ever increases, and the stage follows from it. */
export function grantRewards(
  state: UserState,
  { energy = 0, growth = 0, scales = 0 }: { energy?: number; growth?: number; scales?: number },
): UserState {
  const growthProgress = clamp(state.growthProgress + Math.max(0, growth), 0, MAX_GROWTH);
  return {
    ...state,
    energy: Math.round(state.energy + energy),
    goldenScales: state.goldenScales + scales,
    growthProgress,
    stage: stageForGrowth(growthProgress),
    isNapping: false,
  };
}

/**
 * Counts today toward the streak. Only the first meaningful activity of a day
 * changes the streak; later ones are no-ops. Continues the streak when the
 * last active day was yesterday, otherwise starts a fresh one.
 */
export function creditMeaningfulActivity(state: UserState, now: Date): { state: UserState; message?: string } {
  const daily = dailyFor(state, now);
  if (daily.meaningfulActivity) return { state };

  const today = dayKey(now);
  const gap = state.lastActiveDay ? daysBetween(state.lastActiveDay, now) : Infinity;
  // Clock moved backwards past the last active day: don't touch the streak.
  if (gap < 0) return { state };

  const continues = gap === 1;
  const currentStreak = gap === 0 ? state.currentStreak : continues ? state.currentStreak + 1 : 1;
  const next: UserState = {
    ...state,
    currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak),
    lastActiveDay: today,
    daily: { ...daily, meaningfulActivity: true },
  };

  let message: string | undefined;
  if (continues && currentStreak > 1) {
    message = `🔥 ${currentStreak}-day streak! ${state.dragonName} is so proud of you.`;
  } else if (state.lastActiveDay && gap >= 2) {
    message = `Welcome back! Today counts, and ${state.dragonName} is happy you're here.`;
  } else if (gap !== 0) {
    message = `Today counts! ${state.dragonName} is happy you're here.`;
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
    growthProgress: 0,
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
  };
}

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Upgrades any previously saved state to the current shape without losing
 * progress. Older saves could have their stage forced back to Egg, so the
 * higher of saved growth and the saved stage's threshold is kept.
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
  const growthProgress = clamp(
    Math.max(num(saved.growthProgress, 0), stageThreshold(savedStage)),
    0,
    MAX_GROWTH,
  );

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

  return {
    ...base,
    ...saved,
    version: SAVE_VERSION,
    quests,
    badges,
    growthProgress,
    stage: stageForGrowth(growthProgress),
    energy: num(saved.energy, base.energy),
    goldenScales: num(saved.goldenScales, 0),
    petCount: num(saved.petCount, 0),
    currentStreak,
    bestStreak: Math.max(num(saved.bestStreak, 0), currentStreak),
    lastActiveDay,
    symptomLogs: Array.isArray(saved.symptomLogs) ? saved.symptomLogs : [],
    inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
    equipped: saved.equipped && typeof saved.equipped === 'object' ? saved.equipped : {},
    customQuestTypes: Array.isArray(saved.customQuestTypes) ? saved.customQuestTypes : [],
    lastLogin,
    isNapping: !!saved.isNapping,
    daily,
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

export function advanceQuest(state: UserState, id: string, now: Date, increment = 1): ActionResult {
  const current = rollOverDay(state, now);
  const quest = current.quests.find(q => q.id === id);
  if (!quest || quest.completed) return { state: current };

  const progress = Math.min(quest.target, quest.progress + increment);
  const completed = progress === quest.target;
  const steps = progress - quest.progress;

  let growth = (REWARDS.questGrowth / quest.target) * steps;
  let scales = 0;
  // Only the built-in Vitality quest pays the medication bonus. A custom
  // quest's category is cosmetic, so custom quests always earn standard rewards.
  if (quest.type === 'medication' && !quest.isCustom && completed) {
    growth = REWARDS.medication.growth;
    scales = REWARDS.medication.scales;
  }

  let withQuest: UserState = {
    ...current,
    quests: current.quests.map(q => (q.id === id ? { ...q, progress, completed } : q)),
  };

  // Custom quests share a daily growth allowance. A step that would exceed it
  // gets only what's left; energy and streak credit are never reduced.
  let message: string | undefined;
  if (quest.isCustom) {
    const daily = dailyFor(current, now);
    const remaining = Math.max(0, DAILY_LIMITS.customQuestGrowth - daily.customQuestGrowth);
    const granted = Math.min(growth, remaining);
    if (granted < growth) {
      message = "You've earned today's growth from custom quests. They still count for energy and your streak!";
    }
    growth = granted;
    withQuest = { ...withQuest, daily: { ...daily, customQuestGrowth: roundGrowth(daily.customQuestGrowth + granted) } };
  }

  const result: ActionResult = {
    state: grantRewards(withQuest, { energy: (quest.points / quest.target) * steps, growth, scales }),
    message,
  };
  return completed ? withStreakCredit(result, now) : result;
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
  const daily = dailyFor(current, now);
  const withQuest = {
    ...current,
    quests: current.quests.map(q => (q.type === 'focus' ? { ...q, progress: q.target, completed: true } : q)),
  };

  if (daily.focusRewards >= DAILY_LIMITS.focusRewards) {
    return withStreakCredit({
      state: { ...withQuest, daily, isNapping: false },
      message: "Great focus! You've earned all of today's focus growth. Ember is proud of you.",
    }, now);
  }
  return withStreakCredit({
    state: grantRewards({ ...withQuest, daily: { ...daily, focusRewards: daily.focusRewards + 1 } }, REWARDS.focus),
  }, now);
}

/** Logs today's check-in. A second check-in on the same day updates the log without extra rewards. */
export function logCheckIn(state: UserState, energy: number, mood: number, now: Date): ActionResult {
  const current = rollOverDay(state, now);
  const daily = dailyFor(current, now);
  const log: SymptomLog = { date: now.toISOString(), energy, mood };

  const todayIndex = current.symptomLogs.map(l => dayKey(new Date(l.date))).lastIndexOf(dayKey(now));
  if (daily.checkInRewarded && todayIndex !== -1) {
    const symptomLogs = current.symptomLogs.map((l, i) => (i === todayIndex ? { ...l, ...log } : l));
    return { state: { ...current, symptomLogs, daily }, message: "Updated today's check-in." };
  }

  const withLog = {
    ...current,
    symptomLogs: [...current.symptomLogs, log],
    quests: current.quests.map(q => (q.type === 'symptom' ? { ...q, progress: q.target, completed: true } : q)),
    daily: { ...daily, checkInRewarded: true },
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
      (badge.id === 'badge_streak_3' && state.bestStreak >= 3) ||
      (badge.id === 'badge_streak_7' && state.bestStreak >= 7);
    // TODO: badge_focus_5 needs a lifetime focus counter (Phase 2).
    if (!unlocked) return badge;
    changed = true;
    return { ...badge, unlockedAt: now.toISOString() };
  });
  return changed ? { ...state, badges } : state;
}

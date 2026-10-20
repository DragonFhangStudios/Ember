import { DragonStage, DailyRewards, Quest, SymptomLog, UserState } from '../types';
import { INITIAL_QUESTS, BADGES } from '../constants';

// Ember's progression rules, kept pure so they can be unit tested.
// Philosophy: growth is permanent. Missing days may break a streak or make
// Ember nap, but never takes away growth, stages, or earned rewards.

export const SAVE_VERSION = 3;
export const MAX_GROWTH = 100;

// Minimum growth required for each stage, highest first.
export const STAGE_THRESHOLDS: ReadonlyArray<readonly [DragonStage, number]> = [
  [DragonStage.ANCIENT, 91],
  [DragonStage.DRAKE, 66],
  [DragonStage.FLEDGLING, 41],
  [DragonStage.HATCHLING, 21],
  [DragonStage.EGG, 0],
];

export const DAILY_LIMITS = {
  feeds: 3,
  focusRewards: 3,
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

export function stageForGrowth(growth: number): DragonStage {
  return STAGE_THRESHOLDS.find(([, min]) => growth >= min)![0];
}

export function stageThreshold(stage: DragonStage): number {
  return STAGE_THRESHOLDS.find(([s]) => s === stage)?.[1] ?? 0;
}

export function freshDaily(date: string): DailyRewards {
  return { date, feeds: 0, focusRewards: 0, checkInRewarded: false };
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

  const currentStreak = num(saved.currentStreak, 0);
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

  const completedAll = state.quests.every(q => q.completed);
  const currentStreak = daysAway === 1 && completedAll ? state.currentStreak + 1 : 0;

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
  if (quest.type === 'medication' && completed) {
    growth = REWARDS.medication.growth;
    scales = REWARDS.medication.scales;
  }

  const withQuest = {
    ...current,
    quests: current.quests.map(q => (q.id === id ? { ...q, progress, completed } : q)),
  };
  return {
    state: grantRewards(withQuest, { energy: (quest.points / quest.target) * steps, growth, scales }),
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
  const daily = dailyFor(current, now);
  const withQuest = {
    ...current,
    quests: current.quests.map(q => (q.type === 'focus' ? { ...q, progress: q.target, completed: true } : q)),
  };

  if (daily.focusRewards >= DAILY_LIMITS.focusRewards) {
    return {
      state: { ...withQuest, daily, isNapping: false },
      message: "Great focus! You've earned all of today's focus growth. Ember is proud of you.",
    };
  }
  return {
    state: grantRewards({ ...withQuest, daily: { ...daily, focusRewards: daily.focusRewards + 1 } }, REWARDS.focus),
  };
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
  return { state: daily.checkInRewarded ? { ...withLog, isNapping: false } : grantRewards(withLog, REWARDS.checkIn) };
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

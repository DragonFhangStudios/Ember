import type { ThemePreference } from './lib/theme';

export enum DragonStage {
  EGG = 'Egg',
  HATCHLING = 'Hatchling',
  FLEDGLING = 'Fledgling',
  DRAKE = 'Drake',
  ANCIENT = 'Ancient'
}

export type QuestType = 'routine' | 'medication' | 'focus' | 'symptom' | 'custom' | string;

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  completed: boolean;
  points: number;
  isDaily: boolean;
  isCustom?: boolean;
  progress: number;
  target: number;
}

export interface SymptomLog {
  date: string;
  energy: number; // 1-5
  mood: number; // 1-5
  /** Optional private note (plain text, bounded; see CHECK_IN_NOTE_MAX). Stays in the local save. */
  notes?: string;
}

export interface CosmeticItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: 'hat' | 'scarf' | 'nest';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
}

export interface CustomQuestType {
  id: string;
  label: string;
  icon: string;
  color: string;
}

/** What a quest's steps have already been worth today (before any daily cap). */
export interface QuestReward {
  energy: number;
  growth: number;
  scales: number;
}

/** Per-calendar-day reward bookkeeping. Resets when the day rolls over. */
export interface DailyRewards {
  date: string; // Date.toDateString() of the day these counters belong to
  feeds: number; // rewarded feeds (hatched dragon only)
  focusRewards: number; // focus sessions that granted energy/growth
  checkInRewarded: boolean;
  meaningfulActivity: boolean; // today already counted toward the streak
  customQuestGrowth: number; // growth earned today from custom quests (capped)
  customQuestEnergy: number; // energy earned today from custom quests (capped)
  /**
   * Per quest id: the most its progress has been worth today. A step pays only
   * what goes beyond this, so undoing and redoing (or editing) never pays twice.
   * Entries outlive a deleted quest until the day rolls over.
   */
  questRewards: Record<string, QuestReward>;
  /** Quests completed today by a focus session or check-in (not correctable). */
  autoCompletedQuests: string[];
  /**
   * Today's once-a-day care is done: petting (or cleaning the egg), incubating.
   * False on every day that starts fresh; absent only on a day that began
   * before these flags existed, which falls back to the stored care time (#42).
   */
  petted?: boolean;
  incubated?: boolean;
}

/**
 * "At least `floor` active days happened strictly before `before`" (ISO date).
 * Created when migrating saves from before active-day tracking.
 */
export interface LegacyActiveDayCredit {
  floor: number;
  before: string;
}

/** Lifetime active days, shaped to merge safely across devices (set union + lower-bound claims). */
export interface ActivityLog {
  days: string[]; // sorted unique ISO local dates (YYYY-MM-DD) with a meaningful activity
  legacy: LegacyActiveDayCredit[];
}

/** Bond contributions per source (device id or 'legacy'). Total Bond is the sum. */
export type BondLedger = Record<string, number>;

/**
 * The one shared focus session (all tabs see the same one). Only state
 * transitions are persisted; the countdown is derived from `endsAt`.
 */
export interface FocusSession {
  id: string; // unique per session, never reused
  status: 'running' | 'paused' | 'finished';
  durationMs: number;
  remainingMs: number; // authoritative while paused; derived from endsAt while running
  endsAt: number | null; // epoch ms, only while running
  completedAt?: number; // epoch ms the session actually ended
}

export interface UserState {
  version?: number;
  dragonName: string;
  stage: DragonStage;
  energy: number;
  goldenScales: number;
  bond: BondLedger; // permanent, uncapped; growth rewards add to this device's entry
  activity: ActivityLog; // drives evolution
  deviceId?: string; // this install's ledger key; assigned at load, never trusted from a save
  lastLogin: string;
  isNapping: boolean;
  quests: Quest[];
  symptomLogs: SymptomLog[];
  inventory: string[]; // IDs of owned cosmetics
  equipped: {
    hat?: string;
    scarf?: string;
    nest?: string;
  };
  badges: Badge[];
  petCount: number;
  lastPetAt?: string;
  lastIncubateAt?: string;
  customQuestTypes: CustomQuestType[];
  currentStreak: number;
  bestStreak: number;
  lastActiveDay?: string; // Date.toDateString() of the last day that counted toward the streak
  themeColor?: string;
  /** Light/dark preference; 'system' follows the device (see lib/theme.ts). Replaced isDarkMode in v8. */
  theme: ThemePreference;
  daily: DailyRewards;
  focus: FocusSession | null;
  completedFocusSessions: string[]; // ids already rewarded (bounded; see progression.ts)
  focusSessionsCompleted: number; // lifetime count, never lowered (Zen Master); not bounded like the ids
  /**
   * The highest stage whose evolution reveal the player has seen (see
   * lib/milestones.ts). A later stage waits as a pending reveal until viewed.
   * Saves from before reveals don't have it: every stage they reached counts
   * as seen, so upgrading or importing one never announces old evolutions.
   */
  stageSeen?: DragonStage;
  /** The local day (YYYY-MM-DD) each stage was reached, when known (recorded from reveals on). */
  stageReachedOn?: Partial<Record<DragonStage, string>>;
}

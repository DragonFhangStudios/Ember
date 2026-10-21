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

/** Per-calendar-day reward bookkeeping. Resets when the day rolls over. */
export interface DailyRewards {
  date: string; // Date.toDateString() of the day these counters belong to
  feeds: number; // rewarded feeds (hatched dragon only)
  focusRewards: number; // focus sessions that granted energy/growth
  checkInRewarded: boolean;
  meaningfulActivity: boolean; // today already counted toward the streak
  customQuestGrowth: number; // growth earned today from custom quests (capped)
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
}

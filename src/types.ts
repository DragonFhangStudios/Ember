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

export interface UserState {
  version?: number;
  dragonName: string;
  stage: DragonStage;
  energy: number;
  goldenScales: number;
  growthProgress: number; // 0-100
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
  isDarkMode?: boolean;
  daily: DailyRewards;
}

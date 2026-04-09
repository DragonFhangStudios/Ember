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

export interface UserState {
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
  themeColor?: string;
  isDarkMode?: boolean;
}

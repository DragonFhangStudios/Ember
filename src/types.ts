export enum DragonStage {
  EGG = 'Egg',
  HATCHLING = 'Hatchling',
  TEEN = 'Teen',
  ADULT = 'Adult',
  ELDER = 'Elder'
}

export type QuestType = 'routine' | 'medication' | 'focus' | 'symptom' | 'custom';

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  completed: boolean;
  points: number;
  isDaily: boolean;
  isCustom?: boolean;
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
}

import { DragonStage, Quest, CosmeticItem, Badge } from './types';

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'q1',
    title: 'Morning Routine',
    description: 'Get out of bed and drink a glass of water.',
    type: 'routine',
    completed: false,
    points: 10,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q2',
    title: 'Daily Vitality',
    description: 'Log your daily health routine or medication.',
    type: 'medication',
    completed: false,
    points: 25,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q3',
    title: 'Focus Meditation',
    description: 'Complete a 10-minute focus quest with Ember.',
    type: 'focus',
    completed: false,
    points: 15,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q4',
    title: 'Symptom Check-in',
    description: 'How are you feeling today?',
    type: 'symptom',
    completed: false,
    points: 5,
    isDaily: true,
    progress: 0,
    target: 1,
  },
  {
    id: 'q5',
    title: 'Hydration Goal',
    description: 'Drink 4 glasses of water throughout the day.',
    type: 'routine',
    completed: false,
    points: 20,
    isDaily: true,
    progress: 0,
    target: 4,
  }
];

export const COSMETICS: CosmeticItem[] = [
  { id: 'hat_wizard', name: 'Tiny Wizard Hat', price: 50, category: 'hat', image: 'https://picsum.photos/seed/wizard-hat/100/100' },
  { id: 'hat_crown', name: 'Golden Crown', price: 150, category: 'hat', image: 'https://picsum.photos/seed/crown/100/100' },
  { id: 'scarf_red', name: 'Red Cozy Scarf', price: 30, category: 'scarf', image: 'https://picsum.photos/seed/red-scarf/100/100' },
  { id: 'nest_moss', name: 'Soft Moss Nest', price: 100, category: 'nest', image: 'https://picsum.photos/seed/moss-nest/100/100' },
  { id: 'nest_cloud', name: 'Cloud Bed', price: 200, category: 'nest', image: 'https://picsum.photos/seed/cloud-bed/100/100' },
];

export const BADGES: Badge[] = [
  { id: 'badge_hatch', name: 'First Hatch', description: 'Your dragon egg has hatched!', icon: '🥚' },
  { id: 'badge_streak_3', name: 'Consistent Companion', description: 'Complete all daily quests for 3 days in a row.', icon: '✨' },
  { id: 'badge_streak_7', name: 'Week Warrior', description: 'Complete all daily quests for 7 days in a row.', icon: '🔥' },
  { id: 'badge_pet_10', name: 'Dragon Bonder', description: 'Pet your dragon 10 times.', icon: '❤️' },
  { id: 'badge_focus_5', name: 'Zen Master', description: 'Complete 5 focus quests.', icon: '🧘' },
];

export const DRAGON_STAGES_DATA = {
  [DragonStage.EGG]: {
    minProgress: 0,
    maxProgress: 20,
    description: 'A glowing egg, warm to the touch.',
    image: 'https://picsum.photos/seed/dragon-egg/400/400'
  },
  [DragonStage.HATCHLING]: {
    minProgress: 21,
    maxProgress: 40,
    description: 'A tiny, curious hatchling with soft scales.',
    image: 'https://picsum.photos/seed/dragon-hatchling/400/400'
  },
  [DragonStage.TEEN]: {
    minProgress: 41,
    maxProgress: 65,
    description: 'A playful teen dragon, full of energy.',
    image: 'https://picsum.photos/seed/dragon-teen/400/400'
  },
  [DragonStage.ADULT]: {
    minProgress: 66,
    maxProgress: 90,
    description: 'A majestic adult dragon, wise and strong.',
    image: 'https://picsum.photos/seed/dragon-adult/400/400'
  },
  [DragonStage.ELDER]: {
    minProgress: 91,
    maxProgress: 100,
    description: 'A legendary elder dragon, guardian of wellness.',
    image: 'https://picsum.photos/seed/dragon-elder/400/400'
  }
};

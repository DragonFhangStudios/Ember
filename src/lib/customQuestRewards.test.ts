import { describe, expect, it } from 'vitest';
import { Quest, UserState } from '../types';
import { REWARDS, advanceQuest, createInitialState, migrateState, rollOverDay, stageForGrowth } from './progression';

// #10: custom quests use standard rewards regardless of their category.

const day = (d: number, hour = 10) => new Date(2026, 9, d, hour);

const vitality = (id: string, overrides: Partial<Quest> = {}): Quest => ({
  id, title: id, description: '', type: 'medication', completed: false,
  points: 10, isDaily: true, isCustom: true, progress: 0, target: 1, ...overrides,
});

function hatchedWith(quests: Quest[]): UserState {
  const base = createInitialState(day(20));
  return { ...base, growthProgress: 30, stage: stageForGrowth(30), quests: [...base.quests, ...quests] };
}

describe('custom quest rewards ignore category', () => {
  it('a custom Vitality quest grants standard energy and growth and no Golden Scales', () => {
    const { state } = advanceQuest(hatchedWith([vitality('v')]), 'v', day(20));
    expect(state.goldenScales).toBe(0);
    expect(state.growthProgress).toBe(30 + REWARDS.questGrowth);
    expect(state.energy).toBe(50 + 10);
  });

  it('many custom Vitality quests cannot farm Golden Scales', () => {
    const quests = Array.from({ length: 25 }, (_, i) => vitality(`v${i}`));
    let state = hatchedWith(quests);
    for (const q of quests) state = advanceQuest(state, q.id, day(20)).state;
    expect(state.goldenScales).toBe(0);
    expect(state.quests.filter(q => q.isCustom).every(q => q.completed)).toBe(true);
  });

  it('a multi-step custom Vitality quest earns standard per-step growth, with no completion bonus', () => {
    let state = hatchedWith([vitality('v', { target: 2 })]);
    state = advanceQuest(state, 'v', day(20)).state;
    state = advanceQuest(state, 'v', day(20)).state;
    expect(state.growthProgress).toBe(30 + REWARDS.questGrowth);
    expect(state.goldenScales).toBe(0);
  });

  it('the built-in Daily Vitality quest still grants its bonus', () => {
    const { state } = advanceQuest(hatchedWith([]), 'q2', day(20));
    expect(state.goldenScales).toBe(REWARDS.medication.scales);
    expect(state.growthProgress).toBe(30 + REWARDS.medication.growth);
  });

  it('custom Vitality quests still count toward the streak', () => {
    expect(advanceQuest(hatchedWith([vitality('v')]), 'v', day(20)).state.currentStreak).toBe(1);
  });
});

describe('upgrading keeps everything already earned', () => {
  it('scales, purchases, and equipped items from before the fix are untouched', () => {
    const save: UserState = {
      ...hatchedWith([vitality('v', { progress: 1, completed: true })]),
      goldenScales: 340,
      inventory: ['hat_crown', 'nest_cloud'],
      equipped: { hat: 'hat_crown' },
    };
    const loaded = rollOverDay(migrateState(JSON.parse(JSON.stringify(save)), day(20, 15)), day(20, 15));
    expect(loaded.goldenScales).toBe(340);
    expect(loaded.inventory).toEqual(['hat_crown', 'nest_cloud']);
    expect(loaded.equipped).toEqual({ hat: 'hat_crown' });
    // Next day, the same custom Vitality quest pays standard rewards only.
    const next = advanceQuest(rollOverDay(loaded, day(21)), 'v', day(21)).state;
    expect(next.goldenScales).toBe(340);
  });
});

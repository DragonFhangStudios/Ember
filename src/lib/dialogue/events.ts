// Which moment Ember reacts to (#18): derived from the save before and after
// an action, so dialogue never changes progression or rewards.

import { DragonStage, UserState } from '../../types';
import { DAILY_LIMITS, daysBetween } from '../progression';
import { bondLevel, bondTotal } from '../evolution';
import { DialogueContext } from './library';
import { timeOfDay } from './select';

/** What the player just did, for moments the save alone can't tell apart. */
export type Intent = 'open' | 'quest' | 'pet' | 'feed' | 'checkIn' | 'focusStart' | 'focusPause';

export interface Moment {
  context: DialogueContext;
  level?: number;
}

/** Days away at or beyond this count as a long time (a gentler, sleepier hello). */
export const LONG_AWAY_DAYS = 14;
const HYDRATION_QUEST = 'q5';

const STAGE_ORDER = [DragonStage.EGG, DragonStage.HATCHLING, DragonStage.FLEDGLING, DragonStage.DRAKE, DragonStage.ANCIENT];

const sameDay = (iso: string, now: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
};

/** Today's check-in (the latest one), if any. */
export const todaysCheckIn = (state: UserState, now: Date) =>
  [...state.symptomLogs].reverse().find(log => sameDay(log.date, now));

/** A hard day: today's check-in mood was low (1–2 of 5). Ember stays gentle. */
export const isSoftDay = (state: UserState, now: Date) => (todaysCheckIn(state, now)?.mood ?? 3) <= 2;

const dailyQuests = (state: UserState) => state.quests.filter(q => q.isDaily);

/**
 * The moment to react to after an action, most significant first, or null.
 * `awayDays` is how long the player was away when the app opened.
 */
export function momentFor(before: UserState, after: UserState, intent: Intent | undefined, now: Date, awayDays: number): Moment | null {
  if (STAGE_ORDER.indexOf(after.stage) > STAGE_ORDER.indexOf(before.stage)) return { context: 'evolution' };

  const levelBefore = bondLevel(bondTotal(before.bond)).level;
  const levelAfter = bondLevel(bondTotal(after.bond)).level;
  if (levelAfter > levelBefore) return { context: 'bond.levelUp', level: levelAfter };

  // A focus session that just completed (rewarded once, in any tab).
  if (after.completedFocusSessions.length > before.completedFocusSessions.length) {
    const rewarded = after.daily.date !== before.daily.date || after.daily.focusRewards > before.daily.focusRewards;
    if (!rewarded && after.daily.focusRewards >= DAILY_LIMITS.focusRewards) return { context: 'focus.bondComplete' };
    return { context: intent === 'open' ? 'focus.finishedAway' : 'focus.finished' };
  }

  if (before.isNapping && !after.isNapping) {
    return { context: awayDays >= LONG_AWAY_DAYS ? 'return.longAway' : 'return.wake' };
  }

  switch (intent) {
    case 'quest': {
      const completed = after.quests.find(q => q.completed && !before.quests.find(b => b.id === q.id)?.completed);
      const progressed = after.quests.find(q => q.progress > (before.quests.find(b => b.id === q.id)?.progress ?? 0));
      if (completed) {
        if (dailyQuests(after).every(q => q.completed)) return { context: 'quest.allDone' };
        if (!dailyQuests(before).some(q => q.completed)) return { context: 'quest.first' };
        if (completed.id === HYDRATION_QUEST) return { context: 'quest.hydration' };
        return { context: 'quest.more' };
      }
      if (progressed?.id === HYDRATION_QUEST) return { context: 'quest.hydration' };
      return progressed ? { context: 'quest.more' } : null;
    }
    case 'checkIn': {
      const log = todaysCheckIn(after, now);
      if (!log) return null;
      if (todaysCheckIn(before, now)) return { context: 'checkIn.updated' };
      return { context: log.mood >= 4 ? 'checkIn.good' : log.mood === 3 ? 'checkIn.middle' : 'checkIn.low' };
    }
    case 'pet':
      return { context: after.petCount > before.petCount ? 'care.pet' : 'care.alreadyPetted' };
    case 'feed':
      if (after.stage === DragonStage.EGG) return after.lastIncubateAt !== before.lastIncubateAt ? { context: 'care.incubate' } : null;
      return { context: after.daily.feeds > before.daily.feeds || after.daily.date !== before.daily.date ? 'care.feed' : 'care.full' };
    case 'focusStart':
      return after.focus?.status === 'running' && before.focus?.status !== 'running' ? { context: 'focus.start' } : null;
    case 'focusPause':
      return after.focus?.status === 'paused' && before.focus?.status === 'running' ? { context: 'focus.paused' } : null;
    default:
      return null;
  }
}

/** Days between the save's last visit and now (0 = earlier today). */
export const daysAway = (state: UserState, now: Date) => Math.max(0, daysBetween(state.lastLogin, now));

/** What Ember says when the app opens: napping, welcome back, or a greeting for the time of day. */
export function openingMoment(settled: UserState, awayDays: number, now: Date): Moment {
  if (settled.isNapping) return { context: 'return.napping' };
  if (awayDays === 1) return { context: 'return.oneDay' };
  const time = timeOfDay(now);
  return { context: `greeting.${time}` as DialogueContext };
}

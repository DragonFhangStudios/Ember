import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import { CheckCircle2, Circle, MoreVertical, Pill, Timer, Sun, Heart, Sparkles } from 'lucide-react';
import { Quest, QuestType, CustomQuestType } from '../types';
import { cn } from '../lib/utils';
import type { NextStepReward } from '../lib/progression';
import { chipClasses } from '../lib/questColors';

interface QuestItemProps {
  quest: Quest;
  onToggle: (id: string) => void;
  /** Opens the quest's options (correct a tap, edit, delete); omitted when it has none. */
  onOptions?: (id: string) => void;
  /** For custom quests: the id of the note on their shared daily energy limit. */
  rewardNoteId?: string;
  /** What tapping this quest once more would pay right now (see nextStepReward). */
  next?: NextStepReward;
  customQuestTypes?: CustomQuestType[];
  key?: string | number;
}

const TYPE_ICONS: Record<string, any> = {
  routine: Sun,
  medication: Pill,
  focus: Timer,
  symptom: Heart,
  custom: Sparkles,
};

const TYPE_COLORS: Record<string, string> = {
  routine: 'text-blue-500 bg-blue-50',
  medication: 'text-dragon-gold bg-dragon-gold/10',
  focus: 'text-dragon-ember bg-dragon-ember/10',
  symptom: 'text-rose-500 bg-rose-50',
  custom: 'text-purple-500 bg-purple-50',
};

export function QuestItem({ quest, onToggle, onOptions, rewardNoteId, next, customQuestTypes = [] }: QuestItemProps) {
  const customType = customQuestTypes.find(t => t.id === quest.type);
  
  const IconComponent = customType 
    ? (LucideIcons[customType.icon as keyof typeof LucideIcons] as any) || Sparkles
    : TYPE_ICONS[quest.type] || Sparkles;

  const perStepEnergy = Math.round(quest.points / quest.target);
  // A quest still to do promises only what its next step really pays (the same calculation as the
  // tap itself). A done custom quest shows no amount: it may have been done after the allowance ran out.
  const showReward = !(quest.isCustom && quest.completed);
  const rewardWord = quest.completed || !next ? null
    : next.alreadyRewarded ? 'Already rewarded'
    : !quest.isCustom || next.energy > 0 ? null
    : next.growth > 0 ? 'Bond only'
    : next.countsForStreak ? 'Streak only'
    : 'Daily max reached';
  const energyShown = quest.isCustom ? (quest.completed || !next ? perStepEnergy : next.energy) : quest.points;

  const colorClass = customType 
    ? customType.color 
    : (TYPE_COLORS[quest.type] || TYPE_COLORS.custom);

  const isMultiStep = quest.target > 1;
  const progressPercent = (quest.progress / quest.target) * 100;

  // The row is a real button (Enter and Space work natively), with an
  // optional options button beside it; nothing interactive is nested.
  return (
    <div
      className={cn(
        "group flex items-stretch rounded-2xl border transition-all",
        quest.completed
          ? "bg-surface/60 border-transparent"
          : "bg-surface border-line shadow-sm hover:shadow-md hover:border-dragon-gold/30"
      )}
    >
      <motion.button
        type="button"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => onToggle(quest.id)}
        aria-describedby={quest.isCustom ? rewardNoteId : undefined}
        className="flex-1 min-w-0 flex items-center gap-3 sm:gap-4 p-4 rounded-2xl text-left cursor-pointer"
      >
        <span className={cn("p-3 rounded-xl flex-shrink-0 transition-colors", chipClasses(colorClass), quest.completed && "opacity-60")}>
          <IconComponent className="w-5 h-5" />
        </span>

        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2">
            <span className={cn("font-bold break-words", quest.completed ? "text-fg-muted line-through" : "text-fg")}>
              {quest.title}
            </span>
            {isMultiStep && !quest.completed && (
              <span className="text-xs font-bold bg-fg/5 px-1.5 py-0.5 rounded text-fg-muted">
                {quest.progress}/{quest.target}
              </span>
            )}
            {quest.completed && <span className="sr-only">(done)</span>}
          </span>
          <span className="block text-xs text-fg-muted break-words">{quest.description}</span>

          {isMultiStep && !quest.completed && (
            <span className="block mt-2 w-full bg-fg/5 h-1 rounded-full overflow-hidden">
              <motion.span
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                className="block h-full bg-dragon-gold"
              />
            </span>
          )}
        </span>

        <span className="flex flex-col items-end gap-1 flex-shrink-0">
          {showReward && (
            <span className="flex items-center gap-1 text-gold-fg font-bold text-sm" data-reward>
              {rewardWord ? (
                <span className="text-xs">{rewardWord}</span>
              ) : (
                <>
                  <span>
                    +{energyShown}
                    {quest.isCustom && isMultiStep && energyShown === perStepEnergy && <span className="text-xs">/step</span>}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-dragon-gold" />
                </>
              )}
            </span>
          )}
          {quest.completed ? (
            <CheckCircle2 className="w-6 h-6 text-dragon-gold" />
          ) : (
            <Circle className="w-6 h-6 text-dragon-gold/30 group-hover:text-dragon-gold/60" />
          )}
        </span>
      </motion.button>
      {onOptions && (
        <button
          type="button"
          onClick={() => onOptions(quest.id)}
          aria-label={`Options for ${quest.title}`}
          title="Options"
          className="w-11 flex-shrink-0 -ml-2 mr-1 flex items-center justify-center rounded-xl text-fg-muted hover:text-fg"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

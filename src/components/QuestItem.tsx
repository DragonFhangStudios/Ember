import { motion } from 'motion/react';
import * as LucideIcons from 'lucide-react';
import { CheckCircle2, Circle, Pill, Timer, Sun, Heart, Sparkles } from 'lucide-react';
import { Quest, QuestType, CustomQuestType } from '../types';
import { cn } from '../lib/utils';

interface QuestItemProps {
  quest: Quest;
  onToggle: (id: string) => void;
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

export function QuestItem({ quest, onToggle, customQuestTypes = [] }: QuestItemProps) {
  const customType = customQuestTypes.find(t => t.id === quest.type);
  
  const IconComponent = customType 
    ? (LucideIcons[customType.icon as keyof typeof LucideIcons] as any) || Sparkles
    : TYPE_ICONS[quest.type] || Sparkles;

  const colorClass = customType 
    ? customType.color 
    : (TYPE_COLORS[quest.type] || TYPE_COLORS.custom);

  const isMultiStep = quest.target > 1;
  const progressPercent = (quest.progress / quest.target) * 100;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onToggle(quest.id)}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
        quest.completed 
          ? "bg-[var(--card-bg)]/50 border-transparent opacity-60" 
          : "bg-[var(--card-bg)] border-[var(--border-color)] shadow-sm hover:shadow-md hover:border-dragon-gold/30"
      )}
    >
      <div className={cn("p-3 rounded-xl transition-colors", colorClass)}>
        <IconComponent className="w-5 h-5" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className={cn("font-bold text-[var(--text-primary)]", quest.completed && "line-through")}>
            {quest.title}
          </h3>
          {isMultiStep && !quest.completed && (
            <span className="text-[10px] font-bold bg-dragon-warm/20 px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
              {quest.progress}/{quest.target}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{quest.description}</p>
        
        {isMultiStep && !quest.completed && (
          <div className="mt-2 w-full bg-dragon-warm/20 h-1 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className="h-full bg-dragon-gold"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1 text-dragon-gold font-bold text-sm">
          <span>+{quest.points}</span>
          <div className="w-2 h-2 rounded-full bg-dragon-gold" />
        </div>
        {quest.completed ? (
          <CheckCircle2 className="w-6 h-6 text-dragon-gold" />
        ) : (
          <Circle className="w-6 h-6 text-dragon-gold/30 group-hover:text-dragon-gold/60" />
        )}
      </div>
    </motion.div>
  );
}

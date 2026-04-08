import { motion } from 'motion/react';
import { CheckCircle2, Circle, Pill, Timer, Sun, Heart, Sparkles } from 'lucide-react';
import { Quest, QuestType } from '../types';
import { cn } from '../lib/utils';

interface QuestItemProps {
  quest: Quest;
  onToggle: (id: string) => void;
  key?: string | number;
}

const TYPE_ICONS: Record<QuestType, any> = {
  routine: Sun,
  medication: Pill,
  focus: Timer,
  symptom: Heart,
  custom: Sparkles,
};

const TYPE_COLORS: Record<QuestType, string> = {
  routine: 'text-blue-500 bg-blue-50',
  medication: 'text-dragon-gold bg-dragon-gold/10',
  focus: 'text-dragon-ember bg-dragon-ember/10',
  symptom: 'text-rose-500 bg-rose-50',
  custom: 'text-purple-500 bg-purple-50',
};

export function QuestItem({ quest, onToggle }: QuestItemProps) {
  const Icon = TYPE_ICONS[quest.type];

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onToggle(quest.id)}
      className={cn(
        "group flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
        quest.completed 
          ? "bg-white/50 border-transparent opacity-60" 
          : "bg-white border-dragon-gold/10 shadow-sm hover:shadow-md hover:border-dragon-gold/30"
      )}
    >
      <div className={cn("p-3 rounded-xl transition-colors", TYPE_COLORS[quest.type])}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1">
        <h3 className={cn("font-bold text-dragon-ink", quest.completed && "line-through")}>
          {quest.title}
        </h3>
        <p className="text-xs text-dragon-muted">{quest.description}</p>
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

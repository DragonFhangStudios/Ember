import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Trophy, Lock } from 'lucide-react';
import { Badge } from '../types';
import { cn } from '../lib/utils';

interface BadgesProps {
  badges: Badge[];
  /** Shown under the heading, above the badges (the dragon's journey). */
  children?: ReactNode;
}

export function Badges({ badges, children }: BadgesProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-gold-fg mb-6">
        <Trophy className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Milestones</h2>
      </div>

      {children}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {badges.map((badge) => {
          const isUnlocked = !!badge.unlockedAt;

          return (
            <motion.div
              key={badge.id}
              whileHover={isUnlocked ? { scale: 1.05 } : {}}
              className={cn(
                "flex flex-col items-center text-center p-4 rounded-2xl transition-all",
                isUnlocked 
                  ? "bg-surface border border-dragon-gold/20 shadow-sm" 
                  : "bg-surface-muted border border-transparent"
              )}
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-3",
                isUnlocked ? "bg-dragon-gold/10" : "bg-dragon-muted/10 opacity-60 grayscale"
              )}>
                {isUnlocked ? badge.icon : <Lock className="w-6 h-6 text-fg-muted" />}
              </div>
              <h3 className={cn("text-xs font-bold mb-1", isUnlocked ? "text-fg" : "text-fg-muted")}>{badge.name}</h3>
              <p className="text-xs text-fg-muted leading-tight">{badge.description}</p>
              {isUnlocked && (
                <span className="mt-2 text-xs font-bold text-gold-fg uppercase tracking-widest">
                  Unlocked!
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

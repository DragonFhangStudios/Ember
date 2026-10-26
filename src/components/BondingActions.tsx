import { motion } from 'motion/react';
import { Heart, Utensils, Sparkles, Flame, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { DragonStage } from '../types';

interface BondingActionsProps {
  onPet: () => void;
  onFeed: () => void;
  /** Today's petting / incubation is done (see careDoneToday: the same day rule as the reward). */
  petDone: boolean;
  incubateDone: boolean;
  stage: DragonStage;
  feedsLeft: number;
}

export function BondingActions({ onPet, onFeed, petDone, incubateDone, stage, feedsLeft }: BondingActionsProps) {
  const isEgg = stage === DragonStage.EGG;
  const canPet = !petDone;
  const canIncubate = !incubateDone;
  const canFeed = isEgg ? canIncubate : feedsLeft > 0;

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <div className="flex flex-wrap gap-3 justify-center">
        <motion.button
          whileHover={canPet ? { scale: 1.05 } : {}}
          whileTap={canPet ? { scale: 0.95 } : {}}
          onClick={onPet}
          disabled={!canPet}
          className={cn(
            "min-h-12 flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-lg relative overflow-hidden",
            canPet 
              ? "bg-rose-solid text-white hover:bg-rose-solid/90 shadow-rose-500/20" 
              : "bg-surface-muted text-fg-muted cursor-not-allowed opacity-80"
          )}
        >
          {canPet ? (
            <Heart className={cn("w-5 h-5", "fill-white")} />
          ) : (
            <Clock className="w-5 h-5" />
          )}
          <span>{isEgg ? "Clean & Hydrate" : "Pet Ember"}</span>
        </motion.button>

        <motion.button
          whileHover={canFeed ? { scale: 1.05 } : {}}
          whileTap={canFeed ? { scale: 0.95 } : {}}
          onClick={onFeed}
          disabled={!canFeed}
          className={cn(
            "min-h-12 flex items-center gap-2 px-5 py-3 rounded-2xl font-bold transition-all shadow-lg",
            !canFeed
              ? "bg-surface-muted text-fg-muted cursor-not-allowed opacity-80"
              : isEgg
                ? "bg-ember-solid text-white hover:bg-ember-solid/90 shadow-dragon-ember/20"
                : "bg-dragon-gold text-dragon-ink hover:bg-dragon-gold/90 shadow-dragon-gold/20"
          )}
        >
          {!canFeed ? <Clock className="w-5 h-5" /> : isEgg ? <Flame className="w-5 h-5" /> : <Utensils className="w-5 h-5" />}
          {isEgg ? "Incubate" : "Feed Ember"}
        </motion.button>
      </div>
      
      {(!canPet || !canFeed) && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-center uppercase tracking-widest font-bold text-fg-muted"
        >
          Daily care complete! Ember is resting
        </motion.p>
      )}
    </div>
  );
}

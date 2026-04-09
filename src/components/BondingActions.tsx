import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, Utensils, Sparkles, Flame, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { DragonStage } from '../types';

interface BondingActionsProps {
  onPet: () => void;
  onFeed: () => void;
  lastPetAt?: string;
  lastIncubateAt?: string;
  stage: DragonStage;
}

export function BondingActions({ onPet, onFeed, lastPetAt, lastIncubateAt, stage }: BondingActionsProps) {
  const isEgg = stage === DragonStage.EGG;
  const [petTimeLeft, setPetTimeLeft] = useState(0);
  const [incubateTimeLeft, setIncubateTimeLeft] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = new Date().toDateString();
      
      if (lastPetAt) {
        const last = new Date(lastPetAt).toDateString();
        setPetTimeLeft(last === today ? 1 : 0);
      } else {
        setPetTimeLeft(0);
      }

      if (lastIncubateAt) {
        const last = new Date(lastIncubateAt).toDateString();
        setIncubateTimeLeft(last === today ? 1 : 0);
      } else {
        setIncubateTimeLeft(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastPetAt, lastIncubateAt]);

  const canPet = petTimeLeft === 0;
  const canIncubate = incubateTimeLeft === 0;

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <div className="flex gap-4 justify-center">
        <motion.button
          whileHover={canPet ? { scale: 1.05 } : {}}
          whileTap={canPet ? { scale: 0.95 } : {}}
          onClick={onPet}
          disabled={!canPet}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg relative overflow-hidden",
            canPet 
              ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20" 
              : "bg-dragon-warm text-dragon-muted cursor-not-allowed opacity-80"
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
          whileHover={canIncubate ? { scale: 1.05 } : {}}
          whileTap={canIncubate ? { scale: 0.95 } : {}}
          onClick={onFeed}
          disabled={isEgg && !canIncubate}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold transition-all shadow-lg",
            isEgg 
              ? (canIncubate ? "bg-dragon-ember hover:bg-dragon-ember/90 shadow-dragon-ember/20" : "bg-dragon-warm text-dragon-muted cursor-not-allowed opacity-80")
              : "bg-dragon-gold hover:bg-dragon-gold/90 shadow-dragon-gold/20"
          )}
        >
          {isEgg ? (canIncubate ? <Flame className="w-5 h-5" /> : <Clock className="w-5 h-5" />) : <Utensils className="w-5 h-5" />}
          {isEgg ? "Incubate" : "Feed Ember"}
        </motion.button>
      </div>
      
      {(!canPet || (isEgg && !canIncubate)) && (
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] uppercase tracking-widest font-bold text-dragon-muted"
        >
          Daily care complete! Ember is resting
        </motion.p>
      )}
    </div>
  );
}

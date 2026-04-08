import { motion } from 'motion/react';
import { Heart, Utensils, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

interface BondingActionsProps {
  onPet: () => void;
  onFeed: () => void;
  canPet: boolean;
}

export function BondingActions({ onPet, onFeed, canPet }: BondingActionsProps) {
  return (
    <div className="flex gap-4 justify-center mt-8">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPet}
        disabled={!canPet}
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all shadow-lg",
          canPet 
            ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20" 
            : "bg-dragon-warm text-dragon-muted cursor-not-allowed"
        )}
      >
        <Heart className={cn("w-5 h-5", canPet && "fill-white")} />
        Pet Ember
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onFeed}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-dragon-gold text-white font-bold hover:bg-dragon-gold/90 transition-all shadow-lg shadow-dragon-gold/20"
      >
        <Utensils className="w-5 h-5" />
        Feed Ember
      </motion.button>
    </div>
  );
}

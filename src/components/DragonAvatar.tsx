import { motion } from 'motion/react';
import { DragonStage } from '../types';
import { DRAGON_STAGES_DATA } from '../constants';
import { cn } from '../lib/utils';

interface DragonAvatarProps {
  stage: DragonStage;
  isNapping?: boolean;
  isMeditating?: boolean;
  className?: string;
  equipped?: {
    hat?: string;
    scarf?: string;
    nest?: string;
  };
}

export function DragonAvatar({ stage, isNapping, isMeditating, className, equipped }: DragonAvatarProps) {
  const stageData = DRAGON_STAGES_DATA[stage];

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <motion.div
        animate={{
          scale: isNapping ? 0.95 : 1,
          y: isNapping ? 5 : [0, -10, 0],
        }}
        transition={{
          duration: isNapping ? 3 : 4,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative"
      >
        {/* Nest */}
        {equipped?.nest && (
          <div className="absolute -bottom-4 -left-4 -right-4 h-12 bg-dragon-gold/20 rounded-full blur-xl -z-10" />
        )}

        <img
          src={stageData.image}
          alt={stage}
          className={cn(
            "w-48 h-48 rounded-full border-4 border-dragon-gold object-cover shadow-xl transition-all duration-1000",
            isNapping && "grayscale opacity-70",
            isMeditating && "ring-8 ring-dragon-ember/30"
          )}
          referrerPolicy="no-referrer"
        />

        {/* Hat */}
        {equipped?.hat && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full p-1 shadow-lg border border-dragon-gold/20"
          >
            <img 
              src={`https://picsum.photos/seed/${equipped.hat}/100/100`} 
              alt="Hat" 
              className="w-full h-full object-cover rounded-full"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}

        {/* Scarf */}
        {equipped?.scarf && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-8 bg-dragon-ember rounded-full shadow-md border border-white/20 flex items-center justify-center"
          >
            <span className="text-[8px] font-bold text-white uppercase tracking-widest">Equipped</span>
          </motion.div>
        )}
        
        {isNapping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-md"
          >
            <span className="text-xl font-bold text-dragon-muted">Zzz</span>
          </motion.div>
        )}

        {isMeditating && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full border-4 border-dragon-ember"
          />
        )}
      </motion.div>
      
      <div className="mt-6 text-center">
        <h2 className="serif text-3xl font-bold text-dragon-ink">{stage}</h2>
        <p className="text-sm text-dragon-muted italic mt-1">{stageData.description}</p>
      </div>
    </div>
  );
}

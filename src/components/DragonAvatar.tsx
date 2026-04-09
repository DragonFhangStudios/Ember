import { motion, AnimatePresence } from 'motion/react';
import { DragonStage } from '../types';
import { DRAGON_STAGES_DATA } from '../constants';
import { cn } from '../lib/utils';
import { Sparkles } from 'lucide-react';

interface DragonAvatarProps {
  stage: DragonStage;
  isNapping?: boolean;
  isMeditating?: boolean;
  isPetted?: boolean;
  isLevelingUp?: boolean;
  className?: string;
  equipped?: {
    hat?: string;
    scarf?: string;
    nest?: string;
  };
}

export function DragonAvatar({ stage, isNapping, isMeditating, isPetted, isLevelingUp, className, equipped }: DragonAvatarProps) {
  const stageData = DRAGON_STAGES_DATA[stage];
  const isEgg = stage === DragonStage.EGG;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      {/* Ambient Sparkles */}
      {!isNapping && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(isLevelingUp ? 20 : 6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0], 
                scale: isLevelingUp ? [0, 1.5, 0] : [0, 1, 0],
                x: isLevelingUp 
                  ? [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300] 
                  : [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 10), 0],
                y: isLevelingUp 
                  ? [0, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 300] 
                  : [0, -40 - i * 15, 0]
              }}
              transition={{
                duration: isLevelingUp ? 1.5 : 3 + i,
                repeat: isLevelingUp ? 0 : Infinity,
                delay: isLevelingUp ? Math.random() * 0.5 : i * 0.8,
                ease: "easeOut"
              }}
              className={cn(
                "absolute left-1/2 top-1/2 rounded-full blur-[1px]",
                isLevelingUp ? "w-2 h-2 bg-dragon-gold shadow-[0_0_10px_#D4AF37]" : "w-1.5 h-1.5 bg-dragon-gold"
              )}
            />
          ))}
        </div>
      )}

      {/* Level Up Text */}
      <AnimatePresence>
        {isLevelingUp && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.5 }}
            animate={{ opacity: 1, y: -100, scale: 1.5 }}
            exit={{ opacity: 0, scale: 2 }}
            className="absolute z-50 pointer-events-none"
          >
            <div className="bg-dragon-gold text-white px-6 py-2 rounded-full font-bold shadow-2xl border-2 border-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="serif tracking-widest uppercase">Growth Milestone!</span>
              <Sparkles className="w-5 h-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          scale: isNapping ? 0.95 : isLevelingUp ? [1, 1.2, 1] : [1, 1.02, 1],
          y: isNapping ? 5 : [0, -10, 0],
          rotate: isNapping ? 0 : isLevelingUp ? [0, 360] : isEgg ? [-1, 1, -1] : [-2, 2, -2],
        }}
        transition={{
          duration: isLevelingUp ? 1 : isNapping ? 3 : 4,
          repeat: isLevelingUp ? 0 : Infinity,
          ease: "easeInOut"
        }}
        className={cn(
          "relative transition-all duration-500",
          isPetted && "animate-heartbeat",
          isLevelingUp && "z-40"
        )}
      >
        {/* Glow effect when petted */}
        {isPetted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.5, 0], scale: [0.8, 1.2, 0.8] }}
            className="absolute inset-0 bg-dragon-ember/30 blur-2xl rounded-full -z-10"
          />
        )}

        {/* Nest */}
        {equipped?.nest && (
          <div className="absolute -bottom-4 -left-4 -right-4 h-12 bg-dragon-gold/20 rounded-full blur-xl -z-10" />
        )}

        <div className="relative">
          <img
            src={stageData.image}
            alt={stage}
            className={cn(
              "w-48 h-48 border-4 border-dragon-gold object-cover shadow-xl transition-all duration-1000",
              isEgg ? "rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%]" : "rounded-full",
              isNapping && "grayscale opacity-70",
              isMeditating && "ring-8 ring-dragon-ember/30"
            )}
            style={{
              boxShadow: isEgg 
                ? 'inset -10px -10px 30px rgba(0,0,0,0.5), inset 10px 10px 30px rgba(255,255,255,0.2), 0 10px 25px -5px rgba(0, 0, 0, 0.1)'
                : undefined
            }}
            referrerPolicy="no-referrer"
          />
          
          {/* Shimmer Overlay */}
          {!isNapping && (
            <motion.div
              animate={{
                opacity: [0, 0.2, 0],
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                repeatDelay: 5,
                ease: "linear"
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent pointer-events-none rounded-full"
            />
          )}
          
          {/* Inset shadow overlay for images that don't support inset shadow directly */}
          {isEgg && (
            <div 
              className="absolute inset-0 pointer-events-none rounded-[50%_50%_50%_50%_/_60%_60%_40%_40%]"
              style={{
                boxShadow: 'inset -10px -10px 30px rgba(0,0,0,0.5), inset 10px 10px 30px rgba(255,255,255,0.2)'
              }}
            />
          )}
        </div>

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

import { motion, AnimatePresence, TargetAndTransition } from 'motion/react';
import { DragonStage } from '../types';
import { COSMETICS, DRAGON_STAGES_DATA } from '../constants';
import { cn } from '../lib/utils';
import { usePrefersReducedMotion } from '../lib/useMediaQuery';
import { Sparkles } from 'lucide-react';
import { Celebration } from './Celebration';
import { Expression } from '../lib/dialogue/library';

/** A small, gentle reaction per expression (#18); badges stand in until original art (#20). */
const REACTIONS: Record<Expression, { badge: string; motion: TargetAndTransition }> = {
  affection: { badge: '💕', motion: { scale: [1, 1.06, 1] } },
  curiosity: { badge: '❔', motion: { rotate: [0, -6, 0] } },
  mischief: { badge: '😼', motion: { x: [0, -4, 4, -2, 0] } },
  celebration: { badge: '🎉', motion: { y: [0, -10, 0] } },
  focus: { badge: '🧘', motion: { scale: [1, 0.98, 1] } },
  sleepiness: { badge: '💤', motion: { y: [0, 4, 0] } },
  reassurance: { badge: '🤍', motion: { scale: [1, 1.03, 1] } },
  surprise: { badge: '❗', motion: { y: [0, -14, 0] } },
};

/** The keyboard Easter egg: typing away (Part A), then caught (Part B). */
export type Antic = 'typing' | 'busted';

/**
 * A tiny keyboard (temporary art; the final character art and animation come
 * from #20). Decorative: Ember's words describe the scene.
 */
function TinyKeyboard() {
  const keys = [0, 1, 2].flatMap(row =>
    Array.from({ length: 9 - row }, (_, i) => ({ x: 9 + row * 5 + i * 12, y: 10 + row * 9 })),
  );
  return (
    <svg viewBox="0 0 120 44" className="w-full h-auto drop-shadow-md" aria-hidden="true">
      <rect x="2" y="4" width="116" height="38" rx="7" fill="#2A2A2A" stroke="#D4AF37" strokeWidth="2" />
      {keys.map((k, i) => (
        <rect key={i} x={k.x} y={k.y} width="9" height="6" rx="1.5" fill="#F5F5F0" />
      ))}
      <rect x="30" y="34" width="60" height="5" rx="2" fill="#F5F5F0" />
    </svg>
  );
}

// Where the keyboard is: in front while typing, tucked behind his back (peeking out) when caught.
const KEYBOARD_POSES = {
  typing: { x: '-50%', y: 0, rotate: -4, scale: 1 },
  busted: { x: '10%', y: -36, rotate: 28, scale: 0.8 },
};

export interface Reaction {
  expression: Expression;
  /** Changes for every new reaction, so the same expression can play again. */
  key: number;
}

interface DragonAvatarProps {
  stage: DragonStage;
  name: string;
  /** Tap (or press) Ember to hear a musing. */
  onTalk?: () => void;
  reaction?: Reaction | null;
  /** The keyboard Easter egg, if it's happening. */
  antic?: Antic | null;
  isNapping?: boolean;
  isMeditating?: boolean;
  isPetted?: boolean;
  isLevelingUp?: boolean;
  /** Rest Together: a slow, quiet breath and a soft glow for a little while. */
  isResting?: boolean;
  className?: string;
  equipped?: {
    hat?: string;
    scarf?: string;
    nest?: string;
  };
}

export function DragonAvatar({ stage, name, onTalk, reaction = null, antic = null, isNapping, isMeditating, isPetted, isLevelingUp, isResting, className, equipped }: DragonAvatarProps) {
  const stageData = DRAGON_STAGES_DATA[stage];
  const isEgg = stage === DragonStage.EGG;
  // Idle loops (sparkles, breathing, shimmer) stop when the player prefers reduced motion.
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      {/* Ambient Sparkles */}
      {!isNapping && !reduceMotion && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: [0, (i % 2 === 0 ? 1 : -1) * (20 + i * 10), 0],
                y: [0, -40 - i * 15, 0],
              }}
              transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full blur-[1px] bg-dragon-gold"
            />
          ))}
        </div>
      )}

      {/* Evolution: a gentle glow, sparkles, and a short banner (see Celebration). */}
      <Celebration active={!!isLevelingUp} rounded="rounded-full" />
      <AnimatePresence>
        {isLevelingUp && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: -96 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute z-50 pointer-events-none"
          >
            <div className="bg-dragon-gold text-dragon-ink px-6 py-2 rounded-full font-bold shadow-xl border-2 border-white flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <span className="serif tracking-widest uppercase">Evolution Milestone!</span>
              <Sparkles className="w-5 h-5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* A still button (easy to tap) around the breathing dragon. */}
      <button
        type="button"
        onClick={onTalk}
        disabled={!onTalk}
        aria-label={`Talk to ${name}`}
        data-reaction={reaction?.expression}
        data-antic={antic ?? undefined}
        className="relative rounded-full outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60 disabled:cursor-default"
      >
        {/* The current reaction's badge (decorative; Ember's words carry the meaning). */}
        <AnimatePresence>
          {reaction && (
            <motion.span
              key={reaction.key}
              aria-hidden="true"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 -left-2 z-20 w-10 h-10 rounded-full bg-surface border border-line shadow-md flex items-center justify-center text-xl"
            >
              {REACTIONS[reaction.expression].badge}
            </motion.span>
          )}
        </AnimatePresence>
        {/* The keyboard Easter egg (in front while typing, behind him when caught). */}
        <AnimatePresence>
          {antic && (
            <motion.div
              key="keyboard"
              data-keyboard={antic}
              initial={{ opacity: 0, ...KEYBOARD_POSES.typing, y: 12 }}
              animate={{ opacity: 1, ...KEYBOARD_POSES[antic] }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 18 }}
              className={cn('absolute left-1/2 bottom-6 w-28 pointer-events-none', antic === 'typing' ? 'z-20' : 'z-0')}
            >
              {/* Tap-tap-tap while typing (a few bounces, then still). */}
              <motion.div
                animate={antic === 'typing' ? { y: [0, -2, 0] } : { y: 0 }}
                transition={antic === 'typing' ? { duration: 0.3, repeat: 6 } : undefined}
              >
                <TinyKeyboard />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          data-resting={isResting || undefined}
          animate={
            isNapping
              ? { scale: 0.95, y: 5, rotate: 0 }
              : reduceMotion
                ? { scale: 1, y: 0, rotate: 0 }
                : isResting
                  ? { scale: [1, 1.015, 1], y: 4, rotate: 0 }
                  : { scale: [1, 1.02, 1], y: [0, -10, 0], rotate: isEgg ? [-1, 1, -1] : [-2, 2, -2] }
          }
          transition={{
            duration: isNapping ? 3 : isResting ? 6 : 4,
            repeat: isNapping || reduceMotion ? 0 : Infinity,
            ease: "easeInOut"
          }}
          className={cn("relative z-10 transition-all duration-500", isPetted && "animate-heartbeat")}
        >
          {/* Rest Together: a warm, still glow (it doesn't move, so it suits reduced motion too). */}
          {isResting && (
            <div aria-hidden="true" className="absolute -inset-3 rounded-full bg-dragon-gold/15 blur-xl -z-10" />
          )}
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

          <motion.div
            key={reaction?.key ?? 'still'}
            // Reduced motion: MotionConfig (main.tsx) skips these transform animations.
          animate={reaction ? REACTIONS[reaction.expression].motion : {}}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="relative"
          >
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
            {!isNapping && !reduceMotion && (
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
          </motion.div>

          {/* Hat */}
          {equipped?.hat && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-surface rounded-full p-1 shadow-lg border border-dragon-gold/20"
            >
              <img
                src={COSMETICS.find(item => item.id === equipped.hat)?.image}
                alt="Hat"
                className="w-full h-full object-cover rounded-full"
              />
            </motion.div>
          )}

          {/* Scarf */}
          {equipped?.scarf && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-24 h-8 bg-ember-solid rounded-full shadow-md border border-white/20 flex items-center justify-center"
            >
              <span className="text-[0.625rem] font-bold text-white uppercase tracking-widest">Equipped</span>
            </motion.div>
          )}
        
          {isNapping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute -top-4 -right-4 bg-surface rounded-full p-2 shadow-md"
            >
              <span className="text-xl font-bold text-fg-muted">Zzz</span>
            </motion.div>
          )}

          {isMeditating && (
            <motion.div
              animate={reduceMotion ? { scale: 1, opacity: 0.7 } : { scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: reduceMotion ? 0 : Infinity }}
              className="absolute inset-0 rounded-full border-4 border-dragon-ember"
            />
          )}
        </motion.div>
      </button>
      
      <div className="mt-6 text-center">
        <h2 className="serif text-3xl font-bold text-fg">{stage}</h2>
        <p className="text-sm text-fg-muted italic mt-1">{stageData.description}</p>
      </div>
    </div>
  );
}

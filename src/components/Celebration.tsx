import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../lib/utils';
import { usePrefersReducedMotion } from '../lib/useMediaQuery';

/** Duration of a celebration, in ms (gentle and short; see #17). */
export const CELEBRATION_MS = 1200;

// Fixed spots (percent of the box), so it looks the same every time.
const SPARKLES = [
  { x: 8, y: 18, delay: 0 },
  { x: 88, y: 12, delay: 0.1 },
  { x: 50, y: -2, delay: 0.2 },
  { x: 14, y: 82, delay: 0.15 },
  { x: 92, y: 78, delay: 0.05 },
  { x: 58, y: 96, delay: 0.25 },
];

interface CelebrationProps {
  active: boolean;
  /** Matches the parent's corner rounding, so the glow follows its shape. */
  rounded?: string;
}

/**
 * A gentle glow with a few sparkles around its parent (which must be
 * positioned). With reduced motion, only a soft glow that fades: nothing moves.
 * Decorative only; the matching message carries the meaning.
 */
export function Celebration({ active, rounded = 'rounded-3xl' }: CelebrationProps) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden="true"
          data-celebration
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0"
        >
          <div className={cn('absolute inset-0 shadow-[0_0_24px_4px_rgba(212,175,55,0.45)]', rounded)} />
          {!reduceMotion &&
            SPARKLES.map((s, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.6], y: -10 }}
                transition={{ duration: CELEBRATION_MS / 1000 - 0.2, delay: s.delay, ease: 'easeOut' }}
                className="absolute h-1.5 w-1.5 rounded-full bg-dragon-gold shadow-[0_0_6px_#D4AF37]"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

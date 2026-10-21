import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { Celebration } from './Celebration';

interface FeedbackToastProps {
  /** Rewards, streaks, evolution, and other action results. */
  message: string | null;
  /** A gentle glow around the message (e.g. a milestone was unlocked). */
  celebrate?: boolean;
  /** A save that failed. Stays until dismissed or the next save succeeds. */
  error: string | null;
  onDismissError: () => void;
}

/**
 * Feedback pinned just above the bottom navigation, so it's visible wherever
 * the player tapped (a quest at the bottom of the list, the focus timer, …)
 * instead of only under the dragon, which is often scrolled away.
 */
export function FeedbackToast({ message, celebrate = false, error, onDismissError }: FeedbackToastProps) {
  return (
    <div className="feedback-above-nav fixed inset-x-0 z-[60] px-4 pointer-events-none">
      <div className="max-w-md mx-auto flex flex-col gap-2">
        {error && (
          <div
            role="alert"
            className="pointer-events-auto p-3 pl-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100 shadow-lg flex gap-3 items-center"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm">{error}</p>
            <button onClick={onDismissError} aria-label="Dismiss" className="w-11 h-11 -my-2 -mr-1 flex-shrink-0 rounded-xl flex items-center justify-center hover:bg-rose-100 dark:hover:bg-rose-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Always rendered, so screen readers announce each new message. */}
        <div role="status" aria-live="polite">
          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative px-4 py-3 rounded-2xl bg-fg text-surface dark:bg-surface-muted dark:text-fg dark:ring-1 dark:ring-dragon-gold/30 text-sm font-medium text-center shadow-lg"
              >
                {message}
                <Celebration active={celebrate} rounded="rounded-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

import { ReactNode, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';
import { CELEBRATION_MS, Celebration } from './Celebration';
import { Spoken } from '../lib/dialogue/select';

interface FeedbackToastProps {
  /** What Ember says (#18). */
  speech?: Spoken | null;
  /** Rewards, streaks, evolution, and other action results. */
  message: string | null;
  /** Celebrate this message with a gentle glow (e.g. a milestone was unlocked). */
  celebrate?: boolean;
  /** A save that failed. Stays until dismissed or the next save succeeds. */
  error: string | null;
  onDismissError: () => void;
  /** A gentle, lasting invitation (an evolution waiting to be seen), under any messages. */
  invite?: ReactNode;
}

/**
 * Feedback pinned just above the bottom navigation, so it's visible wherever
 * the player tapped (a quest at the bottom of the list, the focus timer, …)
 * instead of only under the dragon, which is often scrolled away.
 */
/** The glow starts when its message appears (not when it was saved), so it's never missed. */
function MessageCelebration() {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setActive(false), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, []);
  return <Celebration active={active} rounded="rounded-2xl" />;
}

/** Ember's words, with *narrated actions* in italics. */
export function SpeechText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).filter(Boolean).map((part, i) =>
        part.startsWith('*') && part.endsWith('*') ? <em key={i}>{part.slice(1, -1)}</em> : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function FeedbackToast({ speech = null, message, celebrate = false, error, onDismissError, invite = null }: FeedbackToastProps) {
  const shown = speech || message;
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
            {shown && (
              <motion.div
                key={`${speech?.id ?? ''}|${message ?? ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="relative px-4 py-3 rounded-2xl bg-fg text-surface dark:bg-surface-muted dark:text-fg dark:ring-1 dark:ring-dragon-gold/30 text-sm font-medium text-center shadow-lg"
              >
                {speech && (
                  <p data-line={speech.id} data-expression={speech.expression} className="text-base leading-snug">
                    <span className="sr-only">Ember says: </span>
                    <span aria-hidden="true" className="mr-1">🐉</span>
                    <SpeechText text={speech.text} />
                  </p>
                )}
                {message && <p className={speech ? 'mt-1 text-xs' : undefined}>{message}</p>}
                {celebrate && <MessageCelebration />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Always rendered, so the invitation is announced when it appears. */}
        <div aria-live="polite">{invite}</div>
      </div>
    </div>
  );
}

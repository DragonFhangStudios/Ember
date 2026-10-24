import { motion } from 'motion/react';
import { Play, Pause, RotateCcw, Timer, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { FocusTimerState } from '../lib/focusTimer';

interface FocusTimerProps {
  timer: FocusTimerState;
  rewardsLeft: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export function FocusTimer({ timer, rewardsLeft, onStart, onPause, onReset }: FocusTimerProps) {
  const isActive = timer.status === 'running';
  const isFinished = timer.status === 'finished';
  const timeLeft = Math.ceil(timer.remainingMs / 1000);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((timer.durationMs - timer.remainingMs) / timer.durationMs) * 100;

  return (
    <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-line flex flex-col items-center text-center">
      <div className="mb-6 flex items-center gap-2 text-dragon-ember">
        <Timer className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Focus Quest</h2>
      </div>

      <div className="relative w-48 h-48 mb-8">
        {/* Decorative: the time itself is the text below. */}
        <svg aria-hidden="true" className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-surface-muted"
          />
          <motion.circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray="552.92"
            animate={{ strokeDashoffset: 552.92 - (552.92 * progress) / 100 }}
            className="text-dragon-ember"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-bold font-mono text-fg">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {!isFinished ? (
          <>
            <button
              onClick={isActive ? onPause : onStart}
              aria-label={isActive ? 'Pause focus' : timer.status === 'paused' ? 'Resume focus' : 'Start focus'}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center transition-all",
                isActive 
                  ? "bg-surface-muted text-fg hover:bg-dragon-gold/10" 
                  : "bg-ember-solid text-white hover:bg-ember-solid/90 shadow-lg shadow-dragon-ember/20"
              )}
            >
              {isActive ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button
              onClick={onReset}
              aria-label="Reset focus"
              className="w-14 h-14 rounded-full bg-surface-muted text-fg flex items-center justify-center hover:bg-dragon-gold/10 transition-all"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="bg-dragon-gold/10 p-4 rounded-full">
              <Trophy className="w-10 h-10 text-dragon-gold" />
            </div>
            <p className="font-bold text-fg">Quest Complete!</p>
            <button
              onClick={onReset}
              className="min-h-12 px-6 py-3 bg-dragon-gold text-dragon-ink rounded-full font-bold hover:bg-dragon-gold/90 transition-all"
            >
              Start New Quest
            </button>
          </motion.div>
        )}
      </div>

      <p className="mt-6 text-sm text-fg-muted max-w-xs">
        {isActive 
          ? "Ember is meditating with you. Stay focused!" 
          : "Ready to start a focus quest? Ember will meditate by your side."}
      </p>
      <p className="mt-2 text-xs text-fg-muted">
        {rewardsLeft > 0
          ? `${rewardsLeft} Bond-earning ${rewardsLeft === 1 ? 'session' : 'sessions'} left today`
          : "Today's focus Bond is complete. Sessions still count toward your quest!"}
      </p>
    </div>
  );
}

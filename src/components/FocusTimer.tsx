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
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-dragon-gold/10 flex flex-col items-center text-center">
      <div className="mb-6 flex items-center gap-2 text-dragon-ember">
        <Timer className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Focus Quest</h2>
      </div>

      <div className="relative w-48 h-48 mb-8">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="96"
            cy="96"
            r="88"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-dragon-warm"
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
          <span className="text-4xl font-bold font-mono text-dragon-ink">
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="flex gap-4">
        {!isFinished ? (
          <>
            <button
              onClick={isActive ? onPause : onStart}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isActive 
                  ? "bg-dragon-warm text-dragon-ink hover:bg-dragon-gold/10" 
                  : "bg-dragon-ember text-white hover:bg-dragon-ember/90 shadow-lg shadow-dragon-ember/20"
              )}
            >
              {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
            </button>
            <button
              onClick={onReset}
              className="w-12 h-12 rounded-full bg-dragon-warm text-dragon-ink flex items-center justify-center hover:bg-dragon-gold/10 transition-all"
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
            <p className="font-bold text-dragon-ink">Quest Complete!</p>
            <button
              onClick={onReset}
              className="px-6 py-2 bg-dragon-gold text-white rounded-full font-bold hover:bg-dragon-gold/90 transition-all"
            >
              Start New Quest
            </button>
          </motion.div>
        )}
      </div>

      <p className="mt-6 text-sm text-dragon-muted max-w-xs">
        {isActive 
          ? "Ember is meditating with you. Stay focused!" 
          : "Ready to start a focus quest? Ember will meditate by your side."}
      </p>
      <p className="mt-2 text-xs text-dragon-muted">
        {rewardsLeft > 0
          ? `${rewardsLeft} growth-earning ${rewardsLeft === 1 ? 'session' : 'sessions'} left today`
          : "Today's focus growth is complete. Sessions still count toward your quest!"}
      </p>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, RotateCcw, Timer, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';

interface FocusTimerProps {
  onComplete: (points: number) => void;
  isActive: boolean;
  setIsActive: (active: boolean) => void;
}

export function FocusTimer({ onComplete, isActive, setIsActive }: FocusTimerProps) {
  const [timeLeft, setTimeLeft] = useState(10 * 60); // 10 minutes
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      setIsFinished(true);
      onComplete(15);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, setIsActive, onComplete]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setTimeLeft(10 * 60);
    setIsActive(false);
    setIsFinished(false);
  };

  const progress = ((10 * 60 - timeLeft) / (10 * 60)) * 100;

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
              onClick={() => setIsActive(!isActive)}
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
              onClick={resetTimer}
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
              onClick={resetTimer}
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
    </div>
  );
}

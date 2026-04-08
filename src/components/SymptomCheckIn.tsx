import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Battery, Send } from 'lucide-react';
import { cn } from '../lib/utils';

interface SymptomCheckInProps {
  onComplete: (energy: number, mood: number) => void;
}

export function SymptomCheckIn({ onComplete }: SymptomCheckInProps) {
  const [energy, setEnergy] = useState(3);
  const [mood, setMood] = useState(3);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    onComplete(energy, mood);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-xl border border-dragon-gold/10 text-center">
        <div className="bg-rose-50 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
        </div>
        <h3 className="serif text-xl font-bold text-dragon-ink mb-2">Check-in Logged</h3>
        <p className="text-sm text-dragon-muted">
          Patterns help you and your doctor. Great job checking in with yourself!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl p-8 shadow-xl border border-dragon-gold/10">
      <div className="flex items-center gap-2 text-rose-500 mb-6">
        <Heart className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Daily Check-in</h2>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-dragon-muted" />
              <span className="text-sm font-semibold text-dragon-muted uppercase tracking-wider">Energy Level</span>
            </div>
            <span className="text-lg font-bold text-dragon-ink">{energy}/5</span>
          </div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => setEnergy(val)}
                className={cn(
                  "flex-1 h-12 rounded-xl transition-all font-bold",
                  energy === val 
                    ? "bg-dragon-ink text-white shadow-lg" 
                    : "bg-dragon-warm text-dragon-muted hover:bg-dragon-gold/10"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-dragon-muted" />
              <span className="text-sm font-semibold text-dragon-muted uppercase tracking-wider">Mood</span>
            </div>
            <span className="text-lg font-bold text-dragon-ink">{mood}/5</span>
          </div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => setMood(val)}
                className={cn(
                  "flex-1 h-12 rounded-xl transition-all font-bold",
                  mood === val 
                    ? "bg-rose-500 text-white shadow-lg" 
                    : "bg-dragon-warm text-dragon-muted hover:bg-dragon-gold/10"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-dragon-ink text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl"
        >
          <Send className="w-5 h-5" />
          Log Check-in
        </button>
      </div>
    </div>
  );
}

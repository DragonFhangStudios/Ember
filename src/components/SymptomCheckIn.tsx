import { useEffect, useId, useState } from 'react';
import { Heart, Battery, Send, NotebookPen } from 'lucide-react';
import { cn } from '../lib/utils';
import { CHECK_IN_NOTE_MAX } from '../lib/progression';
import { SymptomLog } from '../types';

interface SymptomCheckInProps {
  onComplete: (energy: number, mood: number, note: string) => void;
  checkedInToday: boolean;
  /**
   * Today's saved check-in. Updating starts from all of it (energy, mood and
   * note), so changing one never overwrites the others by accident.
   */
  today?: SymptomLog;
  /** The local day (Date.toDateString()); a new day starts with a fresh form. */
  day: string;
}

const FRESH = { energy: 3, mood: 3, note: '' };

export function SymptomCheckIn({ onComplete, checkedInToday, today, day }: SymptomCheckInProps) {
  const [energy, setEnergy] = useState(FRESH.energy);
  const [mood, setMood] = useState(FRESH.mood);
  const [note, setNote] = useState(FRESH.note);
  const [isEditing, setIsEditing] = useState(false);
  const noteId = useId();

  // Nothing from yesterday's form carries into a new day.
  useEffect(() => {
    setEnergy(FRESH.energy);
    setMood(FRESH.mood);
    setNote(FRESH.note);
    setIsEditing(false);
  }, [day]);

  const handleSubmit = () => {
    onComplete(energy, mood, note);
    setIsEditing(false);
  };

  const startUpdate = () => {
    setEnergy(today?.energy ?? FRESH.energy);
    setMood(today?.mood ?? FRESH.mood);
    setNote(today?.notes ?? FRESH.note);
    setIsEditing(true);
  };

  if (checkedInToday && !isEditing) {
    return (
      <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-line text-center">
        <div className="bg-rose-500/10 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
        </div>
        <h3 className="serif text-xl font-bold text-fg mb-2">Check-in saved!</h3>
        <p className="text-sm text-fg-muted">Thanks for taking a moment to see how you're feeling today. ❤️</p>
        <button
          onClick={startUpdate}
          className="mt-4 min-h-11 px-4 text-xs font-bold text-gold-fg uppercase tracking-widest hover:text-ember-fg transition-colors"
        >
          Update today's check-in
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-xl border border-line">
      <div className="flex items-center gap-2 text-rose-500 mb-6">
        <Heart className="w-6 h-6" />
        <h2 className="serif text-2xl font-bold">Daily Check-in</h2>
      </div>

      <div className="space-y-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <Battery className="w-4 h-4 text-fg-muted" />
              <span className="text-sm font-semibold text-fg-muted uppercase tracking-wider">Energy Level</span>
            </div>
            <span className="text-lg font-bold text-fg">{energy}/5</span>
          </div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => setEnergy(val)}
                aria-pressed={energy === val}
                className={cn(
                  "flex-1 h-12 rounded-xl transition-all font-bold",
                  energy === val 
                    ? "bg-fg text-surface shadow-lg" 
                    : "bg-surface-muted text-fg-muted hover:bg-dragon-gold/10"
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
              <Heart className="w-4 h-4 text-fg-muted" />
              <span className="text-sm font-semibold text-fg-muted uppercase tracking-wider">Mood</span>
            </div>
            <span className="text-lg font-bold text-fg">{mood}/5</span>
          </div>
          <div className="flex justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => setMood(val)}
                aria-pressed={mood === val}
                className={cn(
                  "flex-1 h-12 rounded-xl transition-all font-bold",
                  mood === val 
                    ? "bg-rose-solid text-white shadow-lg" 
                    : "bg-surface-muted text-fg-muted hover:bg-dragon-gold/10"
                )}
              >
                {val}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor={noteId} className="flex items-center gap-2 text-sm font-semibold text-fg-muted uppercase tracking-wider">
              <NotebookPen className="w-4 h-4" />
              Note (optional)
            </label>
            <span className="text-xs text-fg-muted" aria-hidden="true">
              {note.length}/{CHECK_IN_NOTE_MAX}
            </span>
          </div>
          <textarea
            id={noteId}
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={CHECK_IN_NOTE_MAX}
            rows={3}
            aria-describedby={`${noteId}-hint`}
            placeholder="Anything you'd like to remember about today?"
            className="w-full px-4 py-3 rounded-xl bg-surface-muted border-none focus:ring-2 focus:ring-dragon-gold text-fg resize-none"
          />
          <p id={`${noteId}-hint`} className="text-xs text-fg-muted mt-1">
            Private: notes stay on this device. Up to {CHECK_IN_NOTE_MAX} characters.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full py-4 bg-fg text-surface rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl"
        >
          <Send className="w-5 h-5" />
          Log Check-in
        </button>
      </div>
    </div>
  );
}

import { Compass, Hand, LayoutGrid, Moon, PartyPopper, Puzzle, Sparkles } from 'lucide-react';
import { MomentKind } from '../lib/moments';

const ACTIONS: { kind: MomentKind; label: string; icon: typeof Hand }[] = [
  { kind: 'boop', label: 'Boop', icon: Hand },
  { kind: 'play', label: 'Play', icon: Sparkles },
  { kind: 'rest', label: 'Rest together', icon: Moon },
];

// Phones: a tile, icon above label, so two fit side by side even at 320 px. Wider: a pill.
const BUTTON =
  'min-h-11 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl text-center text-sm font-bold bg-surface-muted text-fg border border-line hover:border-dragon-gold/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60 transition-colors';

/**
 * Dragon Moments: little things to do with Ember, any time, as often as you
 * like, plus the ways into Little Expeditions, Memory Match, Pattern
 * Challenge and Trick Time. Just for fun: they earn nothing (an expedition
 * keeps the keepsake it finds, nothing else).
 */
export function DragonMoments({ dragonName, onMoment, onExplore, onMemoryMatch, onPatternChallenge, onTrickTime }: { dragonName: string; onMoment: (kind: MomentKind) => void; onExplore: () => void; onMemoryMatch: () => void; onPatternChallenge: () => void; onTrickTime: () => void }) {
  return (
    <div role="group" aria-labelledby="moments-label" className="mt-5 mb-16 flex flex-col items-center gap-2">
      <p id="moments-label" className="text-xs font-bold uppercase tracking-widest text-fg-muted">
        Just for fun with {dragonName}
      </p>
      {/* Phones: two even columns (an odd last button spans both). Wider: a centred row that wraps. */}
      <div className="grid w-full max-w-sm grid-cols-2 gap-2 [&>:last-child:nth-child(odd)]:col-span-2 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
        {ACTIONS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            data-moment={kind}
            onClick={() => onMoment(kind)}
            className={BUTTON}
          >
            <Icon aria-hidden="true" className="w-4 h-4 text-gold-fg" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onExplore}
          className={BUTTON}
        >
          <Compass aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Explore
        </button>
        <button
          type="button"
          onClick={onMemoryMatch}
          className={BUTTON}
        >
          <LayoutGrid aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Memory Match
        </button>
        <button
          type="button"
          onClick={onPatternChallenge}
          className={BUTTON}
        >
          <Puzzle aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Pattern Challenge
        </button>
        <button
          type="button"
          onClick={onTrickTime}
          className={BUTTON}
        >
          <PartyPopper aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Trick Time
        </button>
      </div>
    </div>
  );
}

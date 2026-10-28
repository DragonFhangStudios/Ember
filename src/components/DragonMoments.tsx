import { Compass, Hand, LayoutGrid, Moon, Sparkles } from 'lucide-react';
import { MomentKind } from '../lib/moments';

const ACTIONS: { kind: MomentKind; label: string; icon: typeof Hand }[] = [
  { kind: 'boop', label: 'Boop', icon: Hand },
  { kind: 'play', label: 'Play', icon: Sparkles },
  { kind: 'rest', label: 'Rest together', icon: Moon },
];

/**
 * Dragon Moments: little things to do with Ember, any time, as often as you
 * like, plus the ways into Little Expeditions and Memory Match. Just for
 * fun: they earn nothing (an expedition keeps the keepsake it finds, nothing else).
 */
export function DragonMoments({ dragonName, onMoment, onExplore, onMemoryMatch }: { dragonName: string; onMoment: (kind: MomentKind) => void; onExplore: () => void; onMemoryMatch: () => void }) {
  return (
    <div role="group" aria-labelledby="moments-label" className="mt-5 mb-16 flex flex-col items-center gap-2">
      <p id="moments-label" className="text-xs font-bold uppercase tracking-widest text-fg-muted">
        Just for fun with {dragonName}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {ACTIONS.map(({ kind, label, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            data-moment={kind}
            onClick={() => onMoment(kind)}
            className="min-h-11 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-surface-muted text-fg border border-line hover:border-dragon-gold/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60 transition-colors"
          >
            <Icon aria-hidden="true" className="w-4 h-4 text-gold-fg" />
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={onExplore}
          className="min-h-11 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-surface-muted text-fg border border-line hover:border-dragon-gold/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60 transition-colors"
        >
          <Compass aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Explore
        </button>
        <button
          type="button"
          onClick={onMemoryMatch}
          className="min-h-11 flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-bold bg-surface-muted text-fg border border-line hover:border-dragon-gold/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60 transition-colors"
        >
          <LayoutGrid aria-hidden="true" className="w-4 h-4 text-gold-fg" />
          Memory Match
        </button>
      </div>
    </div>
  );
}

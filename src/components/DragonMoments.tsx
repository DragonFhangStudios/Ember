import { Hand, Moon, Sparkles } from 'lucide-react';
import { MomentKind } from '../lib/moments';

const ACTIONS: { kind: MomentKind; label: string; icon: typeof Hand }[] = [
  { kind: 'boop', label: 'Boop', icon: Hand },
  { kind: 'play', label: 'Play', icon: Sparkles },
  { kind: 'rest', label: 'Rest together', icon: Moon },
];

/**
 * Dragon Moments: little things to do with Ember, any time, as often as you
 * like. Just for fun: they earn nothing and change nothing in the save.
 */
export function DragonMoments({ dragonName, onMoment }: { dragonName: string; onMoment: (kind: MomentKind) => void }) {
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
      </div>
    </div>
  );
}

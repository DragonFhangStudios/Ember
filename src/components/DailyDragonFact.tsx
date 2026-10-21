import { ExternalLink, ScrollText } from 'lucide-react';
import { DragonFact } from '../lib/dragonFacts/facts';
import { cn } from '../lib/utils';

interface DailyDragonFactProps {
  fact: DragonFact;
}

/** Today's dragon fact: real-world (with its source) or Ember lore (clearly fiction). */
export function DailyDragonFact({ fact }: DailyDragonFactProps) {
  const lore = fact.kind === 'lore';
  return (
    <section aria-labelledby="daily-fact-title" data-fact={fact.id} className="bg-surface rounded-2xl p-5 border border-line shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 id="daily-fact-title" className="flex items-center gap-2 font-bold text-fg">
          <ScrollText aria-hidden="true" className="w-5 h-5 text-gold-fg" />
          Daily Dragon Fact
        </h3>
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full',
            lore
              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {lore ? 'Ember lore' : 'Real-world fact'}
        </span>
      </div>
      <p className="text-fg">{fact.text}</p>
      {fact.kind === 'lore' ? (
        <p className="mt-2 text-xs text-fg-muted">Just for fun: a story from Ember's world.</p>
      ) : (
        <p className="mt-1 text-xs text-fg-muted">
          Source:{' '}
          <a
            href={fact.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 font-bold text-ember-fg underline"
          >
            {fact.source.publisher}
            <ExternalLink aria-hidden="true" className="w-3 h-3" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </p>
      )}
    </section>
  );
}

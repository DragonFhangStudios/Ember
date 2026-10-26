import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { DragonStage } from '../types';
import { DRAGON_STAGES_DATA } from '../constants';
import { RevealView, evolutionLine } from '../lib/milestones';
import { CELEBRATION_MS, Celebration } from './Celebration';
import { Dialog } from './Dialog';
import { SpeechText } from './FeedbackToast';
import { cn } from '../lib/utils';

export type { RevealView };

/** "Wednesday, October 21" for a stored YYYY-MM-DD local day. */
function formatDay(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * The persistent invitation to see an evolution, shown above the navigation
 * on every tab. It never moves the page or takes focus, and "Later" only
 * hides it for now: the reveal waits in Milestones.
 */
export function EvolutionInvite({ dragonName, onOpen, onLater }: { dragonName: string; onOpen: () => void; onLater: () => void }) {
  return (
    <section
      aria-labelledby="evolution-invite-text"
      data-evolution-invite
      className="pointer-events-auto p-3 pl-4 rounded-2xl border border-dragon-gold/50 bg-surface text-fg shadow-lg flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <p id="evolution-invite-text" className="flex-1 min-w-[10rem] text-sm font-medium">
        Something wonderful is happening with {dragonName}! <span aria-hidden="true">🐉</span>
      </p>
      <div className="flex gap-2 ml-auto">
        <button type="button" onClick={onLater} className="min-h-11 px-3 rounded-xl text-sm font-bold text-fg-muted hover:text-fg">
          Later
        </button>
        <button type="button" onClick={onOpen} className="min-h-11 px-4 rounded-xl text-sm font-bold bg-dragon-gold text-dragon-ink hover:bg-dragon-gold/90">
          See what happened
        </button>
      </div>
    </section>
  );
}

interface EvolutionRevealProps {
  reveal: RevealView | null;
  dragonName: string;
  /** When each stage was reached, if known. */
  reachedOn?: Partial<Record<DragonStage, string>>;
  /** Finish (Close on a replay): the player is done with it. */
  onFinish: () => void;
  /** Escape or the backdrop: set aside for now, not finished. */
  onDismiss: () => void;
}

/**
 * The evolution reveal: the stage's picture, what the dragon says, and an
 * explicit way to finish. Nothing closes it on a timer; Escape and the
 * backdrop set it aside without finishing it. Viewing it never grants anything.
 */
export function EvolutionReveal({ reveal, dragonName, reachedOn, onFinish, onDismiss }: EvolutionRevealProps) {
  return (
    <Dialog
      open={!!reveal}
      onClose={onDismiss}
      labelledBy="evolution-title"
      describedBy="evolution-description"
      panelClassName="max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-3xl shadow-2xl border border-line p-6 text-center"
    >
      {reveal && <RevealContent reveal={reveal} dragonName={dragonName} reachedOn={reachedOn?.[reveal.stage]} onFinish={onFinish} />}
    </Dialog>
  );
}

function RevealContent({ reveal, dragonName, reachedOn, onFinish }: { reveal: RevealView; dragonName: string; reachedOn?: string; onFinish: () => void }) {
  const { stage, replay } = reveal;
  const [glow, setGlow] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setGlow(false), CELEBRATION_MS);
    return () => clearTimeout(timer);
  }, []);
  const line = evolutionLine(stage);
  const isEgg = stage === DragonStage.EGG;
  const title = isEgg ? `Where it all began: ${dragonName}'s egg` : replay ? `${dragonName} became a ${stage}` : `${dragonName} is a ${stage} now!`;

  return (
    <div data-evolution-reveal={stage} data-replay={replay || undefined}>
      <p className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-gold-fg">
        <Sparkles aria-hidden="true" className="w-4 h-4" />
        {replay ? 'A memory' : 'Evolution milestone'}
        <Sparkles aria-hidden="true" className="w-4 h-4" />
      </p>
      <h2 id="evolution-title" className="serif text-2xl font-bold text-fg mt-2">
        {title}
      </h2>
      <div className="relative mx-auto my-5 w-40 h-40 rounded-full">
        <Celebration active={glow} rounded="rounded-full" />
        <img src={DRAGON_STAGES_DATA[stage].image} alt={`${dragonName} as ${isEgg ? 'an egg' : `a ${stage}`}`} className="w-40 h-40 object-contain" />
      </div>
      <div id="evolution-description" className="space-y-3">
        {line && (
          <p data-line={line.id} className="serif text-lg leading-snug text-fg">
            <span className="sr-only">{dragonName} says: </span>
            <span aria-hidden="true" className="mr-1">🐉</span>
            <SpeechText text={line.text} />
          </p>
        )}
        <p className="text-sm text-fg-muted">{DRAGON_STAGES_DATA[stage].description}</p>
        {reachedOn && <p className="text-xs font-bold uppercase tracking-widest text-fg-muted">Reached on {formatDay(reachedOn)}</p>}
      </div>
      <button
        type="button"
        data-autofocus
        onClick={onFinish}
        className="mt-6 w-full min-h-12 rounded-2xl font-bold bg-ember-solid text-white hover:opacity-90"
      >
        {replay ? 'Close' : 'Finish'}
      </button>
    </div>
  );
}

interface EvolutionJourneyProps {
  dragonName: string;
  stages: DragonStage[];
  pending: DragonStage | null;
  reachedOn?: Partial<Record<DragonStage, string>>;
  onOpen: (stage: DragonStage) => void;
}

/** Milestones: every stage reached, each reveal replayable; a waiting one is offered first. */
export function EvolutionJourney({ dragonName, stages, pending, reachedOn, onOpen }: EvolutionJourneyProps) {
  return (
    <section aria-labelledby="journey-title" className="mb-10">
      <h3 id="journey-title" className="serif text-xl font-bold text-fg mb-4">
        {dragonName}'s journey
      </h3>
      <ol className="space-y-3">
        {[...stages].reverse().map(stage => {
          const waiting = stage === pending;
          return (
            <li
              key={stage}
              data-journey-stage={stage}
              className={cn('flex items-center gap-4 p-3 rounded-2xl border', waiting ? 'border-dragon-gold/60 bg-dragon-gold/10' : 'border-line bg-surface')}
            >
              <img src={DRAGON_STAGES_DATA[stage].image} alt="" className="w-14 h-14 object-contain flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-bold text-fg">{stage}</h4>
                <p className="text-xs text-fg-muted">
                  {waiting ? 'New, whenever you are ready' : reachedOn?.[stage] ? `Reached on ${formatDay(reachedOn[stage]!)}` : 'Reached'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpen(stage)}
                aria-label={waiting ? `See what happened: ${dragonName} became a ${stage}` : `Watch again: ${stage}`}
                className={cn(
                  'min-h-11 px-4 rounded-xl text-sm font-bold flex-shrink-0',
                  waiting ? 'bg-dragon-gold text-dragon-ink hover:bg-dragon-gold/90' : 'bg-surface-muted text-fg hover:bg-line',
                )}
              >
                {waiting ? 'See what happened' : 'Watch again'}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import { RefObject, useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { DragonStage, UserState } from '../types';
import {
  AGAIN_REACTIONS, Choice, DISCOVERIES, DiscoveryId, EXCITED, EXPEDITIONS, Expedition, TREASURE_REACTIONS, Visit,
  expeditionsOpen, fillName, foundInOrder, setOff, visit,
} from '../lib/expeditions';
import { Celebration } from './Celebration';
import { Dialog } from './Dialog';
import { SpeechText } from './FeedbackToast';

/** How long Ember explores before the result (a short, still pause; no motion needed). */
export const EXPLORING_MS = 1200;

type View =
  | { kind: 'map' }
  | { kind: 'shelf' }
  | { kind: 'scene'; expedition: Expedition; excited: string }
  | { kind: 'exploring'; expedition: Expedition; choice: Choice }
  | { kind: 'result'; expedition: Expedition; visit: Visit; reaction: string };

interface ExpeditionsProps {
  open: boolean;
  onClose: () => void;
  state: UserState;
  /** Keeps a newly found keepsake (once; see recordDiscovery). */
  onFind: (discovery: DiscoveryId) => void;
  random?: () => number;
}

const pick = <T,>(items: T[], random: () => number) => items[Math.floor(random() * items.length) % items.length];

/**
 * Little Expeditions: pick a place, pick one of two choices, find something.
 * Optional and just for fun: no rewards, no failure, no timers to beat.
 */
export function Expeditions({ open, onClose, state, onFind, random = Math.random }: ExpeditionsProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="expeditions-title"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      {open && <Content state={state} onClose={onClose} onFind={onFind} random={random} />}
    </Dialog>
  );
}

function Content({ state, onClose, onFind, random }: { state: UserState; onClose: () => void; onFind: (discovery: DiscoveryId) => void; random: () => number }) {
  const [view, setView] = useState<View>({ kind: 'map' });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const name = state.dragonName;
  const hatched = expeditionsOpen(state.stage);

  // Each new step moves focus to its heading, so screen readers hear it.
  useEffect(() => {
    if (view.kind !== 'map') headingRef.current?.focus();
  }, [view.kind]);

  // Exploring: a short pause, then what was found.
  useEffect(() => {
    if (view.kind !== 'exploring') return;
    const timer = setTimeout(() => {
      const found = visit(state, view.choice, random());
      if (found.kind === 'new') onFind(found.discovery);
      setView({ kind: 'result', expedition: view.expedition, visit: found, reaction: pick(found.kind === 'new' ? TREASURE_REACTIONS : AGAIN_REACTIONS, random) });
    }, EXPLORING_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const back = (to: View['kind'] = 'map') => setView(to === 'shelf' ? { kind: 'shelf' } : { kind: 'map' });
  const heading = 'serif text-2xl font-bold text-fg outline-none';
  const quiet = 'text-sm text-fg-muted';
  const secondary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-surface-muted text-fg hover:bg-line';
  const primary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-ember-solid text-white hover:opacity-90';

  return (
    <div data-expedition-view={view.kind}>
      <div className="flex justify-between items-center mb-2 gap-2">
        {view.kind === 'map' ? (
          <h2 id="expeditions-title" className={heading}>Little Expeditions</h2>
        ) : (
          <>
            <button type="button" onClick={() => back()} className="w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg" aria-label="Back to the map">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span id="expeditions-title" className="sr-only">Little Expeditions</span>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close expeditions" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>

      {view.kind === 'map' && !hatched && (
        <div className="pb-4">
          <p className="text-fg">Little expeditions open once {name} hatches.</p>
          <p className={`${quiet} mt-2`}>For now, the egg loves listening to your day. Boop, Play and Rest Together are ready any time.</p>
        </div>
      )}

      {view.kind === 'map' && hatched && (
        <div className="pb-4">
          <p className={`${quiet} mb-4`}>Pick a place to explore with {name}. Every path finds something, and you can visit as often as you like.</p>
          <ul className="space-y-3">
            {EXPEDITIONS.map(expedition => (
              <li key={expedition.id}>
                <button
                  type="button"
                  data-location={expedition.id}
                  onClick={() => setView({ kind: 'scene', expedition, excited: pick(EXCITED, random) })}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-line bg-surface hover:border-dragon-gold/60"
                >
                  <span aria-hidden="true" className="text-3xl">{expedition.icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-fg">{expedition.name}</span>
                    <span className="block text-sm text-fg-muted">{expedition.blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setView({ kind: 'shelf' })} className={`${secondary} mt-4 w-full`}>
            {name}'s treasure shelf
          </button>
        </div>
      )}

      {view.kind === 'scene' && (
        <div className="pb-4">
          <h3 ref={headingRef} tabIndex={-1} className={heading}>
            {view.expedition.name}
          </h3>
          <p className="mt-3 text-fg">
            <span className="sr-only">{name} says: </span>
            <span aria-hidden="true" className="mr-1">🐉</span>
            <SpeechText text={view.excited} />
          </p>
          <p className={`${quiet} mt-2`}>{setOff(state.stage, name)}</p>
          <p className="mt-3 text-fg">{view.expedition.scene}</p>
          <div role="group" aria-label="What should you do?" className="mt-5 grid gap-3 sm:grid-cols-2">
            {view.expedition.choices.map(choice => (
              <button key={choice.id} type="button" data-choice={choice.id} onClick={() => setView({ kind: 'exploring', expedition: view.expedition, choice })} className={primary}>
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.kind === 'exploring' && (
        <div className="pb-4" aria-live="polite">
          <h3 ref={headingRef} tabIndex={-1} className={heading}>
            {view.expedition.name}
          </h3>
          <p className="mt-3 text-fg">
            {name} is exploring… <span aria-hidden="true">✨</span>
          </p>
        </div>
      )}

      {view.kind === 'result' && (
        <div className="pb-4" data-visit={view.visit.kind} data-found={view.visit.kind === 'alternate' ? undefined : view.visit.discovery}>
          <h3 ref={headingRef} tabIndex={-1} className={heading}>
            {view.visit.kind === 'new' ? 'A new keepsake!' : view.visit.kind === 'again' ? 'Found it again!' : 'A little adventure'}
          </h3>
          <p className="mt-3 text-fg">{fillName(view.visit.story.story, name)}</p>
          {view.visit.kind !== 'alternate' && (
            <div className="relative mt-4 flex items-center gap-4 p-4 rounded-2xl border border-dragon-gold/50 bg-dragon-gold/10">
              {view.visit.kind === 'new' && <Celebration active rounded="rounded-2xl" />}
              <span aria-hidden="true" className="text-4xl">{DISCOVERIES[view.visit.discovery].icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-fg">{DISCOVERIES[view.visit.discovery].name}</span>
                <span className="block text-sm text-fg-muted">{DISCOVERIES[view.visit.discovery].description}</span>
                <span className="block text-xs font-bold uppercase tracking-widest text-gold-fg mt-1">
                  {view.visit.kind === 'new' ? 'Added to the treasure shelf' : 'Already on the treasure shelf'}
                </span>
              </span>
            </div>
          )}
          <p className="mt-4 text-fg">
            <span className="sr-only">{name} says: </span>
            <span aria-hidden="true" className="mr-1">🐉</span>
            <SpeechText text={view.reaction} />
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => back()} className={secondary}>
              Explore somewhere else
            </button>
            <button type="button" onClick={onClose} className={primary}>
              Done
            </button>
          </div>
        </div>
      )}

      {view.kind === 'shelf' && <Shelf state={state} headingRef={headingRef} />}
    </div>
  );
}

function Shelf({ state, headingRef }: { state: UserState; headingRef: RefObject<HTMLHeadingElement | null> }) {
  const found = foundInOrder(state);
  const day = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  };
  return (
    <div className="pb-4">
      <h3 ref={headingRef} tabIndex={-1} className="serif text-2xl font-bold text-fg outline-none">
        {state.dragonName}'s treasure shelf
      </h3>
      {found.length === 0 ? (
        <p className="text-sm text-fg-muted mt-3">
          {state.stage === DragonStage.EGG
            ? 'Empty for now. Treasures come with expeditions, once Ember hatches.'
            : 'Nothing here yet. Every expedition finds something.'}
        </p>
      ) : (
        <ul className="mt-4 space-y-3" aria-label="Keepsakes">
          {found.map(({ discovery, foundOn, place }) => (
            <li key={discovery.id} data-keepsake={discovery.id} className="flex items-center gap-4 p-3 rounded-2xl border border-line bg-surface">
              <span aria-hidden="true" className="text-3xl">{discovery.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-fg">{discovery.name}</span>
                <span className="block text-sm text-fg-muted">{discovery.description}</span>
                <span className="block text-xs text-fg-muted mt-1">
                  Found at {place} on {day(foundOn)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {found.length > 0 && found.length < Object.keys(DISCOVERIES).length && (
        <p className="text-xs text-fg-muted mt-4">There's more to find out there, whenever you feel like exploring.</p>
      )}
    </div>
  );
}

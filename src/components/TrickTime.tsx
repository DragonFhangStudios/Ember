import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { DragonStage } from '../types';
import { START, TRICKS, TRICK_IDS, TrickId, TrickView, begin, fillName, finish, invite, tricksOpen } from '../lib/tricks';
import { Celebration } from './Celebration';
import { Dialog } from './Dialog';
import { SpeechText } from './FeedbackToast';

const otherTrick = (id: TrickId) => TRICK_IDS.find(other => other !== id)!;

interface TrickTimeProps {
  open: boolean;
  onClose: () => void;
  dragonName: string;
  stage: DragonStage;
  random?: () => number;
}

/**
 * Trick Time: invite Ember to do a little trick, told as a tiny story.
 * Just for fun: nothing to fail, practise or unlock, and nothing saved.
 * Each visit starts fresh from the list of tricks.
 */
export function TrickTime({ open, onClose, dragonName, stage, random = Math.random }: TrickTimeProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="tricks-title"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      {open && <Content dragonName={dragonName} stage={stage} onClose={onClose} random={random} />}
    </Dialog>
  );
}

function Content({ dragonName, stage, onClose, random }: { dragonName: string; stage: DragonStage; onClose: () => void; random: () => number }) {
  const [view, setView] = useState<TrickView>(START);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(view.step);
  const name = (text: string) => fillName(text, dragonName);

  // Each new step moves focus to its heading, so screen readers hear it;
  // going back to the list moves it to the title (the back button is gone by then).
  useEffect(() => {
    if (view.step !== 'pick') headingRef.current?.focus();
    else if (shownStep.current !== 'pick') titleRef.current?.focus();
    shownStep.current = view.step;
  }, [view]);

  const heading = 'serif text-2xl font-bold text-fg outline-none';
  const secondary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-surface-muted text-fg hover:bg-line';
  const primary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-ember-solid text-white hover:opacity-90';
  const says = (line: string) => (
    <p className="mt-3 text-fg">
      <span className="sr-only">{dragonName} says: </span>
      <span aria-hidden="true" className="mr-1">🐉</span>
      <SpeechText text={line} />
    </p>
  );

  return (
    <div className="pb-4" data-trick-step={view.step}>
      <div className="flex justify-between items-center mb-2 gap-2">
        {view.step === 'pick' ? (
          <h2 id="tricks-title" ref={titleRef} tabIndex={-1} className={heading}>
            Trick Time
          </h2>
        ) : (
          <>
            <button type="button" onClick={() => setView(START)} className="w-11 h-11 -ml-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg" aria-label="Back to the tricks">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <span id="tricks-title" className="sr-only">Trick Time</span>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close Trick Time" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>

      {view.step === 'pick' && !tricksOpen(stage) && (
        <div data-tricks-egg>
          <p className="text-fg">Little tricks begin once {dragonName} hatches.</p>
          <p className="text-sm text-fg-muted mt-2">For now, the egg is happy just to have you close. Boop, Play and Rest Together are ready any time.</p>
        </div>
      )}

      {view.step === 'pick' && tricksOpen(stage) && (
        <>
          <p className="text-sm text-fg-muted mb-4">Invite {dragonName} to do a little trick. Each one is told as a tiny story, and you can do them as often as you like.</p>
          <ul className="space-y-3">
            {TRICK_IDS.map(id => (
              <li key={id}>
                <button
                  type="button"
                  data-trick={id}
                  onClick={() => setView(v => begin(v, id))}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-line bg-surface hover:border-dragon-gold/60"
                >
                  <span aria-hidden="true" className="text-3xl">{TRICKS[id].icon}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-fg">{TRICKS[id].name}</span>
                    <span className="block text-sm text-fg-muted">{TRICKS[id].blurb}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {view.step === 'invite' && (
        <div>
          <h3 ref={headingRef} tabIndex={-1} className={heading}>
            <span aria-hidden="true" className="mr-2">{TRICKS[view.trick].icon}</span>
            {TRICKS[view.trick].name}
          </h3>
          <p className="mt-3 text-fg">{name(TRICKS[view.trick].scene)}</p>
          <button type="button" data-invite onClick={() => setView(v => invite(v, random))} className={`${primary} mt-5 w-full`}>
            {TRICKS[view.trick].invite}
          </button>
        </div>
      )}

      {view.step === 'response' && (
        <div>
          <h3 ref={headingRef} tabIndex={-1} className={heading}>
            <span aria-hidden="true" className="mr-2">{TRICKS[view.trick].icon}</span>
            {TRICKS[view.trick].name}
          </h3>
          <p className="mt-3 text-fg">{name(TRICKS[view.trick].response)}</p>
          {says(view.line)}
          <p className="mt-4 text-sm font-bold text-fg">{TRICKS[view.trick].question}</p>
          <div role="group" aria-label={TRICKS[view.trick].question} className="mt-3 grid gap-3 sm:grid-cols-2">
            {TRICKS[view.trick].choices.map(choice => (
              <button key={choice.id} type="button" data-trick-choice={choice.id} onClick={() => setView(v => finish(v, choice.id, random))} className={primary}>
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {view.step === 'finale' && (
        <div data-trick-finale={view.choice} data-silly={view.silly || undefined}>
          <div className="relative p-4 rounded-2xl border border-dragon-gold/50 bg-dragon-gold/10">
            <Celebration active rounded="rounded-2xl" />
            <h3 ref={headingRef} tabIndex={-1} className={heading}>
              <span aria-hidden="true" className="mr-2">{TRICKS[view.trick].icon}</span>
              {TRICKS[view.trick].name}
            </h3>
            <p className="mt-3 text-fg">{name(view.story)}</p>
          </div>
          {says(view.cheer)}
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <button type="button" onClick={() => setView(v => begin(v, view.trick))} className={primary}>
              {TRICKS[view.trick].name} again
            </button>
            <button type="button" onClick={() => setView(v => begin(v, otherTrick(view.trick)))} className={secondary}>
              Try {TRICKS[otherTrick(view.trick)].name}
            </button>
            <button type="button" onClick={onClose} className={secondary}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


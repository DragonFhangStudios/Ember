import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Droplet, Flower2, PawPrint, Snowflake, X } from 'lucide-react';
import { DragonStage } from '../types';
import { PADS, PadId, PatternChallenge as Challenge, PatternGame, ROUNDS, patternInWords, roundPattern } from '../lib/patternChallenge';
import { cn } from '../lib/utils';
import { Celebration } from './Celebration';
import { Dialog } from './Dialog';

/** Each symbol differs in shape, colour, name and place, so no one cue has to carry it. */
const LOOK: Record<PadId, { icon: typeof Flower2; color: string }> = {
  flower: { icon: Flower2, color: 'text-rose-600 dark:text-rose-300' },
  raindrop: { icon: Droplet, color: 'text-sky-700 dark:text-sky-300' },
  snowflake: { icon: Snowflake, color: 'text-violet-700 dark:text-violet-300' },
  paw: { icon: PawPrint, color: 'text-gold-fg' },
};
const nameOf = (id: PadId) => PADS.find(p => p.id === id)!.name;

interface PatternChallengeProps {
  open: boolean;
  onClose: () => void;
  /** The game for this page session (it outlives the dialog). */
  challenge: Challenge;
  dragonName: string;
  stage: DragonStage;
}

/**
 * Pattern Challenge: watch a short pattern light up, then repeat it. Three
 * gentle rounds. No timer, no penalty, watch again as often as you like.
 */
export function PatternChallenge({ open, onClose, challenge, dragonName, stage }: PatternChallengeProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="pattern-title"
      describedBy="pattern-intro"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      {open && <Board challenge={challenge} dragonName={dragonName} stage={stage} onClose={onClose} />}
    </Dialog>
  );
}

/** What's happening, in words: shown under the symbols and announced politely. */
function statusOf(game: PatternGame): string {
  const length = roundPattern(game).length;
  switch (game.phase) {
    case 'ready':
      return `Round ${game.round + 1} of ${ROUNDS}: a pattern of ${length}. Ready when you are.`;
    case 'showing':
      // Between steps the caption stays on the last one, so each step is announced once.
      return game.shown === 0 ? 'Watch closely…' : `${game.shown} of ${length}: ${nameOf(roundPattern(game)[game.shown - 1])}`;
    case 'repeat':
      if (game.missed) return "Not quite, and that's okay. Try again from the start, or watch it again.";
      return game.entered.length === 0 ? 'Your turn: tap the symbols in the same order.' : `${nameOf(game.entered[game.entered.length - 1])}. ${game.entered.length} of ${length}.`;
    case 'roundDone':
      return 'Lovely! You remembered it.';
    case 'won':
      return '';
  }
}

function Board({ challenge, dragonName, stage, onClose }: { challenge: Challenge; dragonName: string; stage: DragonStage; onClose: () => void }) {
  const game = useSyncExternalStore(challenge.subscribe, challenge.game);
  const [inWords, setInWords] = useState(false);
  const showRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const shownPhase = useRef(game.phase);
  const focusShow = useRef(false);

  // Focus follows the game only when the control it was on goes away:
  // a finished round offers Next round; a win goes to the message; a new round back to Show.
  useEffect(() => {
    if (game.phase !== shownPhase.current) {
      if (game.phase === 'roundDone') nextRef.current?.focus();
      if (game.phase === 'won') doneRef.current?.focus();
    }
    shownPhase.current = game.phase;
    if (focusShow.current) {
      focusShow.current = false;
      showRef.current?.focus();
    }
  }, [game]);

  // The words are per round: a new pattern starts hidden.
  useEffect(() => setInWords(false), [game.round, game.pattern]);

  const showing = game.phase === 'showing';
  const yourTurn = game.phase === 'repeat';
  const canShow = game.phase === 'ready' || yourTurn;
  const won = game.phase === 'won';
  const length = roundPattern(game).length;
  const secondary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-surface-muted text-fg hover:bg-line';
  const primary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-ember-solid text-white hover:opacity-90';

  return (
    <div className="pb-4" data-pattern-phase={game.phase}>
      <div className="flex justify-between items-center mb-1 gap-2">
        <h2 id="pattern-title" className="serif text-2xl font-bold text-fg">
          Pattern Challenge
        </h2>
        <button type="button" onClick={onClose} aria-label="Close Pattern Challenge" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>
      <p id="pattern-intro" className="text-sm text-fg-muted">
        Watch the symbols light up, then tap them in the same order. No timer, and you can watch again as often as you like. {dragonName} is cheering you on.
      </p>

      <p className="mt-3 text-center text-sm font-bold text-fg" data-round>
        Round {game.round + 1} of {ROUNDS}
      </p>

      <ul aria-label="Symbols" className="mt-3 mx-auto grid max-w-[22rem] grid-cols-2 gap-3">
        {PADS.map(({ id, name }) => {
          const { icon: Icon, color } = LOOK[id];
          const lit = showing && game.lit !== null && roundPattern(game)[game.lit] === id;
          return (
            <li key={id}>
              <button
                type="button"
                data-pad={id}
                data-lit={lit || undefined}
                aria-label={name}
                aria-disabled={!yourTurn || undefined}
                onClick={() => challenge.press(id)}
                className={cn(
                  'relative w-full min-h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-[background-color,border-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60',
                  lit ? 'border-dragon-gold bg-dragon-gold/35 ring-4 ring-dragon-gold/50 motion-safe:scale-105 shadow-lg' : 'border-line bg-surface',
                  yourTurn && 'hover:border-dragon-gold/70',
                )}
              >
                {lit && (
                  <span aria-hidden="true" className="absolute top-1.5 left-2 text-xs font-bold text-fg">
                    {game.lit! + 1}
                  </span>
                )}
                <Icon aria-hidden="true" className={cn('w-10 h-10', color)} strokeWidth={2.25} fill="currentColor" fillOpacity={lit ? 0.35 : 0.15} />
                <span aria-hidden="true" className="text-sm font-bold text-fg">
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* What's been entered so far: one slot per symbol in this round's pattern. */}
      <div aria-hidden="true" className="mt-3 flex justify-center gap-2" data-entered={game.entered.length}>
        {Array.from({ length }, (_, i) => {
          const pad = game.entered[i];
          const Icon = pad ? LOOK[pad].icon : null;
          return (
            <span key={i} className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center', pad ? 'border-dragon-gold bg-dragon-gold/15' : 'border-line')}>
              {Icon && <Icon className={cn('w-4 h-4', LOOK[pad].color)} strokeWidth={2.5} />}
            </span>
          );
        })}
      </div>

      <p role="status" aria-live="polite" data-pattern-message className="mt-3 min-h-10 text-center text-sm text-fg">
        {statusOf(game)}
      </p>

      {!won && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {game.phase === 'roundDone' ? (
            <button
              ref={nextRef}
              type="button"
              onClick={() => {
                focusShow.current = true;
                challenge.nextRound();
              }}
              className={cn(primary, 'sm:col-span-2')}
            >
              Next round
            </button>
          ) : (
            <>
              <button ref={showRef} type="button" aria-disabled={!canShow || undefined} onClick={() => challenge.show()} className={cn(primary, !canShow && 'opacity-60')}>
                {showing ? 'Showing the pattern…' : game.phase === 'ready' ? 'Show the pattern' : 'Watch it again'}
              </button>
              <button type="button" aria-expanded={inWords} aria-controls="pattern-words" onClick={() => setInWords(v => !v)} className={secondary}>
                {inWords ? 'Hide the words' : 'Read it as words'}
              </button>
            </>
          )}
        </div>
      )}
      {inWords && !won && (
        <p id="pattern-words" className="mt-3 text-center text-sm text-fg" data-pattern-words>
          The pattern: {patternInWords(game)}.
        </p>
      )}

      {won && (
        <div className="relative mt-1 p-4 rounded-2xl border border-dragon-gold/50 bg-dragon-gold/10 text-center" data-pattern-complete>
          <Celebration active rounded="rounded-2xl" />
          <h3 ref={doneRef} tabIndex={-1} className="serif text-2xl font-bold text-fg outline-none">
            All three patterns remembered!
          </h3>
          <p className="mt-2 text-fg">
            {stage === DragonStage.EGG ? `Somewhere inside the egg, ${dragonName} is cheering for you.` : `${dragonName} is so proud of you. What a memory!`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                focusShow.current = true;
                challenge.playAgain();
              }}
              className={primary}
            >
              Play Again
            </button>
            <button type="button" onClick={onClose} className={secondary}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

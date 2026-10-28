import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import { Check, Cloud, Flame, Heart, Leaf, Moon, Sun, X } from 'lucide-react';
import { DragonStage } from '../types';
import { MemoryMatchGame, PAIRS, Round, SYMBOLS, SymbolId, isFaceUp, pairsFound } from '../lib/memoryMatch';
import { cn } from '../lib/utils';
import { Celebration } from './Celebration';
import { Dialog } from './Dialog';

/** Six shapes that differ in outline as well as colour. */
const LOOK: Record<SymbolId, { icon: typeof Heart; color: string }> = {
  heart: { icon: Heart, color: 'text-rose-600 dark:text-rose-300' },
  moon: { icon: Moon, color: 'text-violet-700 dark:text-violet-300' },
  sun: { icon: Sun, color: 'text-gold-fg' },
  leaf: { icon: Leaf, color: 'text-emerald-700 dark:text-emerald-300' },
  cloud: { icon: Cloud, color: 'text-sky-700 dark:text-sky-300' },
  flame: { icon: Flame, color: 'text-ember-fg' },
};

const COLUMNS = 4;
const nameOf = (symbol: SymbolId) => SYMBOLS.find(s => s.id === symbol)!.name;

interface MemoryMatchProps {
  open: boolean;
  onClose: () => void;
  /** The round for this page session (it outlives the dialog). */
  game: MemoryMatchGame;
  dragonName: string;
  stage: DragonStage;
}

/**
 * Memory Match: turn over two cards at a time and find the six pairs.
 * Just for fun: no score, no timer, nothing saved.
 */
export function MemoryMatch({ open, onClose, game, dragonName, stage }: MemoryMatchProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="memory-match-title"
      describedBy="memory-match-intro"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[90vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      {open && <Board game={game} dragonName={dragonName} stage={stage} onClose={onClose} />}
    </Dialog>
  );
}

/** What a pick just did, in words (shown, and announced politely). */
function describe(before: Round, after: Round): string | null {
  if (after === before || after.status === 'won') return null;
  if (after.status === 'mismatch') {
    const [a, b] = after.faceUp.map(i => nameOf(after.cards[i].symbol));
    return `${a} and ${b} aren't a match. They'll turn back over.`;
  }
  if (pairsFound(after) > pairsFound(before)) {
    const matched = after.cards.findIndex((card, i) => card.matched && !before.cards[i].matched);
    return `A match: ${nameOf(after.cards[matched].symbol)}! ${pairsFound(after)} of ${PAIRS} pairs found.`;
  }
  return `${nameOf(after.cards[after.faceUp[0]].symbol)}. Now find its partner.`;
}

function Board({ game, dragonName, stage, onClose }: { game: MemoryMatchGame; dragonName: string; stage: DragonStage; onClose: () => void }) {
  const round = useSyncExternalStore(game.subscribe, game.round);
  const [message, setMessage] = useState('');
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const shownStatus = useRef(round.status);
  const focusFirstCard = useRef(false);

  // Finishing moves focus to the message, so it's heard; a new round moves it to the first card.
  useEffect(() => {
    if (round.status === 'won' && shownStatus.current !== 'won') doneRef.current?.focus();
    shownStatus.current = round.status;
    if (focusFirstCard.current) {
      focusFirstCard.current = false;
      cardRefs.current[0]?.focus();
    }
  }, [round]);

  const choose = (index: number) => {
    const before = game.round();
    game.pick(index);
    const said = describe(before, game.round());
    if (said) setMessage(said);
  };

  const playAgain = () => {
    focusFirstCard.current = true;
    game.playAgain();
    setMessage('New round: the cards are shuffled.');
  };

  const won = round.status === 'won';
  const found = pairsFound(round);
  const secondary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-surface-muted text-fg hover:bg-line';
  const primary = 'min-h-11 px-4 rounded-2xl text-sm font-bold bg-ember-solid text-white hover:opacity-90';

  return (
    <div className="pb-4" data-memory-status={round.status}>
      <div className="flex justify-between items-center mb-1 gap-2">
        <h2 id="memory-match-title" className="serif text-2xl font-bold text-fg">
          Memory Match
        </h2>
        <button type="button" onClick={onClose} aria-label="Close Memory Match" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>
      <p id="memory-match-intro" className="text-sm text-fg-muted">
        Turn over two cards at a time and find all six pairs. No rush: {dragonName} is cheering you on.
      </p>

      <p className="mt-3 text-center text-sm font-bold text-fg" data-pairs-found>
        Pairs found: {found}/{PAIRS}
      </p>

      <ul aria-label="Cards" className="mt-3 mx-auto grid max-w-[26rem] grid-cols-4 gap-2 sm:gap-3">
        {round.cards.map((card, i) => {
          const up = isFaceUp(round, i);
          const where = `Row ${Math.floor(i / COLUMNS) + 1}, column ${(i % COLUMNS) + 1}`;
          const { icon: Icon, color } = LOOK[card.symbol];
          return (
            <li key={i} className="aspect-square">
              <button
                ref={el => {
                  cardRefs.current[i] = el;
                }}
                type="button"
                data-card={i}
                data-state={card.matched ? 'matched' : up ? 'up' : 'down'}
                aria-label={`${where}: ${up ? nameOf(card.symbol) : 'face down'}${card.matched ? ', matched' : ''}`}
                aria-disabled={card.matched || undefined}
                onClick={() => choose(i)}
                className={cn(
                  'relative h-full w-full rounded-2xl border-2 flex items-center justify-center overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-dragon-gold/60',
                  !up && 'border-dragon-gold/50 bg-ember-solid hover:border-dragon-gold',
                  up && !card.matched && 'border-dragon-gold/70 bg-surface',
                  card.matched && 'border-dragon-gold bg-dragon-gold/15',
                )}
              >
                {/* Turning over: a quick, small turn (none with reduced motion). The symbol is only in the page once it's face up. */}
                <motion.span
                  key={up ? 'up' : 'down'}
                  aria-hidden="true"
                  initial={{ rotateY: 90 }}
                  animate={{ rotateY: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex h-full w-full items-center justify-center"
                >
                  {up ? (
                    <Icon className={cn('w-1/2 h-1/2', color)} strokeWidth={2.25} fill="currentColor" fillOpacity={0.18} />
                  ) : (
                    <span className="h-full w-full flex items-center justify-center bg-[radial-gradient(rgba(255,255,255,0.16)_1.5px,transparent_2px)] bg-[length:10px_10px]">
                      <span className="w-1/4 h-1/4 rotate-45 rounded-sm border-2 border-dragon-gold/80" />
                    </span>
                  )}
                </motion.span>
                {card.matched && (
                  <Check aria-hidden="true" className="absolute top-1 right-1 w-3.5 h-3.5 text-gold-fg" strokeWidth={3} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p role="status" aria-live="polite" data-memory-message className="mt-3 min-h-10 text-center text-sm text-fg-muted">
        {won ? '' : message}
      </p>

      {won && (
        <div className="relative mt-1 p-4 rounded-2xl border border-dragon-gold/50 bg-dragon-gold/10 text-center" data-memory-complete>
          <Celebration active rounded="rounded-2xl" />
          <h3 ref={doneRef} tabIndex={-1} className="serif text-2xl font-bold text-fg outline-none">
            All six pairs found!
          </h3>
          <p className="mt-2 text-fg">
            {stage === DragonStage.EGG
              ? `${dragonName}'s egg gives a happy little wiggle. What a memory!`
              : `${dragonName} does a happy little dance. What a memory!`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={playAgain} className={primary}>
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

// Choosing what Ember says (#18). Pure logic over the data in library.ts.

import { DragonStage } from '../../types';
import { DialogueContext, Expression, LIBRARY, Line } from './library';

export interface Spoken {
  id: string;
  /** Rendered text; *asterisks* still mark narration. */
  text: string;
  expression: Expression;
}

export interface SpeakingAs {
  stage: DragonStage;
  dragonName: string;
  /** Optional; there's no name setting yet, so lines read naturally without it. */
  playerName?: string;
  /** A hard day (low-mood check-in today): gentle lines only. */
  soft?: boolean;
  /** For Bond level-up lines. */
  level?: number;
}

const canSay = (line: Line, stage: DragonStage) =>
  line.stages ? line.stages.includes(stage) : stage !== DragonStage.EGG;

/**
 * The lines Ember could say right now. On a hard day only gentle ones; if a
 * context has none for his stage, he says something supportive instead.
 */
export function candidates(context: DialogueContext, as: SpeakingAs): Line[] {
  const all = LIBRARY[context].filter(line => canSay(line, as.stage));
  if (!as.soft) return all;
  const gentle = all.filter(line => line.gentle);
  return gentle.length ? gentle : LIBRARY.support.filter(line => canSay(line, as.stage));
}

/** Fills in placeholders. Without a player name, ", {playerName}" is dropped. */
export function render(text: string, as: SpeakingAs): string {
  const named = as.playerName?.trim();
  const withName = named ? text.replace(/\{playerName\}/g, named) : text.replace(/,? \{playerName\}/g, '');
  return withName
    .replace(/\{dragonName\}/g, as.dragonName)
    .replace(/\{level\}/g, String(as.level ?? ''));
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'lateNight';

/** Local time of day: morning 5–11, afternoon 12–16, evening 17–20, late night otherwise. */
export function timeOfDay(now: Date): TimeOfDay {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'lateNight';
}

/**
 * A speaker that never repeats a line immediately. Each pool is a shuffle
 * bag: every line comes up once before any comes up again, and the next line
 * is never the same text as the one just said (in any context).
 */
export function createSpeaker(random: () => number = Math.random) {
  const bags = new Map<string, string[]>();
  let lastText: string | undefined;

  return {
    say(context: DialogueContext, as: SpeakingAs): Spoken | null {
      const pool = candidates(context, as);
      if (pool.length === 0) return null;
      const textOf = (id: string) => render(pool.find(line => line.id === id)!.text, as);
      const ids = pool.map(line => line.id);
      const key = `${context}|${as.stage}|${as.soft ? 'soft' : ''}`;

      let bag = (bags.get(key) ?? []).filter(id => ids.includes(id));
      if (bag.length === 0) bag = shuffle(ids, random);
      let index = bag.findIndex(id => textOf(id) !== lastText);
      if (index === -1) {
        // Only the line just said is left in this round: start the next round first.
        const others = ids.filter(id => textOf(id) !== lastText);
        if (others.length) bag = [...shuffle(others, random), ...bag];
        index = 0;
      }
      const [id] = bag.splice(index, 1);
      bags.set(key, bag);
      const line = pool.find(l => l.id === id)!;
      lastText = textOf(id);
      return { id, text: lastText, expression: line.expression };
    },
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** How often a tap finds Ember "helping" build himself (the founder Easter egg). */
export const FOUNDER_CHANCE = 1 / 25;
/** Tap again within this time after Part A and he gets caught (Part B). */
export const FOUNDER_CAUGHT_MS = 8000;

/**
 * How likely a tap finds Ember at the keyboard. Development and test builds
 * accept `__emberEasterEggChance` (0 or 1) so browser tests never depend on
 * chance; production builds compile the override out and always use
 * FOUNDER_CHANCE.
 */
export function founderChance(): number {
  if (import.meta.env.DEV) {
    const override = (globalThis as { __emberEasterEggChance?: unknown }).__emberEasterEggChance;
    if (typeof override === 'number') return override;
  }
  return FOUNDER_CHANCE;
}

/**
 * What a tap on Ember says. Rarely, he's caught "helping" build himself: the
 * DFS founder Easter egg (a fun discovery, not a wellness message). Both
 * halves only happen to a hatched dragon, never on a hard day, and never while
 * something meaningful is going on (a focus session, running or paused):
 * then a tap is just an ordinary musing. `chance` is founderChance() in the
 * app; tests pass 0 or 1.
 */
export function tapContext(opts: {
  napping: boolean;
  soft: boolean;
  busy: boolean;
  stage: DragonStage;
  random: number;
  chance: number;
  msSinceFounderLine: number | null;
}): DialogueContext {
  if (opts.napping) return 'return.napping';
  if (opts.stage === DragonStage.EGG || opts.soft || opts.busy) return 'idle';
  if (opts.msSinceFounderLine !== null && opts.msSinceFounderLine <= FOUNDER_CAUGHT_MS) return 'founder.caught';
  return opts.random < opts.chance ? 'founder' : 'idle';
}

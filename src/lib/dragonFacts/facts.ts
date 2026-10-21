// The Daily Dragon Fact library (#18). Data only; selection lives in daily.ts.
//
// Two kinds, always labeled differently in the app:
// - 'real': a real-world fact about something called "dragon". Each MUST be
//   checked against the cited source page before it's added (#18: every
//   real-world fact is verified against a reliable source).
// - 'lore': Ember's world. Fiction, clearly framed as just for fun.
//
// Lore lines 1–4 come from the approved dialogue library v0.2; lines marked
// "new" were written for this feature and are listed in the PR for review.

interface Source {
  /** The page's title. */
  title: string;
  /** Who published it (museum, zoo, university, …). */
  publisher: string;
  url: string;
  /** When the claim was checked on that page (YYYY-MM-DD). */
  checked: string;
}

export type DragonFact =
  | { id: string; kind: 'real'; text: string; source: Source }
  | { id: string; kind: 'lore'; text: string };

/**
 * Verified real-world facts. Empty until they can be checked against their
 * sources (the source sites were unreachable from the build environment).
 */
export const REAL_FACTS: DragonFact[] = [];

export const LORE_FACTS: DragonFact[] = [
  { id: 'lore-kind-voices', kind: 'lore', text: "Dragon eggs stay warm by listening to kind voices. That's why you talk to me." },
  { id: 'lore-sparkle-sneezes', kind: 'lore', text: "Young dragons sneeze sparkles. It's very embarrassing." },
  { id: 'lore-hoard', kind: 'lore', text: "A dragon's hoard isn't really about gold. It's about keeping the things that matter close." },
  { id: 'lore-sunrises', kind: 'lore', text: 'Ancient dragons remember every sunrise they shared with a friend.' },
  // new
  { id: 'lore-petal-scales', kind: 'lore', text: 'Dragon eggs grow new petal scales on cozy days. Petal Ember eggs have the most of all.' },
  { id: 'lore-tail-flame', kind: 'lore', text: "A dragon's tail flame flickers brighter when they're happy. Mine is very bright right now." },
  { id: 'lore-sunbeam-treasure', kind: 'lore', text: "Dragons count treasure in sunbeams, not coins. It's a much warmer kind of rich." },
  { id: 'lore-flying-practice', kind: 'lore', text: 'Hatchlings practice flying by flapping very hard while standing completely still.' },
  { id: 'lore-hiding-spot', kind: 'lore', text: "A dragon's best hiding spot is always behind the snack they just took." },
  { id: 'lore-nap-purrs', kind: 'lore', text: 'Dragon naps are measured in purrs. A good nap is about a thousand purrs long.' },
  { id: 'lore-drake-guard', kind: 'lore', text: "Drakes guard whatever they love most. Sometimes that's gold. Usually it's a person." },
  { id: 'lore-wing-wave', kind: 'lore', text: "Coral-red wings glow a little at sunset. It's how dragons wave goodbye to the day." },
];

export const FACTS: DragonFact[] = [...REAL_FACTS, ...LORE_FACTS];

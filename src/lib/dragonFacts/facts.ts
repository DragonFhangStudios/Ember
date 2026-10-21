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
  /** Who opened the page and checked the claim. */
  checkedBy: string;
}

export type DragonFact =
  | { id: string; kind: 'real'; text: string; source: Source }
  | { id: string; kind: 'lore'; text: string };

/**
 * Real-world facts. Each claim was checked directly on the cited publisher
 * page by the AI Council (ChatGPT) on 2026-10-21; the wording is a paraphrase
 * of that page. (The build environment couldn't reach these sites, so Claude
 * Code recorded the citations but did not re-open the pages.)
 */
const COUNCIL = 'ChatGPT (AI Council)';
const SOURCES = {
  A: { title: 'Komodo dragon', publisher: "Smithsonian's National Zoo", url: 'https://www.nationalzoo.si.edu/animals/komodo-dragon', checked: '2026-10-21', checkedBy: COUNCIL },
  B: { title: 'Leafy sea dragon', publisher: 'Monterey Bay Aquarium', url: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/leafy-sea-dragon', checked: '2026-10-21', checkedBy: COUNCIL },
  C: { title: 'Draco volans (Common Flying Dragon)', publisher: 'University of Michigan, Animal Diversity Web', url: 'https://animaldiversity.org/accounts/Draco_volans/', checked: '2026-10-21', checkedBy: COUNCIL },
  D: { title: 'Dragonflies: The ultimate hunters', publisher: 'Natural History Museum, London', url: 'https://www.nhm.ac.uk/discover/dragonflies-the-ultimate-hunters.html', checked: '2026-10-21', checkedBy: COUNCIL },
  E: { title: 'Griffinflies: The earliest flying insects', publisher: 'Natural History Museum, London', url: 'https://www.nhm.ac.uk/discover/giant-dragonflies.html', checked: '2026-10-21', checkedBy: COUNCIL },
  F: { title: 'Top tricksters: Plants winning at pollination', publisher: 'Royal Botanic Gardens, Kew', url: 'https://www.kew.org/read-and-watch/top-plant-pollination-tricks', checked: '2026-10-21', checkedBy: COUNCIL },
} satisfies Record<string, Source>;

export const REAL_FACTS: DragonFact[] = [
  { id: 'komodo-largest-lizard', kind: 'real', text: 'Komodo dragons are the largest living lizards in the world.', source: SOURCES.A },
  { id: 'komodo-tongue-smell', kind: 'real', text: 'Komodo dragons use their forked tongues to sample the air and help them smell.', source: SOURCES.A },
  { id: 'komodo-venomous-bite', kind: 'real', text: 'Komodo dragons are among the lizards with venomous bites.', source: SOURCES.A },
  { id: 'komodo-big-meal', kind: 'real', text: 'An adult Komodo dragon can consume up to 80% of its body weight in a single meal.', source: SOURCES.A },
  { id: 'leafy-sea-dragon-camouflage', kind: 'real', text: 'Leafy sea dragons blend into seaweed with their leaflike fins and frilly appendages.', source: SOURCES.B },
  { id: 'leafy-sea-dragon-dads-carry-eggs', kind: 'real', text: 'Male leafy sea dragons carry developing eggs underneath their tails, rather than in a pouch.', source: SOURCES.B },
  { id: 'leafy-sea-dragon-300-eggs', kind: 'real', text: "Female leafy sea dragons can transfer up to 300 eggs to a male's brood patch.", source: SOURCES.B },
  { id: 'leafy-sea-dragon-shrimp', kind: 'real', text: 'Leafy sea dragons slurp up small shrimp through their tube-shaped mouths.', source: SOURCES.B },
  { id: 'flying-dragon-gliding', kind: 'real', text: 'Flying dragon lizards glide with winglike skin supported by elongated ribs.', source: SOURCES.C },
  { id: 'flying-dragon-dewlap', kind: 'real', text: 'Male common flying dragons have a bright yellow throat flap called a dewlap.', source: SOURCES.C },
  { id: 'dragonfly-nymphs-underwater', kind: 'real', text: 'Young dragonflies spend their nymph stage living underwater.', source: SOURCES.D },
  { id: 'dragonfly-nymph-lip', kind: 'real', text: 'Dragonfly nymphs catch prey using an extendable, hinged lower lip.', source: SOURCES.D },
  { id: 'dragonfly-no-stinger', kind: 'real', text: "Dragonflies can bite when threatened, but they don't have stingers.", source: SOURCES.D },
  { id: 'griffinfly-wingspan', kind: 'real', text: 'Around 300 million years ago, giant dragonfly-like insects called griffinflies had wingspans reaching about 71 centimeters (28 inches).', source: SOURCES.E },
  { id: 'dragon-fruit-cactus', kind: 'real', text: 'Dragon fruit grows on cactus plants.', source: SOURCES.F },
  { id: 'dragon-fruit-bats', kind: 'real', text: 'Some dragon fruit cactus flowers attract bats that help pollinate them.', source: SOURCES.F },
];

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

// Quest category colors in both themes. Categories (including players' custom
// quest types, which are saved with these class strings) store their light-
// mode classes; these maps add the dark-mode look at render time. Tailwind
// only generates classes it can see whole, so every variant is spelled out.

const CHIPS: Record<string, string> = {
  'text-blue-500 bg-blue-50': 'text-blue-500 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15',
  'text-purple-500 bg-purple-50': 'text-purple-500 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15',
  'text-emerald-500 bg-emerald-50': 'text-emerald-500 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15',
  'text-amber-500 bg-amber-50': 'text-amber-500 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15',
  'text-rose-500 bg-rose-50': 'text-rose-500 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/15',
  'text-orange-500 bg-orange-50': 'text-orange-500 bg-orange-50 dark:text-orange-300 dark:bg-orange-500/15',
  'text-dragon-gold bg-dragon-gold/10': 'text-dragon-gold bg-dragon-gold/10 dark:bg-dragon-gold/15',
  'text-dragon-ember bg-dragon-ember/10': 'text-dragon-ember bg-dragon-ember/10 dark:bg-dragon-ember/15',
};

/** Icon chip classes for a category's stored color (unknown values pass through). */
export const chipClasses = (stored: string) => CHIPS[stored] ?? stored;

const LABELS: Record<string, string> = {
  'text-blue-500 bg-blue-50': 'text-blue-700 dark:text-blue-300',
  'text-purple-500 bg-purple-50': 'text-purple-700 dark:text-purple-300',
  'text-emerald-500 bg-emerald-50': 'text-emerald-700 dark:text-emerald-300',
  'text-amber-500 bg-amber-50': 'text-amber-700 dark:text-amber-300',
  'text-rose-500 bg-rose-50': 'text-rose-700 dark:text-rose-300',
  'text-orange-500 bg-orange-50': 'text-orange-700 dark:text-orange-300',
};

/** Readable text color for a color's name (e.g. "Purple" in the color picker). */
export const labelClasses = (stored: string) => LABELS[stored] ?? 'text-fg';

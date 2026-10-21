import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Monitor, Moon, Palette, RotateCcw, Sun, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { ThemePreference } from '../lib/theme';

const DEFAULT_BACKGROUND = '#F5F5F0';
const APPEARANCES = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
] as const;

const BACKGROUND_COLORS = [
  { name: 'Warm White', value: DEFAULT_BACKGROUND },
  { name: 'Soft Blue', value: '#EBF5FF' },
  { name: 'Mint Green', value: '#F0FFF4' },
  { name: 'Lavender', value: '#F5F3FF' },
  { name: 'Peach', value: '#FFF5F5' },
  { name: 'Sunset', value: '#FFF7ED' },
];

interface SettingsSheetProps {
  isOpen: boolean;
  /** Unset means the default background. */
  themeColor?: string;
  theme: ThemePreference;
  onClose: () => void;
  onThemeChange: (color: string) => void;
  onThemePreference: (preference: ThemePreference) => void;
  /** Opens the reset confirmation; nothing is reset from here directly. */
  onResetRequest: () => void;
}

/** A bottom sheet for appearance and data settings, so the header fits a phone. */
export function SettingsSheet({ isOpen, themeColor, theme, onClose, onThemeChange, onThemePreference, onResetRequest }: SettingsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const background = (themeColor ?? DEFAULT_BACKGROUND).toLowerCase();

  useEffect(() => {
    if (!isOpen) return;
    // Move focus into the sheet, and back to whatever opened it on close.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-dragon-ink/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="sheet-safe relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="settings-title" className="serif text-2xl font-bold text-fg">Settings</h2>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close settings"
                className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <section className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-3">Background color</h3>
              <div className="flex flex-wrap gap-3">
                {BACKGROUND_COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => onThemeChange(color.value)}
                    aria-label={color.name}
                    aria-pressed={background === color.value.toLowerCase()}
                    className={cn(
                      'w-11 h-11 rounded-full border-2 transition-all',
                      background === color.value.toLowerCase() ? 'border-dragon-gold shadow-sm' : 'border-dragon-muted/20',
                    )}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
                <span className="relative w-11 h-11">
                  <input
                    type="color"
                    value={background}
                    onChange={e => onThemeChange(e.target.value)}
                    aria-label="Custom background color"
                    className="color-swatch-input w-11 h-11 p-0 rounded-full border-none cursor-pointer bg-transparent"
                  />
                  <Palette aria-hidden="true" className="absolute inset-0 m-auto w-5 h-5 pointer-events-none text-fg-muted" />
                </span>
              </div>
            </section>

            <fieldset className="mb-6">
              <legend className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-3">Appearance</legend>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-muted">
                {APPEARANCES.map(({ value, label, icon: Icon }) => (
                  <label key={value} className="relative">
                    {/* The native radio covers the whole segment, so the tap target is the full size. */}
                    <input
                      type="radio"
                      name="appearance"
                      value={value}
                      checked={theme === value}
                      onChange={() => onThemePreference(value)}
                      className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <span className="min-h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-fg-muted transition-colors peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-dragon-gold">
                      <Icon aria-hidden="true" className="w-4 h-4" />
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="pt-4 border-t border-line">
              <button
                onClick={onResetRequest}
                className="w-full min-h-12 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border border-red-500/40 text-red-700 dark:text-red-400 font-bold hover:bg-red-500/5 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Reset progress…
              </button>
            </section>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

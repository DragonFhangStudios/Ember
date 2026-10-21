import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Moon, Palette, RotateCcw, X } from 'lucide-react';
import { cn } from '../lib/utils';

const DEFAULT_BACKGROUND = '#F5F5F0';
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
  isDarkMode?: boolean;
  onClose: () => void;
  onThemeChange: (color: string) => void;
  onToggleDarkMode: () => void;
  /** Opens the reset confirmation; nothing is reset from here directly. */
  onResetRequest: () => void;
}

/** A bottom sheet for appearance and data settings, so the header fits a phone. */
export function SettingsSheet({ isOpen, themeColor, isDarkMode, onClose, onThemeChange, onToggleDarkMode, onResetRequest }: SettingsSheetProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const background = (themeColor ?? DEFAULT_BACKGROUND).toLowerCase();

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
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
            className="sheet-safe relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-[var(--card-bg)] rounded-t-3xl shadow-2xl border-t border-[var(--border-color)] px-6 pt-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 id="settings-title" className="serif text-2xl font-bold text-[var(--text-primary)]">Settings</h2>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close settings"
                className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <section className="mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-3">Background color</h3>
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
                  <Palette aria-hidden="true" className="absolute inset-0 m-auto w-5 h-5 pointer-events-none text-dragon-muted" />
                </span>
              </div>
            </section>

            <section className="mb-6">
              <button
                role="switch"
                aria-checked={!!isDarkMode}
                onClick={onToggleDarkMode}
                className="w-full min-h-12 flex items-center justify-between gap-3 rounded-2xl px-4 py-2 bg-dragon-warm/50 text-[var(--text-primary)]"
              >
                <span className="flex items-center gap-3 font-bold">
                  <Moon className="w-5 h-5 text-[var(--text-secondary)]" />
                  Dark mode
                </span>
                <span
                  aria-hidden="true"
                  className={cn('w-12 h-7 rounded-full p-1 transition-colors', isDarkMode ? 'bg-dragon-ember' : 'bg-dragon-muted/30')}
                >
                  <span className={cn('block w-5 h-5 rounded-full bg-white shadow transition-transform', isDarkMode && 'translate-x-5')} />
                </span>
              </button>
            </section>

            <section className="pt-4 border-t border-[var(--border-color)]">
              <button
                onClick={onResetRequest}
                className="w-full min-h-12 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border border-red-500/40 text-red-500 font-bold hover:bg-red-500/5 transition-colors"
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

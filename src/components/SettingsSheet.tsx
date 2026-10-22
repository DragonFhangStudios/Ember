import { useRef } from 'react';
import { Download, History, Monitor, Moon, Palette, RotateCcw, Sun, Upload, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { ThemePreference } from '../lib/theme';
import { Dialog } from './Dialog';

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
  /** False when there's no save to export or import into (preview mode). */
  saveAvailable: boolean;
  /** How many replaced saves are kept on this device. */
  backupCount: number;
  onExport: () => void;
  /** A file the player picked; it's checked and confirmed before anything changes. */
  onImportFile: (file: File) => void;
  onShowBackups: () => void;
}

/** A bottom sheet for appearance and data settings, so the header fits a phone. */
export function SettingsSheet({
  isOpen,
  themeColor,
  theme,
  onClose,
  onThemeChange,
  onThemePreference,
  onResetRequest,
  saveAvailable,
  backupCount,
  onExport,
  onImportFile,
  onShowBackups,
}: SettingsSheetProps) {
  const background = (themeColor ?? DEFAULT_BACKGROUND).toLowerCase();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const action = 'w-full min-h-11 flex items-center gap-3 rounded-2xl px-4 py-2 bg-surface-muted text-fg font-bold text-left disabled:opacity-60';

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      labelledBy="settings-title"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[85vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 id="settings-title" className="serif text-2xl font-bold text-fg">Settings</h2>
        <button
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

      <section className="mb-6" aria-labelledby="your-save-title">
        <h3 id="your-save-title" className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-2">Your save</h3>
        <p id="your-save-description" className="text-sm text-fg-muted mb-3">
          Your save lives only on this device. Export a copy to keep it safe or to move it to another device by hand.
          The file includes your check-ins and notes, so keep it somewhere private.
        </p>
        {!saveAvailable && (
          <p className="text-sm text-fg-muted mb-3">Saving isn't available right now (preview mode), so there's nothing to export or import into.</p>
        )}
        <div className="flex flex-col gap-2">
          <button onClick={onExport} disabled={!saveAvailable} className={action}>
            <Download aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
            Export save
          </button>
          <button onClick={() => fileInputRef.current?.click()} disabled={!saveAvailable} className={action}>
            <Upload aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
            Import save…
          </button>
          {backupCount > 0 && (
            <button onClick={onShowBackups} disabled={!saveAvailable} className={action}>
              <History aria-hidden="true" className="w-5 h-5 flex-shrink-0" />
              Restore a backup… <span className="ml-auto text-sm font-medium text-fg-muted">{backupCount}</span>
            </button>
          )}
        </div>
        {/* The real file picker, opened by "Import save…". */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Choose a save file to import"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = ''; // the same file can be picked again
            if (file) onImportFile(file);
          }}
        />
      </section>

      <section className="pt-4 border-t border-line">
        <button
          onClick={onResetRequest}
          className="w-full min-h-12 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 border border-red-500/40 text-red-700 dark:text-red-400 font-bold hover:bg-red-500/5 transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
          Reset progress…
        </button>
      </section>
    </Dialog>
  );
}

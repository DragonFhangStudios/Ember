import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { collectDiagnostics } from '../lib/diagnostics';
import { Dialog } from './Dialog';

interface PrivacyDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * What Ember keeps on this device and what this build sends over the network,
 * in plain words, plus diagnostics the player can copy for feedback. Nothing
 * is sent from here; copying is the player's choice.
 */
export function PrivacyDialog({ open, onClose }: PrivacyDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="privacy-title"
      describedBy="privacy-lead"
      variant="sheet"
      panelClassName="sheet-safe max-w-2xl max-h-[85vh] overflow-y-auto bg-surface rounded-t-3xl shadow-2xl border-t border-line px-6 pt-4"
    >
      {open && <Content onClose={onClose} />}
    </Dialog>
  );
}

function Content({ onClose }: { onClose: () => void }) {
  const [diagnostics, setDiagnostics] = useState('');
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  useEffect(() => {
    let current = true;
    collectDiagnostics().then(text => current && setDiagnostics(text));
    return () => {
      current = false;
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied('copied');
    } catch {
      // No clipboard access (e.g. not HTTPS): the text is selectable below.
      setCopied('manual');
    }
  };

  const heading = 'text-xs font-bold uppercase tracking-widest text-fg-muted mb-2 mt-5';
  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h2 id="privacy-title" className="serif text-2xl font-bold text-fg">Privacy and your data</h2>
        <button onClick={onClose} aria-label="Close privacy" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg">
          <X className="w-6 h-6" />
        </button>
      </div>
      <p id="privacy-lead" className="text-sm text-fg">
        Everything you do in Ember stays on this device. There are no accounts, analytics, ads or tracking, and your check-ins
        and notes never leave your phone or computer.
      </p>

      <h3 className={heading}>Kept on this device</h3>
      <ul className="list-disc pl-5 text-sm text-fg-muted space-y-1">
        <li>Your save: Ember, quests, rewards, focus sessions, settings, and your check-ins with their notes (in this browser's storage).</li>
        <li>Up to 3 earlier saves, kept when a save is imported, restored or reset.</li>
        <li>Two small settings: your light/dark preference (so the right theme shows instantly) and a random device id (so Bond earned on different devices stays separate in your save).</li>
        <li>If you used Ember before its current save system, your old save is kept untouched as a backup.</li>
      </ul>

      <h3 className={heading}>Sent over the network</h3>
      <ul className="list-disc pl-5 text-sm text-fg-muted space-y-1">
        <li>Only loading Ember itself: your browser downloads the app's files from wherever it's hosted, and that host can see your IP address, as with any website.</li>
        <li>Fonts and images are part of the app, so nothing is fetched from other sites.</li>
        <li>Links you choose to open (like a Daily Dragon Fact's source) go to those sites.</li>
        <li>Exported save files go only where you save them. They include your check-ins and notes, so keep them private.</li>
      </ul>

      <h3 className={heading}>Feedback</h3>
      <p className="text-sm text-fg-muted mb-3">
        If something goes wrong, you can copy these technical details into your message. They describe the app and your
        browser only, never your check-ins, notes or save. Nothing is sent automatically.
      </p>
      <textarea
        readOnly
        value={diagnostics}
        aria-label="Diagnostics"
        rows={10}
        onFocus={e => e.currentTarget.select()}
        className="w-full px-3 py-2 rounded-xl bg-surface-muted border-none text-xs font-mono text-fg resize-none"
      />
      <button
        onClick={copy}
        disabled={!diagnostics}
        className="mt-3 w-full min-h-11 flex items-center justify-center gap-2 rounded-2xl px-4 py-2 bg-fg text-surface font-bold disabled:opacity-60"
      >
        {copied === 'copied' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
        {copied === 'copied' ? 'Copied' : 'Copy diagnostics'}
      </button>
      <p aria-live="polite" data-copy-status className="text-xs text-fg-muted mt-2 min-h-4">
        {copied === 'copied' && 'Copied. Paste them into your feedback.'}
        {copied === 'manual' && "This browser didn't allow copying. Select the text above and copy it yourself."}
      </p>

      <p className="text-xs text-fg-muted mt-4 mb-2">
        Ember is for habit-tracking and wellness only and isn't medical advice. See the medical disclaimer on the Home screen.
      </p>
    </>
  );
}

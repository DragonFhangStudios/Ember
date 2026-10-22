import { useEffect, useRef } from 'react';
import { AlertTriangle, Download, History, RotateCcw, Upload, X } from 'lucide-react';
import { UserState } from '../types';
import { COSMETICS } from '../constants';
import { SaveSummary, progressLost, summarizeSave } from '../lib/saveFile';
import { BACKUPS_KEPT, BackupReason, SaveBackup } from '../lib/store';
import { Dialog } from './Dialog';

/** What the save dialog is showing. `expectedRev` is the save the player is reviewing against. */
export type SaveDialogState =
  | { kind: 'problem'; title: string; message: string }
  | { kind: 'import'; current: UserState; incoming: UserState; exportedAt: string; expectedRev: number }
  | { kind: 'backups'; current: UserState; backups: SaveBackup<UserState>[]; expectedRev: number }
  | { kind: 'restore'; current: UserState; backup: SaveBackup<UserState>; backups: SaveBackup<UserState>[]; expectedRev: number };

interface SaveTransferDialogProps {
  state: SaveDialogState | null;
  /** True while a replacement is being written (buttons are disabled). */
  busy: boolean;
  onConfirmImport: () => void;
  onDownloadCurrent: () => void;
  onChooseBackup: (backup: SaveBackup<UserState>) => void;
  onBackToBackups: () => void;
  onConfirmRestore: () => void;
  onClose: () => void;
}

const REASONS: Record<BackupReason, string> = {
  import: 'Replaced by an import',
  restore: 'Replaced by a restore',
  reset: 'Replaced by a reset',
};

const day = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const moment = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? 'Unknown'
    : date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const ROWS: [string, (s: SaveSummary) => string][] = [
  ['Dragon', s => `${s.dragonName}, ${s.stage}`],
  ['Active days', s => String(s.activeDays)],
  ['Bond', s => String(s.bond)],
  ['Streak (best)', s => `${s.currentStreak} (${s.bestStreak})`],
  ['Milestones', s => String(s.badges)],
  ['Golden Scales', s => String(s.goldenScales)],
  ['Check-ins', s => String(s.checkIns)],
  ['Focus sessions', s => String(s.focusSessions)],
  ['Last played', s => day(s.lastPlayed)],
];

/** Current save next to the one that would replace it. */
function Comparison({ current, incoming, incomingLabel }: { current: UserState; incoming: UserState; incomingLabel: string }) {
  const a = summarizeSave(current);
  const b = summarizeSave(incoming);
  return (
    <table className="w-full text-sm mb-4">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wider text-fg-muted">
          <th scope="col" className="py-1 pr-2 font-bold"><span className="sr-only">Detail</span></th>
          <th scope="col" className="py-1 pr-2 font-bold">This device now</th>
          <th scope="col" className="py-1 font-bold">{incomingLabel}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {ROWS.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" className="py-1.5 pr-2 text-left font-medium text-fg-muted">{label}</th>
            <td className="py-1.5 pr-2 text-fg">{value(a)}</td>
            <td className="py-1.5 text-fg font-bold">{value(b)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const cosmeticName = (id: string) => COSMETICS.find(item => item.id === id)?.name ?? id;
/** Losses shown before "Show more" (the most personal come first). */
const LOSSES_SHOWN = 4;

/** What the incoming save doesn't have, gently and briefly; the rest is one tap away. */
function LossWarning({ current, incoming, replacing }: { current: UserState; incoming: UserState; replacing: string }) {
  const lost = progressLost(current, incoming, cosmeticName);
  if (!lost.length) return null;
  const shown = lost.length > LOSSES_SHOWN ? lost.slice(0, LOSSES_SHOWN - 1) : lost;
  const more = lost.slice(shown.length);
  const list = (items: typeof lost) => (
    <ul className="list-disc pl-5 my-1 space-y-0.5">
      {items.map(loss => (
        <li key={loss.kind} data-loss={loss.kind}>{loss.text}</li>
      ))}
    </ul>
  );
  return (
    <div role="note" className="mb-4 p-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 text-sm text-fg flex gap-2">
      <AlertTriangle aria-hidden="true" className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0">
        <p>{replacing} doesn't have everything that's on this device:</p>
        {list(shown)}
        {more.length > 0 && (
          <details>
            <summary className="cursor-pointer font-bold min-h-11 flex items-center">Show {more.length} more</summary>
            {list(more)}
          </details>
        )}
        <p className="mt-1">Your current save will be kept as a backup in this browser, so you can restore it from Settings.</p>
      </div>
    </div>
  );
}

/** What the automatic backups can't protect against, near every replacement. */
const BACKUP_LIMITS = `Ember keeps up to ${BACKUPS_KEPT} replaced saves in this browser. Clearing the browser's site data deletes them along with your save; an exported file is a separate copy.`;

/**
 * Import, restore, and problems with save files. Every replacement shows the
 * current save beside the incoming one and needs an explicit confirmation;
 * Cancel is the default focus, and the replaced save is always kept as a backup.
 */
export function SaveTransferDialog(props: SaveTransferDialogProps) {
  const { state, onClose } = props;
  return (
    <Dialog
      open={state !== null}
      onClose={onClose}
      labelledBy="save-dialog-title"
      describedBy="save-dialog-description"
      panelClassName="max-w-md max-h-[90vh] overflow-y-auto bg-surface rounded-3xl p-6 sm:p-8 shadow-2xl border border-line"
    >
      {state && <Content {...props} state={state} />}
    </Dialog>
  );
}

function Content({ state, busy, onConfirmImport, onDownloadCurrent, onChooseBackup, onBackToBackups, onConfirmRestore, onClose }: SaveTransferDialogProps & { state: SaveDialogState }) {
  // Switching views removes the pressed button, so focus moves to the new heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownRef = useRef(state.kind);
  useEffect(() => {
    if (shownRef.current !== state.kind) headingRef.current?.focus();
    shownRef.current = state.kind;
  }, [state.kind]);

  const heading = (text: string) => (
    <h2 id="save-dialog-title" ref={headingRef} tabIndex={-1} className="serif text-2xl font-bold text-fg mb-2 pr-10 outline-none">
      {text}
    </h2>
  );
  const close = (
    <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-fg-muted hover:text-fg">
      <X className="w-5 h-5" />
    </button>
  );
  const cancel = (label = 'Cancel') => (
    <button onClick={onClose} data-autofocus className="w-full min-h-11 py-3 bg-surface-muted text-fg rounded-2xl font-bold">
      {label}
    </button>
  );

  if (state.kind === 'problem') {
    return (
      <>
        {close}
        {heading(state.title)}
        <p id="save-dialog-description" className="text-sm text-fg-muted mb-6">
          {state.message} Your save on this device wasn't changed.
        </p>
        {cancel('OK')}
      </>
    );
  }

  if (state.kind === 'import') {
    return (
      <>
        {close}
        {heading('Replace your save?')}
        <p id="save-dialog-description" className="text-sm text-fg-muted mb-4">
          The file's save would replace the one on this device. It doesn't merge or sync. Your current save is kept as a backup
          you can restore from Settings.
        </p>
        <p className="text-xs text-fg-muted mb-4" data-backup-limits>{BACKUP_LIMITS}</p>
        <Comparison current={state.current} incoming={state.incoming} incomingLabel={`From the file (${day(state.exportedAt)})`} />
        <LossWarning current={state.current} incoming={state.incoming} replacing="The file" />
        <div className="flex flex-col gap-3">
          <button
            onClick={onDownloadCurrent}
            disabled={busy}
            className="w-full min-h-11 py-3 px-4 bg-surface-muted text-fg rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Download className="w-5 h-5" />
            Download current save first
          </button>
          <button
            onClick={onConfirmImport}
            disabled={busy}
            className="w-full min-h-11 py-3 bg-danger-solid text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Upload className="w-5 h-5" />
            Replace My Save
          </button>
          {cancel()}
        </div>
      </>
    );
  }

  if (state.kind === 'backups') {
    return (
      <>
        {close}
        {heading('Restore a backup')}
        <p id="save-dialog-description" className="text-sm text-fg-muted mb-4">
          Saves replaced on this device are kept here (the {state.backups.length === 1 ? 'last one' : `last ${state.backups.length}`}).
          Restoring one keeps your current save as a backup too.
        </p>
        <p className="text-xs text-fg-muted mb-4" data-backup-limits>{BACKUP_LIMITS}</p>
        <ul className="flex flex-col gap-3 mb-4">
          {state.backups.map(backup => {
            const s = summarizeSave(backup.state);
            return (
              <li key={backup.id}>
                <button
                  onClick={() => onChooseBackup(backup)}
                  className="w-full min-h-11 p-3 rounded-2xl border border-line text-left hover:border-dragon-gold/50 flex items-center gap-3"
                >
                  <History aria-hidden="true" className="w-5 h-5 flex-shrink-0 text-fg-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-fg">{moment(backup.savedAt)}</span>
                    <span className="block text-xs text-fg-muted">
                      {REASONS[backup.reason]} · {s.dragonName}, {s.stage} · {s.activeDays} active days
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {cancel('Close')}
      </>
    );
  }

  return (
    <>
      {close}
      {heading('Restore this backup?')}
      <p id="save-dialog-description" className="text-sm text-fg-muted mb-4">
        The backup from {moment(state.backup.savedAt)} would replace the save on this device. Your current save is kept as a backup.
      </p>
      <Comparison current={state.current} incoming={state.backup.state} incomingLabel="The backup" />
      <LossWarning current={state.current} incoming={state.backup.state} replacing="The backup" />
      <div className="flex flex-col gap-3">
        <button
          onClick={onConfirmRestore}
          disabled={busy}
          className="w-full min-h-11 py-3 bg-danger-solid text-white rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <RotateCcw className="w-5 h-5" />
          Restore This Backup
        </button>
        <button onClick={onBackToBackups} disabled={busy} className="w-full min-h-11 py-3 bg-surface-muted text-fg rounded-2xl font-bold">
          Back to backups
        </button>
        {cancel()}
      </div>
    </>
  );
}

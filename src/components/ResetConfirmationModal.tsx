import { AlertTriangle, X } from 'lucide-react';
import { Dialog } from './Dialog';

interface ResetConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResetConfirmationModal({ isOpen, onClose, onConfirm }: ResetConfirmationModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      labelledBy="reset-title"
      describedBy="reset-description"
      panelClassName="max-w-sm bg-surface rounded-3xl p-6 sm:p-8 shadow-2xl border border-line text-center"
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>

      <h2 id="reset-title" className="serif text-2xl font-bold text-fg mb-2">Reset Progress?</h2>
      <p id="reset-description" className="text-fg-muted text-sm mb-8">
        This returns Ember to the egg stage and starts over. Your current save is kept as a backup, so you can restore it from Settings.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onConfirm}
          className="w-full py-4 bg-danger-solid text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:bg-danger-solid/90 transition-colors"
        >
          Yes, Reset Everything
        </button>
        {/* Focus starts on the safe choice. */}
        <button
          onClick={onClose}
          data-autofocus
          className="w-full py-4 bg-surface-muted text-fg rounded-2xl font-bold hover:bg-surface-muted transition-colors"
        >
          Cancel
        </button>
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </Dialog>
  );
}

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
      panelClassName="max-w-sm bg-[var(--card-bg)] rounded-3xl p-6 sm:p-8 shadow-2xl border border-[var(--border-color)] text-center"
    >
      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-red-500" />
      </div>

      <h2 id="reset-title" className="serif text-2xl font-bold text-[var(--text-primary)] mb-2">Reset Progress?</h2>
      <p id="reset-description" className="text-[var(--text-secondary)] text-sm mb-8">
        This will return Ember to its egg stage and clear all your data. This action cannot be undone.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onConfirm}
          className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-colors"
        >
          Yes, Reset Everything
        </button>
        {/* Focus starts on the safe choice. */}
        <button
          onClick={onClose}
          data-autofocus
          className="w-full py-4 bg-dragon-warm/50 text-[var(--text-primary)] rounded-2xl font-bold hover:bg-dragon-warm transition-colors"
        >
          Cancel
        </button>
      </div>

      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 w-11 h-11 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
    </Dialog>
  );
}

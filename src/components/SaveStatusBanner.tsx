import { useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface SaveStatusBannerProps {
  preview: boolean;
  error: string | null;
  onRetry: () => void;
  onDismissError: () => void;
}

export function SaveStatusBanner({ preview, error, onRetry, onDismissError }: SaveStatusBannerProps) {
  if (preview) {
    return (
      <div role="alert" className="mb-6 p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-bold">Preview mode: progress can't be saved right now</p>
          <p className="mt-1">
            Ember couldn't open its save storage in this browser (for example, in some private browsing modes or if site
            storage is blocked). You're seeing a read-only preview of your last saved progress, which may not be the
            latest. Nothing you do here will be saved, so actions are paused until saving works again.
          </p>
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
        </div>
      </div>
    );
  }
  if (!error) return null;
  return (
    <div role="alert" className="mb-6 p-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-900 flex gap-3 items-start">
      <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm">{error}</p>
      <button onClick={onDismissError} aria-label="Dismiss" className="p-1 rounded hover:bg-rose-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface RecoveryNoticeProps {
  onRetry: () => void;
  onStartFresh: () => void;
}

/** Shown when an existing save couldn't be read. Nothing has been created or changed. */
export function RecoveryNotice({ onRetry, onStartFresh }: RecoveryNoticeProps) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div role="alert" className="p-5 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900">
      <div className="flex gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-sm">
          <p className="font-bold">We couldn't read your Ember save</p>
          <p className="mt-1">
            Ember hasn't changed or replaced anything: your save is still stored in this browser. This can happen if site
            storage is briefly unavailable. Please try again.
          </p>
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 font-bold"
          >
            <RefreshCw className="w-4 h-4" /> Try again
          </button>
          <div className="mt-4 pt-3 border-t border-amber-200">
            {confirming ? (
              <>
                <p className="font-bold">Start a new save?</p>
                <p className="mt-1">
                  Ember will start fresh in this browser. Your old save is not deleted; it stays in this browser as a
                  backup.
                </p>
                <div className="mt-2 flex gap-2">
                  <button onClick={onStartFresh} className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold">
                    Yes, start a new save
                  </button>
                  <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg bg-amber-100 font-bold">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <button onClick={() => setConfirming(true)} className="text-xs underline">
                Still not working? Start a new save instead…
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

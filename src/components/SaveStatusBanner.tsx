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

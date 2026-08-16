import { RefreshCw, CheckCircle2, X } from 'lucide-react';

interface UpdateToastProps {
  needRefresh: boolean;
  offlineReady: boolean;
  onRefresh: () => void;
  onCloseNeedRefresh: () => void;
  onCloseOfflineReady: () => void;
}

export function UpdateToast({
  needRefresh,
  offlineReady,
  onRefresh,
  onCloseNeedRefresh,
  onCloseOfflineReady,
}: UpdateToastProps) {
  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-5 z-50 flex flex-col gap-2 max-w-sm"
    >
      {needRefresh && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-xs sm:text-sm font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 bg-brand-light dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border-brand-accent/40">
          <RefreshCw className="w-4 h-4 text-brand-accent animate-spin shrink-0" style={{ animationDuration: '3s' }} />
          
          <div className="flex-1">
            <p className="font-semibold text-brand-dark dark:text-brand-light">Update available</p>
            <p className="text-[11px] text-brand-muted">A new version of the app is ready.</p>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            className="px-2.5 py-1 bg-brand-accent hover:bg-brand-accent-hover text-brand-light text-xs font-semibold rounded transition-colors cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={onCloseNeedRefresh}
            className="p-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded transition-colors"
            aria-label="Dismiss update notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg shadow-lg border text-xs font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 bg-brand-light dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border-brand-muted/20 dark:border-brand-muted/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="flex-1 text-[11px]">App ready for offline use.</span>
          <button
            type="button"
            onClick={onCloseOfflineReady}
            className="p-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

import { Download, X, Sparkles } from 'lucide-react';

interface InstallBannerProps {
  canInstall: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ canInstall, onInstall, onDismiss }: InstallBannerProps) {
  if (!canInstall) return null;

  return (
    <div
      role="banner"
      aria-label="Install App"
      className="p-3.5 mx-3 mb-2 rounded-xl border border-brand-accent/30 bg-brand-surface dark:bg-brand-surface-dark shadow-sm transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-accent text-brand-light flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Download className="w-4 h-4 stroke-[2.2]" />
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-brand-dark dark:text-brand-light">
                Install Mizumoto Notes
              </h3>
              <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-accent bg-brand-accent/10 px-1 py-0.2 rounded">
                <Sparkles className="w-2.5 h-2.5" />
                PWA
              </span>
            </div>
            <p className="text-[11px] text-brand-muted leading-tight">
              Fast, offline-ready desktop and mobile app experience.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="p-1 -mr-1 -mt-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-1">
        <button
          type="button"
          onClick={onInstall}
          className="flex-1 py-1.5 px-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-light text-xs font-medium rounded-md transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="py-1.5 px-2.5 text-xs text-brand-muted hover:text-brand-dark dark:hover:text-brand-light bg-brand-light dark:bg-brand-dark border border-brand-muted/20 dark:border-brand-muted/30 rounded-md transition-colors cursor-pointer"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

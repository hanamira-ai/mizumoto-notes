import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastState } from '../hooks/useNotes';

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl border text-xs sm:text-sm font-medium transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 bg-brand-light dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border-brand-muted/20 dark:border-brand-muted/30"
    >
      {toast.type === 'success' && (
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      )}
      {toast.type === 'error' && (
        <AlertCircle className="w-4 h-4 text-brand-accent shrink-0" />
      )}
      {toast.type === 'info' && (
        <Info className="w-4 h-4 text-brand-muted shrink-0" />
      )}

      <span className="leading-snug">{toast.message}</span>

      <button
        type="button"
        onClick={onClose}
        className="ml-1.5 p-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
        aria-label="Close notification"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
    >
      <div className="bg-brand-light dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 w-full max-w-sm rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all transform scale-100 duration-150">
        {/* Header */}
        <div className="p-5 flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center ${
              isDestructive
                ? 'bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/20'
                : 'bg-brand-surface text-brand-dark dark:bg-brand-surface-dark dark:text-brand-light'
            }`}
          >
            <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
          </div>

          <div className="flex-1 space-y-1">
            <h3
              id="confirm-dialog-title"
              className="text-base font-semibold text-brand-dark dark:text-brand-light tracking-tight"
            >
              {title}
            </h3>
            <p id="confirm-dialog-desc" className="text-xs text-brand-muted leading-relaxed">
              {message}
            </p>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 -mr-1 -mt-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded-md transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-3.5 bg-brand-surface/60 dark:bg-brand-dark/60 border-t border-brand-muted/15 dark:border-brand-muted/25 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium text-brand-dark dark:text-brand-light bg-brand-light dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 hover:bg-brand-surface dark:hover:bg-brand-dark rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
              isDestructive
                ? 'bg-brand-accent hover:bg-brand-accent-hover text-brand-light'
                : 'bg-brand-dark dark:bg-brand-light text-brand-light dark:text-brand-dark hover:opacity-90'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

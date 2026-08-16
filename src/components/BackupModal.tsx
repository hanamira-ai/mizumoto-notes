import { useState, useRef, type ChangeEvent } from 'react';
import {
  Download,
  Upload,
  FileJson,
  FileText,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  FolderArchive,
  ArrowRight,
} from 'lucide-react';
import type { Note, CreateNoteInput } from '../types';
import { validateAndParseImportJSON, restoreImagesFromBackup, type BackupImagePayload } from '../utils/backup';

interface BackupModalProps {
  isOpen: boolean;
  notes: Note[];
  selectedNote: Note | null;
  onClose: () => void;
  onExportAllJSON: () => void;
  onExportCurrentMarkdown: () => void;
  onExportCurrentPDF?: () => void;
  onImportNotes: (notes: CreateNoteInput[]) => Promise<number>;
}

export function BackupModal({
  isOpen,
  notes,
  selectedNote,
  onClose,
  onExportAllJSON,
  onExportCurrentMarkdown,
  onExportCurrentPDF,
  onImportNotes,
}: BackupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import flow state
  const [importStatus, setImportStatus] = useState<'idle' | 'confirming' | 'importing' | 'success'>('idle');
  const [pendingNotes, setPendingNotes] = useState<CreateNoteInput[]>([]);
  const [pendingImages, setPendingImages] = useState<BackupImagePayload[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number>(0);

  if (!isOpen) return null;

  const activeNotesCount = notes.filter((n) => !n.isDeleted).length;

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);

    try {
      const text = await file.text();
      const result = validateAndParseImportJSON(text);

      if (!result.success || result.notes.length === 0) {
        setImportError(result.error || "This file doesn't look like a valid backup.");
        setImportStatus('idle');
        return;
      }

      setPendingNotes(result.notes);
      setPendingImages(result.images || []);
      setImportStatus('confirming');
    } catch (err) {
      console.error('File read error:', err);
      setImportError('Unable to read this file. Please ensure it is a readable .json document.');
      setImportStatus('idle');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (pendingNotes.length === 0) return;

    setImportStatus('importing');
    try {
      if (pendingImages.length > 0) {
        await restoreImagesFromBackup(pendingImages);
      }
      const count = await onImportNotes(pendingNotes);
      setImportedCount(count);
      setImportStatus('success');
      setPendingNotes([]);
      setPendingImages([]);
    } catch (err) {
      console.error('Import execution error:', err);
      setImportError('An unexpected error occurred while saving imported notes.');
      setImportStatus('idle');
    }
  };

  const handleCancelImport = () => {
    setPendingNotes([]);
    setPendingImages([]);
    setImportError(null);
    setImportStatus('idle');
  };

  const handleClose = () => {
    handleCancelImport();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
    >
      <div className="bg-brand-light dark:bg-brand-dark border border-brand-muted/20 dark:border-brand-muted/30 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all">
        {/* Modal Header */}
        <header className="px-6 py-4 border-b border-brand-muted/15 dark:border-brand-muted/25 flex items-center justify-between bg-brand-surface/70 dark:bg-brand-surface-dark/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-accent/10 text-brand-accent dark:bg-brand-accent/20 flex items-center justify-center">
              <FolderArchive className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="backup-modal-title"
                className="font-semibold text-base text-brand-dark dark:text-brand-light tracking-tight"
              >
                Local Backup & Export Center
              </h2>
              <p className="text-xs text-brand-muted">
                100% private, client-side data management & PDF generation.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* IMPORT CONFIRMATION VIEW (Safe In-App Modal Dialog) */}
          {importStatus === 'confirming' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 space-y-2">
                <div className="flex items-center gap-2 text-brand-dark dark:text-brand-light font-semibold text-sm">
                  <HelpCircle className="w-4 h-4 shrink-0 text-brand-accent" />
                  <span>Ready to import {pendingNotes.length} notes</span>
                </div>
                <p className="text-xs text-brand-muted leading-relaxed">
                  These notes will be safely added to your notebook as new entries. None of your current {activeNotesCount} active notes will be overwritten or removed.
                </p>
              </div>

              {/* Preview of incoming notes */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-brand-dark dark:text-brand-light">
                  Notes included in backup file:
                </span>
                <div className="max-h-36 overflow-y-auto border border-brand-muted/20 dark:border-brand-muted/30 rounded-lg p-2.5 divide-y divide-brand-muted/10 dark:divide-brand-muted/20 bg-brand-surface/40 dark:bg-brand-surface-dark/40 text-xs">
                  {pendingNotes.slice(0, 5).map((note, idx) => (
                    <div key={idx} className="py-1.5 px-1 flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-brand-dark dark:text-brand-light">
                        {note.title?.trim() || 'Untitled Note'}
                      </span>
                      {note.tags && note.tags.length > 0 && (
                        <span className="text-[10px] text-brand-muted shrink-0">
                          #{note.tags.join(', #')}
                        </span>
                      )}
                    </div>
                  ))}
                  {pendingNotes.length > 5 && (
                    <div className="py-1 text-center text-[11px] text-brand-muted">
                      + and {pendingNotes.length - 5} more notes
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCancelImport}
                  className="px-3.5 py-2 text-xs font-medium text-brand-dark dark:text-brand-light bg-brand-surface dark:bg-brand-surface-dark hover:bg-brand-muted/20 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-4 py-2 text-xs font-semibold text-brand-light bg-brand-accent hover:bg-brand-accent-hover rounded-md transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                >
                  <span>Confirm & Import ({pendingNotes.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* IMPORT SUCCESS VIEW */}
          {importStatus === 'success' && (
            <div className="text-center py-5 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm text-brand-dark dark:text-brand-light">
                Import Completed Successfully
              </h3>
              <p className="text-xs text-brand-muted max-w-xs mx-auto">
                {importedCount} {importedCount === 1 ? 'note was' : 'notes were'} added to your library.
              </p>
              <button
                type="button"
                onClick={handleClose}
                className="mt-2 px-4 py-2 text-xs font-medium text-brand-light bg-brand-accent hover:bg-brand-accent-hover rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
              >
                Done
              </button>
            </div>
          )}

          {/* REORGANIZED EXPORT & BACKUP SECTIONS */}
          {importStatus !== 'confirming' && importStatus !== 'success' && (
            <>
              {/* Error Banner */}
              {importError && (
                <div className="p-3.5 rounded-lg bg-brand-accent/10 border border-brand-accent/30 flex items-start gap-2.5 text-xs text-brand-dark dark:text-brand-light">
                  <AlertTriangle className="w-4 h-4 text-brand-accent shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p className="font-semibold text-brand-accent">Unable to import backup</p>
                    <p className="text-brand-muted">{importError}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImportError(null)}
                    className="text-brand-muted hover:text-brand-dark dark:hover:text-brand-light p-0.5"
                    aria-label="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Section 1: THIS NOTE (Export options for the active note) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-accent" />
                    <span>This Note</span>
                  </h3>
                  {selectedNote && (
                    <span className="text-[11px] text-brand-muted truncate max-w-[200px]">
                      &ldquo;{selectedNote.title || 'Untitled Note'}&rdquo;
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primary Action: Export as PDF */}
                  <div className="p-4 rounded-lg border border-brand-accent/30 dark:border-brand-accent/40 bg-brand-surface dark:bg-brand-surface-dark flex flex-col justify-between space-y-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-brand-dark dark:text-brand-light">
                          <Printer className="w-4 h-4 text-brand-accent" />
                          <span>Export as PDF</span>
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-accent/10 text-brand-accent px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed">
                        {selectedNote
                          ? 'Generate a formatted, print-ready PDF document with metadata and images.'
                          : 'Select a note to export as a formatted PDF.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onExportCurrentPDF) {
                          onExportCurrentPDF();
                        }
                        onClose();
                      }}
                      disabled={!selectedNote}
                      title={selectedNote ? 'Export current note to PDF' : 'Please select a note first'}
                      className="w-full text-xs font-semibold py-2 px-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-light rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Export as PDF</span>
                    </button>
                  </div>

                  {/* Secondary Action: Markdown Note Export */}
                  <div className="p-4 rounded-lg border border-brand-muted/20 dark:border-brand-muted/30 bg-brand-surface/50 dark:bg-brand-surface-dark/50 flex flex-col justify-between space-y-3 hover:border-brand-muted/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-brand-dark dark:text-brand-light">
                        <FileText className="w-4 h-4 text-brand-muted" />
                        <span>Export as Markdown</span>
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed">
                        Export as raw Markdown (.md) with standard YAML frontmatter for portability.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onExportCurrentMarkdown();
                        onClose();
                      }}
                      disabled={!selectedNote}
                      title={selectedNote ? 'Export current note to Markdown' : 'Please select a note first'}
                      className="w-full text-xs font-medium py-2 px-3 bg-brand-light dark:bg-brand-surface-dark hover:bg-brand-surface dark:hover:bg-brand-dark text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded-md border border-brand-muted/20 dark:border-brand-muted/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .MD</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Section Divider */}
              <div className="border-t border-brand-muted/15 dark:border-brand-muted/25" />

              {/* Section 2: ALL NOTES (Full Backup and Restore) */}
              <section className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <FolderArchive className="w-3.5 h-3.5 text-brand-accent" />
                  <span>All Notes ({activeNotesCount})</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Primary Full JSON Backup */}
                  <div className="p-4 rounded-lg border border-brand-muted/20 dark:border-brand-muted/30 bg-brand-surface/50 dark:bg-brand-surface-dark/50 flex flex-col justify-between space-y-3 hover:border-brand-accent/40 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-brand-dark dark:text-brand-light">
                        <FileJson className="w-4 h-4 text-brand-accent" />
                        <span>Full Notebook Backup</span>
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed">
                        Complete JSON archive of all {activeNotesCount} active notes with tags, pins, and timestamps.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onExportAllJSON();
                        onClose();
                      }}
                      disabled={activeNotesCount === 0}
                      title={activeNotesCount === 0 ? 'No notes to export' : 'Export all notes to a single JSON backup'}
                      className="w-full text-xs font-semibold py-2 px-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-light rounded-md shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Backup All ({activeNotesCount})</span>
                    </button>
                  </div>

                  {/* Restore from Backup (.json) */}
                  <div className="p-4 rounded-lg border border-dashed border-brand-muted/30 dark:border-brand-muted/40 bg-brand-surface/30 dark:bg-brand-surface-dark/30 flex flex-col justify-between space-y-3 text-center">
                    <div className="space-y-1">
                      <div className="flex items-center justify-center gap-1.5 font-semibold text-xs text-brand-dark dark:text-brand-light">
                        <Upload className="w-4 h-4 text-brand-accent" />
                        <span>Restore from Backup</span>
                      </div>
                      <p className="text-[11px] text-brand-muted leading-relaxed">
                        Import notes from a previously exported <code className="font-mono text-[10px] bg-brand-surface dark:bg-brand-surface-dark px-1 py-0.5 rounded">.json</code> file safely.
                      </p>
                    </div>

                    {/* Hidden File Input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileChange}
                      className="hidden"
                      id="import-backup-file-input"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-xs font-medium py-2 px-3 bg-brand-light dark:bg-brand-surface-dark hover:bg-brand-surface dark:hover:bg-brand-dark text-brand-dark dark:text-brand-light rounded-md border border-brand-muted/20 dark:border-brand-muted/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                    >
                      <Upload className="w-3.5 h-3.5 stroke-[2]" />
                      <span>Select JSON File</span>
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-6 py-3 border-t border-brand-muted/15 dark:border-brand-muted/25 text-[11px] text-brand-muted flex items-center justify-between bg-brand-surface/70 dark:bg-brand-surface-dark/70">
          <span>Safe local storage &middot; IndexedDB &middot; Zero Cloud</span>
          <button
            type="button"
            onClick={handleClose}
            className="text-xs font-medium text-brand-muted hover:text-brand-dark dark:hover:text-brand-light cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 rounded px-1"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

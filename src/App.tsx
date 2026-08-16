import { useState } from 'react';
import { useNotes } from './hooks/useNotes';
import { usePWA } from './hooks/usePWA';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { BackupModal } from './components/BackupModal';
import { ConfirmModal } from './components/ConfirmModal';
import { Toast } from './components/Toast';
import { UpdateToast } from './components/UpdateToast';

/**
 * Mizumoto Notes - Stage 6 (Final: Installable Offline-First PWA)
 *
 * Full Feature Set:
 * - Data Layer: IndexedDB with Dexie.js (offline persistence, zero cloud dependencies)
 * - PWA: vite-plugin-pwa with Cache-First app-shell caching, standalone manifest, and custom icons
 * - Installability: Native beforeinstallprompt detection with custom dismissible banner
 * - Network Awareness: Real-time Online / Offline status badge in sidebar footer
 * - Service Worker Updates: Non-intrusive update toast with 1-click refresh reload
 * - Core Features: CRUD, auto-save with status badge, fuzzy search, pinning, tag taxonomy
 * - Editor: Lightweight markdown (bold, italic, lists, formatted live preview)
 * - Trash / Recovery: Soft-delete recycle bin with safe in-app permanent deletion dialog
 * - Local Portability: JSON full notebook backup/restore and per-note Markdown export
 * - Design: Mizumoto Creative Studio brand identity (Accent #A3242A, Dark #111111, Surface #F5F5F5)
 */
export default function App() {
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isMobileViewingEditor, setIsMobileViewingEditor] = useState(false);
  const [noteToDeletePermanently, setNoteToDeletePermanently] = useState<{ id: number; title: string } | null>(null);

  // Core Notes State Engine
  const {
    notes,
    trashNotes,
    filteredActiveNotes,
    filteredTrashNotes,
    pinnedNotes,
    unpinnedNotes,
    availableTags,
    activeView,
    selectedNoteId,
    selectedNote,
    selectedTag,
    searchQuery,
    sortBy,
    setSortBy,
    saveStatus,
    focusTitleTrigger,
    focusSearchTrigger,
    darkMode,
    toast,
    hideToast,
    exportAllJSON,
    exportCurrentNoteMarkdown,
    exportCurrentNotePDF,
    importNotesBatch,
    setActiveView,
    setSelectedNoteId,
    setSearchQuery,
    toggleTagFilter,
    createNewNote,
    updateNoteContent,
    togglePin,
    addTag,
    removeTag,
    deleteNote,
    restoreNoteById,
    permanentDelete,
    toggleDarkMode,
  } = useNotes();

  // PWA Infrastructure & Offline Lifecycle State
  const {
    isOnline,
    canInstall,
    needRefresh,
    offlineReady,
    triggerInstall,
    dismissInstall,
    handleRefreshApp,
    closeNeedRefresh,
    closeOfflineReady,
  } = usePWA();

  const handleSelectNote = (id: number) => {
    setSelectedNoteId(id);
    setIsMobileViewingEditor(true);
  };

  const handleCreateNewNote = () => {
    createNewNote();
    setIsMobileViewingEditor(true);
  };

  const handleRequestPermanentDelete = (id: number, title: string) => {
    setNoteToDeletePermanently({ id, title: title.trim() || 'Untitled Note' });
  };

  const handleConfirmPermanentDelete = () => {
    if (noteToDeletePermanently) {
      permanentDelete(noteToDeletePermanently.id);
      setNoteToDeletePermanently(null);
    }
  };

  return (
    <div className="flex h-screen w-full bg-brand-light dark:bg-brand-dark text-brand-dark dark:text-brand-light overflow-hidden font-sans antialiased select-none">
      {/* Left Sidebar (Full width on mobile when not viewing editor, fixed width on md+) */}
      <div className={`h-full ${isMobileViewingEditor ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}>
        <Sidebar
          notes={notes}
          trashNotes={trashNotes}
          pinnedNotes={pinnedNotes}
          unpinnedNotes={unpinnedNotes}
          filteredActiveNotes={filteredActiveNotes}
          filteredTrashNotes={filteredTrashNotes}
          availableTags={availableTags}
          activeView={activeView}
          selectedNoteId={selectedNoteId}
          selectedTag={selectedTag}
          searchQuery={searchQuery}
          sortBy={sortBy}
          focusSearchTrigger={focusSearchTrigger}
          darkMode={darkMode}
          isOnline={isOnline}
          canInstall={canInstall}
          onSelectView={(view) => {
            setActiveView(view);
            setIsMobileViewingEditor(false);
          }}
          onSelectNote={handleSelectNote}
          onCreateNote={handleCreateNewNote}
          onDeleteNote={deleteNote}
          onRestoreNote={restoreNoteById}
          onRequestPermanentDelete={handleRequestPermanentDelete}
          onTogglePin={togglePin}
          onToggleTagFilter={toggleTagFilter}
          onSearchChange={setSearchQuery}
          onSortChange={setSortBy}
          onToggleDarkMode={toggleDarkMode}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onTriggerInstall={triggerInstall}
          onDismissInstall={dismissInstall}
        />
      </div>

      {/* Right Panel: Note Editor (Full width on mobile when viewing editor, flex-1 on md+) */}
      <div className={`h-full flex-1 ${!isMobileViewingEditor ? 'hidden md:flex' : 'flex'}`}>
        <NoteEditor
          note={selectedNote}
          activeView={activeView}
          saveStatus={saveStatus}
          focusTitleTrigger={focusTitleTrigger}
          onUpdateNote={updateNoteContent}
          onTogglePin={togglePin}
          onAddTag={addTag}
          onRemoveTag={removeTag}
          onRestoreNote={restoreNoteById}
          onRequestPermanentDelete={handleRequestPermanentDelete}
          onCreateNote={handleCreateNewNote}
          onExportMarkdown={exportCurrentNoteMarkdown}
          onExportPDF={exportCurrentNotePDF}
          onOpenBackupModal={() => setIsBackupModalOpen(true)}
          onBackToList={() => setIsMobileViewingEditor(false)}
        />
      </div>

      {/* Local Backup & Restore Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        notes={notes}
        selectedNote={selectedNote}
        onClose={() => setIsBackupModalOpen(false)}
        onExportAllJSON={exportAllJSON}
        onExportCurrentMarkdown={exportCurrentNoteMarkdown}
        onExportCurrentPDF={exportCurrentNotePDF}
        onImportNotes={importNotesBatch}
      />

      {/* In-App Permanent Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={noteToDeletePermanently !== null}
        title="Permanently delete note?"
        message={`Are you sure you want to permanently delete "${noteToDeletePermanently?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        cancelLabel="Cancel"
        isDestructive={true}
        onConfirm={handleConfirmPermanentDelete}
        onCancel={() => setNoteToDeletePermanently(null)}
      />

      {/* General Notification Toast */}
      <Toast toast={toast} onClose={hideToast} />

      {/* PWA Service Worker Update Notification Toast */}
      <UpdateToast
        needRefresh={needRefresh}
        offlineReady={offlineReady}
        onRefresh={handleRefreshApp}
        onCloseNeedRefresh={closeNeedRefresh}
        onCloseOfflineReady={closeOfflineReady}
      />
    </div>
  );
}

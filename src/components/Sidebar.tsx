import { useRef, useEffect } from 'react';
import {
  Plus,
  Search,
  Trash2,
  X,
  Pin,
  FileText,
  Bookmark,
  Sun,
  Moon,
  RotateCcw,
  Tag as TagIcon,
  FolderArchive,
  Wifi,
  WifiOff,
  ArrowUpDown,
} from 'lucide-react';
import type { Note, NoteSortOption } from '../types';
import type { ActiveView } from '../hooks/useNotes';
import { formatRelativeTime } from '../utils/date';
import { InstallBanner } from './InstallBanner';

interface SidebarProps {
  notes: Note[];
  trashNotes: Note[];
  pinnedNotes: Note[];
  unpinnedNotes: Note[];
  filteredActiveNotes: Note[];
  filteredTrashNotes: Note[];
  availableTags: string[];
  activeView: ActiveView;
  selectedNoteId: number | null;
  selectedTag: string | null;
  searchQuery: string;
  sortBy: NoteSortOption;
  focusSearchTrigger: number;
  darkMode: boolean;
  isOnline: boolean;
  canInstall?: boolean;
  onSelectView: (view: ActiveView) => void;
  onSelectNote: (id: number) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: number) => void;
  onRestoreNote: (id: number) => void;
  onRequestPermanentDelete: (id: number, title: string) => void;
  onTogglePin: (id: number) => void;
  onToggleTagFilter: (tag: string) => void;
  onSearchChange: (query: string) => void;
  onSortChange: (sort: NoteSortOption) => void;
  onToggleDarkMode: () => void;
  onOpenBackupModal: () => void;
  onTriggerInstall?: () => void;
  onDismissInstall?: () => void;
}

function getPlainTextPreview(rawContent: string): string {
  if (!rawContent || !rawContent.trim()) return 'No additional text';
  // Strip HTML tags and markdown symbols for preview
  const text = rawContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, '[Image]')
    .replace(/[#*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text || 'No additional text';
}

export function Sidebar({
  notes,
  trashNotes,
  pinnedNotes,
  unpinnedNotes,
  filteredActiveNotes,
  filteredTrashNotes,
  availableTags,
  activeView,
  selectedNoteId,
  selectedTag,
  searchQuery,
  sortBy,
  focusSearchTrigger,
  darkMode,
  isOnline,
  canInstall,
  onSelectView,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onRestoreNote,
  onRequestPermanentDelete,
  onTogglePin,
  onToggleTagFilter,
  onSearchChange,
  onSortChange,
  onToggleDarkMode,
  onOpenBackupModal,
  onTriggerInstall,
  onDismissInstall,
}: SidebarProps) {

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when Ctrl+F shortcut triggers
  useEffect(() => {
    if (focusSearchTrigger > 0) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  }, [focusSearchTrigger]);

  const pinnedTotalCount = notes.filter((n) => n.pinned).length;

  return (
    <aside className="w-full md:w-[310px] md:shrink-0 bg-brand-light dark:bg-brand-dark border-r border-brand-muted/20 dark:border-brand-muted/25 flex flex-col h-full select-none transition-colors duration-150 ease-in-out">
      {/* Top Header */}
      <div className="p-4 border-b border-brand-muted/15 dark:border-brand-muted/25 space-y-3">
        {/* Brand App Title & Global Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 bg-brand-accent text-brand-light rounded-md flex items-center justify-center text-xs font-bold shadow-xs">
              M
            </span>
            <h1 className="font-semibold text-base text-brand-dark dark:text-brand-light tracking-tight">
              Mizumoto Notes
            </h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleDarkMode}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-md text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-muted" />}
            </button>
          </div>
        </div>

        {/* View Switcher Tabs (All Notes | Pinned | Trash) */}
        <nav
          className="flex bg-brand-surface dark:bg-brand-surface-dark p-1 rounded-lg gap-1 border border-brand-muted/15 dark:border-brand-muted/25"
          aria-label="Notes view mode"
        >
          <button
            type="button"
            onClick={() => onSelectView('all')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
              activeView === 'all'
                ? 'bg-brand-light dark:bg-brand-dark text-brand-dark dark:text-brand-light shadow-xs'
                : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>All</span>
            <span className="text-[10px] text-brand-muted">({notes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('pinned')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
              activeView === 'pinned'
                ? 'bg-brand-light dark:bg-brand-dark text-brand-accent font-semibold shadow-xs'
                : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light'
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${activeView === 'pinned' ? 'fill-brand-accent' : ''}`} />
            <span>Pinned</span>
            <span className="text-[10px] text-brand-muted">({pinnedTotalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectView('trash')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
              activeView === 'trash'
                ? 'bg-brand-light dark:bg-brand-dark text-brand-accent font-semibold shadow-xs'
                : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Trash</span>
            <span className="text-[10px] text-brand-muted">({trashNotes.length})</span>
          </button>
        </nav>

        {/* Primary Action Button: + New Note */}
        {activeView !== 'trash' && (
          <button
            type="button"
            onClick={onCreateNote}
            title="Create a new note (Ctrl+N / Cmd+N)"
            className="w-full bg-brand-accent hover:bg-brand-accent-hover text-brand-light font-medium text-sm py-2.5 px-4 rounded-md transition-colors duration-150 shadow-xs flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 min-h-[40px]"
          >
            <Plus className="w-4 h-4 stroke-[2.2]" />
            <span>New Note</span>
            <kbd className="hidden sm:inline-block ml-auto text-[10px] font-mono opacity-80 bg-black/20 px-1.5 py-0.5 rounded">
              ⌘N
            </kbd>
          </button>
        )}

        {/* Search Input Box */}
        <div className="relative">
          <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={activeView === 'trash' ? 'Search trash...' : 'Search notes... (⌘F)'}
            className="w-full pl-9 pr-8 py-2 text-xs bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light placeholder:text-brand-muted/70 rounded-md border border-brand-muted/20 dark:border-brand-muted/30 focus-visible:outline-none focus-visible:border-brand-accent focus-visible:ring-1 focus-visible:ring-brand-accent transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light p-1 rounded transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tags Horizontal Scroll Filter Bar (Only in active views) */}
        {activeView !== 'trash' && availableTags.length > 0 && (
          <div className="pt-0.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              <span className="text-brand-muted flex items-center gap-1 shrink-0 text-[10px] uppercase font-semibold">
                <TagIcon className="w-3 h-3" />
              </span>
              {availableTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onToggleTagFilter(tag)}
                    className={`px-2.5 py-1 rounded-full shrink-0 transition-colors duration-150 cursor-pointer text-xs flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                      isSelected
                        ? 'bg-brand-accent text-brand-light font-medium shadow-xs'
                        : 'bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 hover:border-brand-accent'
                    }`}
                  >
                    <span>#{tag}</span>
                    {isSelected && <X className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sort by control */}
        <div className="flex items-center justify-between pt-0.5 text-xs text-brand-muted">
          <label htmlFor="notes-sort-select" className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer">
            <ArrowUpDown className="w-3 h-3 text-brand-muted" />
            <span>Sort by:</span>
          </label>
          <select
            id="notes-sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as NoteSortOption)}
            className="bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light text-[11px] py-1 px-2 rounded-md border border-brand-muted/20 dark:border-brand-muted/30 focus-visible:outline-none focus-visible:border-brand-accent focus-visible:ring-1 focus-visible:ring-brand-accent cursor-pointer transition-colors"
          >
            <option value="updated_desc">Last edited</option>
            <option value="created_desc">Date created (newest)</option>
            <option value="created_asc">Date created (oldest)</option>
          </select>
        </div>
      </div>


      {/* Note List Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-brand-muted/10 dark:divide-brand-muted/20">
        {/* TRASH VIEW */}
        {activeView === 'trash' ? (
          filteredTrashNotes.length === 0 ? (
            <div className="p-8 text-center text-brand-muted space-y-3.5 mt-8">
              <div className="w-12 h-12 mx-auto rounded-full bg-brand-surface dark:bg-brand-surface-dark flex items-center justify-center text-brand-muted">
                <Trash2 className="w-6 h-6 stroke-[1.8]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-brand-dark dark:text-brand-light">
                  {trashNotes.length === 0 ? 'Trash is empty' : 'No matching notes'}
                </h3>
                <p className="text-xs text-brand-muted leading-relaxed max-w-[200px] mx-auto">
                  {trashNotes.length === 0
                    ? 'Notes moved to trash will appear here for recovery.'
                    : `No deleted notes match "${searchQuery}".`}
                </p>
              </div>
            </div>
          ) : (
            filteredTrashNotes.map((note) => {
              const isSelected = note.id === selectedNoteId;
              const displayTitle = note.title.trim() || 'Untitled Note';
              const displayPreview = getPlainTextPreview(note.content).slice(0, 80);

              return (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => note.id !== undefined && onSelectNote(note.id)}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && note.id !== undefined) {
                      onSelectNote(note.id);
                    }
                  }}
                  className={`group relative p-3.5 cursor-pointer text-left transition-colors duration-150 border-l-4 ${
                    isSelected
                      ? 'bg-brand-surface dark:bg-brand-surface-dark border-brand-accent shadow-xs'
                      : 'bg-brand-light dark:bg-brand-dark border-transparent hover:bg-brand-surface/60 dark:hover:bg-brand-surface-dark/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2
                      className={`text-sm truncate font-medium text-brand-dark dark:text-brand-light ${
                        isSelected ? 'font-semibold' : ''
                      }`}
                    >
                      {displayTitle}
                    </h2>
                  </div>

                  <p className="text-xs text-brand-muted line-clamp-2 mt-1 leading-normal font-normal">
                    {displayPreview}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-brand-muted">
                      Deleted {formatRelativeTime(note.updatedAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (note.id !== undefined) onRestoreNote(note.id);
                        }}
                        title="Restore note"
                        className="px-2 py-1 text-brand-dark dark:text-brand-light bg-brand-surface dark:bg-brand-surface-dark hover:bg-brand-muted/20 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                        aria-label={`Restore ${displayTitle}`}
                      >
                        <RotateCcw className="w-3 h-3 text-brand-muted" />
                        <span>Restore</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (note.id !== undefined) {
                            onRequestPermanentDelete(note.id, note.title);
                          }
                        }}
                        title="Delete permanently"
                        className="px-2 py-1 text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                        aria-label={`Permanently delete ${displayTitle}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )
        ) : (
          /* ACTIVE NOTES VIEW (All or Pinned) */
          <>
            {filteredActiveNotes.length === 0 ? (
              <div className="p-8 text-center text-brand-muted space-y-3.5 mt-8">
                <div className="w-12 h-12 mx-auto rounded-full bg-brand-surface dark:bg-brand-surface-dark flex items-center justify-center text-brand-muted">
                  {activeView === 'pinned' ? (
                    <Pin className="w-6 h-6 stroke-[1.8]" />
                  ) : (
                    <FileText className="w-6 h-6 stroke-[1.8]" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-semibold text-brand-dark dark:text-brand-light">
                    {searchQuery
                      ? 'No matching notes'
                      : selectedTag
                      ? 'No notes with this tag'
                      : activeView === 'pinned'
                      ? 'No pinned notes yet'
                      : 'No notes yet'}
                  </h3>
                  <p className="text-xs leading-relaxed text-brand-muted max-w-[210px] mx-auto">
                    {searchQuery
                      ? `No notes match "${searchQuery}".`
                      : selectedTag
                      ? `No notes tagged with #${selectedTag}.`
                      : activeView === 'pinned'
                      ? 'Pin important notes to keep them pinned at the top.'
                      : 'Click "+ New Note" to capture your thoughts.'}
                  </p>
                </div>
                {(searchQuery || selectedTag) && (
                  <button
                    type="button"
                    onClick={() => {
                      onSearchChange('');
                      if (selectedTag) onToggleTagFilter(selectedTag);
                    }}
                    className="text-xs text-brand-accent hover:underline font-medium pt-1 cursor-pointer"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* When in 'all' view and there are pinned notes, group them */}
                {activeView === 'all' && pinnedNotes.length > 0 && (
                  <div>
                    <div className="px-3.5 py-1.5 bg-brand-surface/70 dark:bg-brand-surface-dark/70 text-[10px] font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                      <Bookmark className="w-3 h-3 text-brand-accent fill-brand-accent" />
                      <span>Pinned Notes ({pinnedNotes.length})</span>
                    </div>
                    {pinnedNotes.map((note) => renderNoteCard(note))}

                    <div className="px-3.5 py-1.5 bg-brand-surface/70 dark:bg-brand-surface-dark/70 text-[10px] font-bold uppercase tracking-wider text-brand-muted border-t border-brand-muted/10 dark:border-brand-muted/20">
                      <span>Other Notes ({unpinnedNotes.length})</span>
                    </div>
                    {unpinnedNotes.map((note) => renderNoteCard(note))}
                  </div>
                )}

                {/* When in 'pinned' view OR in 'all' view with no pinned notes */}
                {(activeView === 'pinned' || (activeView === 'all' && pinnedNotes.length === 0)) &&
                  filteredActiveNotes.map((note) => renderNoteCard(note))}
              </>
            )}
          </>
        )}
      </div>

      {/* PWA Install Banner */}
      {canInstall && onTriggerInstall && onDismissInstall && (
        <InstallBanner
          canInstall={canInstall}
          onInstall={onTriggerInstall}
          onDismiss={onDismissInstall}
        />
      )}

      {/* Sidebar Footer with Online/Offline Indicator */}
      <footer className="p-3 border-t border-brand-muted/15 dark:border-brand-muted/25 text-[11px] text-brand-muted flex items-center justify-between bg-brand-light dark:bg-brand-dark">
        <button
          type="button"
          onClick={onOpenBackupModal}
          title="Backup & Restore: Export JSON/Markdown, Import JSON"
          className="flex items-center gap-1.5 py-1.5 px-2 rounded-md hover:bg-brand-surface dark:hover:bg-brand-surface-dark text-brand-dark dark:text-brand-light font-medium transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
        >
          <FolderArchive className="w-3.5 h-3.5 text-brand-accent" />
          <span>Backup & Export</span>
        </button>

        {/* Online / Offline Status Indicator */}
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <span
              className="flex items-center gap-1.5 font-mono text-[10px] text-brand-muted"
              title="Online — browser connected"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
              <span>Online</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 font-mono text-[10px] text-brand-accent font-medium"
              title="Offline mode active. All notes are saved securely in IndexedDB."
            >
              <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
              <span>Offline (safe)</span>
            </span>
          )}
        </div>
      </footer>
    </aside>
  );

  function renderNoteCard(note: Note) {
    const isSelected = note.id === selectedNoteId;
    const displayTitle = note.title.trim() || 'Untitled Note';
    const displayPreview = getPlainTextPreview(note.content).slice(0, 90);

    return (
      <div
        key={note.id}
        role="button"
        tabIndex={0}
        onClick={() => note.id !== undefined && onSelectNote(note.id)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && note.id !== undefined) {
            onSelectNote(note.id);
          }
        }}
        className={`group relative p-3.5 cursor-pointer text-left transition-colors duration-150 border-l-4 ${
          isSelected
            ? 'bg-brand-surface dark:bg-brand-surface-dark border-brand-accent text-brand-dark dark:text-brand-light shadow-xs'
            : 'bg-brand-light dark:bg-brand-dark border-transparent hover:bg-brand-surface/60 dark:hover:bg-brand-surface-dark/60 text-brand-dark dark:text-brand-light'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <h2
            className={`text-sm truncate font-medium text-brand-dark dark:text-brand-light ${
              isSelected ? 'font-semibold' : ''
            }`}
          >
            {displayTitle}
          </h2>

          <div className="flex items-center gap-1 shrink-0">
            {/* Pin Toggle Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (note.id !== undefined) onTogglePin(note.id);
              }}
              title={note.pinned ? 'Unpin note' : 'Pin note to top'}
              className={`note-action-button p-1.5 rounded transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                note.pinned
                  ? 'text-brand-accent'
                  : 'text-brand-muted opacity-0 group-hover:opacity-100 hover:text-brand-accent'
              }`}
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-brand-accent' : ''}`} />
            </button>

            {/* Soft Delete Hover Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (note.id !== undefined) onDeleteNote(note.id);
              }}
              title="Move note to trash"
              className="note-action-button opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 text-brand-muted hover:text-brand-accent rounded focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
              aria-label={`Delete ${displayTitle}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Snippet Preview */}
        <p className="text-xs text-brand-muted line-clamp-2 mt-1 leading-normal font-normal">
          {displayPreview}
        </p>

        {/* Tag chips (up to 2) & Timestamp */}
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-brand-muted">
          <span className="font-normal">{formatRelativeTime(note.updatedAt)}</span>

          {Array.isArray(note.tags) && note.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {note.tags.slice(0, 2).map((t) => (
                <span
                  key={t}
                  className="inline-block px-1.5 py-0.5 bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light text-[10px] rounded border border-brand-muted/20 dark:border-brand-muted/30 truncate max-w-[80px]"
                >
                  #{t}
                </span>
              ))}
              {note.tags.length > 2 && (
                <span className="text-[10px] text-brand-muted">+{note.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}

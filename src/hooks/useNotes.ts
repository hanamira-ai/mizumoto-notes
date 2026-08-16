import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  getAllNotes,
  getTrashNotes,
  createNote,
  updateNote,
  softDeleteNote,
  restoreNote,
  deleteNotePermanently,
  importNotes as importNotesToDb,
} from '../db/notesRepository';
import type { Note, UpdateNoteInput, CreateNoteInput, NoteSortOption } from '../types';
import {
  exportAllNotesAsJSON,
  exportNoteAsMarkdown,
  exportNoteAsPDF,
} from '../utils/backup';

export type SaveStatus = 'idle' | 'saving' | 'saved';
export type ActiveView = 'all' | 'pinned' | 'trash';

export interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [focusTitleTrigger, setFocusTitleTrigger] = useState<number>(0);
  const [focusSearchTrigger, setFocusSearchTrigger] = useState<number>(0);

  // Sort preference persisted in localStorage
  const [sortBy, setSortByState] = useState<NoteSortOption>(() => {
    try {
      const saved = localStorage.getItem('mizumoto_sort_by');
      if (saved === 'updated_desc' || saved === 'created_desc' || saved === 'created_asc') {
        return saved as NoteSortOption;
      }
    } catch (e) {
      console.error('Failed to read sort preference:', e);
    }
    return 'updated_desc';
  });

  const setSortBy = useCallback((newSort: NoteSortOption) => {
    setSortByState(newSort);
    try {
      localStorage.setItem('mizumoto_sort_by', newSort);
    } catch (e) {
      console.error('Failed to save sort preference:', e);
    }
  }, []);

  // Dark mode state persisted in localStorage
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mizumoto_dark_mode');
      if (saved !== null) {
        return saved === 'true';
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  // Sync dark mode class to root HTML
  useEffect(() => {
    try {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('mizumoto_dark_mode', 'true');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('mizumoto_dark_mode', 'false');
      }
    } catch (e) {
      console.error('Failed to save dark mode preference:', e);
    }
  }, [darkMode]);

  const toggleDarkMode = useCallback(() => {
    setDarkMode((prev) => !prev);
  }, []);

  // Debounce timers
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeSavedTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Loads both active notes and trash notes from IndexedDB.
   */
  const loadNotes = useCallback(async (selectIdAfterLoad?: number | null) => {
    try {
      const [fetchedActive, fetchedTrash] = await Promise.all([
        getAllNotes(),
        getTrashNotes(),
      ]);

      setNotes(fetchedActive);
      setTrashNotes(fetchedTrash);

      // Handle note selection
      if (selectIdAfterLoad !== undefined) {
        setSelectedNoteId(selectIdAfterLoad);
      } else {
        setSelectedNoteId((currentId) => {
          if (fetchedActive.length === 0) return null;
          if (currentId && fetchedActive.some((n) => n.id === currentId)) {
            return currentId;
          }
          return fetchedActive[0].id ?? null;
        });
      }
    } catch (error) {
      console.error('Error loading notes from database:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  /**
   * Extract all unique tags currently in active notes.
   */
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach((note) => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [notes]);

  /**
   * Currently selected note object (from active notes or trash).
   */
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    if (activeView === 'trash') {
      return trashNotes.find((n) => n.id === selectedNoteId) ?? null;
    }
    return notes.find((n) => n.id === selectedNoteId) ?? null;
  }, [notes, trashNotes, selectedNoteId, activeView]);

  /**
   * Comparator helper for sorting notes
   */
  const compareNotes = useCallback((a: Note, b: Note): number => {
    if (sortBy === 'created_desc') {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    }
    if (sortBy === 'created_asc') {
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeA - timeB;
    }
    // Default: 'updated_desc'
    const timeA = new Date(a.updatedAt).getTime() || 0;
    const timeB = new Date(b.updatedAt).getTime() || 0;
    return timeB - timeA;
  }, [sortBy]);

  /**
   * Filtered active notes based on:
   * 1. View mode ('all' vs 'pinned')
   * 2. Selected tag filter
   * 3. Search query (title + content matching)
   * 4. Current sort order
   */
  const filteredActiveNotes = useMemo(() => {
    let result = notes;

    // View filter
    if (activeView === 'pinned') {
      result = result.filter((n) => n.pinned);
    }

    // Tag filter
    if (selectedTag) {
      result = result.filter(
        (n) => Array.isArray(n.tags) && n.tags.includes(selectedTag)
      );
    }

    // Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((note) => {
        const titleMatch = note.title.toLowerCase().includes(query);
        const contentMatch = note.content.toLowerCase().includes(query);
        const tagsMatch = Array.isArray(note.tags)
          ? note.tags.some((t) => t.toLowerCase().includes(query))
          : false;
        return titleMatch || contentMatch || tagsMatch;
      });
    }

    // Apply sort
    return [...result].sort(compareNotes);
  }, [notes, activeView, selectedTag, searchQuery, compareNotes]);

  /**
   * Filtered trash notes based on search query and sort.
   */
  const filteredTrashNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = trashNotes;
    if (query) {
      result = trashNotes.filter((note) => {
        const titleMatch = note.title.toLowerCase().includes(query);
        const contentMatch = note.content.toLowerCase().includes(query);
        return titleMatch || contentMatch;
      });
    }
    return [...result].sort(compareNotes);
  }, [trashNotes, searchQuery, compareNotes]);


  /**
   * Split active notes into Pinned and Unpinned for display in 'all' view.
   */
  const { pinnedNotes, unpinnedNotes } = useMemo(() => {
    const pinned: Note[] = [];
    const unpinned: Note[] = [];

    filteredActiveNotes.forEach((note) => {
      if (note.pinned) {
        pinned.push(note);
      } else {
        unpinned.push(note);
      }
    });

    return { pinnedNotes: pinned, unpinnedNotes: unpinned };
  }, [filteredActiveNotes]);

  /**
   * Creates a new note and selects it immediately.
   */
  const createNewNote = useCallback(async () => {
    try {
      // If we are currently in trash view, switch back to 'all'
      if (activeView === 'trash') {
        setActiveView('all');
      }

      const newId = await createNote({
        title: '',
        content: '',
        tags: selectedTag ? [selectedTag] : [],
      });

      setSearchQuery('');
      await loadNotes(newId);

      setFocusTitleTrigger((prev) => prev + 1);
      setSaveStatus('idle');
      return newId;
    } catch (error) {
      console.error('Error creating new note:', error);
    }
  }, [loadNotes, activeView, selectedTag]);

  /**
   * Debounced update note content and title.
   */
  const updateNoteContent = useCallback(
    (id: number, changes: UpdateNoteInput) => {
      const now = new Date().toISOString();

      // Optimistic update in state
      setNotes((prevNotes) =>
        prevNotes.map((note) => {
          if (note.id === id) {
            return {
              ...note,
              ...changes,
              updatedAt: now,
            };
          }
          return note;
        })
      );

      setSaveStatus('saving');

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (fadeSavedTimerRef.current) clearTimeout(fadeSavedTimerRef.current);

      debounceTimerRef.current = setTimeout(async () => {
        try {
          await updateNote(id, changes);
          setSaveStatus('saved');

          // Keep list ordered
          const updatedList = await getAllNotes();
          setNotes(updatedList);

          fadeSavedTimerRef.current = setTimeout(() => {
            setSaveStatus((current) => (current === 'saved' ? 'idle' : current));
          }, 2500);
        } catch (error) {
          console.error('Failed to auto-save note:', error);
          setSaveStatus('idle');
        }
      }, 500);
    },
    []
  );

  /**
   * Toggle pinned state for a note.
   */
  const togglePin = useCallback(
    async (id: number) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;

      const newPinned = !target.pinned;

      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, pinned: newPinned } : n))
      );

      try {
        await updateNote(id, { pinned: newPinned });
        const refreshed = await getAllNotes();
        setNotes(refreshed);
      } catch (err) {
        console.error('Error toggling pin:', err);
      }
    },
    [notes]
  );

  /**
   * Add a tag to a note.
   */
  const addTag = useCallback(
    async (id: number, rawTag: string) => {
      const tag = rawTag.trim().toLowerCase();
      if (!tag) return;

      const target = notes.find((n) => n.id === id);
      if (!target) return;

      const existingTags = target.tags || [];
      if (existingTags.includes(tag)) return; // No duplicates

      const updatedTags = [...existingTags, tag];

      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, tags: updatedTags } : n))
      );

      try {
        await updateNote(id, { tags: updatedTags });
      } catch (err) {
        console.error('Error adding tag:', err);
      }
    },
    [notes]
  );

  /**
   * Remove a tag from a note.
   */
  const removeTag = useCallback(
    async (id: number, tagToRemove: string) => {
      const target = notes.find((n) => n.id === id);
      if (!target) return;

      const updatedTags = (target.tags || []).filter((t) => t !== tagToRemove);

      // Optimistic update
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, tags: updatedTags } : n))
      );

      try {
        await updateNote(id, { tags: updatedTags });
      } catch (err) {
        console.error('Error removing tag:', err);
      }
    },
    [notes]
  );

  /**
   * Soft delete note (moves to trash).
   */
  const deleteNote = useCallback(
    async (id: number) => {
      try {
        await softDeleteNote(id);
        const [refreshedActive, refreshedTrash] = await Promise.all([
          getAllNotes(),
          getTrashNotes(),
        ]);

        setNotes(refreshedActive);
        setTrashNotes(refreshedTrash);

        // Adjust selection if currently selected was deleted
        if (selectedNoteId === id) {
          setSelectedNoteId(
            refreshedActive.length > 0 ? refreshedActive[0].id ?? null : null
          );
        }
      } catch (error) {
        console.error('Error soft-deleting note:', error);
      }
    },
    [selectedNoteId]
  );

  /**
   * Restore a note from trash back to active notes.
   */
  const restoreNoteById = useCallback(
    async (id: number) => {
      try {
        await restoreNote(id);
        const [refreshedActive, refreshedTrash] = await Promise.all([
          getAllNotes(),
          getTrashNotes(),
        ]);

        setNotes(refreshedActive);
        setTrashNotes(refreshedTrash);

        // Select the restored note
        setSelectedNoteId(id);
      } catch (error) {
        console.error('Error restoring note:', error);
      }
    },
    []
  );

  /**
   * Permanently delete a note from IndexedDB.
   */
  const permanentDelete = useCallback(
    async (id: number) => {
      try {
        await deleteNotePermanently(id);
        const refreshedTrash = await getTrashNotes();
        setTrashNotes(refreshedTrash);

        if (selectedNoteId === id) {
          setSelectedNoteId(
            refreshedTrash.length > 0 ? refreshedTrash[0].id ?? null : null
          );
        }
      } catch (error) {
        console.error('Error permanently deleting note:', error);
      }
    },
    [selectedNoteId]
  );

  /**
   * Toggle or select a tag filter.
   */
  const toggleTagFilter = useCallback((tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }, []);

  /**
   * Global Keyboard Shortcuts (Ctrl/Cmd + N, Ctrl/Cmd + F, Escape).
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + N: Create new note
      if (isCmdOrCtrl && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        createNewNote();
      }

      // Ctrl/Cmd + F: Focus search input
      if (isCmdOrCtrl && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setFocusSearchTrigger((prev) => prev + 1);
      }

      // Escape: Clear search or exit filter
      if (e.key === 'Escape') {
        if (searchQuery) {
          setSearchQuery('');
        } else if (selectedTag) {
          setSelectedTag(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createNewNote, searchQuery, selectedTag]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (fadeSavedTimerRef.current) clearTimeout(fadeSavedTimerRef.current);
    };
  }, []);

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4000);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  /**
   * Triggers export of all non-deleted notes to a JSON backup file.
   */
  const exportAllJSON = useCallback(() => {
    if (notes.length === 0) {
      showToast('No notes available to export.', 'info');
      return;
    }
    try {
      exportAllNotesAsJSON(notes);
      showToast(`Exported ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} as JSON backup.`, 'success');
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Failed to export notes.', 'error');
    }
  }, [notes, showToast]);

  /**
   * Triggers export of the currently selected note to Markdown format (.md).
   */
  const exportCurrentNoteMarkdown = useCallback(() => {
    if (!selectedNote) {
      showToast('Please select a note to export.', 'info');
      return;
    }
    try {
      exportNoteAsMarkdown(selectedNote);
      showToast(`Exported "${selectedNote.title || 'Untitled Note'}" as Markdown.`, 'success');
    } catch (err) {
      console.error('Markdown export failed:', err);
      showToast('Failed to export note as Markdown.', 'error');
    }
  }, [selectedNote, showToast]);

  /**
   * Triggers export of the currently selected note as a formatted PDF.
   */
  const exportCurrentNotePDF = useCallback(() => {
    if (!selectedNote) {
      showToast('Please select a note to export.', 'info');
      return;
    }
    try {
      exportNoteAsPDF(selectedNote);
      showToast(`Preparing PDF export for "${selectedNote.title || 'Untitled Note'}".`, 'success');
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('Failed to export note as PDF.', 'error');
    }
  }, [selectedNote, showToast]);

  /**
   * Performs bulk import of validated notes into IndexedDB.
   */
  const importNotesBatch = useCallback(
    async (importedNotes: CreateNoteInput[]) => {
      try {
        const count = await importNotesToDb(importedNotes);
        await loadNotes();
        // Switch to all notes view
        setActiveView('all');
        showToast(`${count} ${count === 1 ? 'note' : 'notes'} imported successfully.`, 'success');
        return count;
      } catch (err) {
        console.error('Import failed:', err);
        showToast('Failed to import notes into database.', 'error');
        throw err;
      }
    },
    [loadNotes, showToast]
  );

  return {
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
    isLoading,
    saveStatus,
    focusTitleTrigger,
    focusSearchTrigger,
    darkMode,
    toast,
    showToast,
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
  };
}

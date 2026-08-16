import { useEffect, useRef, useState, useCallback, type ChangeEvent, type KeyboardEvent } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { CustomImage } from '../extensions/CustomImage';

import {
  Check,
  Edit3,
  Plus,
  Loader2,
  Pin,
  Bold,
  Italic,
  List,
  CheckSquare,
  Image as ImageIcon,
  Table as TableIcon,
  X,
  RotateCcw,
  Trash2,
  Tag as TagIcon,
  Download,
  Printer,
  FileText,
  FolderArchive,
  ChevronDown,
  ArrowLeft,
  Upload,
  Link as LinkIcon,
  PlusSquare,
  MinusSquare,
} from 'lucide-react';

import type { Note, UpdateNoteInput } from '../types';
import type { SaveStatus, ActiveView } from '../hooks/useNotes';
import { formatRelativeTime } from '../utils/date';
import { compressImage } from '../utils/imageCompress';
import { saveImageBlob } from '../db/imageRepository';

interface NoteEditorProps {
  note: Note | null;
  activeView: ActiveView;
  saveStatus: SaveStatus;
  focusTitleTrigger: number;
  onUpdateNote: (id: number, changes: UpdateNoteInput) => void;
  onTogglePin: (id: number) => void;
  onAddTag: (id: number, tag: string) => void;
  onRemoveTag: (id: number, tag: string) => void;
  onRestoreNote: (id: number) => void;
  onRequestPermanentDelete: (id: number, title: string) => void;
  onCreateNote: () => void;
  onExportMarkdown?: () => void;
  onExportPDF?: () => void;
  onOpenBackupModal?: () => void;
  onBackToList?: () => void;
}

export function NoteEditor({
  note,
  activeView,
  saveStatus,
  focusTitleTrigger,
  onUpdateNote,
  onTogglePin,
  onAddTag,
  onRemoveTag,
  onRestoreNote,
  onRequestPermanentDelete,
  onCreateNote,
  onExportMarkdown,
  onExportPDF,
  onOpenBackupModal,
  onBackToList,
}: NoteEditorProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [tagInput, setTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Insert Image Dialog State
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageAltInput, setImageAltInput] = useState('');
  const [imageTab, setImageTab] = useState<'upload' | 'url'>('upload');
  const [imageError, setImageError] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  // Track noteId to avoid unnecessary re-renders or content resets
  const noteIdRef = useRef<number | undefined>(note?.id);
  noteIdRef.current = note?.id;

  const isTrashNote = Boolean(note?.isDeleted);

  // Track previous focus trigger strictly to prevent focus-stealing bug
  const prevFocusTriggerRef = useRef(focusTitleTrigger);

  // Auto-focus title input ONLY when focusTitleTrigger explicitly increments (e.g. "+ New Note" clicked)
  useEffect(() => {
    if (focusTitleTrigger > prevFocusTriggerRef.current) {
      prevFocusTriggerRef.current = focusTitleTrigger;
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
        titleInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [focusTitleTrigger]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isExportMenuOpen]);

  // Initialize Tiptap Editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          HTMLAttributes: {
            class: 'bullet-list',
          },
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: {
          class: 'mizumoto-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      CustomImage,
    ],
    content: note?.content || '',
    editable: !isTrashNote,
    editorProps: {
      attributes: {
        class: 'tiptap ProseMirror focus:outline-none min-h-[300px] w-full',
        'data-placeholder': 'Start writing here, or use the toolbar to format...',
      },
    },
    onUpdate: ({ editor }) => {
      if (noteIdRef.current !== undefined && !isTrashNote) {
        const html = editor.getHTML();
        onUpdateNote(noteIdRef.current, { content: html });
      }
    },
  });

  // Sync editor content when switching notes
  useEffect(() => {
    if (editor && note) {
      const currentHtml = editor.getHTML();
      const newContent = note.content || '';

      // Only set content if it's different to prevent cursor position resets
      if (newContent !== currentHtml) {
        editor.commands.setContent(newContent);
      }
      editor.setEditable(!isTrashNote);
    }
  }, [note?.id, isTrashNote, editor]);

  // Reset dialog states when switching notes
  useEffect(() => {
    setIsAddingTag(false);
    setTagInput('');
    setIsExportMenuOpen(false);
    setIsImageModalOpen(false);
    setImageUrlInput('');
    setImageAltInput('');
    setImageError(null);
  }, [note?.id]);

  // Calculate coordinates of the active table inside the editor container
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [tableToolbarPosition, setTableToolbarPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  const isTableActive = Boolean(editor?.isActive('table'));

  const updateTableToolbarPos = useCallback(() => {
    if (!editor || !isTableActive || !editorContainerRef.current) {
      setTableToolbarPosition(null);
      return;
    }

    try {
      const { state } = editor;
      const { selection } = state;
      const $anchor = selection.$anchor;
      
      // Find DOM table element
      let tableDom: HTMLElement | null = null;
      let depth = $anchor.depth;
      while (depth > 0) {
        const node = $anchor.node(depth);
        if (node.type.name === 'table') {
          const dom = editor.view.nodeDOM($anchor.before(depth)) as HTMLElement | null;
          if (dom) {
            tableDom = dom.tagName.toLowerCase() === 'table' ? dom : dom.querySelector('table') || dom;
          }
          break;
        }
        depth--;
      }

      // Fallback: check closest table element from document active selection
      if (!tableDom) {
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          const anchorEl = sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement;
          tableDom = anchorEl?.closest('table') || null;
        }
      }

      if (tableDom && editorContainerRef.current) {
        const containerRect = editorContainerRef.current.getBoundingClientRect();
        const tableRect = tableDom.getBoundingClientRect();

        const top = tableRect.top - containerRect.top + editorContainerRef.current.scrollTop - 44;
        const left = Math.max(0, tableRect.left - containerRect.left + editorContainerRef.current.scrollLeft);
        const width = tableRect.width;

        setTableToolbarPosition({ top, left, width });
      } else {
        setTableToolbarPosition(null);
      }
    } catch {
      setTableToolbarPosition(null);
    }
  }, [editor, isTableActive]);

  useEffect(() => {
    if (!isTableActive) {
      setTableToolbarPosition(null);
      return;
    }

    updateTableToolbarPos();

    const handleUpdate = () => updateTableToolbarPos();
    editor?.on('selectionUpdate', handleUpdate);
    editor?.on('transaction', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    const container = editorContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleUpdate, { passive: true });
    }

    return () => {
      editor?.off('selectionUpdate', handleUpdate);
      editor?.off('transaction', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      if (container) {
        container.removeEventListener('scroll', handleUpdate);
      }
    };
  }, [isTableActive, editor, updateTableToolbarPos]);

  if (!note || note.id === undefined) {
    return (
      <main className="flex-1 bg-brand-light dark:bg-brand-dark flex items-center justify-center p-8 select-none transition-colors duration-150">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 flex items-center justify-center text-brand-muted shadow-xs">
            <Edit3 className="w-7 h-7 stroke-[1.8]" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-brand-dark dark:text-brand-light tracking-tight">
              {activeView === 'trash' ? 'No Trash Note Selected' : 'No Note Selected'}
            </h2>
            <p className="text-xs text-brand-muted leading-relaxed max-w-[260px] mx-auto">
              {activeView === 'trash'
                ? 'Select a deleted note from the list to review or restore it.'
                : 'Choose a note from the list or create a fresh one to begin writing.'}
            </p>
          </div>
          {activeView !== 'trash' && (
            <button
              type="button"
              onClick={onCreateNote}
              className="inline-flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-light text-xs font-medium py-2.5 px-4 rounded-md transition-colors duration-150 shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
              <span>Create New Note</span>
            </button>
          )}
        </div>
      </main>
    );
  }

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (note.id !== undefined && !isTrashNote) {
      onUpdateNote(note.id, { title: e.target.value });
    }
  };

  /**
   * Handle image insert from local file with Canvas compression + Dexie blob storage
   */
  const handleLocalImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor || note.id === undefined || isTrashNote) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Please select a valid image file (PNG, JPEG, WebP, GIF, SVG).');
      return;
    }

    setIsProcessingImage(true);
    setImageError(null);

    try {
      // 1. Compress image via Canvas API (max ~1200px width, JPEG 80%)
      const compressedBlob = await compressImage(file);

      // 2. Save Blob in Dexie images table
      const imageId = await saveImageBlob(compressedBlob, note.id);
      const blobUrl = URL.createObjectURL(compressedBlob);

      // 3. Insert into Tiptap editor
      editor
        .chain()
        .focus()
        .setImage({
          src: blobUrl,
          alt: imageAltInput.trim() || file.name.replace(/\.[^/.]+$/, ''),
          imageId: imageId,
          width: '100%',
        })
        .run();

      setIsImageModalOpen(false);
      setImageUrlInput('');
      setImageAltInput('');
      setImageError(null);
    } catch (err) {
      console.error('Failed to process and store image:', err);
      setImageError('Failed to process image file. Please try another image.');
    } finally {
      setIsProcessingImage(false);
      if (imageFileInputRef.current) {
        imageFileInputRef.current.value = '';
      }
    }
  };

  /**
   * Handle image insert from external URL
   */
  const handleUrlImageSubmit = () => {
    if (!imageUrlInput.trim() || !editor || isTrashNote) {
      setImageError('Please enter a valid image URL.');
      return;
    }

    editor
      .chain()
      .focus()
      .setImage({
        src: imageUrlInput.trim(),
        alt: imageAltInput.trim() || 'Image',
        width: '100%',
      })
      .run();

    setIsImageModalOpen(false);
    setImageUrlInput('');
    setImageAltInput('');
    setImageError(null);
  };

  /**
   * Add a 2x2 table with header row
   */
  const handleInsertTable = () => {
    if (!editor || isTrashNote) return;
    editor
      .chain()
      .focus()
      .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
      .run();
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tagInput.trim() && note.id !== undefined && !isTrashNote) {
      onAddTag(note.id, tagInput.trim());
      setTagInput('');
      setIsAddingTag(false);
    }
  };

  const handleTagInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsAddingTag(false);
      setTagInput('');
    }
  };

  return (
    <main className="flex-1 flex flex-col h-full bg-brand-light dark:bg-brand-dark overflow-hidden transition-colors duration-150">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-brand-muted/15 dark:border-brand-muted/25 px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 bg-brand-light/95 dark:bg-brand-dark/95 backdrop-blur-xs z-10">
        {/* Left: Mobile back button & Save Status Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="md:hidden p-1.5 -ml-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded-md hover:bg-brand-surface dark:hover:bg-brand-surface-dark transition-colors cursor-pointer"
              aria-label="Back to note list"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {/* Auto-Save & Timestamp Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-brand-muted truncate">
            {isTrashNote ? (
              <span className="inline-flex items-center gap-1 text-brand-accent font-medium">
                <Trash2 className="w-3.5 h-3.5" />
                <span>In Trash (Read-only)</span>
              </span>
            ) : saveStatus === 'saving' ? (
              <span className="inline-flex items-center gap-1.5 text-brand-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-accent" />
                <span>Saving...</span>
              </span>
            ) : saveStatus === 'saved' ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Saved</span>
              </span>
            ) : (
              <span className="truncate">
                Edited {formatRelativeTime(note.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions (Pin, Export Menu, Trash controls) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isTrashNote ? (
            <>
              <button
                type="button"
                onClick={() => onRestoreNote(note.id!)}
                className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-md bg-brand-surface dark:bg-brand-surface-dark hover:bg-brand-muted/20 text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                title="Restore note"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Restore Note</span>
              </button>

              <button
                type="button"
                onClick={() => onRequestPermanentDelete(note.id!, note.title)}
                className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-md bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-brand-light border border-brand-accent/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                title="Permanently delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Permanently</span>
              </button>
            </>
          ) : (
            <>
              {/* Pin / Unpin Button */}
              <button
                type="button"
                onClick={() => onTogglePin(note.id!)}
                className={`p-2 rounded-md transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  note.pinned
                    ? 'text-brand-accent bg-brand-accent/10 dark:bg-brand-accent/20'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title={note.pinned ? 'Unpin note' : 'Pin note to top'}
                aria-label={note.pinned ? 'Unpin note' : 'Pin note to top'}
              >
                <Pin className={`w-4 h-4 ${note.pinned ? 'fill-brand-accent' : ''}`} />
              </button>

              {/* Export & Backup Dropdown Menu */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-2.5 rounded-md bg-brand-surface dark:bg-brand-surface-dark hover:bg-brand-muted/20 text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                  title="Export or backup note"
                  aria-expanded={isExportMenuOpen}
                  aria-haspopup="true"
                >
                  <Download className="w-3.5 h-3.5 text-brand-accent" />
                  <span className="hidden sm:inline">Export</span>
                  <ChevronDown className="w-3 h-3 text-brand-muted" />
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-brand-light dark:bg-brand-dark rounded-lg shadow-xl border border-brand-muted/20 dark:border-brand-muted/30 py-1 z-30 animate-in fade-in-50 zoom-in-95 duration-100">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted border-b border-brand-muted/15 dark:border-brand-muted/25">
                      This Note
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        onExportPDF?.();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-brand-dark dark:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 text-brand-accent" />
                      <div className="flex-1">
                        <div className="font-medium">Export as PDF</div>
                        <div className="text-[10px] text-brand-muted">Formatted document</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        onExportMarkdown?.();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-brand-dark dark:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-brand-muted" />
                      <div className="flex-1">
                        <div className="font-medium">Export as Markdown</div>
                        <div className="text-[10px] text-brand-muted">.md with frontmatter</div>
                      </div>
                    </button>

                    <div className="my-1 border-t border-brand-muted/15 dark:border-brand-muted/25" />

                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                      All Notes
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        onOpenBackupModal?.();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-brand-dark dark:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FolderArchive className="w-4 h-4 text-brand-accent" />
                      <div className="flex-1">
                        <div className="font-medium">Backup & Restore</div>
                        <div className="text-[10px] text-brand-muted">JSON archive</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Editor Main Scrollable Container */}
      <div 
        ref={editorContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-12 lg:px-20 py-6 sm:py-8 space-y-6 max-w-4xl w-full mx-auto relative"
      >
        {/* Isolated Title Input Field */}
        <div className="space-y-2">
          <input
            ref={titleInputRef}
            type="text"
            value={note.title}
            onChange={handleTitleChange}
            disabled={isTrashNote}
            placeholder="Untitled Note"
            className="w-full text-2xl sm:text-3xl font-bold tracking-tight text-brand-dark dark:text-brand-light placeholder:text-brand-muted/40 bg-transparent border-none outline-none focus:ring-0 px-0 disabled:opacity-75 disabled:cursor-not-allowed"
          />

          {/* Tags Row */}
          <div className="flex items-center flex-wrap gap-1.5 pt-1">
            {note.tags &&
              note.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-full bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 group transition-colors"
                >
                  <TagIcon className="w-3 h-3 text-brand-muted" />
                  <span>#{tag}</span>
                  {!isTrashNote && (
                    <button
                      type="button"
                      onClick={() => onRemoveTag(note.id!, tag)}
                      className="p-0.5 text-brand-muted hover:text-brand-accent rounded-full transition-colors cursor-pointer"
                      title={`Remove tag #${tag}`}
                      aria-label={`Remove tag #${tag}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}

            {!isTrashNote && (
              <>
                {isAddingTag ? (
                  <form onSubmit={handleAddTagSubmit} className="inline-flex items-center">
                    <input
                      ref={tagInputRef}
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagInputKeyDown}
                      onBlur={() => {
                        if (!tagInput.trim()) setIsAddingTag(false);
                      }}
                      placeholder="Tag name..."
                      autoFocus
                      className="text-xs py-1 px-2.5 rounded-full bg-brand-surface dark:bg-brand-surface-dark text-brand-dark dark:text-brand-light border border-brand-accent outline-none w-28 placeholder:text-brand-muted/50"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingTag(true)}
                    className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-full text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark border border-dashed border-brand-muted/30 hover:border-brand-muted/60 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tag</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Unified Rich Text Toolbar (6 Buttons) */}
        {!isTrashNote && editor && (
          <div className="sticky top-0 z-20 bg-brand-light/95 dark:bg-brand-dark/95 backdrop-blur-xs py-2 border-y border-brand-muted/15 dark:border-brand-muted/25 flex items-center justify-between gap-1 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {/* 1. Bold */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  editor.isActive('bold')
                    ? 'bg-brand-accent text-brand-light shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title="Bold (Ctrl+B)"
                aria-label="Bold text"
              >
                <Bold className="w-4 h-4 stroke-[2.2]" />
              </button>

              {/* 2. Italic */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  editor.isActive('italic')
                    ? 'bg-brand-accent text-brand-light shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title="Italic (Ctrl+I)"
                aria-label="Italic text"
              >
                <Italic className="w-4 h-4 stroke-[2.2]" />
              </button>

              <span className="w-px h-4 bg-brand-muted/20 dark:bg-brand-muted/30 mx-1" />

              {/* 3. Bullet List */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  editor.isActive('bulletList')
                    ? 'bg-brand-accent text-brand-light shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title="Bullet List"
                aria-label="Bullet list"
              >
                <List className="w-4 h-4 stroke-[2.2]" />
              </button>

              {/* 4. Checklist (Task List) */}
              <button
                type="button"
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  editor.isActive('taskList')
                    ? 'bg-brand-accent text-brand-light shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title="Checklist"
                aria-label="Checklist"
              >
                <CheckSquare className="w-4 h-4 stroke-[2.2]" />
              </button>

              <span className="w-px h-4 bg-brand-muted/20 dark:bg-brand-muted/30 mx-1" />

              {/* 5. Insert Table */}
              <button
                type="button"
                onClick={handleInsertTable}
                className={`p-1.5 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 ${
                  editor.isActive('table')
                    ? 'bg-brand-accent text-brand-light shadow-xs'
                    : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark'
                }`}
                title="Insert Table (2x2)"
                aria-label="Insert Table"
              >
                <TableIcon className="w-4 h-4 stroke-[2.2]" />
              </button>

              {/* 6. Insert Image */}
              <button
                type="button"
                onClick={() => setIsImageModalOpen(true)}
                className="p-1.5 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light hover:bg-brand-surface dark:hover:bg-brand-surface-dark rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
                title="Insert Image"
                aria-label="Insert Image"
              >
                <ImageIcon className="w-4 h-4 stroke-[2.2]" />
              </button>
            </div>
          </div>
        )}

        {/* Table Contextual Quick Actions (Rendered directly above the active table) */}
        {!isTrashNote && editor && isTableActive && (
          <div
            className={`transition-all duration-150 z-30 ${
              tableToolbarPosition
                ? 'absolute'
                : 'bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/25 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap text-xs shadow-md mb-2'
            }`}
            style={
              tableToolbarPosition
                ? {
                    top: `${tableToolbarPosition.top}px`,
                    left: `${tableToolbarPosition.left}px`,
                    maxWidth: `${Math.max(300, tableToolbarPosition.width)}px`,
                  }
                : undefined
            }
          >
            <div className="bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/30 dark:border-brand-muted/40 rounded-lg px-2.5 py-1.5 flex items-center gap-2 flex-wrap text-xs shadow-lg backdrop-blur-xs">
              <span className="font-semibold text-brand-dark dark:text-brand-light flex items-center gap-1 shrink-0">
                <TableIcon className="w-3.5 h-3.5 text-brand-accent" />
                <span className="hidden sm:inline">Table:</span>
              </span>

              <div className="flex items-center gap-1 flex-wrap">
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="px-2 py-0.5 bg-brand-light dark:bg-brand-dark hover:bg-brand-accent hover:text-brand-light text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  title="Add Row Below"
                >
                  + Row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteRow().run()}
                  className="px-2 py-0.5 bg-brand-light dark:bg-brand-dark hover:bg-brand-accent hover:text-brand-light text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  title="Delete Current Row"
                >
                  - Row
                </button>
                <span className="text-brand-muted/40">|</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="px-2 py-0.5 bg-brand-light dark:bg-brand-dark hover:bg-brand-accent hover:text-brand-light text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  title="Add Column to Right"
                >
                  + Col
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteColumn().run()}
                  className="px-2 py-0.5 bg-brand-light dark:bg-brand-dark hover:bg-brand-accent hover:text-brand-light text-brand-dark dark:text-brand-light border border-brand-muted/20 dark:border-brand-muted/30 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  title="Delete Current Column"
                >
                  - Col
                </button>
                <span className="text-brand-muted/40">|</span>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().deleteTable().run()}
                  className="px-2 py-0.5 text-brand-accent hover:bg-brand-accent hover:text-brand-light border border-brand-accent/30 rounded text-[11px] font-medium transition-colors cursor-pointer"
                  title="Delete Table"
                >
                  Delete Table
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Trash Banner */}
        {isTrashNote && (
          <div className="p-3.5 rounded-lg bg-brand-accent/10 border border-brand-accent/30 text-xs text-brand-dark dark:text-brand-light flex items-center justify-between gap-3">
            <span className="text-brand-muted">
              This note is in Trash. Restore it to make edits or changes.
            </span>
            <button
              type="button"
              onClick={() => onRestoreNote(note.id!)}
              className="text-xs font-semibold text-brand-accent hover:underline cursor-pointer"
            >
              Restore Now
            </button>
          </div>
        )}

        {/* Unified WYSIWYG Editor Content Container */}
        <div className="pt-2 pb-16 min-h-[350px]">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Insert Image Modal */}
      {isImageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="image-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        >
          <div className="bg-brand-light dark:bg-brand-dark border border-brand-muted/20 dark:border-brand-muted/30 w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col transition-all">
            {/* Header */}
            <div className="px-5 py-4 border-b border-brand-muted/15 dark:border-brand-muted/25 flex items-center justify-between bg-brand-surface/70 dark:bg-brand-surface-dark/70">
              <div className="flex items-center gap-2.5 font-semibold text-sm text-brand-dark dark:text-brand-light">
                <ImageIcon className="w-4 h-4 text-brand-accent" />
                <span id="image-modal-title">Insert Image</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 text-brand-muted hover:text-brand-dark dark:hover:text-brand-light rounded cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Tab Selector */}
              <div className="flex rounded-lg bg-brand-surface dark:bg-brand-surface-dark p-1 border border-brand-muted/20 dark:border-brand-muted/30">
                <button
                  type="button"
                  onClick={() => setImageTab('upload')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    imageTab === 'upload'
                      ? 'bg-brand-light dark:bg-brand-dark text-brand-dark dark:text-brand-light shadow-xs'
                      : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Local File</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('url')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                    imageTab === 'url'
                      ? 'bg-brand-light dark:bg-brand-dark text-brand-dark dark:text-brand-light shadow-xs'
                      : 'text-brand-muted hover:text-brand-dark dark:hover:text-brand-light'
                  }`}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span>Image URL</span>
                </button>
              </div>

              {/* Error Message */}
              {imageError && (
                <div className="p-3 text-xs text-brand-accent bg-brand-accent/10 border border-brand-accent/20 rounded-md">
                  {imageError}
                </div>
              )}

              {/* Alt Text Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-brand-dark dark:text-brand-light">
                  Caption / Alt text (optional)
                </label>
                <input
                  type="text"
                  value={imageAltInput}
                  onChange={(e) => setImageAltInput(e.target.value)}
                  placeholder="e.g. Architecture diagram"
                  className="w-full text-xs px-3 py-2 rounded-md bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 text-brand-dark dark:text-brand-light outline-none focus:border-brand-accent"
                />
              </div>

              {/* Tab 1: Upload */}
              {imageTab === 'upload' && (
                <div className="space-y-3">
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    onChange={handleLocalImageUpload}
                    className="hidden"
                    id="image-file-input"
                  />
                  <div
                    onClick={() => imageFileInputRef.current?.click()}
                    className="p-6 border-2 border-dashed border-brand-muted/30 dark:border-brand-muted/40 hover:border-brand-accent/60 rounded-lg text-center cursor-pointer transition-colors bg-brand-surface/30 dark:bg-brand-surface-dark/30 space-y-2"
                  >
                    {isProcessingImage ? (
                      <div className="py-3 flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
                        <span className="text-xs text-brand-muted">Compressing & storing image...</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 mx-auto text-brand-muted" />
                        <p className="text-xs font-semibold text-brand-dark dark:text-brand-light">
                          Click to select an image from your device
                        </p>
                        <p className="text-[11px] text-brand-muted">
                          Auto-compressed & stored locally in IndexedDB &middot; Zero Cloud
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: URL */}
              {imageTab === 'url' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-brand-dark dark:text-brand-light">
                      Image Web Address (URL)
                    </label>
                    <input
                      type="url"
                      value={imageUrlInput}
                      onChange={(e) => setImageUrlInput(e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                      className="w-full text-xs px-3 py-2 rounded-md bg-brand-surface dark:bg-brand-surface-dark border border-brand-muted/20 dark:border-brand-muted/30 text-brand-dark dark:text-brand-light outline-none focus:border-brand-accent"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleUrlImageSubmit}
                    className="w-full py-2 px-3 text-xs font-semibold text-brand-light bg-brand-accent hover:bg-brand-accent-hover rounded-md transition-colors cursor-pointer shadow-xs"
                  >
                    Insert Image
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-brand-muted/15 dark:border-brand-muted/25 flex justify-end bg-brand-surface/70 dark:bg-brand-surface-dark/70">
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-brand-muted hover:text-brand-dark dark:hover:text-brand-light cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

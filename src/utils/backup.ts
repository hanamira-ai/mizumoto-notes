import type { Note, CreateNoteInput } from '../types';
import { convertHtmlToMarkdown } from './htmlToMarkdown';
import { getAllImageRecords, importImageRecord, getImageUrlForId } from '../db/imageRepository';

/**
 * Backup & Export Utilities for Mizumoto Notes
 *
 * Provides 100% offline, client-side export and import functionality:
 * - JSON full backup with metadata and embedded image blobs
 * - Markdown (.md) note export with YAML frontmatter from Tiptap HTML
 * - Safe JSON import parser with robust validation and zero crash risk
 * - Formatted, print-ready PDF export via browser print dialogue
 */

export interface BackupImagePayload {
  id?: number;
  noteId?: number;
  dataUrl: string;
  createdAt?: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  appName: string;
  notesCount: number;
  notes: Array<{
    title: string;
    content: string;
    tags: string[];
    pinned: boolean;
    createdAt?: string;
    updatedAt?: string;
  }>;
  images?: BackupImagePayload[];
}

export interface ImportValidationResult {
  success: boolean;
  notes: CreateNoteInput[];
  images?: BackupImagePayload[];
  notesCount: number;
  error?: string;
}

/**
 * Helper to trigger a browser file download using Blob and temporary <a> link.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an ISO-based date string formatted as YYYY-MM-DD.
 */
export function getFormattedDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converts a Blob to a Base64 Data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts a Base64 Data URL to a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const byteString = atob(parts[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * Exports all active (non-deleted) notes and images as a formatted JSON backup file.
 */
export async function exportAllNotesAsJSON(notes: Note[]): Promise<void> {
  const activeNotes = notes.filter((n) => !n.isDeleted);
  const nowIso = new Date().toISOString();

  // Export image records from Dexie images table
  const images = await getAllImageRecords();
  const serializedImages: BackupImagePayload[] = [];

  for (const img of images) {
    if (img.blob) {
      try {
        const dataUrl = await blobToDataUrl(img.blob);
        serializedImages.push({
          id: img.id,
          noteId: img.noteId,
          dataUrl,
          createdAt: img.createdAt,
        });
      } catch (err) {
        console.error('Failed to serialize image:', err);
      }
    }
  }

  const backupData: BackupPayload = {
    version: 2,
    exportedAt: nowIso,
    appName: 'Mizumoto Notes',
    notesCount: activeNotes.length,
    notes: activeNotes.map((note) => ({
      title: note.title ?? '',
      content: note.content ?? '',
      tags: Array.isArray(note.tags) ? note.tags : [],
      pinned: Boolean(note.pinned),
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    })),
    images: serializedImages,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const filename = `mizumoto-notes-backup-${getFormattedDateString()}.json`;

  downloadBlob(blob, filename);
}

/**
 * Exports a single note as a Markdown file with clean YAML frontmatter.
 */
export function exportNoteAsMarkdown(note: Note): void {
  const title = (note.title || 'Untitled Note').trim();
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const createdAt = note.createdAt || new Date().toISOString();
  const updatedAt = note.updatedAt || new Date().toISOString();
  const isPinned = Boolean(note.pinned);

  // Construct YAML Frontmatter
  const tagsYaml = tags.length > 0 ? `[${tags.map((t) => `"${t}"`).join(', ')}]` : '[]';
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `tags: ${tagsYaml}`,
    `pinned: ${isPinned}`,
    `createdAt: "${createdAt}"`,
    `updatedAt: "${updatedAt}"`,
    '---',
    '',
  ].join('\n');

  // Convert HTML content from Tiptap to clean Markdown
  let markdownBody = convertHtmlToMarkdown(note.content || '');

  // If the note content doesn't start with a heading matching the title, provide a clean title header
  if (title && !markdownBody.trim().startsWith('# ')) {
    markdownBody = `# ${title}\n\n${markdownBody}`;
  }

  const fullMarkdown = `${frontmatter}${markdownBody}\n`;
  const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });

  // Sanitize filename for operating systems
  const safeFilename =
    title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled-note';

  downloadBlob(blob, `${safeFilename}.md`);
}

/**
 * Resolves any data-image-id tags in note HTML into active blob/data URLs for printing
 */
async function prepareHtmlForPrint(html: string): Promise<string> {
  if (!html || !html.trim()) {
    return '<p style="color: #6B7280; font-style: italic;">(Empty note content)</p>';
  }

  // If content is plain text or old format, wrap in basic paragraph tags
  let processed = html;
  if (!processed.includes('<') && !processed.includes('>')) {
    processed = processed
      .split('\n')
      .map((l) => (l.trim() ? `<p>${l}</p>` : '<div style="height: 8px;"></div>'))
      .join('');
  }

  // Parse DOM to resolve image IDs
  const parser = new DOMParser();
  const doc = parser.parseFromString(processed, 'text/html');

  const imgElements = Array.from(doc.querySelectorAll('img'));
  for (const img of imgElements) {
    const imageId = img.getAttribute('data-image-id');
    if (imageId) {
      const url = await getImageUrlForId(Number(imageId));
      if (url) {
        img.setAttribute('src', url);
      }
    }
    const width = img.getAttribute('data-width') || img.getAttribute('width') || img.style.width;
    if (width && width !== '100%') {
      img.style.maxWidth = width;
      img.style.width = width;
    } else {
      img.style.maxWidth = '100%';
    }
    img.style.height = 'auto';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid #E5E7EB';
    img.style.display = 'block';
    img.style.margin = '12px 0';
  }

  return doc.body.innerHTML;
}

/**
 * Exports a single note as a beautifully styled, print-ready PDF via browser print dialogue.
 */
export async function exportNoteAsPDF(note: Note): Promise<void> {
  const title = (note.title || 'Untitled Note').trim();
  const tags = Array.isArray(note.tags) ? note.tags : [];
  const updatedAt = note.updatedAt
    ? new Date(note.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString();

  // Create an invisible iframe for isolated printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const htmlBody = await prepareHtmlForPrint(note.content || '');

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>${title} - Mizumoto Notes</title>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4 portrait;
            margin: 20mm 15mm 20mm 15mm;
          }
          * {
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111111;
            background: #ffffff;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            font-size: 13.5px;
          }
          .header {
            border-bottom: 2px solid #A3242A;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .brand-logo {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
          }
          .brand-badge {
            background-color: #A3242A;
            color: #ffffff;
            font-weight: 700;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            display: inline-block;
          }
          .brand-name {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #A3242A;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            color: #111111;
            margin: 0 0 6px 0;
            line-height: 1.25;
          }
          .meta {
            font-size: 11px;
            color: #6B7280;
          }
          .tags {
            margin-top: 8px;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
          }
          .tag {
            font-size: 10px;
            background: #F5F5F5;
            border: 1px solid #E5E7EB;
            padding: 2px 8px;
            border-radius: 9999px;
            color: #374151;
            font-weight: 500;
          }
          .content {
            font-size: 13.5px;
            color: #1F2937;
          }
          .content p {
            margin: 8px 0;
            line-height: 1.6;
          }
          .content strong {
            font-weight: 600;
            color: #111111;
          }
          .content em {
            font-style: italic;
          }
          .content ul:not([data-type="taskList"]) {
            list-style-type: disc;
            padding-left: 20px;
            margin: 10px 0;
            color: #A3242A;
          }
          .content ul:not([data-type="taskList"]) li {
            color: #1F2937;
            margin-bottom: 4px;
          }
          .content ul[data-type="taskList"] {
            list-style: none;
            padding-left: 0;
            margin: 10px 0;
          }
          .content ul[data-type="taskList"] li[data-type="taskItem"] {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            margin-bottom: 6px;
            line-height: 1.5;
          }
          .content ul[data-type="taskList"] li[data-type="taskItem"][data-checked="true"] {
            text-decoration: line-through;
            color: #9CA3AF;
          }
          .content ul[data-type="taskList"] li[data-type="taskItem"] input[type="checkbox"] {
            accent-color: #A3242A;
            margin-top: 3px;
          }
          .content table {
            width: 100%;
            border-collapse: collapse;
            margin: 16px 0;
            font-size: 12.5px;
            border: 1px solid #D1D5DB;
          }
          .content th {
            background-color: #F5F5F5;
            border: 1px solid #D1D5DB;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            color: #111111;
          }
          .content td {
            border: 1px solid #E5E7EB;
            padding: 6px 10px;
            color: #1F2937;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            border: 1px solid #E5E7EB;
          }
          .footer {
            margin-top: 30px;
            padding-top: 12px;
            border-top: 1px solid #E5E7EB;
            font-size: 10px;
            color: #9CA3AF;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand-logo">
            <span class="brand-badge">M</span>
            <span class="brand-name">Mizumoto Notes</span>
          </div>
          <h1>${title}</h1>
          <div class="meta">
            <span>Last updated: ${updatedAt}</span>
          </div>
          ${
            tags.length > 0
              ? `<div class="tags">${tags.map((t) => `<span class="tag">#${t}</span>`).join('')}</div>`
              : ''
          }
        </div>
        <div class="content">
          ${htmlBody}
        </div>
        <div class="footer">
          <span>Exported from Mizumoto Notes</span>
          <span>100% Offline &middot; Private</span>
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Trigger print after iframe renders
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('PDF print failed:', e);
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 350);
}

/**
 * Validates and sanitizes raw JSON backup text from file upload.
 */
export function validateAndParseImportJSON(jsonText: string): ImportValidationResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      success: false,
      notes: [],
      notesCount: 0,
      error: 'Invalid JSON file. Please ensure the file is a properly formatted JSON document.',
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      success: false,
      notes: [],
      notesCount: 0,
      error: "This file doesn't look like a valid backup. Expected a notes backup structure.",
    };
  }

  // Extract raw list of notes
  let rawList: unknown[] = [];
  let imagesList: BackupImagePayload[] = [];

  if (Array.isArray(parsed)) {
    rawList = parsed;
  } else if ('notes' in parsed && Array.isArray((parsed as Record<string, unknown>).notes)) {
    rawList = (parsed as Record<string, unknown>).notes as unknown[];
    if ('images' in parsed && Array.isArray((parsed as Record<string, unknown>).images)) {
      imagesList = (parsed as Record<string, unknown>).images as BackupImagePayload[];
    }
  } else {
    return {
      success: false,
      notes: [],
      notesCount: 0,
      error: 'No notes list found in this JSON file. Expected a list of notes.',
    };
  }

  if (rawList.length === 0) {
    return {
      success: false,
      notes: [],
      notesCount: 0,
      error: 'The uploaded backup file contains 0 notes.',
    };
  }

  const sanitizedNotes: CreateNoteInput[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object') {
      continue;
    }

    const record = item as Record<string, unknown>;

    const title = typeof record.title === 'string' ? record.title : '';
    const content = typeof record.content === 'string' ? record.content : '';

    // Process tags safely
    let tags: string[] = [];
    if (Array.isArray(record.tags)) {
      tags = record.tags
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => (t as string).trim().toLowerCase());
    }

    const pinned = Boolean(record.pinned);

    if (!title.trim() && !content.trim() && tags.length === 0) {
      continue;
    }

    sanitizedNotes.push({
      title,
      content,
      tags,
      pinned,
    });
  }

  if (sanitizedNotes.length === 0) {
    return {
      success: false,
      notes: [],
      notesCount: 0,
      error: 'No readable note content was found in this file.',
    };
  }

  return {
    success: true,
    notes: sanitizedNotes,
    images: imagesList,
    notesCount: sanitizedNotes.length,
  };
}

/**
 * Restores serialized images into IndexedDB Dexie images table
 */
export async function restoreImagesFromBackup(images: BackupImagePayload[]): Promise<number> {
  if (!images || images.length === 0) return 0;
  let count = 0;
  for (const img of images) {
    if (img.dataUrl) {
      try {
        const blob = dataUrlToBlob(img.dataUrl);
        await importImageRecord({
          id: img.id,
          noteId: img.noteId,
          blob,
          createdAt: img.createdAt || new Date().toISOString(),
        });
        count++;
      } catch (e) {
        console.error('Failed to restore image record:', e);
      }
    }
  }
  return count;
}

import Dexie, { type Table } from 'dexie';
import type { Note } from '../types';

export interface NoteImage {
  id?: number;
  noteId?: number;
  blob: Blob;
  createdAt: string;
}

/**
 * OfflineNotesDB - IndexedDB wrapper using Dexie.js
 * 
 * Dexie provides a clean, Promise-based API on top of browser IndexedDB,
 * ensuring fast local persistence with zero network dependencies.
 */
export class NotesDatabase extends Dexie {
  // Declare tables with type Note and NoteImage and number primary key
  notes!: Table<Note, number>;
  images!: Table<NoteImage, number>;

  constructor() {
    super('OfflineNotesDB');

    // Schema definition for version 1
    this.version(1).stores({
      notes: '++id, title, pinned, isDeleted, createdAt, updatedAt, syncStatus, *tags',
    });

    // Schema definition for version 2: Adds images table
    this.version(2).stores({
      notes: '++id, title, pinned, isDeleted, createdAt, updatedAt, syncStatus, *tags',
      images: '++id, noteId, createdAt',
    });
  }
}

// Single shared database instance
export const db = new NotesDatabase();


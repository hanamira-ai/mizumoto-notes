import { db } from './db';
import type { Note, CreateNoteInput, UpdateNoteInput } from '../types';

/**
 * Notes Repository - Data access layer for Notes
 * 
 * Provides clean CRUD utility functions over IndexedDB (via Dexie.js).
 */

/**
 * Creates a new note in the database.
 * 
 * @param input Optional fields to populate the new note.
 * @returns The newly created note's auto-generated primary key (ID).
 */
export async function createNote(input: CreateNoteInput = {}): Promise<number> {
  const now = new Date().toISOString();

  const newNote: Note = {
    title: input.title ?? '',
    content: input.content ?? '',
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local-only', // Reserved for future Google Drive synchronization
  };

  const id = await db.notes.add(newNote);
  return id;
}

/**
 * Retrieves all active (non-deleted) notes from the database.
 * Excludes notes where isDeleted === true (soft-deleted notes).
 * 
 * @returns Array of active notes.
 */
export async function getAllNotes(): Promise<Note[]> {
  // Query notes where isDeleted is 0 or false (Dexie index query or filter)
  return await db.notes
    .filter((note) => !note.isDeleted)
    .reverse()
    .sortBy('updatedAt');
}

/**
 * Retrieves a single note by its ID.
 * 
 * @param id The note primary key.
 * @returns The note object if found, or undefined if not found.
 */
export async function getNoteById(id: number): Promise<Note | undefined> {
  return await db.notes.get(id);
}

/**
 * Updates an existing note with new changes and sets the updated timestamp.
 * 
 * @param id The primary key of the note to update.
 * @param changes Object containing fields to update.
 * @returns 1 if the note was updated, or 0 if the note was not found.
 */
export async function updateNote(
  id: number,
  changes: UpdateNoteInput
): Promise<number> {
  const now = new Date().toISOString();

  const updatedCount = await db.notes.update(id, {
    ...changes,
    updatedAt: now,
  });

  return updatedCount;
}

/**
 * Soft-deletes a note by setting isDeleted = true.
 * This retains the note for trash/recycle bin recovery in later stages.
 * 
 * @param id The primary key of the note to soft-delete.
 * @returns 1 if updated, or 0 if not found.
 */
export async function softDeleteNote(id: number): Promise<number> {
  return await updateNote(id, {
    isDeleted: true,
  });
}

/**
 * Restores a soft-deleted note from the trash back to active notes.
 * 
 * @param id The primary key of the note to restore.
 * @returns 1 if restored, or 0 if not found.
 */
export async function restoreNote(id: number): Promise<number> {
  return await updateNote(id, {
    isDeleted: false,
  });
}

/**
 * Retrieves all soft-deleted notes (trash/recycle bin).
 * 
 * @returns Array of soft-deleted notes sorted by updatedAt descending.
 */
export async function getTrashNotes(): Promise<Note[]> {
  return await db.notes
    .filter((note) => Boolean(note.isDeleted))
    .reverse()
    .sortBy('updatedAt');
}

/**
 * Permanently removes a note record from IndexedDB.
 * 
 * @param id The primary key of the note to delete permanently.
 */
export async function deleteNotePermanently(id: number): Promise<void> {
  await db.notes.delete(id);
}

/**
 * Imports an array of notes into IndexedDB as brand new records with fresh IDs.
 * Preserves timestamps, tags, and pin status while guaranteeing no ID collisions.
 * 
 * @param notesToImport Array of validated note inputs.
 * @returns Total number of notes successfully inserted.
 */
export async function importNotes(notesToImport: CreateNoteInput[]): Promise<number> {
  if (!notesToImport || notesToImport.length === 0) return 0;

  const now = new Date().toISOString();

  const formattedNotes: Note[] = notesToImport.map((input) => ({
    title: input.title ?? '',
    content: input.content ?? '',
    tags: input.tags ?? [],
    pinned: input.pinned ?? false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'local-only',
  }));

  // Perform bulk insertion in a single IndexedDB transaction
  await db.transaction('rw', db.notes, async () => {
    await db.notes.bulkAdd(formattedNotes);
  });

  return formattedNotes.length;
}

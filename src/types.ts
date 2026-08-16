/**
 * Types definition for the Offline Notes application.
 */

export interface Note {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  isDeleted: boolean;
  createdAt: string; // ISO 8601 string format
  updatedAt: string; // ISO 8601 string format
  syncStatus: 'local-only' | 'synced' | 'pending' | string;
}

export type CreateNoteInput = {
  title?: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
};

export type UpdateNoteInput = Partial<Omit<Note, 'id' | 'createdAt'>>;

export type NoteSortOption = 'updated_desc' | 'created_desc' | 'created_asc';

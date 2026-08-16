import { db, type NoteImage } from './db';

/**
 * Image Repository - Local Blob persistence in IndexedDB
 *
 * Stores raw image Blobs in the Dexie "images" table with zero base64 bloat in HTML notes.
 * Provides caching of object URLs for instant rendering across component re-renders.
 */

// Memory cache for active Blob URLs to prevent duplicate creation
const blobUrlCache = new Map<number, string>();

/**
 * Saves an image Blob to IndexedDB
 */
export async function saveImageBlob(blob: Blob, noteId?: number): Promise<number> {
  const record: NoteImage = {
    blob,
    noteId,
    createdAt: new Date().toISOString(),
  };
  const id = await db.images.add(record);
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(id, blobUrl);
  return id;
}

/**
 * Retrieves a NoteImage record by its ID
 */
export async function getImageRecord(id: number): Promise<NoteImage | undefined> {
  return await db.images.get(id);
}

/**
 * Gets or creates a Blob URL for an image ID
 */
export async function getImageUrlForId(id: number): Promise<string | null> {
  if (blobUrlCache.has(id)) {
    return blobUrlCache.get(id)!;
  }

  const record = await db.images.get(id);
  if (!record || !record.blob) {
    return null;
  }

  const blobUrl = URL.createObjectURL(record.blob);
  blobUrlCache.set(id, blobUrl);
  return blobUrl;
}

/**
 * Retrieves all stored images (used for full JSON backup)
 */
export async function getAllImageRecords(): Promise<NoteImage[]> {
  return await db.images.toArray();
}

/**
 * Imports an image record (used during JSON restore)
 */
export async function importImageRecord(image: NoteImage): Promise<number> {
  if (image.id) {
    // Check if exists
    const exists = await db.images.get(image.id);
    if (exists) {
      await db.images.put(image);
      return image.id;
    }
  }
  return await db.images.add(image);
}

/**
 * Deletes an image record and revokes its Blob URL
 */
export async function deleteImageRecord(id: number): Promise<void> {
  if (blobUrlCache.has(id)) {
    URL.revokeObjectURL(blobUrlCache.get(id)!);
    blobUrlCache.delete(id);
  }
  await db.images.delete(id);
}

/**
 * Deletes all images associated with a specific note ID
 */
export async function deleteImagesForNote(noteId: number): Promise<void> {
  const images = await db.images.where('noteId').equals(noteId).toArray();
  for (const img of images) {
    if (img.id !== undefined) {
      if (blobUrlCache.has(img.id)) {
        URL.revokeObjectURL(blobUrlCache.get(img.id)!);
        blobUrlCache.delete(img.id);
      }
      await db.images.delete(img.id);
    }
  }
}

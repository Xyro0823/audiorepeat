import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, VocabSet } from '@/types/app';

interface AudioRepeatDB extends DBSchema {
  sets: { key: string; value: VocabSet };
  settings: { key: string; value: { key: string; value: AppSettings } };
}

let dbPromise: Promise<IDBPDatabase<AudioRepeatDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<AudioRepeatDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AudioRepeatDB>('audiorepeat', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sets')) {
          db.createObjectStore('sets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllSets(): Promise<VocabSet[]> {
  const db = await getDb();
  const sets = await db.getAll('sets');
  return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putSet(set: VocabSet): Promise<void> {
  const db = await getDb();
  await db.put('sets', set);
}

export async function deleteSet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sets', id);
}

export async function getSettings(): Promise<AppSettings | undefined> {
  const db = await getDb();
  return (await db.get('settings', 'global'))?.value;
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', { key: 'global', value: settings });
}

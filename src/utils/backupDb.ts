const DB_NAME = 'ostora_erp_backups';
const STORE_NAME = 'daily_snapshots';
const DB_VERSION = 1;

export interface DailyBackupRecord {
  id: string;
  dateKey: string;
  createdAt: string;
  sizeBytes: number;
  json: string;
}

export interface DailyBackupMeta {
  dateKey: string;
  createdAt: string;
  sizeBytes: number;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function openBackupDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function sortRecordsDesc(records: DailyBackupRecord[]): DailyBackupRecord[] {
  return [...records].sort((a, b) => {
    const dateCmp = b.dateKey.localeCompare(a.dateKey);
    if (dateCmp !== 0) return dateCmp;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

export async function saveDailySnapshot(
  record: DailyBackupRecord,
  maxRetention = 30,
): Promise<boolean> {
  const db = await openBackupDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);

      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const all = sortRecordsDesc((getAllReq.result as DailyBackupRecord[]) ?? []);
        if (all.length > maxRetention) {
          for (const stale of all.slice(maxRetention)) {
            store.delete(stale.id);
          }
        }
      };

      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    } catch {
      db.close();
      resolve(false);
    }
  });
}

export async function getDailySnapshot(dateKey: string): Promise<DailyBackupRecord | null> {
  const db = await openBackupDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(dateKey);

      req.onsuccess = () => {
        resolve((req.result as DailyBackupRecord | undefined) ?? null);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function getLatestDailySnapshot(): Promise<DailyBackupRecord | null> {
  const db = await openBackupDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = sortRecordsDesc((req.result as DailyBackupRecord[]) ?? []);
        resolve(all[0] ?? null);
      };
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
      resolve(null);
    }
  });
}

export async function listDailySnapshotMeta(): Promise<DailyBackupMeta[]> {
  const db = await openBackupDb();
  if (!db) return [];

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const all = sortRecordsDesc((req.result as DailyBackupRecord[]) ?? []);
        resolve(
          all.map(({ dateKey, createdAt, sizeBytes }) => ({
            dateKey,
            createdAt,
            sizeBytes,
          })),
        );
      };
      req.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      db.close();
      resolve([]);
    }
  });
}

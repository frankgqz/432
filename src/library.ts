// The library: ~30 favourites, kept as blobs in IndexedDB so the installed
// app survives reloads (Frank 2026-11-18: "a handful of favourites").
export interface Track {
  id: string;
  name: string;
  blob: Blob;
  tuningCents?: number | null;  // the source's detected tuning (null = unknown)
  tuningConfidence?: number;
}

const DB = "432", STORE = "tracks";

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function allTracks(): Promise<Track[]> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as Track[]).sort((a, b) => a.name.localeCompare(b.name));
      res(rows);
    };
    req.onerror = () => rej(req.error);
  });
}

export async function addTrack(name: string, blob: Blob, tuning?: { cents: number; confidence: number } | null): Promise<Track> {
  const track: Track = {
    id: crypto.randomUUID(), name, blob,
    tuningCents: tuning ? tuning.cents : null,
    tuningConfidence: tuning ? tuning.confidence : undefined,
  };
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).add(track);
    req.onsuccess = () => res(track);
    req.onerror = () => rej(req.error);
  });
}

export async function updateTuning(id: string, tuning: { cents: number; confidence: number }): Promise<void> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      const row = get.result as Track | undefined;
      if (row) {
        row.tuningCents = tuning.cents;
        row.tuningConfidence = tuning.confidence;
        store.put(row);
      }
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function removeTrack(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}

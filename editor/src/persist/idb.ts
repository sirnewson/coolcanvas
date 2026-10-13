import type { BoardDoc } from "../types";

const DB_NAME = "flowcanvas";
const DB_VERSION = 2;
const BOARDS = "boards";
const META = "meta";
const REELS = "timelapse";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BOARDS)) db.createObjectStore(BOARDS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(REELS)) db.createObjectStore(REELS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function saveBoard(doc: BoardDoc): Promise<void> {
  await tx(BOARDS, "readwrite", (s) => s.put(JSON.parse(JSON.stringify(doc))));
  await tx(META, "readwrite", (s) => s.put(doc.id, "lastBoardId"));
}

export async function loadLastBoard(): Promise<BoardDoc | null> {
  try {
    const id = await tx<string | undefined>(META, "readonly", (s) => s.get("lastBoardId"));
    if (!id) return null;
    const doc = await tx<BoardDoc | undefined>(BOARDS, "readonly", (s) => s.get(id));
    return doc ?? null;
  } catch {
    return null;
  }
}

export async function listBoards(): Promise<BoardDoc[]> {
  try {
    return await tx<BoardDoc[]>(BOARDS, "readonly", (s) => s.getAll());
  } catch {
    return [];
  }
}

export async function saveReel(boardId: string, frames: string[]): Promise<void> {
  await tx(REELS, "readwrite", (s) => s.put(frames, boardId));
}

export async function loadReel(boardId: string): Promise<string[]> {
  try {
    return (await tx<string[] | undefined>(REELS, "readonly", (s) => s.get(boardId))) ?? [];
  } catch {
    return [];
  }
}

export async function deleteReel(boardId: string): Promise<void> {
  try {
    await tx(REELS, "readwrite", (s) => s.delete(boardId));
  } catch {
    /* nothing to remove */
  }
}

export async function deleteBoard(id: string): Promise<void> {
  await tx(BOARDS, "readwrite", (s) => s.delete(id));
  await deleteReel(id);
}

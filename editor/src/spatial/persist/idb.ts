import type { Sketch, SketchMeta } from "../types";

/**
 * Local storage for sketches. Everything stays on the device: no account, no
 * upload, and the app works with the network off.
 */

const DB_NAME = "coolsketch";
const VERSION = 2;
const SKETCHES = "sketches";
const META = "meta";
const ASSETS = "assets";

export interface StoredAsset {
  id: string;
  name: string;
  mime: string;
  data: ArrayBuffer;
  size: number;
  createdAt: number;
}

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SKETCHES)) db.createObjectStore(SKETCHES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

const assetBlobUrls = new Map<string, string>();

export async function saveAsset(id: string, name: string, data: ArrayBuffer, mime = "application/octet-stream"): Promise<void> {
  const asset: StoredAsset = {
    id,
    name,
    mime,
    data,
    size: data.byteLength,
    createdAt: Date.now(),
  };
  await tx(ASSETS, "readwrite", (s) => s.put(asset));
}

export function loadAsset(id: string): Promise<StoredAsset | undefined> {
  return tx<StoredAsset | undefined>(ASSETS, "readonly", (s) => s.get(id));
}

export async function deleteAsset(id: string): Promise<void> {
  const existingUrl = assetBlobUrls.get(id);
  if (existingUrl) {
    URL.revokeObjectURL(existingUrl);
    assetBlobUrls.delete(id);
  }
  await tx(ASSETS, "readwrite", (s) => s.delete(id));
}

export async function listAssets(): Promise<{ id: string; name: string; size: number }[]> {
  const all = await tx<StoredAsset[]>(ASSETS, "readonly", (s) => s.getAll());
  return all.map((a) => ({ id: a.id, name: a.name, size: a.size }));
}

export async function getAssetBlobUrl(id: string): Promise<string | null> {
  if (assetBlobUrls.has(id)) {
    return assetBlobUrls.get(id)!;
  }
  const asset = await loadAsset(id);
  if (!asset) return null;
  const blob = new Blob([asset.data], { type: asset.mime });
  const url = URL.createObjectURL(blob);
  assetBlobUrls.set(id, url);
  return url;
}

export async function saveSketch(sketch: Sketch, thumb?: string): Promise<void> {
  await tx(SKETCHES, "readwrite", (s) => s.put(sketch));
  const meta: SketchMeta = {
    id: sketch.id,
    name: sketch.name,
    createdAt: sketch.createdAt,
    updatedAt: sketch.updatedAt,
    objectCount: sketch.objects.length,
    thumb,
  };
  if (!thumb) {
    const prev = await tx<SketchMeta | undefined>(META, "readonly", (s) => s.get(sketch.id));
    if (prev?.thumb) meta.thumb = prev.thumb;
  }
  await tx(META, "readwrite", (s) => s.put(meta));
}

export function loadSketch(id: string): Promise<Sketch | undefined> {
  return tx<Sketch | undefined>(SKETCHES, "readonly", (s) => s.get(id));
}

export async function listSketches(): Promise<SketchMeta[]> {
  const all = await tx<SketchMeta[]>(META, "readonly", (s) => s.getAll());
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteSketch(id: string): Promise<void> {
  await tx(SKETCHES, "readwrite", (s) => s.delete(id));
  await tx(META, "readwrite", (s) => s.delete(id));
}

export async function estimateUsage(): Promise<{ used: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { used: e.usage ?? 0, quota: e.quota ?? 0 };
}

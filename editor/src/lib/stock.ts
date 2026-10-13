/**
 * Free stock images — one search across four sources.
 *
 * Openverse (CC-licensed, keyless) works out of the box. Unsplash, Pixabay and
 * Pexels each need a free key, typed into the Images tab and kept in this
 * browser only. Results are normalised so the panel and the drop handlers do
 * not care where a picture came from.
 */

export type StockSource = "openverse" | "unsplash" | "pixabay" | "pexels";

export interface StockImage {
  id: string;
  source: StockSource;
  /** Small preview for the grid. */
  thumb: string;
  /** Sized for the board (~1200px on the long side). */
  full: string;
  width: number;
  height: number;
  author: string;
  link: string;
  alt: string;
}

export interface StockKeys {
  unsplash: string;
  pixabay: string;
  pexels: string;
}

const KEYS_STORE = "yxm-canvas:stock-keys";

/** Keys can be seeded at build time from a git-ignored .env.local (VITE_*_API_KEY). */
const SEED: StockKeys = {
  unsplash: (import.meta.env.VITE_UNSPLASH_API_KEY as string | undefined) ?? "",
  pixabay: (import.meta.env.VITE_PIXABAY_API_KEY as string | undefined) ?? "",
  pexels: (import.meta.env.VITE_PEXELS_API_KEY as string | undefined) ?? "",
};

export function loadStockKeys(): StockKeys {
  try {
    const stored = JSON.parse(localStorage.getItem(KEYS_STORE) ?? "{}") as Partial<StockKeys>;
    return {
      unsplash: stored.unsplash || SEED.unsplash,
      pixabay: stored.pixabay || SEED.pixabay,
      pexels: stored.pexels || SEED.pexels,
    };
  } catch {
    return { ...SEED };
  }
}

export function saveStockKeys(keys: StockKeys) {
  try {
    localStorage.setItem(KEYS_STORE, JSON.stringify(keys));
  } catch {
    /* storage can be disabled */
  }
}

export const SOURCE_LABELS: Record<StockSource, string> = {
  openverse: "Openverse · CC (no key)",
  unsplash: "Unsplash",
  pixabay: "Pixabay",
  pexels: "Pexels",
};

/** Which sources are ready to search right now. */
export function availableSources(keys: StockKeys): StockSource[] {
  const out: StockSource[] = ["openverse"];
  if (keys.unsplash) out.push("unsplash");
  if (keys.pixabay) out.push("pixabay");
  if (keys.pexels) out.push("pexels");
  return out;
}

async function openverse(q: string, page: number): Promise<StockImage[]> {
  const res = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page=${page}&page_size=20&mature=false&size=medium,large`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const json = (await res.json()) as {
    results?: { id: string; url: string; thumbnail?: string; width?: number; height?: number; creator?: string; foreign_landing_url?: string; title?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    id: `ov-${r.id}`,
    source: "openverse",
    thumb: r.thumbnail ?? r.url,
    // Openverse proxies thumbnails with CORS; the original often does not.
    full: r.thumbnail ? `${r.thumbnail}${r.thumbnail.includes("?") ? "&" : "?"}full_size=true` : r.url,
    width: r.width ?? 1200,
    height: r.height ?? 800,
    author: r.creator ?? "Unknown",
    link: r.foreign_landing_url ?? r.url,
    alt: r.title ?? q,
  }));
}

async function unsplash(q: string, page: number, key: string): Promise<StockImage[]> {
  const res = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=24`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!res.ok) throw new Error(`Unsplash ${res.status}${res.status === 401 ? " — check the access key" : ""}`);
  const json = (await res.json()) as {
    results?: { id: string; urls: { small: string; regular: string }; width: number; height: number; user: { name: string }; links: { html: string }; alt_description?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    id: `us-${r.id}`,
    source: "unsplash",
    thumb: r.urls.small,
    full: r.urls.regular,
    width: r.width,
    height: r.height,
    author: r.user.name,
    link: r.links.html,
    alt: r.alt_description ?? q,
  }));
}

async function pixabay(q: string, page: number, key: string): Promise<StockImage[]> {
  const res = await fetch(`https://pixabay.com/api/?key=${key}&q=${encodeURIComponent(q)}&page=${page}&per_page=24&image_type=photo&safesearch=true`);
  if (!res.ok) throw new Error(`Pixabay ${res.status}${res.status === 400 ? " — check the key" : ""}`);
  const json = (await res.json()) as {
    hits?: { id: number; previewURL: string; webformatURL: string; largeImageURL: string; imageWidth: number; imageHeight: number; user: string; pageURL: string; tags: string }[];
  };
  return (json.hits ?? []).map((r) => ({
    id: `px-${r.id}`,
    source: "pixabay",
    thumb: r.webformatURL.replace("_640", "_340"),
    full: r.largeImageURL ?? r.webformatURL,
    width: r.imageWidth,
    height: r.imageHeight,
    author: r.user,
    link: r.pageURL,
    alt: r.tags,
  }));
}

async function pexels(q: string, page: number, key: string): Promise<StockImage[]> {
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&page=${page}&per_page=24`, {
    headers: { Authorization: key },
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}${res.status === 401 ? " — check the key" : ""}`);
  const json = (await res.json()) as {
    photos?: { id: number; src: { medium: string; large: string; large2x: string }; width: number; height: number; photographer: string; url: string; alt?: string }[];
  };
  return (json.photos ?? []).map((r) => ({
    id: `pe-${r.id}`,
    source: "pexels",
    thumb: r.src.medium,
    full: r.src.large2x ?? r.src.large,
    width: r.width,
    height: r.height,
    author: r.photographer,
    link: r.url,
    alt: r.alt ?? q,
  }));
}

export async function searchStock(q: string, source: StockSource, page = 1): Promise<StockImage[]> {
  const keys = loadStockKeys();
  switch (source) {
    case "unsplash":
      return unsplash(q, page, keys.unsplash);
    case "pixabay":
      return pixabay(q, page, keys.pixabay);
    case "pexels":
      return pexels(q, page, keys.pexels);
    default:
      return openverse(q, page);
  }
}

/**
 * Bring a remote picture onto the board durably: fetch it and keep a data URL
 * so the board still opens offline and exports do not hit a tainted canvas.
 * Falls back to the URL itself when the host blocks CORS.
 */
export async function stockToDataUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return url;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return url;
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

/** Drag payload so drops anywhere in the app can recognise a stock picture. */
export const STOCK_MIME = "application/x-yxm-stock";

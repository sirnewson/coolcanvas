/**
 * The CoolCanvas studios.
 *
 * Two editors built from our own Rust engines in `engines/`: Photo Studio (raster,
 * PSD, adjustments, masks) and Vector Studio (paths, boolean ops, SVG/PDF/EPS).
 * They run as WebAssembly inside the app window, and as native windows on the
 * desktop when those builds are installed.
 *
 * Nothing here talks to a server: the engines are local files, and what passes
 * between the canvas and a studio is a file the browser already has in memory.
 */

export type StudioId = "photo" | "vector";

export interface StudioDef {
  id: StudioId;
  name: string;
  blurb: string;
  /** Where the WebAssembly build is served from. */
  base: string;
  /** Formats it opens, for the "send to studio" path. */
  sends: string;
  accent: string;
}

export const STUDIOS: Record<StudioId, StudioDef> = {
  photo: {
    id: "photo",
    name: "Photo Studio",
    blurb: "Layers, masks, adjustments, retouching and real PSD files.",
    base: "/engine/photo",
    sends: "image/png",
    accent: "#1f5fd0",
  },
  vector: {
    id: "vector",
    name: "Vector Studio",
    blurb: "Bézier paths, boolean shapes, strokes and SVG, PDF and EPS.",
    base: "/engine/vector",
    sends: "image/svg+xml",
    accent: "#d1562f",
  },
};

export const STUDIO_LIST = [STUDIOS.photo, STUDIOS.vector];

/** The host page URL for a studio, with the backend the device can actually run. */
export function studioUrl(id: StudioId, backend?: "webgl"): string {
  const params = new URLSearchParams({ studio: id });
  if (backend) params.set("backend", backend);
  return `${STUDIOS[id].base}/host.html?${params}`;
}

/* ---------------------------------------------------------------- bridge */

export interface StudioMessage {
  source: "coolcanvas-studio";
  studio: StudioId;
  kind: "ready" | "opened" | "saved" | "error";
  name?: string;
  type?: string;
  bytes?: ArrayBuffer;
  message?: string;
}

/** Hand a file to a running studio: it arrives as if it had been dropped on its canvas. */
export function sendToStudio(frame: HTMLIFrameElement | null, name: string, bytes: ArrayBuffer, type: string) {
  frame?.contentWindow?.postMessage({ target: "coolcanvas-studio", kind: "open", name, bytes, type }, "*", [bytes]);
}

/** True while a studio build is present. Checked before offering the workspace. */
export async function studioAvailable(id: StudioId): Promise<boolean> {
  try {
    const res = await fetch(`${STUDIOS[id].base}/host.html`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

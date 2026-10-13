/**
 * Image tools: background removal, colour-key cut-out, vectorisation and
 * rasterising any object (with its effects baked in) to a bitmap.
 *
 * Everything here runs in the browser. The AI cut-out downloads its model
 * (~40MB, cached by the browser) the first time it is used.
 */
import type { CanvasObject, Point, VectorPath } from "../types";
import { canvasRefs, renderToCanvas } from "./export";
import { objectBounds } from "./geom";
import { uid } from "./id";

/* --------------------------------------------------------------- loading */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read."));
    img.src = src;
  });
}

/** Draw an image (optionally cropped) onto a fresh canvas at natural size. */
export async function imageToCanvas(
  src: string,
  crop?: CanvasObject["data"]["crop"],
  maxSide = 2048,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(src);
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const sx = (crop?.x ?? 0) * nw;
  const sy = (crop?.y ?? 0) * nh;
  const sw = (crop?.width ?? 1) * nw;
  const sh = (crop?.height ?? 1) * nh;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale));
  c.height = Math.max(1, Math.round(sh * scale));
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("No 2D context.");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image."))), type, quality);
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------ rasterise */

/**
 * Bitmap of one object exactly as it appears on the board — effects, shadow
 * and crop included — at `scale` × board pixels. Uses the live Konva scene,
 * so it works for any object type, not only images.
 */
export function rasteriseObject(
  o: CanvasObject,
  doc: Parameters<typeof renderToCanvas>[0]["doc"],
  scale = 2,
  padding = 0,
): HTMLCanvasElement | null {
  return renderToCanvas({ bounds: objectBounds(o), scale, transparent: true, doc, padding });
}

/** Bitmap of a set of objects (the "sketch") as one transparent PNG. */
export function rasteriseObjects(
  objects: CanvasObject[],
  doc: Parameters<typeof renderToCanvas>[0]["doc"],
  scale = 1.5,
  padding = 16,
  transparent = false,
): HTMLCanvasElement | null {
  if (!objects.length || !canvasRefs.stage) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    const b = objectBounds(o);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  // Keep the payload sane for API uploads.
  const longest = Math.max(bounds.width, bounds.height) * scale;
  const s = longest > 1600 ? (1600 / Math.max(bounds.width, bounds.height)) : scale;
  return renderToCanvas({ bounds, scale: s, transparent, doc, padding });
}

/* ------------------------------------------------------ AI background */

type Progress = (stage: string, done: number, total: number) => void;

/**
 * Subject cut-out with the in-browser ISNet model (@imgly/background-removal).
 * Runs on the GPU when available, otherwise CPU; the model is fetched from
 * the package's CDN on first use and cached by the browser afterwards.
 */
export async function removeBackgroundAi(src: string, crop?: CanvasObject["data"]["crop"], onProgress?: Progress): Promise<string> {
  const mod = await import("@imgly/background-removal");
  const source = await imageToCanvas(src, crop, 1536);
  const blob = await canvasToBlob(source);
  const out = await mod.removeBackground(blob, {
    model: "isnet_fp16",
    output: { format: "image/png", quality: 1 },
    progress: (key, current, total) => onProgress?.(key.replace(/^fetch:/, "downloading "), current, total),
  });
  return blobToDataUrl(out);
}

/* ------------------------------------------------------- colour key */

/**
 * Fast flat-background cut-out: floods from the image corners, clearing every
 * pixel within `tolerance` (0..1) of the corner colour, then feathers the
 * boundary one pixel so the edge is not jagged.
 */
export async function removeBackgroundColorKey(
  src: string,
  crop?: CanvasObject["data"]["crop"],
  tolerance = 0.12,
  seeds?: Point[],
): Promise<string> {
  const c = await imageToCanvas(src, crop, 2048);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("No 2D context.");
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const maxDist = tolerance * 441.7; // sqrt(3 * 255^2)

  const starts = seeds?.length
    ? seeds.map((p) => ({ x: Math.round(p.x * w), y: Math.round(p.y * h) }))
    : [
        { x: 0, y: 0 },
        { x: w - 1, y: 0 },
        { x: 0, y: h - 1 },
        { x: w - 1, y: h - 1 },
      ];

  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (const s of starts) {
    if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= h) continue;
    const i = s.y * w + s.x;
    const r0 = d[i * 4];
    const g0 = d[i * 4 + 1];
    const b0 = d[i * 4 + 2];
    stack.push(i);
    while (stack.length) {
      const p = stack.pop() as number;
      if (visited[p]) continue;
      const r = d[p * 4];
      const g = d[p * 4 + 1];
      const b = d[p * 4 + 2];
      const dist = Math.sqrt((r - r0) ** 2 + (g - g0) ** 2 + (b - b0) ** 2);
      if (dist > maxDist) continue;
      visited[p] = 1;
      // Soft edge: pixels near the tolerance boundary keep a little alpha.
      const t = dist / maxDist;
      d[p * 4 + 3] = t > 0.85 ? Math.round(d[p * 4 + 3] * ((t - 0.85) / 0.15) * 0.6) : 0;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > 0) stack.push(p - w);
      if (y < h - 1) stack.push(p + w);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/* ------------------------------------------------------------ vectorise */

export interface TraceOptions {
  /** Number of colours to quantise to. */
  colors: number;
  /** Detail: lower = smoother, fewer nodes. */
  detail: number;
  /** Ignore blobs smaller than this many pixels. */
  minArea: number;
  /** Blur the source first (0-5) to drop noise. */
  blur: number;
  /** Add a thin stroke to each shape so gaps close (cartoon look). */
  stroke: boolean;
}

export const TRACE_PRESETS: { id: string; label: string; opts: TraceOptions }[] = [
  { id: "logo", label: "Logo", opts: { colors: 4, detail: 1, minArea: 24, blur: 0, stroke: false } },
  { id: "poster", label: "Poster", opts: { colors: 8, detail: 1, minArea: 12, blur: 1, stroke: false } },
  { id: "photo", label: "Photo", opts: { colors: 24, detail: 0.6, minArea: 6, blur: 1, stroke: false } },
  { id: "cartoon", label: "Cartoon", opts: { colors: 12, detail: 1, minArea: 16, blur: 2, stroke: true } },
  { id: "sketch", label: "Ink", opts: { colors: 2, detail: 1, minArea: 8, blur: 0, stroke: false } },
];

interface Tracer {
  imagedataToTracedata(imgd: ImageData, options: Record<string, unknown>): TraceData;
}
interface TraceData {
  width: number;
  height: number;
  palette: { r: number; g: number; b: number; a: number }[];
  layers: TraceSegment[][][];
}
type TraceSegment = { type: string; x1: number; y1: number; x2: number; y2: number; x3?: number; y3?: number };
interface TracePath {
  segments: TraceSegment[];
  isholepath: boolean;
  holechildren: number[];
  boundingbox: number[];
}

function segmentsToD(segments: TraceSegment[], round = 1): string {
  if (!segments.length) return "";
  const f = (n: number) => Math.round(n * 10 ** round) / 10 ** round;
  let d = `M ${f(segments[0].x1)} ${f(segments[0].y1)}`;
  for (const s of segments) {
    if (s.type === "L") d += ` L ${f(s.x2)} ${f(s.y2)}`;
    else d += ` Q ${f(s.x2)} ${f(s.y2)} ${f(s.x3 ?? s.x2)} ${f(s.y3 ?? s.y2)}`;
  }
  return `${d} Z`;
}

/**
 * Photo → vector paths with imagetracerjs. Each colour layer becomes a set of
 * filled paths (holes included), ordered so larger shapes sit behind.
 */
export async function vectoriseImage(
  src: string,
  crop: CanvasObject["data"]["crop"] | undefined,
  opts: TraceOptions,
): Promise<{ paths: VectorPath[]; width: number; height: number }> {
  const mod = (await import("imagetracerjs")) as unknown as { default?: Tracer } & Tracer;
  const tracer: Tracer = mod.default ?? mod;
  const c = await imageToCanvas(src, crop, 900);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("No 2D context.");
  const imgd = ctx.getImageData(0, 0, c.width, c.height);

  const td = tracer.imagedataToTracedata(imgd, {
    numberofcolors: opts.colors,
    colorquantcycles: 3,
    ltres: 1 / Math.max(0.2, opts.detail),
    qtres: 1 / Math.max(0.2, opts.detail),
    pathomit: opts.minArea,
    rightangleenhance: true,
    blurradius: opts.blur,
    blurdelta: 20,
    roundcoords: 1,
    layering: 0,
  });

  const paths: VectorPath[] = [];
  td.layers.forEach((layer, li) => {
    const col = td.palette[li];
    if (!col || col.a < 8) return;
    const fill = `rgb(${col.r},${col.g},${col.b})`;
    const list = layer as unknown as TracePath[];
    list.forEach((p) => {
      if (p.isholepath) return;
      let d = segmentsToD(p.segments);
      for (const hi of p.holechildren) {
        const hole = list[hi];
        if (hole) d += ` ${segmentsToD(hole.segments)}`;
      }
      if (!d) return;
      paths.push({
        d,
        fill,
        opacity: col.a / 255,
        stroke: opts.stroke ? fill : undefined,
        strokeWidth: opts.stroke ? 1 : 0,
      });
    });
  });

  if (!paths.length) throw new Error("Nothing traceable in that image — try more colours.");
  return { paths, width: td.width, height: td.height };
}

/** A vector object next to its source image. */
export function createVector(
  from: CanvasObject,
  traced: { paths: VectorPath[]; width: number; height: number },
  offset = 24,
): CanvasObject {
  return {
    id: uid("vec"),
    type: "vector",
    name: `${from.name ?? "Image"} (vector)`,
    x: from.x + from.width + offset,
    y: from.y,
    width: from.width,
    height: from.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    style: {},
    data: { paths: traced.paths, viewBox: { width: traced.width, height: traced.height } },
  };
}

/** Serialise a vector object to a standalone SVG file. */
export function vectorToSvg(o: CanvasObject): string {
  const vb = o.data.viewBox ?? { width: 100, height: 100 };
  const body = (o.data.paths ?? [])
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill ?? "none"}"${p.stroke ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth ?? 1}"` : ""}${
          p.opacity !== undefined && p.opacity !== 1 ? ` opacity="${p.opacity}"` : ""
        }/>`,
    )
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb.width} ${vb.height}" width="${Math.round(o.width)}" height="${Math.round(o.height)}">\n${body}\n</svg>`;
}

export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

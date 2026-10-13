import type Konva from "konva";

import type { Bounds, BoardDoc, CanvasObject } from "../types";
import { BACKGROUNDS } from "./theme";
import { boundsOfObjects, objectBounds } from "./geom";

/** Live Konva handles, set by the Canvas so exporters can reach the scene. */
export const canvasRefs: {
  stage: Konva.Stage | null;
  transformer: Konva.Transformer | null;
  overlay: Konva.Layer | null;
} = { stage: null, transformer: null, overlay: null };

export interface ExportOptions {
  bounds: Bounds;
  scale: number;
  transparent: boolean;
  doc: BoardDoc;
  padding?: number;
}

/** Hide the selection furniture, run `fn`, put it back. */
function withoutChrome<T>(fn: () => T): T {
  const tr = canvasRefs.transformer;
  const overlay = canvasRefs.overlay;
  const trNodes = tr?.nodes() ?? [];
  const overlayVisible = overlay?.visible() ?? true;
  tr?.nodes([]);
  overlay?.visible(false);
  try {
    return fn();
  } finally {
    tr?.nodes(trNodes);
    overlay?.visible(overlayVisible);
  }
}

function paint(source: HTMLCanvasElement, doc: BoardDoc, transparent: boolean) {
  if (transparent) return source;
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = BACKGROUNDS[doc.settings.background].surface;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);
  return out;
}

/**
 * Renders a world-space rectangle at the requested multiple of 1:1 board
 * pixels, independent of the current zoom level.
 */
export function renderToCanvas({
  bounds,
  scale,
  transparent,
  doc,
  padding = 24,
}: ExportOptions): HTMLCanvasElement | null {
  const stage = canvasRefs.stage;
  if (!stage) return null;

  return withoutChrome(() => {
    const layer = stage.getLayers()[0];
    const camera = { x: layer.x(), y: layer.y(), zoom: layer.scaleX() };
    const world = {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    };
    const source = stage.toCanvas({
      x: world.x * camera.zoom + camera.x,
      y: world.y * camera.zoom + camera.y,
      width: Math.max(1, world.width * camera.zoom),
      height: Math.max(1, world.height * camera.zoom),
      pixelRatio: Math.max(0.05, scale / camera.zoom),
    });
    return paint(source, doc, transparent);
  });
}

/* ------------------------------------------------------------- animation */

/** Object ids that belong to a cel: the frame itself and everything inside. */
export function celMembers(doc: BoardDoc, celId: string): Set<string> {
  const out = new Set<string>([celId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const id of doc.order) {
      const o = doc.objects[id];
      if (o?.parentId && out.has(o.parentId) && !out.has(id)) {
        out.add(id);
        grew = true;
      }
    }
  }
  return out;
}

/**
 * Renders every cel to its own canvas by toggling Konva node visibility
 * directly — no React round-trip, so the whole sequence is captured in one
 * synchronous pass.
 */
export function renderCels(opts: {
  doc: BoardDoc;
  celIds: string[];
  scale: number;
  transparent: boolean;
  includeLoose?: boolean;
}): HTMLCanvasElement[] {
  const stage = canvasRefs.stage;
  const { doc, celIds, scale, transparent, includeLoose = true } = opts;
  if (!stage || !celIds.length) return [];

  const owned = new Set<string>();
  const members = celIds.map((id) => {
    const set = celMembers(doc, id);
    for (const m of set) owned.add(m);
    return set;
  });

  return withoutChrome(() => {
    const layer = stage.getLayers()[0];
    const camera = { x: layer.x(), y: layer.y(), zoom: layer.scaleX() };
    const nodes = doc.order
      .map((id) => ({ id, node: stage.findOne(`#${id}`) }))
      .filter((n): n is { id: string; node: Konva.Node } => !!n.node);
    const restore = nodes.map((n) => n.node.visible());

    const out: HTMLCanvasElement[] = [];
    try {
      celIds.forEach((celId, i) => {
        const visible = members[i];
        for (const { id, node } of nodes) {
          const loose = !owned.has(id);
          node.visible(visible.has(id) || (includeLoose && loose));
        }
        layer.draw();
        const cel = doc.objects[celId];
        if (!cel) return;
        const b = objectBounds(cel);
        const source = stage.toCanvas({
          x: b.x * camera.zoom + camera.x,
          y: b.y * camera.zoom + camera.y,
          width: Math.max(1, b.width * camera.zoom),
          height: Math.max(1, b.height * camera.zoom),
          pixelRatio: Math.max(0.05, scale / camera.zoom),
        });
        out.push(paint(source, doc, transparent));
      });
    } finally {
      nodes.forEach((n, i) => n.node.visible(restore[i]));
      layer.draw();
    }
    return out;
  });
}

/** Lay the cels out as a strip (or grid when there are many) for spritesheets. */
export function spriteSheet(frames: HTMLCanvasElement[], columns?: number): HTMLCanvasElement | null {
  if (!frames.length) return null;
  const cols = columns ?? (frames.length <= 8 ? frames.length : Math.ceil(Math.sqrt(frames.length)));
  const rows = Math.ceil(frames.length / cols);
  const w = Math.max(...frames.map((f) => f.width));
  const h = Math.max(...frames.map((f) => f.height));
  const sheet = document.createElement("canvas");
  sheet.width = w * cols;
  sheet.height = h * rows;
  const ctx = sheet.getContext("2d");
  if (!ctx) return null;
  frames.forEach((f, i) => {
    ctx.drawImage(f, (i % cols) * w, Math.floor(i / cols) * h);
  });
  return sheet;
}

export function canRecordVideo(): boolean {
  return typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;
}

/**
 * Plays the cels into a canvas stream at the target frame rate and records it.
 * MediaRecorder works in real time, so a 24-frame loop at 12fps takes 2s.
 */
export async function recordVideo(
  frames: HTMLCanvasElement[],
  fps: number,
  loops = 2,
): Promise<Blob | null> {
  if (!frames.length || !canRecordVideo()) return null;
  const canvas = document.createElement("canvas");
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
  if (!mime) return null;

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start();
  const delay = 1000 / Math.max(1, fps);
  for (let loop = 0; loop < loops; loop += 1) {
    for (const frame of frames) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frame, 0, 0);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  await new Promise((r) => setTimeout(r, delay * 2));
  recorder.stop();
  return finished;
}

/* ------------------------------------------------------------------ files */

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality = 0.92,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (!Item || !navigator.clipboard?.write) return false;
    await navigator.clipboard.write([new Item({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

export function safeFilename(name: string) {
  return name.trim().replace(/[^a-z0-9\-_ ]/gi, "").replace(/\s+/g, "-").toLowerCase() || "board";
}

/** Bounds of a set of objects plus everything nested inside them. */
export function boundsOfScope(doc: BoardDoc, ids: string[]): Bounds | null {
  const wanted = new Set<string>();
  for (const id of ids) for (const m of celMembers(doc, id)) wanted.add(m);
  const objects = doc.order
    .map((id) => doc.objects[id])
    .filter((o): o is CanvasObject => !!o && wanted.has(o.id) && !o.hidden && o.type !== "group");
  return boundsOfObjects(objects);
}

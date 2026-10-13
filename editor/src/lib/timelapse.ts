import type { BoardDoc, CanvasObject } from "../types";
import { boundsOfObjects } from "./geom";
import { BACKGROUNDS } from "./theme";
import { canvasRefs } from "./export";

/**
 * Time-lapse recording.
 *
 * Every meaningful change adds a small frame to a ring buffer. When the buffer
 * fills, every other frame is dropped instead of stopping — so a long session
 * keeps recording, it just gets more sped up, the way Procreate does it.
 */

export let MAX_FRAMES = 420;

export function setMaxFrames(n: number) {
  MAX_FRAMES = Math.max(30, Math.min(2000, Math.round(n)));
}
const FRAME_WIDTH = 460;
const QUALITY = 0.55;

let frames: string[] = [];
let boardId = "";
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function onTimelapseChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function timelapseFrames(): string[] {
  return frames;
}

export function timelapseBoard(): string {
  return boardId;
}

export function setTimelapse(id: string, next: string[]) {
  boardId = id;
  frames = next;
  notify();
}

export function clearTimelapse() {
  frames = [];
  notify();
}

/** Rough size of what is being kept, so the panel can be honest about it. */
export function timelapseBytes(): number {
  return frames.reduce((sum, f) => sum + f.length * 0.75, 0);
}

/**
 * Grabs the board at a small size. Returns null when there is nothing to see,
 * so an empty canvas never fills the buffer with blank frames.
 */
export function captureFrame(doc: BoardDoc): string | null {
  const stage = canvasRefs.stage;
  if (!stage) return null;

  const page = doc.settings.page;
  const objects = doc.order
    .map((id) => doc.objects[id])
    .filter((o): o is CanvasObject => !!o && !o.hidden && o.type !== "group");
  const content = boundsOfObjects(objects);
  const world = page
    ? { x: 0, y: 0, width: page.width, height: page.height }
    : content
      ? { x: content.x - 40, y: content.y - 40, width: content.width + 80, height: content.height + 80 }
      : null;
  if (!world || world.width < 4 || world.height < 4) return null;

  const layer = stage.getLayers()[0];
  const camera = { x: layer.x(), y: layer.y(), zoom: layer.scaleX() };
  const tr = canvasRefs.transformer;
  const overlay = canvasRefs.overlay;
  const nodes = tr?.nodes() ?? [];
  const overlayVisible = overlay?.visible() ?? true;
  tr?.nodes([]);
  overlay?.visible(false);

  try {
    const scale = Math.min(1, FRAME_WIDTH / world.width);
    const source = stage.toCanvas({
      x: world.x * camera.zoom + camera.x,
      y: world.y * camera.zoom + camera.y,
      width: Math.max(1, world.width * camera.zoom),
      height: Math.max(1, world.height * camera.zoom),
      pixelRatio: Math.max(0.04, scale / camera.zoom),
    });
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = BACKGROUNDS[doc.settings.background].surface;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0);
    return out.toDataURL("image/jpeg", QUALITY);
  } catch {
    return null;
  } finally {
    tr?.nodes(nodes);
    overlay?.visible(overlayVisible);
  }
}

export function pushFrame(doc: BoardDoc): boolean {
  const frame = captureFrame(doc);
  if (!frame) return false;
  if (frames[frames.length - 1] === frame) return false;
  frames.push(frame);
  if (frames.length > MAX_FRAMES) {
    // Halve the history rather than stop recording: older work simply plays faster.
    frames = frames.filter((_, i) => i % 2 === 0 || i >= frames.length - 40);
  }
  boardId = doc.id;
  notify();
  return true;
}

/** Turn the stored data URLs back into canvases for video export. */
export function framesToCanvases(list: string[]): Promise<HTMLCanvasElement[]> {
  return Promise.all(
    list.map(
      (src) =>
        new Promise<HTMLCanvasElement>((resolve) => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            // Video encoders want even dimensions.
            canvas.width = img.naturalWidth + (img.naturalWidth % 2);
            canvas.height = img.naturalHeight + (img.naturalHeight % 2);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
            }
            resolve(canvas);
          };
          img.onerror = () => resolve(document.createElement("canvas"));
          img.src = src;
        }),
    ),
  );
}

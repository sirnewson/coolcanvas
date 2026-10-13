import { createImage, createMedia } from "../store/factory";
import type { CanvasObject, Point } from "../types";

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function measureImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 400, height: 300 });
    img.src = src;
  });
}

/** Turns dropped/pasted files into image objects, cascaded so none overlap. */
export async function objectsFromFiles(files: File[], at: Point): Promise<CanvasObject[]> {
  const images = files.filter((f) => f.type.startsWith("image/"));
  const out: CanvasObject[] = [];
  let offset = 0;
  for (const file of images) {
    const src = await readFileAsDataUrl(file);
    const size = await measureImage(src);
    const obj = createImage(
      { x: at.x + offset, y: at.y + offset },
      src,
      size.width,
      size.height,
    );
    obj.name = file.name;
    out.push(obj);
    offset += 28;
  }
  return out;
}

/** Load an image that was dragged in from another page (a URL, not a file). */
export async function imageFromUrl(url: string, at: Point): Promise<CanvasObject | null> {
  const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
  if (!size) return null;
  const obj = createImage(at, url, size.width, size.height);
  obj.name = url.split("/").pop()?.slice(0, 40) ?? "image";
  return obj;
}

/** Video and audio dropped on the board become playable media objects. */
export async function objectsFromMediaFiles(files: File[], at: Point): Promise<CanvasObject[]> {
  const media = files.filter((f) => f.type.startsWith("video/") || f.type.startsWith("audio/"));
  const out: CanvasObject[] = [];
  let offset = 0;
  for (const file of media) {
    if (file.size > 30 * 1024 * 1024) continue;
    const src = await readFileAsDataUrl(file);
    const kind = file.type.startsWith("audio/") ? "audio" : "video";
    const size = kind === "video" ? await measureVideo(src) : { width: 360, height: 96 };
    out.push(
      createMedia(
        { x: at.x + offset, y: at.y + offset },
        src,
        kind,
        file.name.replace(/\.[^.]+$/, ""),
        size.width,
        size.height,
      ),
    );
    offset += 28;
  }
  return out;
}

export function oversizedMedia(files: File[]): boolean {
  return files.some(
    (f) =>
      (f.type.startsWith("video/") || f.type.startsWith("audio/")) && f.size > 30 * 1024 * 1024,
  );
}

function measureVideo(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      resolve({ width: el.videoWidth || 640, height: el.videoHeight || 360 });
    el.onerror = () => resolve({ width: 640, height: 360 });
    el.src = src;
  });
}

export function pickImageFiles(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => resolve(input.files ? [...input.files] : []);
    input.click();
  });
}

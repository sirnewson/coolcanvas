import type { CanvasObject } from "../types";

type MediaEl = HTMLVideoElement | HTMLAudioElement;

const elements = new Map<string, MediaEl>();
const listeners = new Set<() => void>();

/** Anything that wants to redraw while media plays subscribes here. */
export function onMediaTick(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const notify = () => listeners.forEach((fn) => fn());

/**
 * One element per media object, created lazily and kept alive so playback
 * survives re-renders. Video elements double as the Konva image source.
 */
export function getMedia(o: CanvasObject): MediaEl | null {
  if (o.type !== "media" || !o.data.src) return null;
  const existing = elements.get(o.id);
  if (existing) {
    if (existing.src !== o.data.src) existing.src = o.data.src;
    return existing;
  }
  const el: MediaEl =
    o.data.mediaKind === "audio" ? new Audio() : document.createElement("video");
  el.src = o.data.src;
  el.crossOrigin = "anonymous";
  el.preload = "metadata";
  el.loop = !!o.data.loop;
  el.muted = !!o.data.muted;
  if (el instanceof HTMLVideoElement) {
    el.playsInline = true;
    el.muted = o.data.muted ?? true;
  }
  el.addEventListener("timeupdate", notify);
  el.addEventListener("play", notify);
  el.addEventListener("pause", notify);
  el.addEventListener("loadeddata", notify);
  el.addEventListener("ended", notify);
  elements.set(o.id, el);
  return el;
}

export function isPlaying(id: string): boolean {
  const el = elements.get(id);
  return !!el && !el.paused && !el.ended;
}

export function progressOf(id: string): number {
  const el = elements.get(id);
  if (!el || !el.duration || !Number.isFinite(el.duration)) return 0;
  return el.currentTime / el.duration;
}

export function durationOf(id: string): number {
  const el = elements.get(id);
  return el && Number.isFinite(el.duration) ? el.duration : 0;
}

export function currentTimeOf(id: string): number {
  return elements.get(id)?.currentTime ?? 0;
}

export function togglePlay(o: CanvasObject) {
  const el = getMedia(o);
  if (!el) return;
  if (el.paused) void el.play().catch(() => undefined);
  else el.pause();
  notify();
}

export function pauseAll() {
  elements.forEach((el) => el.pause());
  notify();
}

export function seekFraction(o: CanvasObject, fraction: number) {
  const el = getMedia(o);
  if (!el || !Number.isFinite(el.duration)) return;
  el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
  notify();
}

export function setMuted(o: CanvasObject, muted: boolean) {
  const el = getMedia(o);
  if (el) el.muted = muted;
  notify();
}

export function setLoop(o: CanvasObject, loop: boolean) {
  const el = getMedia(o);
  if (el) el.loop = loop;
}

export function restart(o: CanvasObject) {
  const el = getMedia(o);
  if (!el) return;
  el.currentTime = 0;
  void el.play().catch(() => undefined);
  notify();
}

export function anyPlaying(): boolean {
  for (const el of elements.values()) if (!el.paused && !el.ended) return true;
  return false;
}

export function forgetMedia(id: string) {
  const el = elements.get(id);
  if (!el) return;
  el.pause();
  el.removeAttribute("src");
  elements.delete(id);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Where the transport controls sit inside a media object. */
export const MEDIA_BAR = 34;

export function playButtonAt(o: CanvasObject): { x: number; y: number; r: number } {
  if (o.data.mediaKind === "audio") {
    return { x: 30, y: o.height / 2, r: 18 };
  }
  return { x: o.width / 2, y: (o.height - MEDIA_BAR) / 2, r: Math.min(30, o.width * 0.12) };
}

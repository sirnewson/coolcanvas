import * as THREE from "three";
import type { GrainKind, TipKind } from "../types";

/**
 * Every brush texture is generated in code. That keeps the app installable at a
 * small size and lets brush parameters (bristle count, grain) change the texture
 * itself rather than only its tint.
 */

const SIZE = 256;

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const wrap = (a: number, p: number) => ((a % p) + p) % p;

/** Value noise that tiles seamlessly at period `p`. */
function vnoise(x: number, y: number, p: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(wrap(xi, p), wrap(yi, p), seed);
  const b = hash(wrap(xi + 1, p), wrap(yi, p), seed);
  const c = hash(wrap(xi, p), wrap(yi + 1, p), seed);
  const d = hash(wrap(xi + 1, p), wrap(yi + 1, p), seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x: number, y: number, p: number, octaves: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x * freq, y * freq, p * freq, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
};

/* ------------------------------------------------------------------ grain */

function grainAt(kind: GrainKind, u: number, v: number): number {
  const x = u * SIZE;
  const y = v * SIZE;
  switch (kind) {
    case "paper": {
      const n = fbm(x / 6, y / 6, 42, 4, 11);
      return 0.55 + 0.45 * n;
    }
    case "canvas": {
      const weave =
        0.5 + 0.25 * Math.sin(u * Math.PI * 2 * 24) + 0.25 * Math.sin(v * Math.PI * 2 * 24);
      const n = fbm(x / 10, y / 10, 26, 3, 7);
      return clamp01(0.45 + 0.35 * weave + 0.3 * n);
    }
    case "noise": {
      const n = fbm(x / 2.2, y / 2.2, 116, 3, 3);
      return clamp01(0.25 + 1.0 * n);
    }
    case "chalk": {
      const n = fbm(x / 9, y / 9, 29, 4, 19);
      return n > 0.44 ? clamp01(0.35 + 0.9 * n) : 0.06;
    }
    case "crosshatch": {
      const a = Math.abs(Math.sin((u + v) * Math.PI * 22));
      const b = Math.abs(Math.sin((u - v) * Math.PI * 22));
      return clamp01(0.18 + 1.25 * smooth(0.0, 0.55, Math.min(a, b)));
    }
    case "metal": {
      const n = fbm(x / 1.4, y / 26, 183, 3, 55);
      return clamp01(0.35 + 0.85 * n);
    }
    case "none":
    default:
      return 1;
  }
}

/* -------------------------------------------------------------------- tip */

/**
 * Cross-section profile of a brush tip.
 * `u` runs along the stroke, `v` across it (0 and 1 are the two edges).
 */
function tipAt(kind: TipKind, streaks: number, u: number, v: number): number {
  const r = Math.abs(v * 2 - 1); // 0 at the spine, 1 at the edge
  switch (kind) {
    case "round":
      return clamp01(Math.sqrt(Math.max(0, 1 - r * r)) * 1.15);
    case "hard":
      return 1 - smooth(0.88, 1.0, r);
    case "square":
      return r < 0.995 ? 1 : 0;
    case "ink": {
      // A crisp edge that frays very slightly, the way a dry nib does.
      const edge = 0.9 + 0.09 * fbm(u * SIZE * 0.22, v * 4, 64, 2, 31);
      return 1 - smooth(edge - 0.06, edge + 0.03, r);
    }
    case "chisel":
      // Flat across the middle, falling away toward one edge only.
      return clamp01(1.25 - 1.15 * smooth(0.1, 1.0, v));
    case "bristle": {
      const n = Math.max(2, streaks || 9);
      let a = 0;
      for (let i = 0; i < n; i++) {
        const centre = (i + 0.5) / n + (hash(i, 3, 5) - 0.5) * (0.6 / n);
        const halfW = (0.36 / n) * (0.55 + hash(i, 9, 17));
        const d = Math.abs(v - centre) / halfW;
        // each bristle fades in and out along the stroke, so lines break up
        const life = 0.55 + 0.45 * fbm(u * SIZE * 0.06 + i * 131, i * 3.3, 64, 2, 23);
        a = Math.max(a, clamp01(1 - d * d) * life);
      }
      return clamp01(a * (1 - smooth(0.93, 1.0, r)));
    }
    case "chalk": {
      const base = clamp01(Math.sqrt(Math.max(0, 1 - r * r)) * 1.1);
      const n = fbm(u * SIZE * 0.35, v * SIZE * 0.35, 90, 3, 61);
      return base * (n > 0.4 ? clamp01(0.4 + 1.1 * n) : 0.1);
    }
    case "spray": {
      // Radial dab: this tip is stamped rather than swept.
      const d = Math.hypot(u * 2 - 1, v * 2 - 1);
      return clamp01(Math.pow(1 - smooth(0.0, 1.0, d), 1.9));
    }
    default:
      return 1;
  }
}

/* ------------------------------------------------------------------ cache */

const tipCache = new Map<string, THREE.Texture>();
const grainCache = new Map<string, THREE.Texture>();

function paint(fill: (u: number, v: number) => [number, number]): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = SIZE;
  cv.height = SIZE;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const [rgb, a] = fill(x / SIZE, y / SIZE);
      const i = (y * SIZE + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = rgb;
      d[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function tipTexture(kind: TipKind, streaks: number): THREE.Texture {
  const key = `${kind}:${kind === "bristle" ? streaks : 0}`;
  const hit = tipCache.get(key);
  if (hit) return hit;

  const cv = paint((u, v) => [255, Math.round(clamp01(tipAt(kind, streaks, u, v)) * 255)]);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = kind === "spray" ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  tipCache.set(key, tex);
  return tex;
}

export function grainTexture(kind: GrainKind): THREE.Texture {
  const hit = grainCache.get(kind);
  if (hit) return hit;

  const cv = paint((u, v) => [Math.round(clamp01(grainAt(kind, u, v)) * 255), 255]);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  grainCache.set(kind, tex);
  return tex;
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A small preview scribble of a brush, for the brush drawer. */
const previewCache = new Map<string, string>();

export function brushPreview(
  tip: TipKind,
  streaks: number,
  grain: GrainKind,
  grainDepth: number,
  color: string,
  w = 190,
  h = 46
): string {
  const key = `${tip}:${streaks}:${grain}:${grainDepth.toFixed(2)}:${color}`;
  const hit = previewCache.get(key);
  if (hit) return hit;

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const rgb = hexToRgb(color);
  const kind: TipKind = tip === "spray" ? "round" : tip;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      // a stroke that swells through the middle, like a real test scribble
      const half = (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.6)) * (h * 0.36);
      const mid = h / 2 + Math.sin(t * Math.PI * 1.7) * h * 0.13;
      const across = (y - mid) / (half * 2) + 0.5;
      let a = 0;
      if (across >= 0 && across <= 1) {
        a = tipAt(kind, streaks, t * 4, across);
        a *= 1 - grainDepth + grainDepth * grainAt(grain, t * 1.6, y / h);
        a *= Math.min(1, Math.pow(Math.sin(Math.PI * t), 0.3) * 1.5);
      }
      const i = (y * w + x) * 4;
      d[i] = rgb[0];
      d[i + 1] = rgb[1];
      d[i + 2] = rgb[2];
      d[i + 3] = Math.round(clamp01(a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const url = cv.toDataURL("image/png");
  previewCache.set(key, url);
  return url;
}

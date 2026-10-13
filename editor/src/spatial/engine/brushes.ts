import type { Brush } from "../types";

/**
 * The stock brush pack. Sizes are in world units: the default construction
 * plane is 12 units across, so 0.05 is roughly a fine liner and 0.4 a fat
 * marker.
 */

const base: Omit<Brush, "id" | "name" | "set"> = {
  geom: "ribbon",
  tip: "round",
  grain: "none",
  grainScale: 1,
  grainDepth: 0,
  size: 0.06,
  opacity: 1,
  flow: 1,
  spacing: 0.35,
  jitter: 0,
  scatter: 0,
  taper: 0.65,
  pressureSize: 0.75,
  pressureOpacity: 0.25,
  velocitySize: 0,
  smoothing: 0.35,
  wobble: 0,
  streaks: 0,
  blend: "normal",
  glow: 0,
  shade: 0,
  tubeSides: 8,
  builtin: true,
};

const b = (id: string, name: string, set: string, over: Partial<Brush>): Brush => ({
  ...base,
  ...over,
  id,
  name,
  set,
});

export const BRUSHES: Brush[] = [
  /* ------------------------------------------------------------ sketching */
  b("pencil-6b", "6B Graphite", "Sketching", {
    tip: "chalk", grain: "paper", grainScale: 2.4, grainDepth: 0.72,
    size: 0.045, opacity: 0.86, taper: 0.8, pressureSize: 0.55,
    pressureOpacity: 0.75, velocitySize: 0.2, smoothing: 0.25,
  }),
  b("pencil-hb", "HB Pencil", "Sketching", {
    tip: "chalk", grain: "paper", grainScale: 3.4, grainDepth: 0.55,
    size: 0.026, opacity: 0.7, taper: 0.7, pressureSize: 0.45, pressureOpacity: 0.8,
  }),
  b("pencil-tech", "Technical Pencil", "Sketching", {
    tip: "round", grain: "paper", grainScale: 5, grainDepth: 0.22,
    size: 0.016, opacity: 0.95, taper: 0.35, pressureSize: 0.25,
    pressureOpacity: 0.5, smoothing: 0.55,
  }),
  b("charcoal", "Charcoal", "Sketching", {
    tip: "chalk", grain: "chalk", grainScale: 1.5, grainDepth: 0.85,
    size: 0.11, opacity: 0.82, taper: 0.5, pressureSize: 0.7, pressureOpacity: 0.7,
    wobble: 0.1,
  }),
  b("conte", "Conté Stick", "Sketching", {
    tip: "chisel", grain: "canvas", grainScale: 2, grainDepth: 0.6,
    size: 0.095, opacity: 0.88, taper: 0.3, pressureSize: 0.5, pressureOpacity: 0.55,
  }),
  b("blueline", "Blue Underlay", "Sketching", {
    tip: "chalk", grain: "paper", grainScale: 3, grainDepth: 0.5,
    size: 0.055, opacity: 0.4, taper: 0.7, pressureOpacity: 0.6,
  }),

  /* --------------------------------------------------------------- inking */
  b("studio-pen", "Studio Pen", "Inking", {
    tip: "hard", size: 0.03, taper: 0.55, pressureSize: 0.6,
    pressureOpacity: 0.08, smoothing: 0.5,
  }),
  b("dry-ink", "Dry Ink", "Inking", {
    tip: "ink", grain: "paper", grainScale: 3, grainDepth: 0.35,
    size: 0.038, taper: 0.7, pressureSize: 0.7, pressureOpacity: 0.3,
  }),
  b("brush-pen", "Brush Pen", "Inking", {
    tip: "round", size: 0.058, taper: 0.92, pressureSize: 0.95,
    pressureOpacity: 0.12, velocitySize: 0.35, smoothing: 0.45,
  }),
  b("marker", "Chisel Marker", "Inking", {
    tip: "chisel", size: 0.1, opacity: 0.72, taper: 0.12,
    pressureSize: 0.2, pressureOpacity: 0.15,
  }),
  b("gel-roller", "Gel Roller", "Inking", {
    tip: "hard", size: 0.022, taper: 0.4, pressureSize: 0.35, smoothing: 0.6,
  }),
  b("liner-fine", "Fine Liner", "Inking", {
    tip: "hard", size: 0.012, taper: 0.2, pressureSize: 0.15, smoothing: 0.7,
  }),

  /* -------------------------------------------------------------- painting */
  b("round-brush", "Round Brush", "Painting", {
    tip: "round", grain: "canvas", grainScale: 1.6, grainDepth: 0.28,
    size: 0.13, opacity: 0.94, taper: 0.75, pressureSize: 0.85, pressureOpacity: 0.3,
  }),
  b("flat-bristle", "Flat Bristle", "Painting", {
    tip: "bristle", streaks: 11, grain: "canvas", grainScale: 1.4, grainDepth: 0.4,
    size: 0.16, opacity: 0.92, taper: 0.3, pressureSize: 0.6, pressureOpacity: 0.35,
  }),
  b("oil-impasto", "Oil Impasto", "Painting", {
    geom: "tube", tip: "round", grain: "canvas", grainScale: 1.2, grainDepth: 0.3,
    size: 0.15, taper: 0.45, pressureSize: 0.7, shade: 0.85, tubeSides: 8,
  }),
  b("gouache", "Gouache", "Painting", {
    tip: "bristle", streaks: 6, grain: "paper", grainScale: 1.8, grainDepth: 0.3,
    size: 0.14, opacity: 0.98, taper: 0.35, pressureSize: 0.5,
  }),
  b("wash", "Watercolour Wash", "Painting", {
    tip: "round", grain: "paper", grainScale: 1.1, grainDepth: 0.55,
    size: 0.3, opacity: 0.3, taper: 0.6, pressureSize: 0.55, pressureOpacity: 0.65,
    wobble: 0.14,
  }),
  b("dry-brush", "Dry Brush", "Painting", {
    tip: "bristle", streaks: 16, grain: "chalk", grainScale: 1.3, grainDepth: 0.7,
    size: 0.18, opacity: 0.8, taper: 0.25, pressureSize: 0.75, pressureOpacity: 0.5,
  }),

  /* ----------------------------------------------------------- airbrushing */
  b("airbrush", "Soft Airbrush", "Airbrushing", {
    geom: "spray", tip: "spray", size: 0.28, opacity: 0.14, flow: 0.6,
    spacing: 0.12, jitter: 0.12, taper: 0.5, pressureSize: 0.55, pressureOpacity: 0.8,
  }),
  b("stipple", "Stipple Spray", "Airbrushing", {
    geom: "spray", tip: "spray", size: 0.05, opacity: 0.55,
    spacing: 0.5, jitter: 2.6, taper: 0.3, pressureSize: 0.3, pressureOpacity: 0.6,
  }),
  b("splatter", "Splatter", "Airbrushing", {
    geom: "spray", tip: "spray", size: 0.09, opacity: 0.85,
    spacing: 1.6, jitter: 5.5, scatter: 1, taper: 0.2, pressureSize: 0.9,
  }),
  b("mist", "Mist", "Airbrushing", {
    geom: "spray", tip: "spray", size: 0.55, opacity: 0.07, flow: 0.5,
    spacing: 0.22, jitter: 0.8, taper: 0.6, pressureOpacity: 0.7,
  }),

  /* ------------------------------------------------------------------ light */
  b("neon-tube", "Neon Tube", "Light", {
    geom: "tube", tip: "round", size: 0.05, blend: "add", glow: 0.9,
    taper: 0.5, pressureSize: 0.5, tubeSides: 7, smoothing: 0.5,
  }),
  b("glow-ribbon", "Glow Ribbon", "Light", {
    tip: "round", size: 0.11, opacity: 0.55, blend: "add", glow: 0.7,
    taper: 0.85, pressureSize: 0.7, pressureOpacity: 0.4,
  }),
  b("laser", "Laser", "Light", {
    tip: "hard", size: 0.012, blend: "add", glow: 1.6, taper: 0.15,
    pressureSize: 0.1, smoothing: 0.75,
  }),
  b("sparks", "Sparks", "Light", {
    geom: "spray", tip: "spray", size: 0.035, blend: "add", glow: 1.2,
    spacing: 0.9, jitter: 4.5, opacity: 0.9, taper: 0.4, pressureSize: 0.6,
  }),
  b("aurora", "Aurora Veil", "Light", {
    tip: "round", grain: "noise", grainScale: 0.7, grainDepth: 0.6,
    size: 0.5, opacity: 0.16, blend: "add", glow: 0.35, taper: 0.7, wobble: 0.2,
  }),

  /* ----------------------------------------------------------------- volume */
  b("clay", "Clay Tube", "Volume", {
    geom: "tube", tip: "round", size: 0.16, taper: 0.35, pressureSize: 0.6,
    shade: 1, tubeSides: 10, smoothing: 0.5,
  }),
  b("rope", "Twisted Rope", "Volume", {
    geom: "tube", tip: "round", grain: "metal", grainScale: 3.5, grainDepth: 0.55,
    size: 0.1, taper: 0.3, shade: 0.9, tubeSides: 8,
  }),
  b("chrome", "Chrome", "Volume", {
    geom: "tube", tip: "round", grain: "metal", grainScale: 1.6, grainDepth: 0.35,
    size: 0.13, taper: 0.3, shade: 1, glow: 0.2, tubeSides: 12,
  }),
  b("silk", "Silk Ribbon", "Volume", {
    tip: "round", grain: "metal", grainScale: 1.2, grainDepth: 0.25,
    size: 0.26, opacity: 0.85, taper: 0.6, shade: 0.55, pressureSize: 0.6,
  }),

  /* ---------------------------------------------------------------- texture */
  b("hatching", "Hatching", "Texture", {
    geom: "hatch", tip: "chalk", grain: "paper", grainScale: 3, grainDepth: 0.4,
    size: 0.055, opacity: 0.7, spacing: 0.7, scatter: 0.35, jitter: 0.3, taper: 0.5,
  }),
  b("crosshatch", "Crosshatch", "Texture", {
    tip: "round", grain: "crosshatch", grainScale: 1.1, grainDepth: 0.9,
    size: 0.22, opacity: 0.75, taper: 0.35,
  }),
  b("fur", "Fur", "Texture", {
    geom: "hatch", tip: "round", size: 0.03, opacity: 0.6,
    spacing: 0.35, scatter: 0.8, jitter: 0.9, taper: 0.9,
  }),
  b("bubbles", "Bubbles", "Texture", {
    geom: "spray", tip: "round", size: 0.12, opacity: 0.35,
    spacing: 1.4, jitter: 3, taper: 0.2, pressureSize: 0.8,
  }),
];

export const BRUSH_SETS = Array.from(new Set(BRUSHES.map((x) => x.set)));

export function findBrush(all: Brush[], id: string): Brush {
  return all.find((x) => x.id === id) ?? all[0] ?? BRUSHES[0];
}

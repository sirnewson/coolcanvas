/**
 * Pixel effects.
 *
 * An object's `style.effects` is a small declarative stack; this module turns
 * it into Konva filters plus the node attributes those filters read. Konva
 * only applies filters to a cached node, so the renderer caches a group whenever
 * `hasEffects` is true and clears the cache when the stack goes back to empty.
 */
import Konva from "konva";

import type { Effects, ShadowSpec } from "../types";

export const EMPTY_EFFECTS: Required<Effects> = {
  blur: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  grayscale: false,
  sepia: false,
  invert: false,
  pixelate: 1,
  noise: 0,
  posterize: 0,
  threshold: 0,
  emboss: 0,
  solarize: false,
  enhance: 0,
};

export function normaliseEffects(e?: Effects | null): Required<Effects> {
  return { ...EMPTY_EFFECTS, ...(e ?? {}) };
}

/** True when at least one effect departs from its neutral value. */
export function hasEffects(e?: Effects | null): boolean {
  if (!e) return false;
  const n = normaliseEffects(e);
  return (
    n.blur > 0 ||
    n.brightness !== 0 ||
    n.contrast !== 0 ||
    n.saturation !== 0 ||
    n.hue !== 0 ||
    n.grayscale ||
    n.sepia ||
    n.invert ||
    n.pixelate > 1 ||
    n.noise > 0 ||
    n.posterize > 0 ||
    n.threshold > 0 ||
    n.emboss > 0 ||
    n.solarize ||
    n.enhance > 0
  );
}

/** Strip neutral values so the saved document stays small. */
export function compactEffects(e: Effects | null | undefined): Effects | null {
  if (!e) return null;
  const out: Effects = {};
  const n = normaliseEffects(e);
  (Object.keys(EMPTY_EFFECTS) as (keyof Effects)[]).forEach((k) => {
    if (n[k] !== EMPTY_EFFECTS[k]) (out as Record<string, unknown>)[k] = n[k];
  });
  return Object.keys(out).length ? out : null;
}

type Filter = typeof Konva.Filters.Blur;

/** Konva filters, in an order that reads naturally (colour → tone → texture). */
export function filtersFor(e?: Effects | null): Filter[] {
  const n = normaliseEffects(e);
  const list: Filter[] = [];
  if (n.enhance > 0) list.push(Konva.Filters.Enhance);
  if (n.brightness !== 0) list.push(Konva.Filters.Brighten);
  if (n.contrast !== 0) list.push(Konva.Filters.Contrast);
  if (n.saturation !== 0 || n.hue !== 0) list.push(Konva.Filters.HSL);
  if (n.grayscale) list.push(Konva.Filters.Grayscale);
  if (n.sepia) list.push(Konva.Filters.Sepia);
  if (n.invert) list.push(Konva.Filters.Invert);
  if (n.solarize) list.push(Konva.Filters.Solarize);
  if (n.posterize > 0) list.push(Konva.Filters.Posterize);
  if (n.threshold > 0) list.push(Konva.Filters.Threshold);
  if (n.emboss > 0) list.push(Konva.Filters.Emboss);
  if (n.blur > 0) list.push(Konva.Filters.Blur);
  if (n.pixelate > 1) list.push(Konva.Filters.Pixelate);
  if (n.noise > 0) list.push(Konva.Filters.Noise);
  return list;
}

/** Node attributes the filters above read. Always sends a full set so a
 *  removed effect resets its attribute instead of lingering. */
export function filterAttrs(e?: Effects | null): Record<string, number | boolean> {
  const n = normaliseEffects(e);
  return {
    blurRadius: n.blur,
    brightness: n.brightness,
    contrast: n.contrast,
    saturation: n.saturation,
    hue: n.hue * 180,
    luminance: 0,
    pixelSize: Math.max(1, Math.round(n.pixelate)),
    noise: n.noise,
    levels: n.posterize > 0 ? Math.max(0.02, n.posterize / 32) : 0.5,
    threshold: n.threshold > 0 ? n.threshold : 0.5,
    embossStrength: n.emboss,
    embossWhiteLevel: 0.5,
    embossBlend: false,
    enhance: n.enhance,
  };
}

/* ---------------------------------------------------------------- presets */

export interface EffectPreset {
  id: string;
  label: string;
  effects: Effects;
  blend?: string;
}

/** One-tap looks, Canva-style. Each is a full stack so applying one replaces the last. */
export const PRESETS: EffectPreset[] = [
  { id: "none", label: "Original", effects: {} },
  { id: "vivid", label: "Vivid", effects: { saturation: 0.6, contrast: 12, enhance: 0.2 } },
  { id: "soft", label: "Soft", effects: { brightness: 0.08, contrast: -12, saturation: -0.2 } },
  { id: "noir", label: "Noir", effects: { grayscale: true, contrast: 28 } },
  { id: "vintage", label: "Vintage", effects: { sepia: true, contrast: -8, brightness: 0.04, noise: 0.12 } },
  { id: "dramatic", label: "Dramatic", effects: { contrast: 36, brightness: -0.08, saturation: -0.3 } },
  { id: "cool", label: "Cool", effects: { hue: 0.1, saturation: 0.15 } },
  { id: "warm", label: "Warm", effects: { hue: -0.08, saturation: 0.25, brightness: 0.03 } },
  { id: "dream", label: "Dreamy", effects: { blur: 3, brightness: 0.1, saturation: 0.2 } },
  { id: "pop", label: "Pop art", effects: { posterize: 5, saturation: 1.2, contrast: 20 } },
  { id: "stencil", label: "Stencil", effects: { threshold: 0.5, grayscale: true } },
  { id: "pixel", label: "Pixel", effects: { pixelate: 10 } },
  { id: "emboss", label: "Emboss", effects: { emboss: 0.6, grayscale: true } },
  { id: "invert", label: "Negative", effects: { invert: true } },
  { id: "film", label: "Film", effects: { noise: 0.3, contrast: 8, saturation: -0.15 } },
  { id: "solar", label: "Solarize", effects: { solarize: true } },
];

export const DEFAULT_SHADOW: ShadowSpec = {
  color: "#000000",
  blur: 14,
  offsetX: 0,
  offsetY: 6,
  opacity: 0.18,
};

export const SHADOW_PRESETS: { id: string; label: string; spec: ShadowSpec | null }[] = [
  { id: "none", label: "None", spec: null },
  { id: "soft", label: "Soft", spec: { ...DEFAULT_SHADOW } },
  { id: "lift", label: "Lift", spec: { color: "#000000", blur: 28, offsetX: 0, offsetY: 14, opacity: 0.22 } },
  { id: "hard", label: "Hard", spec: { color: "#000000", blur: 0, offsetX: 6, offsetY: 6, opacity: 0.9 } },
  { id: "glow", label: "Glow", spec: { color: "#ffffff", blur: 24, offsetX: 0, offsetY: 0, opacity: 0.9 } },
  { id: "neon", label: "Neon", spec: { color: "#1f5fd0", blur: 22, offsetX: 0, offsetY: 0, opacity: 0.8 } },
];

export interface BlendCategory {
  category: string;
  modes: { id: string; label: string }[];
}

export const BLEND_CATEGORIES: BlendCategory[] = [
  {
    category: "Normal",
    modes: [
      { id: "source-over", label: "Normal" },
      { id: "dissolve", label: "Dissolve" },
    ],
  },
  {
    category: "Darken",
    modes: [
      { id: "darken", label: "Darken" },
      { id: "multiply", label: "Multiply" },
      { id: "color-burn", label: "Color Burn" },
      { id: "linear-burn", label: "Linear Burn" },
      { id: "darker-color", label: "Darker Color" },
    ],
  },
  {
    category: "Lighten",
    modes: [
      { id: "lighten", label: "Lighten" },
      { id: "screen", label: "Screen" },
      { id: "color-dodge", label: "Color Dodge" },
      { id: "linear-dodge", label: "Linear Dodge (Add)" },
      { id: "lighter-color", label: "Lighter Color" },
    ],
  },
  {
    category: "Contrast",
    modes: [
      { id: "overlay", label: "Overlay" },
      { id: "soft-light", label: "Soft Light" },
      { id: "hard-light", label: "Hard Light" },
      { id: "vivid-light", label: "Vivid Light" },
      { id: "linear-light", label: "Linear Light" },
      { id: "pin-light", label: "Pin Light" },
      { id: "hard-mix", label: "Hard Mix" },
    ],
  },
  {
    category: "Inversion",
    modes: [
      { id: "difference", label: "Difference" },
      { id: "exclusion", label: "Exclusion" },
      { id: "subtract", label: "Subtract" },
      { id: "divide", label: "Divide" },
    ],
  },
  {
    category: "Component",
    modes: [
      { id: "hue", label: "Hue" },
      { id: "saturation", label: "Saturation" },
      { id: "color", label: "Color" },
      { id: "luminosity", label: "Luminosity" },
    ],
  },
];

export const BLEND_MODES: { id: string; label: string }[] = BLEND_CATEGORIES.flatMap((c) => c.modes);

export function blendLabel(id?: string): string {
  return BLEND_MODES.find((b) => b.id === (id ?? "source-over"))?.label ?? "Normal";
}


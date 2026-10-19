/**
 * Non-destructive adjustment layer evaluation, matching Adobe Photoshop's model.
 * Reference: the photo engine's `crates/compose/src/adjust.rs` and `crates/doc/src/adjust.rs`
 */

import type { AdjustmentType } from "../types";

export interface CurvePoint {
  x: number; // 0..1
  y: number; // 0..1
}

export interface LevelsParams {
  inBlack: number; // 0..255
  inWhite: number; // 0..255
  gamma: number; // 0.1..9.99
  outBlack: number; // 0..255
  outWhite: number; // 0..255
}

export interface CurvesParams {
  points: CurvePoint[];
  channel?: "rgb" | "red" | "green" | "blue";
}

export interface BrightnessContrastParams {
  brightness: number; // -100..100
  contrast: number; // -100..100
  legacy?: boolean;
}

export interface ExposureParams {
  exposure: number; // -5..5 EV
  offset: number; // -0.5..0.5
  gamma: number; // 0.2..5.0
}

export interface VibranceParams {
  vibrance: number; // -100..100
  saturation: number; // -100..100
}

export interface HueSaturationParams {
  hue: number; // -180..180
  saturation: number; // -100..100
  lightness: number; // -100..100
  colorize?: boolean;
}

export interface ColorBalanceParams {
  shadows: [number, number, number]; // -100..100 [Cyan-Red, Magenta-Green, Yellow-Blue]
  midtones: [number, number, number];
  highlights: [number, number, number];
  preserveLuminosity?: boolean;
}

export interface BlackAndWhiteParams {
  reds: number; // -200..300 (default 40)
  yellows: number; // default 60
  greens: number; // default 40
  cyans: number; // default 60
  blues: number; // default 20
  magentas: number; // default 80
}

export interface PhotoFilterParams {
  color: string; // hex
  density: number; // 0..100
  preserveLuminosity: boolean;
}

export interface PosterizeParams {
  levels: number; // 2..255
}

export interface ThresholdParams {
  threshold: number; // 1..255
}

export interface GradientMapParams {
  stops: { color: string; offset: number }[];
}

export function defaultParamsFor(type: AdjustmentType): any {
  switch (type) {
    case "brightnessContrast":
      return { brightness: 0, contrast: 0, legacy: false };
    case "levels":
      return { inBlack: 0, inWhite: 255, gamma: 1.0, outBlack: 0, outWhite: 255 };
    case "curves":
      return { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], channel: "rgb" };
    case "exposure":
      return { exposure: 0, offset: 0, gamma: 1.0 };
    case "vibrance":
      return { vibrance: 25, saturation: 0 };
    case "hueSaturation":
      return { hue: 0, saturation: 0, lightness: 0, colorize: false };
    case "colorBalance":
      return {
        shadows: [0, 0, 0],
        midtones: [0, 0, 0],
        highlights: [0, 0, 0],
        preserveLuminosity: true,
      };
    case "blackAndWhite":
      return { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 };
    case "photoFilter":
      return { color: "#ec8a00", density: 25, preserveLuminosity: true };
    case "channelMixer":
      return { red: [100, 0, 0], green: [0, 100, 0], blue: [0, 0, 100], monochrome: false };
    case "colorLookup":
      return { lut: "none" };
    case "invert":
      return {};
    case "posterize":
      return { levels: 4 };
    case "threshold":
      return { threshold: 128 };
    case "gradientMap":
      return {
        stops: [
          { color: "#000000", offset: 0 },
          { color: "#ffffff", offset: 1 },
        ],
      };
    case "selectiveColor":
      return { method: "relative", colors: {} };
    default:
      return {};
  }
}

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  brightnessContrast: "Brightness / Contrast",
  levels: "Levels",
  curves: "Curves",
  exposure: "Exposure",
  vibrance: "Vibrance",
  hueSaturation: "Hue / Saturation",
  colorBalance: "Color Balance",
  blackAndWhite: "Black & White",
  photoFilter: "Photo Filter",
  channelMixer: "Channel Mixer",
  colorLookup: "Color Lookup",
  invert: "Invert",
  posterize: "Posterize",
  threshold: "Threshold",
  gradientMap: "Gradient Map",
  selectiveColor: "Selective Color",
};

/** Build cubic spline LUT for curves. */
export function buildCurveLUT(points: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!points || points.length < 2) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  const pts = [...points].sort((a, b) => a.x - b.x);

  // Linear interpolation between points
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    if (x <= pts[0].x) {
      lut[i] = Math.round(Math.max(0, Math.min(1, pts[0].y)) * 255);
      continue;
    }
    if (x >= pts[pts.length - 1].x) {
      lut[i] = Math.round(Math.max(0, Math.min(1, pts[pts.length - 1].y)) * 255);
      continue;
    }
    // find segment
    let j = 0;
    while (j < pts.length - 1 && pts[j + 1].x < x) j++;
    const p0 = pts[j];
    const p1 = pts[j + 1];
    const span = p1.x - p0.x || 0.0001;
    const t = (x - p0.x) / span;
    // Smooth cosine interpolation
    const ft = (1 - Math.cos(t * Math.PI)) * 0.5;
    const y = p0.y * (1 - ft) + p1.y * ft;
    lut[i] = Math.round(Math.max(0, Math.min(1, y)) * 255);
  }
  return lut;
}

/** RGB to HSL and back. */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Apply any adjustment directly to RGBA ImageData. */
export function applyAdjustmentToImageData(
  imgData: ImageData,
  type: AdjustmentType,
  params: any = defaultParamsFor(type)
): void {
  const d = imgData.data;
  const len = d.length;

  switch (type) {
    case "brightnessContrast": {
      const b = (params.brightness ?? 0) * 1.5; // -150..150
      const c = params.contrast ?? 0;
      const factor = (259 * (c + 255)) / (255 * (259 - c));
      for (let i = 0; i < len; i += 4) {
        d[i] = Math.max(0, Math.min(255, factor * (d[i] + b - 128) + 128));
        d[i + 1] = Math.max(0, Math.min(255, factor * (d[i + 1] + b - 128) + 128));
        d[i + 2] = Math.max(0, Math.min(255, factor * (d[i + 2] + b - 128) + 128));
      }
      break;
    }

    case "levels": {
      const inB = params.inBlack ?? 0;
      const inW = params.inWhite ?? 255;
      const gamma = params.gamma ?? 1.0;
      const outB = params.outBlack ?? 0;
      const outW = params.outWhite ?? 255;
      const lut = new Uint8Array(256);
      const inSpan = Math.max(1, inW - inB);
      const outSpan = outW - outB;
      const invGamma = 1 / Math.max(0.01, gamma);

      for (let i = 0; i < 256; i++) {
        let v = Math.max(0, Math.min(1, (i - inB) / inSpan));
        v = Math.pow(v, invGamma);
        lut[i] = Math.round(Math.max(0, Math.min(255, outB + v * outSpan)));
      }
      for (let i = 0; i < len; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      break;
    }

    case "curves": {
      const lut = buildCurveLUT(params.points || [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
      for (let i = 0; i < len; i += 4) {
        d[i] = lut[d[i]];
        d[i + 1] = lut[d[i + 1]];
        d[i + 2] = lut[d[i + 2]];
      }
      break;
    }

    case "exposure": {
      const expMul = Math.pow(2, params.exposure ?? 0);
      const offset = (params.offset ?? 0) * 255;
      const invGamma = 1 / Math.max(0.01, params.gamma ?? 1.0);
      for (let i = 0; i < len; i += 4) {
        for (let c = 0; c < 3; c++) {
          let v = (d[i + c] * expMul + offset) / 255;
          v = Math.max(0, Math.min(1, v));
          d[i + c] = Math.round(Math.pow(v, invGamma) * 255);
        }
      }
      break;
    }

    case "vibrance": {
      const vib = (params.vibrance ?? 0) / 100;
      const sat = (params.saturation ?? 0) / 100;
      for (let i = 0; i < len; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const max = Math.max(r, g, b);
        const avg = (r + g + b) / 3;
        const currentSat = (max - avg) / 255;
        // Vibrance affects less saturated colors more
        const vibFactor = vib * (1 - currentSat);
        const factor = Math.max(-1, vibFactor + sat);
        d[i] = Math.max(0, Math.min(255, r + (r - avg) * factor));
        d[i + 1] = Math.max(0, Math.min(255, g + (g - avg) * factor));
        d[i + 2] = Math.max(0, Math.min(255, b + (b - avg) * factor));
      }
      break;
    }

    case "hueSaturation": {
      const hDelta = params.hue ?? 0;
      const sFactor = 1 + (params.saturation ?? 0) / 100;
      const lFactor = (params.lightness ?? 0) / 100;
      const colorize = params.colorize ?? false;

      for (let i = 0; i < len; i += 4) {
        let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        if (colorize) {
          h = hDelta;
          s = Math.max(0, Math.min(1, (params.saturation ?? 50) / 100));
        } else {
          h = (h + hDelta + 360) % 360;
          s = Math.max(0, Math.min(1, s * sFactor));
        }
        if (lFactor > 0) l = l + (1 - l) * lFactor;
        else if (lFactor < 0) l = l * (1 + lFactor);
        const [nr, ng, nb] = hslToRgb(h, s, l);
        d[i] = nr;
        d[i + 1] = ng;
        d[i + 2] = nb;
      }
      break;
    }

    case "colorBalance": {
      const s = params.shadows || [0, 0, 0];
      const m = params.midtones || [0, 0, 0];
      const h = params.highlights || [0, 0, 0];
      for (let i = 0; i < len; i += 4) {
        const lum = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        const shadowW = Math.max(0, 1 - lum * 2);
        const highW = Math.max(0, (lum - 0.5) * 2);
        const midW = 1 - shadowW - highW;
        for (let c = 0; c < 3; c++) {
          const shift = s[c] * shadowW + m[c] * midW + h[c] * highW;
          d[i + c] = Math.max(0, Math.min(255, d[i + c] + shift));
        }
      }
      break;
    }

    case "blackAndWhite": {
      const wR = (params.reds ?? 40) / 100;
      const wY = (params.yellows ?? 60) / 100;
      const wG = (params.greens ?? 40) / 100;
      const wC = (params.cyans ?? 60) / 100;
      const wB = (params.blues ?? 20) / 100;
      const wM = (params.magentas ?? 80) / 100;
      for (let i = 0; i < len; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let gray = (r * 0.3 + g * 0.59 + b * 0.11);
        if (max !== min) {
          if (r >= g && r >= b) gray = r * wR + (g > b ? g * wY : b * wM);
          else if (g >= r && g >= b) gray = g * wG + (r > b ? r * wY : b * wC);
          else gray = b * wB + (g > r ? g * wC : r * wM);
        }
        const val = Math.max(0, Math.min(255, gray));
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      break;
    }

    case "invert": {
      for (let i = 0; i < len; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      break;
    }

    case "posterize": {
      const lvl = Math.max(2, Math.min(255, params.levels ?? 4));
      const step = 255 / (lvl - 1);
      for (let i = 0; i < len; i += 4) {
        d[i] = Math.round(Math.round(d[i] / step) * step);
        d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
        d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
      }
      break;
    }

    case "threshold": {
      const th = params.threshold ?? 128;
      for (let i = 0; i < len; i += 4) {
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const val = lum >= th ? 255 : 0;
        d[i] = val;
        d[i + 1] = val;
        d[i + 2] = val;
      }
      break;
    }

    case "photoFilter": {
      const density = (params.density ?? 25) / 100;
      const hex = params.color || "#ec8a00";
      const fc = parseInt(hex.replace("#", ""), 16) || 0;
      const fr = (fc >> 16) & 255;
      const fg = (fc >> 8) & 255;
      const fb = fc & 255;
      for (let i = 0; i < len; i += 4) {
        d[i] = Math.round(d[i] * (1 - density) + fr * density);
        d[i + 1] = Math.round(d[i + 1] * (1 - density) + fg * density);
        d[i + 2] = Math.round(d[i + 2] * (1 - density) + fb * density);
      }
      break;
    }

    case "gradientMap": {
      const stops = params.stops || [{ color: "#000000", offset: 0 }, { color: "#ffffff", offset: 1 }];
      const lut = createGradientMapLUT(stops);
      for (let i = 0; i < len; i += 4) {
        const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
        const idx = lum * 4;
        d[i] = lut[idx];
        d[i + 1] = lut[idx + 1];
        d[i + 2] = lut[idx + 2];
      }
      break;
    }
  }
}

function createGradientMapLUT(stops: { color: string; offset: number }[]): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  stops.forEach((s) => grad.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 1);
  return new Uint8Array(ctx.getImageData(0, 0, 256, 1).data);
}

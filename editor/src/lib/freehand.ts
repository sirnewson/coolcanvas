import { getStroke } from "perfect-freehand";
import type { ObjectStyle } from "../types";

export interface StrokeInput {
  points: number[];
  size: number;
  /** 0 = raw, 1 = smooth, 2 = very smooth (blueprint §10). */
  smoothing: number;
  thinning: boolean;
}

const SMOOTHING_PRESETS = [
  { streamline: 0.15, smoothing: 0.25 },
  { streamline: 0.5, smoothing: 0.6 },
  { streamline: 0.78, smoothing: 0.9 },
];

/**
 * Convert a recorded [x, y, pressure, ...] stroke into a closed outline that
 * Konva can fill. Mouse input carries synthetic pressure so lines still taper.
 */
export function strokeOutline({ points, size, smoothing, thinning }: StrokeInput): number[] {
  const preset = SMOOTHING_PRESETS[Math.min(2, Math.max(0, smoothing))];
  const input: [number, number, number][] = [];
  for (let i = 0; i < points.length; i += 3) {
    input.push([points[i], points[i + 1], points[i + 2] ?? 0.5]);
  }
  if (input.length === 1) input.push([input[0][0] + 0.1, input[0][1] + 0.1, input[0][2]]);
  const outline = getStroke(input, {
    size,
    thinning: thinning ? 0.55 : 0,
    smoothing: preset.smoothing,
    streamline: preset.streamline,
    simulatePressure: false,
    last: true,
  });
  const flat: number[] = [];
  for (const [x, y] of outline) flat.push(x, y);
  return flat;
}

/**
 * Pointer events only report pressure for real styluses. For mouse and
 * trackpad we synthesise it from speed so fast strokes thin out.
 */
export function pressureFor(
  event: { pressure?: number; pointerType?: string },
  speed: number,
): number {
  if (event.pointerType === "pen" && event.pressure && event.pressure > 0) {
    return event.pressure;
  }
  const eased = 1 - Math.min(1, speed / 30);
  return 0.35 + eased * 0.5;
}

export function penSize(style: ObjectStyle): number {
  return style.strokeWidth ?? 4;
}

/**
 * Professional Brush Engine inspired by Photocraft `crates/paint`.
 * Features presets, dynamics (size jitter, angle jitter, scatter), smoothing, flow and stamp generation.
 */

export interface BrushPreset {
  id: string;
  name: string;
  size: number;
  hardness: number; // 0..1
  spacing: number; // 0.05..1.0
  flow: number; // 0.01..1.0
  opacity: number; // 0..1
  smoothing: number; // 0..1
  sizeJitter: number; // 0..1
  angleJitter: number; // 0..1
  scatter: number; // 0..1
  roundness: number; // 0.1..1.0
  angle: number; // 0..360 deg
}

export const BRUSH_PRESETS: BrushPreset[] = [
  {
    id: "hard-round",
    name: "Hard Round",
    size: 20,
    hardness: 1.0,
    spacing: 0.1,
    flow: 1.0,
    opacity: 1.0,
    smoothing: 0.2,
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0,
    roundness: 1.0,
    angle: 0,
  },
  {
    id: "soft-round",
    name: "Soft Round",
    size: 45,
    hardness: 0.1,
    spacing: 0.15,
    flow: 0.8,
    opacity: 1.0,
    smoothing: 0.3,
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0,
    roundness: 1.0,
    angle: 0,
  },
  {
    id: "airbrush",
    name: "Soft Airbrush",
    size: 60,
    hardness: 0.0,
    spacing: 0.08,
    flow: 0.3,
    opacity: 0.7,
    smoothing: 0.4,
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0.05,
    roundness: 1.0,
    angle: 0,
  },
  {
    id: "calligraphy",
    name: "Calligraphy Chisel",
    size: 30,
    hardness: 0.95,
    spacing: 0.08,
    flow: 1.0,
    opacity: 1.0,
    smoothing: 0.3,
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0,
    roundness: 0.25,
    angle: 45,
  },
  {
    id: "fan-bristle",
    name: "Fan Bristle",
    size: 50,
    hardness: 0.5,
    spacing: 0.2,
    flow: 0.6,
    opacity: 0.85,
    smoothing: 0.2,
    sizeJitter: 0.2,
    angleJitter: 0.1,
    scatter: 0.3,
    roundness: 0.8,
    angle: 0,
  },
  {
    id: "splatter",
    name: "Splatter / Texture",
    size: 40,
    hardness: 0.8,
    spacing: 0.35,
    flow: 0.9,
    opacity: 0.9,
    smoothing: 0.0,
    sizeJitter: 0.6,
    angleJitter: 1.0,
    scatter: 0.8,
    roundness: 0.7,
    angle: 0,
  },
  {
    id: "pencil",
    name: "Hard Pencil",
    size: 4,
    hardness: 1.0,
    spacing: 0.05,
    flow: 1.0,
    opacity: 1.0,
    smoothing: 0.1,
    sizeJitter: 0,
    angleJitter: 0,
    scatter: 0,
    roundness: 1.0,
    angle: 0,
  },
];

/** Stamp generator for a single dab. */
export function createBrushStamp(
  preset: BrushPreset,
  color: string,
  scale: number = 1
): HTMLCanvasElement {
  const size = Math.max(2, Math.round(preset.size * scale));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  const radius = size / 2;

  ctx.save();
  ctx.translate(center, center);
  ctx.rotate((preset.angle * Math.PI) / 180);
  ctx.scale(1, preset.roundness);

  const grad = ctx.createRadialGradient(0, 0, radius * preset.hardness, 0, 0, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "transparent");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  return canvas;
}

/** Interpolate smooth stamps between two stroke points. */
export function interpolateDabs(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  spacingPx: number
): { x: number; y: number }[] {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return [p1];

  const count = Math.max(1, Math.floor(dist / spacingPx));
  const dabs: { x: number; y: number }[] = [];

  for (let i = 1; i <= count; i++) {
    const t = i / count;
    dabs.push({
      x: p1.x + dx * t,
      y: p1.y + dy * t,
    });
  }
  return dabs;
}

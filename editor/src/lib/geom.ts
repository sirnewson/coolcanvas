import type { Bounds, CanvasObject, Camera, Point } from "../types";

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export function screenToWorld(p: Point, camera: Camera): Point {
  return { x: (p.x - camera.x) / camera.zoom, y: (p.y - camera.y) / camera.zoom };
}

export function worldToScreen(p: Point, camera: Camera): Point {
  return { x: p.x * camera.zoom + camera.x, y: p.y * camera.zoom + camera.y };
}

export function rotatePoint(p: Point, origin: Point, radians: number): Point {
  if (!radians) return p;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  };
}

/** Axis-aligned bounds of one object, accounting for its rotation. */
export function objectBounds(o: CanvasObject): Bounds {
  if (!o.rotation) {
    return normalizeBounds({ x: o.x, y: o.y, width: o.width, height: o.height });
  }
  const rad = (o.rotation * Math.PI) / 180;
  const origin = { x: o.x + o.width / 2, y: o.y + o.height / 2 };
  const corners = [
    { x: o.x, y: o.y },
    { x: o.x + o.width, y: o.y },
    { x: o.x + o.width, y: o.y + o.height },
    { x: o.x, y: o.y + o.height },
  ].map((c) => rotatePoint(c, origin, rad));
  return boundsOfPoints(corners);
}

export function boundsOfPoints(points: Point[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Lines and arrows are stored with negative width/height when drawn backwards. */
export function normalizeBounds(b: Bounds): Bounds {
  return {
    x: b.width < 0 ? b.x + b.width : b.x,
    y: b.height < 0 ? b.y + b.height : b.y,
    width: Math.abs(b.width),
    height: Math.abs(b.height),
  };
}

export function unionBounds(list: Bounds[]): Bounds | null {
  if (!list.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of list) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function boundsOfObjects(objects: CanvasObject[]): Bounds | null {
  return unionBounds(objects.map(objectBounds));
}

export function intersects(a: Bounds, b: Bounds): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function pointInBounds(p: Point, b: Bounds): boolean {
  return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
}

/** Shortest distance from a point to a line segment. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (!lenSq) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq, 0, 1);
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Snap a drag delta to horizontal, vertical or 45° increments — the Shift
 * behaviour that makes mouse drawing feel deliberate (blueprint §7).
 */
export function constrainAngle(dx: number, dy: number): Point {
  const angle = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  const length = Math.hypot(dx, dy);
  return { x: Math.cos(snapped) * length, y: Math.sin(snapped) * length };
}

/** Quadratic control point for a bowed arrow/line. */
export function curveControl(from: Point, to: Point, curve: number): Point {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (!curve) return mid;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mid.x + (-dy / len) * curve * len * 0.3, y: mid.y + (dx / len) * curve * len * 0.3 };
}

/** Sample a quadratic bezier into a polyline Konva can draw. */
export function quadPoints(from: Point, ctrl: Point, to: Point, steps = 20): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    out.push(
      mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
      mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
    );
  }
  return out;
}

/** Elbow routing: horizontal first, then vertical. */
export function elbowPoints(from: Point, to: Point): number[] {
  const midX = (from.x + to.x) / 2;
  return [from.x, from.y, midX, from.y, midX, to.y, to.x, to.y];
}

/** Nearest point on a rectangle's edge, used to dock connectors. */
export function anchorOnBounds(b: Bounds, toward: Point): Point {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const halfW = b.width / 2 || 1;
  const halfH = b.height / 2 || 1;
  const scale = 1 / Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

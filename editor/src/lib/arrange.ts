/**
 * Smart arrangement — lay a selection out as a stack, grid, flow or timeline.
 * Objects keep their sizes and identities; Flow and Timeline add docked
 * arrows/markers so the structure survives later edits.
 */
import type { CanvasObject } from "../types";
import { objectBounds } from "./geom";
import { uid } from "./id";
import { useStore } from "../store/store";
import { stampRect } from "../store/factory";

export type Arrangement = "row" | "col" | "grid" | "flow" | "timeline" | "circle";

export const ARRANGEMENTS: { id: Arrangement; label: string; hint: string }[] = [
  { id: "row", label: "Stack horizontal", hint: "Left to right, equal gaps" },
  { id: "col", label: "Stack vertical", hint: "Top to bottom, equal gaps" },
  { id: "grid", label: "Grid", hint: "Rows of equal columns" },
  { id: "flow", label: "Flow", hint: "A row joined by arrows" },
  { id: "timeline", label: "Timeline", hint: "Along a line with markers" },
  { id: "circle", label: "Cycle", hint: "Around a circle, arrows between" },
];

function sorted(objects: CanvasObject[]): CanvasObject[] {
  // Reading order: roughly top-to-bottom, then left-to-right.
  return [...objects].sort((a, b) => {
    const ab = objectBounds(a);
    const bb = objectBounds(b);
    if (Math.abs(ab.y - bb.y) > Math.min(ab.height, bb.height) * 0.6) return ab.y - bb.y;
    return ab.x - bb.x;
  });
}

function arrow(a: CanvasObject, b: CanvasObject): CanvasObject {
  const ab = objectBounds(a);
  const bb = objectBounds(b);
  const ax = ab.x + ab.width;
  const ay = ab.y + ab.height / 2;
  const bx = bb.x;
  const by = bb.y + bb.height / 2;
  return {
    id: uid("arrow"),
    type: "arrow",
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    style: { stroke: useStore.getState().defaults.ink, strokeWidth: 1.5, arrowEnd: true },
    data: { points: [ax - Math.min(ax, bx), ay - Math.min(ay, by), bx - Math.min(ax, bx), by - Math.min(ay, by)], from: { id: a.id }, to: { id: b.id } },
  };
}

/** Arrange the current selection. Top-level objects only; groups move as one. */
export function arrangeSelection(kind: Arrangement, gap = 48) {
  const s = useStore.getState();
  const { doc, selection } = s;
  const objects = sorted(
    selection
      .map((id) => doc.objects[id])
      .filter((o): o is CanvasObject => !!o && o.type !== "arrow" && o.type !== "line"),
  );
  if (objects.length < 2) return s.flashHint("Select two or more objects to arrange");
  const origin = objects.reduce((acc, o) => ({ x: Math.min(acc.x, o.x), y: Math.min(acc.y, o.y) }), { x: Infinity, y: Infinity });
  const moves: { id: string; x: number; y: number }[] = [];
  const extras: CanvasObject[] = [];

  if (kind === "row" || kind === "flow" || kind === "timeline") {
    const maxH = Math.max(...objects.map((o) => objectBounds(o).height));
    let x = origin.x;
    objects.forEach((o) => {
      const b = objectBounds(o);
      moves.push({ id: o.id, x: x + (o.x - b.x), y: origin.y + (maxH - b.height) / 2 + (o.y - b.y) });
      x += b.width + gap;
    });
    if (kind === "flow") {
      for (let i = 0; i < objects.length - 1; i += 1) extras.push(arrow(objects[i], objects[i + 1]));
    }
    if (kind === "timeline") {
      const width = x - gap - origin.x;
      const lineY = origin.y + maxH + 34;
      extras.push(stampRect({ x: origin.x, y: lineY }, width, 3, { fill: "#1c1c1a", stroke: "#1c1c1a", strokeWidth: 0, radius: 2 }));
      let mx = origin.x;
      objects.forEach((o) => {
        const b = objectBounds(o);
        extras.push(stampRect({ x: mx + b.width / 2 - 7, y: lineY - 6 }, 14, 14, { type: "ellipse", fill: "#ffffff", stroke: "#1c1c1a", strokeWidth: 2 }));
        mx += b.width + gap;
      });
    }
  } else if (kind === "col") {
    const maxW = Math.max(...objects.map((o) => objectBounds(o).width));
    let y = origin.y;
    objects.forEach((o) => {
      const b = objectBounds(o);
      moves.push({ id: o.id, x: origin.x + (maxW - b.width) / 2 + (o.x - b.x), y: y + (o.y - b.y) });
      y += b.height + gap;
    });
  } else if (kind === "grid") {
    const cols = Math.ceil(Math.sqrt(objects.length));
    const cellW = Math.max(...objects.map((o) => objectBounds(o).width));
    const cellH = Math.max(...objects.map((o) => objectBounds(o).height));
    objects.forEach((o, i) => {
      const b = objectBounds(o);
      const c = i % cols;
      const r = Math.floor(i / cols);
      moves.push({ id: o.id, x: origin.x + c * (cellW + gap) + (cellW - b.width) / 2 + (o.x - b.x), y: origin.y + r * (cellH + gap) + (cellH - b.height) / 2 + (o.y - b.y) });
    });
  } else if (kind === "circle") {
    const n = objects.length;
    const maxW = Math.max(...objects.map((o) => objectBounds(o).width));
    const radius = Math.max(160, (n * (maxW + gap)) / (Math.PI * 2));
    const cx = origin.x + radius + maxW / 2;
    const cy = origin.y + radius + maxW / 2;
    objects.forEach((o, i) => {
      const b = objectBounds(o);
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      moves.push({ id: o.id, x: cx + Math.cos(a) * radius - b.width / 2 + (o.x - b.x), y: cy + Math.sin(a) * radius - b.height / 2 + (o.y - b.y) });
    });
    for (let i = 0; i < n; i += 1) extras.push(arrow(objects[i], objects[(i + 1) % n]));
  }

  // Do not double up on arrows that already join two of the objects.
  const linked = new Set(
    Object.values(doc.objects)
      .filter((o) => o.type === "arrow" && o.data.from && o.data.to)
      .map((o) => `${o.data.from!.id}>${o.data.to!.id}`),
  );
  const fresh = extras.filter((e) => e.type !== "arrow" || !linked.has(`${e.data.from?.id}>${e.data.to?.id}`));
  extras.length = 0;
  extras.push(...fresh);

  s.beginGesture();
  for (const m of moves) {
    const o = doc.objects[m.id];
    if (o) s.translateObjects([m.id], m.x - o.x, m.y - o.y);
  }
  s.endGesture();
  if (extras.length) {
    // Arrows dock after the nodes have moved, so they compute from final positions.
    const latest = useStore.getState().doc.objects;
    const fixed = extras.map((e) => {
      if (e.type !== "arrow" || !e.data.from || !e.data.to) return e;
      return arrow(latest[e.data.from.id] ?? e, latest[e.data.to.id] ?? e);
    });
    s.addObjects(fixed, false);
  }
  s.flashHint(`Arranged as ${ARRANGEMENTS.find((a) => a.id === kind)?.label.toLowerCase()}`);
}

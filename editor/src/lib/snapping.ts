import type { Bounds } from "../types";

export interface Guide {
  orientation: "v" | "h";
  /** World coordinate of the guide line. */
  position: number;
  /** Extent of the drawn line, so guides only span the involved objects. */
  start: number;
  end: number;
  kind: "edge" | "center" | "spacing";
  /** Populated for spacing guides: the equal gap in world units. */
  gap?: number;
}

export interface SnapOptions {
  /** Snap distance in world units (screen px / zoom). */
  threshold: number;
  gridSize?: number;
  objects: boolean;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const edgesX = (b: Bounds) => [b.x, b.x + b.width / 2, b.x + b.width];
const edgesY = (b: Bounds) => [b.y, b.y + b.height / 2, b.y + b.height];

/**
 * Given the bounds the user is dragging and everything else on the board,
 * return the correction that lands it on the nearest alignment, plus the
 * guides to draw (blueprint §13).
 */
export function computeSnap(
  moving: Bounds,
  targets: Bounds[],
  options: SnapOptions,
): SnapResult {
  const { threshold, gridSize, objects } = options;
  let bestX: { delta: number; guide: Guide } | null = null;
  let bestY: { delta: number; guide: Guide } | null = null;

  if (objects) {
    const movingX = edgesX(moving);
    const movingY = edgesY(moving);

    for (const target of targets) {
      const tx = edgesX(target);
      const ty = edgesY(target);

      for (let mi = 0; mi < movingX.length; mi += 1) {
        for (let ti = 0; ti < tx.length; ti += 1) {
          const delta = tx[ti] - movingX[mi];
          if (Math.abs(delta) > threshold) continue;
          if (bestX !== null && Math.abs(delta) >= Math.abs(bestX.delta)) continue;
          bestX = {
            delta,
            guide: {
              orientation: "v",
              position: tx[ti],
              start: Math.min(moving.y, target.y),
              end: Math.max(moving.y + moving.height, target.y + target.height),
              kind: mi === 1 && ti === 1 ? "center" : "edge",
            },
          };
        }
      }

      for (let mi = 0; mi < movingY.length; mi += 1) {
        for (let ti = 0; ti < ty.length; ti += 1) {
          const delta = ty[ti] - movingY[mi];
          if (Math.abs(delta) > threshold) continue;
          if (bestY !== null && Math.abs(delta) >= Math.abs(bestY.delta)) continue;
          bestY = {
            delta,
            guide: {
              orientation: "h",
              position: ty[ti],
              start: Math.min(moving.x, target.x),
              end: Math.max(moving.x + moving.width, target.x + target.width),
              kind: mi === 1 && ti === 1 ? "center" : "edge",
            },
          };
        }
      }
    }
  }

  if (gridSize) {
    if (!bestX) {
      const snapped = Math.round(moving.x / gridSize) * gridSize;
      const delta = snapped - moving.x;
      if (Math.abs(delta) <= threshold) {
        bestX = {
          delta,
          guide: { orientation: "v", position: snapped, start: moving.y, end: moving.y + moving.height, kind: "edge" },
        };
      }
    }
    if (!bestY) {
      const snapped = Math.round(moving.y / gridSize) * gridSize;
      const delta = snapped - moving.y;
      if (Math.abs(delta) <= threshold) {
        bestY = {
          delta,
          guide: { orientation: "h", position: snapped, start: moving.x, end: moving.x + moving.width, kind: "edge" },
        };
      }
    }
  }

  const guides: Guide[] = [];
  const dx = bestX ? bestX.delta : 0;
  const dy = bestY ? bestY.delta : 0;
  if (bestX) guides.push(bestX.guide);
  if (bestY) guides.push(bestY.guide);

  if (objects && !bestX) {
    const spacing = equalSpacing(moving, targets, threshold, "x");
    if (spacing) {
      guides.push(...spacing.guides);
      return { dx: spacing.delta, dy, guides };
    }
  }
  if (objects && !bestY) {
    const spacing = equalSpacing(moving, targets, threshold, "y");
    if (spacing) {
      guides.push(...spacing.guides);
      return { dx, dy: spacing.delta, guides };
    }
  }

  return { dx, dy, guides };
}

/**
 * Detects "sitting an equal distance from the neighbour on each side" so
 * repeated cards line up without measuring.
 */
function equalSpacing(
  moving: Bounds,
  targets: Bounds[],
  threshold: number,
  axis: "x" | "y",
): { delta: number; guides: Guide[] } | null {
  const size = axis === "x" ? "width" : "height";
  const cross = axis === "x" ? "y" : "x";
  const crossSize = axis === "x" ? "height" : "width";

  // Only consider neighbours that overlap on the perpendicular axis.
  const row = targets.filter(
    (t) =>
      t[cross] < moving[cross] + moving[crossSize] &&
      t[cross] + t[crossSize] > moving[cross],
  );
  if (row.length < 2) return null;

  const before = row
    .filter((t) => t[axis] + t[size] <= moving[axis] + 1)
    .sort((a, b) => b[axis] + b[size] - (a[axis] + a[size]))[0];
  const after = row
    .filter((t) => t[axis] >= moving[axis] + moving[size] - 1)
    .sort((a, b) => a[axis] - b[axis])[0];
  if (!before || !after) return null;

  const total = after[axis] - (before[axis] + before[size]);
  const gap = (total - moving[size]) / 2;
  if (gap < 0) return null;
  const targetPos = before[axis] + before[size] + gap;
  const delta = targetPos - moving[axis];
  if (Math.abs(delta) > threshold) return null;

  const line = moving[cross] + moving[crossSize] / 2;
  const mk = (from: number, to: number): Guide => ({
    orientation: axis === "x" ? "h" : "v",
    position: line,
    start: from,
    end: to,
    kind: "spacing",
    gap,
  });

  return {
    delta,
    guides: [
      mk(before[axis] + before[size], targetPos),
      mk(targetPos + moving[size], after[axis]),
    ],
  };
}

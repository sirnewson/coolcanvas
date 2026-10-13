/**
 * QuickShape. Hold still at the end of a stroke and the sketch snaps to the
 * shape it was clearly trying to be. Fitting happens in the drawing plane's 2D
 * coordinates, so it works the same on any plane and in free space.
 */

export type FitKind = "line" | "ellipse" | "poly" | "none";

export interface Fit {
  kind: FitKind;
  /** Flat [u, v, ...] in plane coordinates. */
  pts: number[];
}

const dist = (p: number[], i: number, j: number) => Math.hypot(p[i * 2] - p[j * 2], p[i * 2 + 1] - p[j * 2 + 1]);

function perimeter(p: number[]): number {
  let s = 0;
  for (let i = 1; i < p.length / 2; i++) s += dist(p, i - 1, i);
  return s;
}

/** Largest perpendicular distance from the chord between the two ends. */
function chordDeviation(p: number[]): number {
  const n = p.length / 2;
  const ax = p[0];
  const ay = p[1];
  const bx = p[(n - 1) * 2];
  const by = p[(n - 1) * 2 + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1e-9;
  let max = 0;
  for (let i = 1; i < n - 1; i++) {
    const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / len;
    if (d > max) max = d;
  }
  return max;
}

function rdp(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n < 3) return p.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = p[a * 2];
    const ay = p[a * 2 + 1];
    const dx = p[b * 2] - ax;
    const dy = p[b * 2 + 1] - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

/** Resample a polyline so the snapped shape still draws with an even stroke. */
function densify(p: number[], step: number): number[] {
  const out: number[] = [];
  const n = p.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const ax = p[i * 2];
    const ay = p[i * 2 + 1];
    const bx = p[(i + 1) * 2];
    const by = p[(i + 1) * 2 + 1];
    const d = Math.hypot(bx - ax, by - ay);
    const k = Math.max(1, Math.ceil(d / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t);
    }
  }
  out.push(p[(n - 1) * 2], p[(n - 1) * 2 + 1]);
  return out;
}

/** Snap near-cardinal lines fully square. */
function squareUp(p: number[], snapAngle: number): number[] {
  const dx = p[2] - p[0];
  const dy = p[3] - p[1];
  const len = Math.hypot(dx, dy);
  let ang = Math.atan2(dy, dx);
  const step = Math.PI / 12; // every 15 degrees
  const snapped = Math.round(ang / step) * step;
  if (Math.abs(ang - snapped) < snapAngle) ang = snapped;
  return [p[0], p[1], p[0] + Math.cos(ang) * len, p[1] + Math.sin(ang) * len];
}

export function fitShape(pts: number[], size: number): Fit {
  const n = pts.length / 2;
  if (n < 4) return { kind: "none", pts };

  const per = perimeter(pts);
  if (per < size * 3) return { kind: "none", pts };

  const tol = Math.max(size * 0.9, per * 0.012);
  const gap = dist(pts, 0, n - 1);
  const closed = gap < per * 0.22;

  if (!closed) {
    // Forgiving on purpose: someone who holds still at the end of a long stroke
    // wants the line they meant, not a faithful record of their wobble.
    const straightTol = Math.max(tol, per * 0.055);
    if (chordDeviation(pts) < straightTol) {
      const line = squareUp([pts[0], pts[1], pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]], 0.14);
      return { kind: "line", pts: densify(line, Math.max(size * 0.5, per / 300)) };
    }
    const poly = rdp(pts, tol * 1.6);
    if (poly.length / 2 <= 6) return { kind: "poly", pts: densify(poly, Math.max(size * 0.5, per / 300)) };
    return { kind: "none", pts };
  }

  // Closed: fit an ellipse, orientation included. A circle drawn on screen lands
  // on a tilted construction plane as a *rotated* ellipse, so an axis-aligned fit
  // would reject almost every circle the user actually draws. The radii and the
  // angle both come from the second moments, which one wobbly lobe cannot skew
  // the way an extreme point skews a bounding box.
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += pts[i * 2] / n;
    cy += pts[i * 2 + 1] / n;
  }
  let mxx = 0;
  let myy = 0;
  let mxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 2] - cx;
    const dy = pts[i * 2 + 1] - cy;
    mxx += (dx * dx) / n;
    myy += (dy * dy) / n;
    mxy += (dx * dy) / n;
  }
  const mid = (mxx + myy) / 2;
  const spread = Math.sqrt(((mxx - myy) / 2) ** 2 + mxy * mxy);
  let a = Math.sqrt(Math.max(0, 2 * (mid + spread)));
  let b = Math.sqrt(Math.max(0, 2 * (mid - spread)));
  const ang = 0.5 * Math.atan2(2 * mxy, mxx - myy);
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);

  // A rectangle's moment-fitted ellipse has a residual close to a wobbly
  // circle's, so the residual alone cannot separate them. Corners can: simplify
  // first and look at how sharply the outline turns. A polygon turns hard at a
  // few places, a circle turns gently everywhere.
  //
  // The tolerance is a fraction of the shape's own radius, which is what makes
  // the counts separable: at 7.5% of the radius a circle still needs about
  // eight segments to stay inside the band, while a rectangle collapses to its
  // four corners and a triangle to three.
  const radius = per / (Math.PI * 2);
  const corners = rdp(pts, radius * 0.075);
  const cn = corners.length / 2;
  if (cn >= 4 && cn <= 7) {
    let maxTurn = 0;
    for (let i = 0; i < cn - 1; i++) {
      const prev = (i - 1 + (cn - 1)) % (cn - 1);
      const next = (i + 1) % (cn - 1);
      const ax = corners[i * 2] - corners[prev * 2];
      const ay = corners[i * 2 + 1] - corners[prev * 2 + 1];
      const bx = corners[next * 2] - corners[i * 2];
      const by = corners[next * 2 + 1] - corners[i * 2 + 1];
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la < 1e-9 || lb < 1e-9) continue;
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
      if (turn > maxTurn) maxTurn = turn;
    }
    if (maxTurn > 1.0) {
      const closedPoly = corners.concat([corners[0], corners[1]]);
      return { kind: "poly", pts: densify(closedPoly, Math.max(size * 0.5, per / 400)) };
    }
  }

  if (a > 1e-6 && b > 1e-6) {
    if (Math.abs(a - b) / a < 0.14) a = b = (a + b) / 2;
    let err = 0;
    for (let i = 0; i < n; i++) {
      const dx = pts[i * 2] - cx;
      const dy = pts[i * 2 + 1] - cy;
      const u = (dx * ca + dy * sa) / a;
      const v = (-dx * sa + dy * ca) / b;
      err += Math.abs(Math.hypot(u, v) - 1) / n;
    }
    if (err < 0.14) {
      const steps = Math.min(256, Math.max(48, Math.round(per / Math.max(size * 0.4, 1e-4))));
      const out: number[] = [];
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const ex = Math.cos(t) * a;
        const ey = Math.sin(t) * b;
        out.push(cx + ex * ca - ey * sa, cy + ex * sa + ey * ca);
      }
      return { kind: "ellipse", pts: out };
    }
  }

  const poly = rdp(pts, tol * 2.4);
  if (poly.length / 2 <= 9 && poly.length / 2 >= 3) {
    const closedPoly = poly.concat([poly[0], poly[1]]);
    return { kind: "poly", pts: densify(closedPoly, Math.max(size * 0.5, per / 400)) };
  }
  return { kind: "none", pts };
}

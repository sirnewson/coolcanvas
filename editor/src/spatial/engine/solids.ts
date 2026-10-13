import * as THREE from "three";
import type { Solid, Stroke } from "../types";
import type { Basis } from "./plane";
import { worldToPlane } from "./plane";

/**
 * Turning a flat sketch into form. A stroke drawn on the construction plane is
 * reduced to a clean profile, then extruded, inflated or revolved.
 */

/* ------------------------------------------------------------- profiles */

/** Ramer-Douglas-Peucker on a 2D polyline. */
function simplify(pts: number[], tol: number): number[] {
  const n = pts.length / 2;
  if (n < 3) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;

  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    if (b - a < 2) continue;
    const ax = pts[a * 2];
    const ay = pts[a * 2 + 1];
    const bx = pts[b * 2];
    const by = pts[b * 2 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-9;
    let best = -1;
    let bestD = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i * 2] - ax) * dy - (pts[i * 2 + 1] - ay) * dx) / len;
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
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** Project a stroke onto its plane and clean it up into a closed profile. */
export function strokeToProfile(stroke: Stroke, basis: Basis, close = true): number[] {
  const raw: number[] = [];
  const p = new THREE.Vector3();
  const n = Math.floor(stroke.pts.length / 4);
  for (let i = 0; i < n; i++) {
    p.set(stroke.pts[i * 4], stroke.pts[i * 4 + 1], stroke.pts[i * 4 + 2]);
    const [u, v] = worldToPlane(basis, p);
    raw.push(u, v);
  }
  if (raw.length < 6) return raw;

  let out = simplify(raw, Math.max(stroke.size * 0.35, 0.004));
  const c = out.length / 2;
  if (close && c >= 3) {
    const gap = Math.hypot(out[0] - out[(c - 1) * 2], out[1] - out[(c - 1) * 2 + 1]);
    // Only weld the ends if they are already roughly together; otherwise the
    // closing line is deliberate and should stay.
    if (gap > 1e-4) out = out.concat([out[0], out[1]]);
  }
  return out;
}

function toShape(profile: number[]): THREE.Shape | null {
  const n = profile.length / 2;
  if (n < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(profile[0], profile[1]);
  for (let i = 1; i < n; i++) shape.lineTo(profile[i * 2], profile[i * 2 + 1]);
  shape.closePath();
  return shape;
}

/* ------------------------------------------------------------- inflation */

/** Split every triangle into four, so the inflated surface can actually curve. */
function subdivide(pos: number[], idx: number[], times: number): { pos: number[]; idx: number[] } {
  for (let t = 0; t < times; t++) {
    const mid = new Map<string, number>();
    const nextIdx: number[] = [];
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      const hit = mid.get(key);
      if (hit !== undefined) return hit;
      const i = pos.length / 2;
      pos.push((pos[a * 2] + pos[b * 2]) / 2, (pos[a * 2 + 1] + pos[b * 2 + 1]) / 2);
      mid.set(key, i);
      return i;
    };
    for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i];
      const b = idx[i + 1];
      const c = idx[i + 2];
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      nextIdx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    idx = nextIdx;
  }
  return { pos, idx };
}

function distanceToBoundary(x: number, y: number, profile: number[]): number {
  let best = Infinity;
  const n = profile.length / 2;
  for (let i = 0; i < n - 1; i++) {
    const ax = profile[i * 2];
    const ay = profile[i * 2 + 1];
    const bx = profile[(i + 1) * 2];
    const by = profile[(i + 1) * 2 + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
    if (d < best) best = d;
  }
  return best;
}

function buildInflate(profile: number[], height: number): THREE.BufferGeometry | null {
  const shape = toShape(profile);
  if (!shape) return null;
  const flat = new THREE.ShapeGeometry(shape);
  const src = flat.getAttribute("position");
  const srcIdx = flat.getIndex();
  if (!srcIdx) {
    flat.dispose();
    return null;
  }
  let pos2: number[] = [];
  for (let i = 0; i < src.count; i++) pos2.push(src.getX(i), src.getY(i));
  let idx: number[] = Array.from(srcIdx.array);
  flat.dispose();

  const sub = subdivide(pos2, idx, pos2.length < 400 ? 3 : 2);
  pos2 = sub.pos;
  idx = sub.idx;

  const count = pos2.length / 2;
  const dist = new Float32Array(count);
  let maxD = 1e-6;
  for (let i = 0; i < count; i++) {
    dist[i] = distanceToBoundary(pos2[i * 2], pos2[i * 2 + 1], profile);
    if (dist[i] > maxD) maxD = dist[i];
  }

  // Two shells that meet at the outline. sqrt gives the rounded, pillow-like edge.
  const positions = new Float32Array(count * 2 * 3);
  const put = (vi: number, side: number) => {
    const z = Math.sqrt(Math.max(0, dist[vi] / maxD)) * height * side;
    const o = (vi + (side > 0 ? 0 : count)) * 3;
    positions[o] = pos2[vi * 2];
    positions[o + 1] = pos2[vi * 2 + 1];
    positions[o + 2] = z;
  };
  for (let i = 0; i < count; i++) {
    put(i, 1);
    put(i, -1);
  }

  const indices: number[] = [];
  for (let i = 0; i < idx.length; i += 3) {
    indices.push(idx[i], idx[i + 1], idx[i + 2]);
    indices.push(idx[i + 2] + count, idx[i + 1] + count, idx[i] + count);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------- revolve */

function buildRevolve(profile: number[], segments = 48): THREE.BufferGeometry | null {
  const n = profile.length / 2;
  if (n < 2) return null;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(Math.abs(profile[i * 2]), profile[i * 2 + 1]));
  pts.sort((a, b) => a.y - b.y);
  // Collapse duplicate heights, which would produce degenerate rings.
  const clean: THREE.Vector2[] = [];
  for (const p of pts) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(p.y - last.y) > 1e-5) clean.push(p);
  }
  if (clean.length < 2) return null;
  // LatheGeometry spins an XY profile around Y, which is exactly the plane's
  // v axis, so the result already sits in plane space.
  return new THREE.LatheGeometry(clean, segments);
}

/* ------------------------------------------------------------------- api */

export function buildSolidGeometry(solid: Solid): THREE.BufferGeometry | null {
  const profile = solid.profile;
  if (profile.length < 6) return null;

  let geo: THREE.BufferGeometry | null = null;
  const h = Math.max(Math.abs(solid.height), 1e-4) * Math.sign(solid.height || 1);

  if (solid.mode === "extrude") {
    const shape = toShape(profile);
    if (!shape) return null;
    const bevel = Math.min(solid.bevel, Math.abs(h) * 0.45);
    geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.abs(h),
      bevelEnabled: bevel > 1e-4,
      bevelThickness: bevel,
      bevelSize: bevel * 0.8,
      bevelSegments: bevel > 1e-4 ? 3 : 0,
      curveSegments: 8,
      steps: 1,
    });
    if (h < 0) geo.translate(0, 0, -Math.abs(h));
    if (solid.centered) geo.translate(0, 0, -Math.abs(h) / 2);
    geo.computeVertexNormals();
  } else if (solid.mode === "inflate") {
    geo = buildInflate(profile, Math.abs(h) / 2);
    if (geo && !solid.centered) geo.translate(0, 0, Math.abs(h) / 2);
  } else {
    geo = buildRevolve(profile);
  }
  if (!geo) return null;

  // Move from plane space into the world.
  const m = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...solid.ax),
    new THREE.Vector3(...solid.ay),
    new THREE.Vector3(...solid.an)
  );
  m.setPosition(new THREE.Vector3(...solid.origin));
  geo.applyMatrix4(m);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

export function makeSolidMaterial(solid: Solid, env: THREE.Texture | null): THREE.Material {
  const color = new THREE.Color(solid.color);
  const transparent = solid.opacity < 0.999;
  const common = { color, transparent, opacity: solid.opacity, side: THREE.DoubleSide as THREE.Side };

  // The generated room is bright; at full strength it blows every surface to
  // white under ACES. These weights keep the form readable.
  switch (solid.shade) {
    case "flat":
      return new THREE.MeshBasicMaterial({ ...common });
    case "metal":
      return new THREE.MeshStandardMaterial({ ...common, roughness: 0.22, metalness: 1, envMap: env, envMapIntensity: 0.9 });
    case "glossy":
      return new THREE.MeshStandardMaterial({ ...common, roughness: 0.18, metalness: 0.12, envMap: env, envMapIntensity: 0.5 });
    case "glass":
      return new THREE.MeshPhysicalMaterial({
        ...common,
        transparent: true,
        opacity: Math.min(solid.opacity, 0.98),
        roughness: 0.06,
        metalness: 0,
        transmission: 0.92,
        thickness: 0.6,
        ior: 1.45,
        envMap: env,
        envMapIntensity: 0.6,
      });
    case "matte":
    default:
      return new THREE.MeshStandardMaterial({ ...common, roughness: 0.88, metalness: 0, envMap: env, envMapIntensity: 0.35 });
  }
}

export function solidBounds(solid: Solid): THREE.Box3 {
  const geo = buildSolidGeometry(solid);
  if (!geo) return new THREE.Box3();
  const box = geo.boundingBox ? geo.boundingBox.clone() : new THREE.Box3();
  geo.dispose();
  return box;
}

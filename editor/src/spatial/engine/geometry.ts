import * as THREE from "three";
import type { Brush, Stroke, Vec3 } from "../types";

/**
 * Stroke geometry. Every brush produces the same vertex layout so that all
 * strokes sharing a brush can live in one batched buffer and render in a single
 * draw call.
 *
 *   position  vec3   world space
 *   normal    vec3   used for the optional shaded look
 *   uv        vec2   u = distance along the stroke in brush-widths, v = across
 *   aColor    vec3   linear colour, per vertex so one material serves many strokes
 *   aAlpha    float  pressure, flow and end-taper baked together
 */

export interface GeoData {
  position: Float32Array;
  normal: Float32Array;
  uv: Float32Array;
  color: Float32Array;
  alpha: Float32Array;
  index: Uint32Array;
}

export const EMPTY_GEO: GeoData = {
  position: new Float32Array(0),
  normal: new Float32Array(0),
  uv: new Float32Array(0),
  color: new Float32Array(0),
  alpha: new Float32Array(0),
  index: new Uint32Array(0),
};

const MAX_SAMPLES = 1200;

interface Sample {
  p: THREE.Vector3;
  w: number; // half width
  a: number; // alpha
}

/* --------------------------------------------------------------- sampling */

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

/**
 * Raw pointer samples into an evenly spaced, smoothed spine with per-point
 * width and alpha. Doing this once keeps grain and bristle spacing consistent
 * no matter how fast the stroke was drawn.
 */
function prepare(stroke: Stroke, brush: Brush): Sample[] {
  const n = Math.floor(stroke.pts.length / 4);
  if (n === 0) return [];

  const pos: THREE.Vector3[] = [];
  const press: number[] = [];
  for (let i = 0; i < n; i++) {
    pos.push(new THREE.Vector3(stroke.pts[i * 4], stroke.pts[i * 4 + 1], stroke.pts[i * 4 + 2]));
    press.push(stroke.pts[i * 4 + 3]);
  }

  // Smoothing: a few Laplacian passes, strength from the brush.
  const passes = Math.round(brush.smoothing * 6);
  for (let k = 0; k < passes; k++) {
    const next = pos.map((p) => p.clone());
    for (let i = 1; i < n - 1; i++) {
      next[i].copy(pos[i]).multiplyScalar(0.5).addScaledVector(pos[i - 1], 0.25).addScaledVector(pos[i + 1], 0.25);
    }
    for (let i = 0; i < n; i++) pos[i].copy(next[i]);
  }

  // Speed per point, for velocity-driven thinning.
  const speed: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) speed[i] = pos[i].distanceTo(pos[i - 1]);
  const refSpeed = stroke.size * 1.4;

  // Width and alpha at each raw point.
  const rawW: number[] = [];
  const rawA: number[] = [];
  for (let i = 0; i < n; i++) {
    const pr = clamp01(press[i]);
    const sizeMul = 1 - brush.pressureSize + brush.pressureSize * Math.pow(pr, 0.75);
    const velMul = 1 - brush.velocitySize * clamp01(speed[i] / (refSpeed || 1)) * 0.75;
    rawW.push((stroke.size * 0.5 * sizeMul * Math.max(0.08, velMul)));
    const aMul = 1 - brush.pressureOpacity + brush.pressureOpacity * Math.pow(pr, 0.9);
    rawA.push(stroke.opacity * brush.flow * aMul);
  }

  if (n === 1) return [{ p: pos[0], w: rawW[0], a: rawA[0] }];

  // Arc-length resample.
  const lengths: number[] = [0];
  let total = 0;
  for (let i = 1; i < n; i++) {
    total += pos[i].distanceTo(pos[i - 1]);
    lengths.push(total);
  }
  if (total < 1e-6) return [{ p: pos[0], w: rawW[0], a: rawA[0] }];

  let step = Math.max(stroke.size * 0.22, total / MAX_SAMPLES);
  const count = Math.min(MAX_SAMPLES, Math.max(2, Math.ceil(total / step) + 1));
  step = total / (count - 1);

  const out: Sample[] = [];
  let seg = 0;
  const wob = rng(stroke.seed || 1);
  const wobPhase = wob() * 100;
  for (let i = 0; i < count; i++) {
    const d = i * step;
    while (seg < n - 2 && lengths[seg + 1] < d) seg++;
    const span = lengths[seg + 1] - lengths[seg] || 1e-6;
    const t = clamp01((d - lengths[seg]) / span);
    const p = pos[seg].clone().lerp(pos[seg + 1], t);
    let w = rawW[seg] * (1 - t) + rawW[seg + 1] * t;
    const a = rawA[seg] * (1 - t) + rawA[seg + 1] * t;

    // Organic width wobble for chalk and wash brushes.
    if (brush.wobble > 0) {
      const f = Math.sin(d / (stroke.size * 1.7) + wobPhase) * 0.5 + Math.sin(d / (stroke.size * 0.6) + wobPhase * 2) * 0.5;
      w *= 1 + brush.wobble * f * 0.5;
    }

    // End taper.
    if (brush.taper > 0) {
      const tl = Math.min(total * 0.45, stroke.size * (0.6 + brush.taper * 3.2));
      const head = smoothstep(d / (tl || 1e-6));
      const tail = smoothstep((total - d) / (tl || 1e-6));
      const k = Math.min(head, tail);
      w *= 1 - brush.taper + brush.taper * k;
    }
    out.push({ p, w: Math.max(w, stroke.size * 0.012), a });
  }
  return out;
}

/* -------------------------------------------------------------- assembly */

class Builder {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  alp: number[] = [];
  idx: number[] = [];
  private r = 0;
  private g = 0;
  private bl = 0;

  setColor(c: THREE.Color) {
    this.r = c.r;
    this.g = c.g;
    this.bl = c.b;
  }

  vert(p: THREE.Vector3, n: THREE.Vector3, u: number, v: number, a: number): number {
    const i = this.pos.length / 3;
    this.pos.push(p.x, p.y, p.z);
    this.nrm.push(n.x, n.y, n.z);
    this.uv.push(u, v);
    this.col.push(this.r, this.g, this.bl);
    this.alp.push(a);
    return i;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number) {
    this.idx.push(a, b, c, a, c, d);
  }

  done(): GeoData {
    return {
      position: new Float32Array(this.pos),
      normal: new Float32Array(this.nrm),
      uv: new Float32Array(this.uv),
      color: new Float32Array(this.col),
      alpha: new Float32Array(this.alp),
      index: new Uint32Array(this.idx),
    };
  }
}

const _t = new THREE.Vector3();
const _s = new THREE.Vector3();
const _n = new THREE.Vector3();
const _tmp = new THREE.Vector3();

function tangentAt(s: Sample[], i: number, out: THREE.Vector3): THREE.Vector3 {
  const a = s[Math.max(0, i - 1)].p;
  const b = s[Math.min(s.length - 1, i + 1)].p;
  out.subVectors(b, a);
  if (out.lengthSq() < 1e-12) out.set(0, 0, 1);
  return out.normalize();
}

/** Any unit vector perpendicular to `v`. */
function perp(v: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  _tmp.set(ax < ay && ax < az ? 1 : 0, ay <= az && ay <= ax ? 1 : 0, az < ax && az < ay ? 1 : 0);
  if (_tmp.lengthSq() < 0.5) _tmp.set(1, 0, 0);
  return out.crossVectors(v, _tmp).normalize();
}

/* ---------------------------------------------------------------- ribbons */

function buildRibbon(s: Sample[], normal: THREE.Vector3, sizeRef: number, bld: Builder) {
  const rows: number[][] = [];
  let arc = 0;
  for (let i = 0; i < s.length; i++) {
    if (i > 0) arc += s[i].p.distanceTo(s[i - 1].p);
    tangentAt(s, i, _t);
    _s.crossVectors(_t, normal);
    if (_s.lengthSq() < 1e-10) perp(_t, _s);
    else _s.normalize();
    const u = arc / sizeRef;
    const a = s[i].a;
    const v0 = bld.vert(_tmp.copy(s[i].p).addScaledVector(_s, -s[i].w), normal, u, 0, a);
    const v1 = bld.vert(_tmp.copy(s[i].p).addScaledVector(_s, s[i].w), normal, u, 1, a);
    rows.push([v0, v1]);
  }
  for (let i = 0; i < rows.length - 1; i++) {
    bld.quad(rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]);
  }
}

/* ------------------------------------------------------------------ tubes */

function buildTube(s: Sample[], sides: number, sizeRef: number, bld: Builder) {
  if (s.length < 2) return;
  const rings: number[][] = [];
  let arc = 0;

  // Parallel-transport frame: stops the tube from spinning around its own axis.
  tangentAt(s, 0, _t);
  const nrm = perp(_t, new THREE.Vector3());
  const bin = new THREE.Vector3();
  const prevT = _t.clone();

  for (let i = 0; i < s.length; i++) {
    if (i > 0) arc += s[i].p.distanceTo(s[i - 1].p);
    tangentAt(s, i, _t);
    // rotate the previous normal to stay perpendicular to the new tangent
    nrm.addScaledVector(_t, -nrm.dot(_t));
    if (nrm.lengthSq() < 1e-10) perp(_t, nrm);
    else nrm.normalize();
    bin.crossVectors(_t, nrm).normalize();
    prevT.copy(_t);

    const u = arc / sizeRef;
    const ring: number[] = [];
    for (let k = 0; k <= sides; k++) {
      const ang = (k / sides) * Math.PI * 2;
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      _n.copy(nrm).multiplyScalar(cx).addScaledVector(bin, cy).normalize();
      _tmp.copy(s[i].p).addScaledVector(_n, s[i].w);
      ring.push(bld.vert(_tmp, _n, u, k / sides, s[i].a));
    }
    rings.push(ring);
  }

  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      bld.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k + 1], rings[i][k + 1]);
    }
  }

  // Flat caps, so blunt brushes do not look hollow from the end.
  const cap = (ringIdx: number, dir: number) => {
    const ring = rings[ringIdx];
    tangentAt(s, ringIdx, _t).multiplyScalar(dir);
    const centre = bld.vert(s[ringIdx].p, _t, 0.5, 0.5, s[ringIdx].a);
    for (let k = 0; k < sides; k++) {
      const a = ring[k];
      const b = ring[k + 1];
      if (dir > 0) bld.tri(centre, b, a);
      else bld.tri(centre, a, b);
    }
  };
  cap(0, -1);
  cap(rings.length - 1, 1);
}

/* ------------------------------------------------------------ spray dabs */

function buildSpray(s: Sample[], brush: Brush, normal: THREE.Vector3, stroke: Stroke, bld: Builder) {
  const rand = rng(stroke.seed || 7);
  const step = Math.max(stroke.size * brush.spacing, stroke.size * 0.04);
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  let acc = 0;
  let arcPrev = 0;

  for (let i = 0; i < s.length; i++) {
    if (i > 0) arcPrev = s[i].p.distanceTo(s[i - 1].p);
    acc += i === 0 ? step : arcPrev;
    while (acc >= step) {
      acc -= step;
      tangentAt(s, i, _t);
      right.crossVectors(_t, normal);
      if (right.lengthSq() < 1e-10) perp(_t, right);
      else right.normalize();
      up.crossVectors(right, normal).normalize();

      const jr = (rand() - 0.5) * 2 * brush.jitter * stroke.size;
      const ju = (rand() - 0.5) * 2 * brush.jitter * stroke.size;
      const centre = _tmp.clone().copy(s[i].p).addScaledVector(right, jr).addScaledVector(up, ju);

      const scale = s[i].w * (1 + (rand() - 0.5) * brush.scatter);
      const ang = rand() * Math.PI * 2 * (brush.scatter > 0 ? 1 : 0);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const ex = new THREE.Vector3().addScaledVector(right, ca * scale).addScaledVector(up, sa * scale);
      const ey = new THREE.Vector3().addScaledVector(right, -sa * scale).addScaledVector(up, ca * scale);

      const a = s[i].a;
      const p0 = bld.vert(_n.copy(centre).sub(ex).sub(ey), normal, 0, 0, a);
      const p1 = bld.vert(_n.copy(centre).add(ex).sub(ey), normal, 1, 0, a);
      const p2 = bld.vert(_n.copy(centre).add(ex).add(ey), normal, 1, 1, a);
      const p3 = bld.vert(_n.copy(centre).sub(ex).add(ey), normal, 0, 1, a);
      bld.quad(p0, p1, p2, p3);
    }
  }
}

/* ------------------------------------------------------------ hatch dashes */

function buildHatch(s: Sample[], brush: Brush, normal: THREE.Vector3, stroke: Stroke, bld: Builder) {
  const rand = rng(stroke.seed || 13);
  const step = Math.max(stroke.size * brush.spacing * 2, stroke.size * 0.08);
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
  let acc = 0;

  for (let i = 1; i < s.length; i++) {
    acc += s[i].p.distanceTo(s[i - 1].p);
    while (acc >= step) {
      acc -= step;
      tangentAt(s, i, _t);
      const base = _t.clone();
      const ang = Math.PI / 2 + (rand() - 0.5) * 2 * brush.scatter * Math.PI;
      // rotate the tangent around the plane normal
      dir.copy(base).applyAxisAngle(normal, ang).normalize();
      side.crossVectors(dir, normal).normalize();

      const len = stroke.size * 2.6 * (0.6 + rand() * 0.8);
      const halfW = s[i].w * 0.42;
      const off = (rand() - 0.5) * 2 * brush.jitter * stroke.size;
      const c = s[i].p.clone().addScaledVector(side, off);
      const a0 = c.clone().addScaledVector(dir, -len / 2);
      const a1 = c.clone().addScaledVector(dir, len / 2);
      const a = s[i].a * (0.6 + rand() * 0.5);

      const v0 = bld.vert(_tmp.copy(a0).addScaledVector(side, -halfW), normal, 0, 0, a * 0.3);
      const v1 = bld.vert(_tmp.copy(a0).addScaledVector(side, halfW), normal, 0, 1, a * 0.3);
      const v2 = bld.vert(_tmp.copy(a1).addScaledVector(side, halfW), normal, len / (stroke.size * 2), 1, a * 0.3);
      const v3 = bld.vert(_tmp.copy(a1).addScaledVector(side, -halfW), normal, len / (stroke.size * 2), 0, a * 0.3);
      bld.quad(v0, v3, v2, v1);
    }
  }
}

/* -------------------------------------------------------------------- api */

const _color = new THREE.Color();

export function buildStroke(stroke: Stroke, brush: Brush): GeoData {
  const s = prepare(stroke, brush);
  if (s.length < 1) return EMPTY_GEO;

  const bld = new Builder();
  bld.setColor(_color.set(stroke.color));
  const normal = new THREE.Vector3(stroke.normal[0], stroke.normal[1], stroke.normal[2]);
  if (normal.lengthSq() < 1e-9) normal.set(0, 0, 1);
  normal.normalize();
  const sizeRef = Math.max(stroke.size * 2, 1e-5);

  switch (brush.geom) {
    case "tube":
      if (s.length < 2) return EMPTY_GEO;
      buildTube(s, Math.max(3, brush.tubeSides), sizeRef, bld);
      break;
    case "spray":
      buildSpray(s, brush, normal, stroke, bld);
      break;
    case "hatch":
      if (s.length < 2) return EMPTY_GEO;
      buildHatch(s, brush, normal, stroke, bld);
      break;
    case "ribbon":
    default:
      if (s.length < 2) return EMPTY_GEO;
      buildRibbon(s, normal, sizeRef, bld);
      break;
  }
  return bld.done();
}

export function geoToBufferGeometry(g: GeoData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(g.position, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(g.normal, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(g.uv, 2));
  geo.setAttribute("aColor", new THREE.BufferAttribute(g.color, 3));
  geo.setAttribute("aAlpha", new THREE.BufferAttribute(g.alpha, 1));
  geo.setIndex(new THREE.BufferAttribute(g.index, 1));
  geo.computeBoundingSphere();
  return geo;
}

export function strokeBounds(stroke: Stroke): THREE.Box3 {
  const box = new THREE.Box3();
  const n = Math.floor(stroke.pts.length / 4);
  for (let i = 0; i < n; i++) {
    _tmp.set(stroke.pts[i * 4], stroke.pts[i * 4 + 1], stroke.pts[i * 4 + 2]);
    box.expandByPoint(_tmp);
  }
  box.expandByScalar(stroke.size * 0.6);
  return box;
}

export function strokePoints(stroke: Stroke): Vec3[] {
  const out: Vec3[] = [];
  const n = Math.floor(stroke.pts.length / 4);
  for (let i = 0; i < n; i++) {
    out.push([stroke.pts[i * 4], stroke.pts[i * 4 + 1], stroke.pts[i * 4 + 2]]);
  }
  return out;
}

import * as THREE from "three";
import type { PlaneState, Vec3 } from "../types";

/**
 * The construction plane. A 2D pointer only gives two numbers; the plane
 * supplies the third. Everything about "sketch flat, then pull it up" hangs off
 * this basis.
 */

export interface Basis {
  origin: THREE.Vector3;
  x: THREE.Vector3;
  y: THREE.Vector3;
  n: THREE.Vector3;
}

const PRESETS: Record<string, [Vec3, Vec3, Vec3]> = {
  // [x axis, y axis, normal]
  ground: [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  front: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  side: [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
};

export function planeBasis(plane: PlaneState): Basis {
  const base = PRESETS[plane.preset] ?? PRESETS.front;
  const x = new THREE.Vector3(...base[0]);
  const y = new THREE.Vector3(...base[1]);
  const n = new THREE.Vector3(...base[2]);
  if (plane.preset === "custom" || plane.rot.some((r) => r !== 0)) {
    const e = new THREE.Euler(plane.rot[0], plane.rot[1], plane.rot[2], "XYZ");
    x.applyEuler(e);
    y.applyEuler(e);
    n.applyEuler(e);
  }
  const origin = n.clone().multiplyScalar(plane.offset);
  return { origin, x: x.normalize(), y: y.normalize(), n: n.normalize() };
}

export function planeToWorld(b: Basis, u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  return out.copy(b.origin).addScaledVector(b.x, u).addScaledVector(b.y, v);
}

const _d = new THREE.Vector3();

export function worldToPlane(b: Basis, p: THREE.Vector3): [number, number] {
  _d.subVectors(p, b.origin);
  return [_d.dot(b.x), _d.dot(b.y)];
}

/** Where a ray meets the plane, or null if it runs parallel / behind. */
export function rayToPlane(ray: THREE.Ray, b: Basis, out = new THREE.Vector3()): THREE.Vector3 | null {
  const denom = b.n.dot(ray.direction);
  if (Math.abs(denom) < 1e-7) return null;
  const t = _d.subVectors(b.origin, ray.origin).dot(b.n) / denom;
  if (t < 0) return null;
  return out.copy(ray.origin).addScaledVector(ray.direction, t);
}

export function snapToGrid(b: Basis, p: THREE.Vector3, step: number, out = new THREE.Vector3()): THREE.Vector3 {
  const [u, v] = worldToPlane(b, p);
  return planeToWorld(b, Math.round(u / step) * step, Math.round(v / step) * step, out);
}

/* ------------------------------------------------------------------ visual */

const gridVert = /* glsl */ `
attribute float aFade;
varying float vFade;
void main() {
  vFade = aFade;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const gridFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vFade;
void main() {
  float a = vFade * uOpacity;
  if (a < 0.002) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const fillVert = /* glsl */ `
varying vec2 vP;
void main() {
  vP = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fillFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vP;
void main() {
  float a = smoothstep(1.0, 0.1, length(vP)) * uOpacity;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface PlaneVisual {
  group: THREE.Group;
  update(plane: PlaneState, accent: string): void;
  dispose(): void;
}

export function createPlaneVisual(): PlaneVisual {
  const group = new THREE.Group();

  const fillMat = new THREE.ShaderMaterial({
    vertexShader: fillVert,
    fragmentShader: fillFrag,
    uniforms: { uColor: { value: new THREE.Color("#4FE3DC") }, uOpacity: { value: 0.035 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fillMat);
  group.add(fill);

  const gridMat = new THREE.ShaderMaterial({
    vertexShader: gridVert,
    fragmentShader: gridFrag,
    uniforms: { uColor: { value: new THREE.Color("#4FE3DC") }, uOpacity: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
  });
  const gridGeo = new THREE.BufferGeometry();
  const grid = new THREE.LineSegments(gridGeo, gridMat);
  group.add(grid);

  const axisMat = new THREE.ShaderMaterial({
    vertexShader: gridVert,
    fragmentShader: gridFrag,
    uniforms: { uColor: { value: new THREE.Color("#1F5FD0") }, uOpacity: { value: 0.6 } },
    transparent: true,
    depthWrite: false,
  });
  const axisGeo = new THREE.BufferGeometry();
  const axes = new THREE.LineSegments(axisGeo, axisMat);
  group.add(axes);

  let lastKey = "";

  const rebuild = (size: number, step: number) => {
    const half = size / 2;
    const lines = Math.floor(size / step);
    const pos: number[] = [];
    const fade: number[] = [];
    const push = (x0: number, y0: number, x1: number, y1: number, f0: number, f1: number) => {
      pos.push(x0, y0, 0, x1, y1, 0);
      fade.push(f0, f1);
    };
    const falloff = (d: number) => Math.max(0, 1 - Math.pow(Math.abs(d) / half, 1.7));
    for (let i = 0; i <= lines; i++) {
      const t = -half + i * step;
      if (Math.abs(t) < step * 0.01) continue; // the centre lines are the axes
      const f = falloff(t);
      // Lines get shorter near the edge so the grid dissolves rather than stopping.
      const reach = half * (0.35 + 0.65 * f);
      push(t, -reach, t, reach, f * 0.9, f * 0.9);
      push(-reach, t, reach, t, f * 0.9, f * 0.9);
    }
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    gridGeo.setAttribute("aFade", new THREE.Float32BufferAttribute(fade, 1));

    const ap: number[] = [];
    const af: number[] = [];
    const n = 48;
    for (let i = 0; i < n; i++) {
      const a = -half + (i / n) * size;
      const b = -half + ((i + 1) / n) * size;
      ap.push(a, 0, 0, b, 0, 0);
      af.push(falloff(a), falloff(b));
      ap.push(0, a, 0, 0, b, 0);
      af.push(falloff(a), falloff(b));
    }
    axisGeo.setAttribute("position", new THREE.Float32BufferAttribute(ap, 3));
    axisGeo.setAttribute("aFade", new THREE.Float32BufferAttribute(af, 1));

    fill.geometry.dispose();
    fill.geometry = new THREE.PlaneGeometry(size, size);
  };

  return {
    group,
    update(plane, accent) {
      group.visible = plane.visible;
      if (!plane.visible) return;
      const b = planeBasis(plane);
      const m = new THREE.Matrix4().makeBasis(b.x, b.y, b.n);
      group.quaternion.setFromRotationMatrix(m);
      group.position.copy(b.origin);
      const key = `${plane.size}:${plane.grid}`;
      if (key !== lastKey) {
        rebuild(plane.size, Math.max(plane.size / 200, plane.grid));
        lastKey = key;
      }
      gridMat.uniforms.uColor.value.set(accent);
      fillMat.uniforms.uColor.value.set(accent);
    },
    dispose() {
      gridGeo.dispose();
      axisGeo.dispose();
      fill.geometry.dispose();
      gridMat.dispose();
      axisMat.dispose();
      fillMat.dispose();
    },
  };
}

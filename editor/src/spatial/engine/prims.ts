import * as THREE from "three";
import type { Prim, PrimKind, SolidShade } from "../types";

/**
 * The starting mesh set — the same primitives any 3D tool opens with. They give
 * a sketch something solid to build against before a single stroke is drawn.
 */

export interface PrimSpec {
  id: PrimKind;
  name: string;
  /** Sensible default size in metres. */
  size: [number, number, number];
  detail: number;
  minDetail: number;
  maxDetail: number;
  detailLabel: string;
}

export const PRIMS: PrimSpec[] = [
  { id: "cube", name: "Cube", size: [0.5, 0.5, 0.5], detail: 1, minDetail: 1, maxDetail: 12, detailLabel: "Subdivisions" },
  { id: "sphere", name: "UV Sphere", size: [0.3, 0.3, 0.3], detail: 24, minDetail: 4, maxDetail: 64, detailLabel: "Segments" },
  { id: "icosphere", name: "Ico Sphere", size: [0.3, 0.3, 0.3], detail: 2, minDetail: 0, maxDetail: 4, detailLabel: "Subdivisions" },
  { id: "cylinder", name: "Cylinder", size: [0.25, 0.6, 0.25], detail: 24, minDetail: 3, maxDetail: 64, detailLabel: "Sides" },
  { id: "cone", name: "Cone", size: [0.3, 0.6, 0.3], detail: 24, minDetail: 3, maxDetail: 64, detailLabel: "Sides" },
  { id: "torus", name: "Torus", size: [0.4, 0.14, 0.4], detail: 24, minDetail: 4, maxDetail: 64, detailLabel: "Segments" },
  { id: "plane", name: "Plane", size: [0.6, 0.6, 1], detail: 1, minDetail: 1, maxDetail: 24, detailLabel: "Subdivisions" },
  { id: "capsule", name: "Capsule", size: [0.2, 0.6, 0.2], detail: 16, minDetail: 4, maxDetail: 48, detailLabel: "Segments" },
  { id: "torusknot", name: "Torus Knot", size: [0.34, 0.1, 0.34], detail: 64, minDetail: 16, maxDetail: 160, detailLabel: "Segments" },
  { id: "tube", name: "Tube", size: [0.3, 0.6, 0.3], detail: 24, minDetail: 3, maxDetail: 64, detailLabel: "Sides" },
];

export const primSpec = (k: PrimKind): PrimSpec => PRIMS.find((p) => p.id === k) ?? PRIMS[0];

/**
 * Geometry is built at the primitive's natural size and then scaled by the
 * object, so changing scale never has to rebuild anything.
 */
export function buildPrimGeometry(prim: PrimKind, detail: number): THREE.BufferGeometry {
  const d = Math.max(1, Math.round(detail));
  switch (prim) {
    case "sphere":
      return new THREE.SphereGeometry(1, Math.max(4, d), Math.max(3, Math.round(d / 2)));
    case "icosphere":
      return new THREE.IcosahedronGeometry(1, Math.min(4, Math.max(0, Math.round(detail))));
    case "cylinder":
      return new THREE.CylinderGeometry(1, 1, 2, Math.max(3, d), 1);
    case "cone":
      return new THREE.ConeGeometry(1, 2, Math.max(3, d), 1);
    case "torus":
      return new THREE.TorusGeometry(1, 0.38, Math.max(4, Math.round(d / 2)), Math.max(6, d));
    case "plane":
      return new THREE.PlaneGeometry(2, 2, d, d);
    case "capsule":
      return new THREE.CapsuleGeometry(1, 1.4, Math.max(2, Math.round(d / 3)), Math.max(6, d));
    case "torusknot":
      return new THREE.TorusKnotGeometry(1, 0.32, Math.max(16, d), Math.max(6, Math.round(d / 6)));
    case "tube":
      // An open cylinder: a rolled sheet rather than a solid.
      return new THREE.CylinderGeometry(1, 1, 2, Math.max(3, d), 1, true);
    case "cube":
    default:
      return new THREE.BoxGeometry(1, 1, 1, d, d, d);
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Primitives of the same kind and detail share one geometry. */
export function primGeometry(prim: PrimKind, detail: number, faceted: boolean): THREE.BufferGeometry {
  const key = `${prim}:${Math.round(detail)}:${faceted ? 1 : 0}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  let geo = buildPrimGeometry(prim, detail);
  if (faceted) {
    geo = geo.toNonIndexed();
    geo.computeVertexNormals();
  }
  geoCache.set(key, geo);
  return geo;
}

export function makePrimMaterial(
  shade: SolidShade,
  color: string,
  opacity: number,
  env: THREE.Texture | null,
  faceted: boolean
): THREE.Material {
  const base = {
    color: new THREE.Color(color),
    transparent: opacity < 0.999,
    opacity,
    side: THREE.DoubleSide as THREE.Side,
    flatShading: faceted,
  };
  switch (shade) {
    case "flat":
      return new THREE.MeshBasicMaterial({ ...base });
    case "metal":
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.24, metalness: 1, envMap: env, envMapIntensity: 0.9 });
    case "glossy":
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.18, metalness: 0.1, envMap: env, envMapIntensity: 0.5 });
    case "glass":
      return new THREE.MeshPhysicalMaterial({
        ...base,
        transparent: true,
        opacity: Math.min(opacity, 0.98),
        roughness: 0.05,
        transmission: 0.92,
        thickness: 0.4,
        ior: 1.45,
        envMap: env,
        envMapIntensity: 0.6,
      });
    case "matte":
    default:
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.85, metalness: 0, envMap: env, envMapIntensity: 0.35 });
  }
}

export function applyTransform(obj: THREE.Object3D, pos: number[], rot: number[], scale: number[]) {
  obj.position.set(pos[0], pos[1], pos[2]);
  obj.rotation.set(rot[0], rot[1], rot[2]);
  obj.scale.set(scale[0] || 1e-4, scale[1] || 1e-4, scale[2] || 1e-4);
  obj.updateMatrixWorld();
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

export function primBounds(p: Prim): THREE.Box3 {
  const geo = primGeometry(p.prim, p.detail, p.faceted);
  if (!geo.boundingBox) geo.computeBoundingBox();
  _box.copy(geo.boundingBox!);
  const m = new THREE.Matrix4().compose(
    _v.set(...p.pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot)),
    new THREE.Vector3(...p.scale)
  );
  return _box.clone().applyMatrix4(m);
}

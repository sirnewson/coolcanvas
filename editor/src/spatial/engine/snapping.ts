import * as THREE from "three";
import type { Basis } from "./plane";
import { planeToWorld, worldToPlane } from "./plane";
import type { SceneObject } from "../types";

export type SnapKind = "endpoint" | "midpoint" | "intersection" | "grid" | "axis" | "parallel";

export interface SnapResult {
  point: THREE.Vector3;
  kind: SnapKind;
  targetId?: string;
  guideFrom?: THREE.Vector3;
  guideTo?: THREE.Vector3;
}

/**
 * Smart Snapping for 3D sketching.
 * Snaps to endpoints, midpoints, grid points, and cardinal axes.
 */
export function findSnap(
  rawPt: THREE.Vector3,
  basis: Basis,
  objects: SceneObject[],
  gridStep: number,
  gridSnapEnabled: boolean,
  thresholdWorld = 0.12
): SnapResult | null {
  let closestDist = thresholdWorld;
  let result: SnapResult | null = null;
  const p = rawPt;

  // 1. Check endpoints and midpoints of existing strokes
  for (const obj of objects) {
    if (obj.kind !== "stroke") continue;
    const pts = obj.pts;
    const n = Math.floor(pts.length / 4);
    if (n < 2) continue;

    // Start endpoint
    const startPt = new THREE.Vector3(pts[0], pts[1], pts[2]);
    const dStart = p.distanceTo(startPt);
    if (dStart < closestDist) {
      closestDist = dStart;
      result = { point: startPt.clone(), kind: "endpoint", targetId: obj.id };
    }

    // End endpoint
    const endIdx = (n - 1) * 4;
    const endPt = new THREE.Vector3(pts[endIdx], pts[endIdx + 1], pts[endIdx + 2]);
    const dEnd = p.distanceTo(endPt);
    if (dEnd < closestDist) {
      closestDist = dEnd;
      result = { point: endPt.clone(), kind: "endpoint", targetId: obj.id };
    }

    // Midpoint
    const midIdx = Math.floor(n / 2) * 4;
    const midPt = new THREE.Vector3(pts[midIdx], pts[midIdx + 1], pts[midIdx + 2]);
    const dMid = p.distanceTo(midPt);
    if (dMid < closestDist) {
      closestDist = dMid;
      result = { point: midPt.clone(), kind: "midpoint", targetId: obj.id };
    }
  }

  if (result) return result;

  // 2. Snap to Plane Cardinal Axes (U=0 or V=0)
  const [u, v] = worldToPlane(basis, p);
  const axisTol = thresholdWorld * 0.75;
  if (Math.abs(u) < axisTol) {
    const snapped = planeToWorld(basis, 0, v);
    return {
      point: snapped,
      kind: "axis",
      guideFrom: planeToWorld(basis, 0, -20),
      guideTo: planeToWorld(basis, 0, 20),
    };
  }
  if (Math.abs(v) < axisTol) {
    const snapped = planeToWorld(basis, u, 0);
    return {
      point: snapped,
      kind: "axis",
      guideFrom: planeToWorld(basis, -20, 0),
      guideTo: planeToWorld(basis, 20, 0),
    };
  }

  // 3. Snap to Grid intersections if enabled
  if (gridSnapEnabled && gridStep > 0) {
    const snappedU = Math.round(u / gridStep) * gridStep;
    const snappedV = Math.round(v / gridStep) * gridStep;
    const gridPt = planeToWorld(basis, snappedU, snappedV);
    const dGrid = p.distanceTo(gridPt);
    if (dGrid < thresholdWorld * 0.8) {
      return { point: gridPt, kind: "grid" };
    }
  }

  return null;
}

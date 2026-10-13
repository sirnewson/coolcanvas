import * as THREE from "three";
import type { SceneObject } from "../types";
import { strokeBounds } from "./geometry";
import { solidBounds } from "./solids";
import { primBounds } from "./prims";
import { flatBounds } from "./flats";

/**
 * World-space extent of any object. Models are the one kind whose size is only
 * known once the file has loaded, so the engine measures those from the scene
 * and this falls back to their placement.
 */
export function objectBounds(o: SceneObject): THREE.Box3 {
  switch (o.kind) {
    case "stroke":
      return strokeBounds(o);
    case "solid":
      return solidBounds(o);
    case "prim":
      return primBounds(o);
    case "flat":
      return flatBounds(o);
    case "model": {
      const c = new THREE.Vector3(...o.pos);
      const r = Math.max(o.scale[0], o.scale[1], o.scale[2]) * 1.1;
      return new THREE.Box3(
        c.clone().add(new THREE.Vector3(-r, 0, -r)),
        c.clone().add(new THREE.Vector3(r, r * 2, r))
      );
    }
    case "camera":
    case "light": {
      const c = new THREE.Vector3(...o.pos);
      return new THREE.Box3(
        c.clone().subScalar(0.25),
        c.clone().addScalar(0.25)
      );
    }
    case "guide": {
      const c = new THREE.Vector3(...o.pos);
      const b = new THREE.Box3().setFromCenterAndSize(c, new THREE.Vector3(0.3, 0.3, 0.3));
      if (o.to) b.expandByPoint(new THREE.Vector3(...o.to));
      return b;
    }
    default:
      return new THREE.Box3();
  }
}

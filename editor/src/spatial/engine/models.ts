import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelObj, SolidShade } from "../types";
import { getAssetBlobUrl } from "../persist/idb";

/**
 * Reference models and scene assets.
 */

export interface ModelSpec {
  id: string;
  name: string;
  blurb: string;
  url: string;
  /** Imported files use wildly different units; normalise to this height in metres. */
  targetHeight: number;
}

export const BUILTIN_MODELS: ModelSpec[] = [
  {
    id: "builtin:mannequin",
    name: "Mannequin",
    blurb: "A figure in T-pose. Drop it in for scale.",
    url: "/models/mannequin.fbx",
    targetHeight: 1.8,
  },
];

const cache = new Map<string, Promise<THREE.Group>>();
/** Object URLs for user imports, kept alive for the session. */
const imported = new Map<string, string>();

export function registerImport(key: string, file: File): string {
  const url = URL.createObjectURL(file);
  imported.set(key, url);
  return url;
}

export async function resolveModelUrl(src: string): Promise<string | null> {
  const builtin = BUILTIN_MODELS.find((m) => m.id === src);
  if (builtin) return builtin.url;
  const inMem = imported.get(src);
  if (inMem) return inMem;
  if (src.startsWith("blob:") || src.startsWith("/")) return src;
  if (src.startsWith("asset:")) {
    const assetId = src.slice("asset:".length);
    const idbUrl = await getAssetBlobUrl(assetId);
    if (idbUrl) return idbUrl;
  }
  // Try directly as asset ID
  const directIdb = await getAssetBlobUrl(src);
  if (directIdb) return directIdb;
  return null;
}

function loaderFor(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".fbx")) return new FBXLoader();
  if (clean.endsWith(".obj")) return new OBJLoader();
  return new GLTFLoader();
}

/**
 * Centre on the origin, optionally stand on the ground, and scale only if requested.
 */
function normalise(root: THREE.Object3D, targetHeight: number, preserveScale = true): THREE.Group {
  const inner = new THREE.Group();
  inner.add(root);
  const outer = new THREE.Group();
  outer.add(inner);

  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return outer;
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const height = size.y || Math.max(size.x, size.z) || 1;

  root.position.sub(centre);           // centre it
  root.position.y += size.y / 2;       // stand on ground

  if (!preserveScale && targetHeight > 0) {
    inner.scale.setScalar(targetHeight / height);
  } else {
    inner.scale.setScalar(1);
  }
  outer.updateMatrixWorld(true);
  return outer;
}

export async function loadModel(src: string, targetHeight = 1.8, preserveScale = true): Promise<THREE.Group> {
  const key = `${src}@${targetHeight}@${preserveScale}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = await resolveModelUrl(src);
  if (!url) return Promise.reject(new Error(`No source for ${src}`));

  const spec = BUILTIN_MODELS.find((m) => m.id === src);
  const height = spec ? spec.targetHeight : targetHeight;
  const shouldPreserve = spec ? false : preserveScale;

  const p = new Promise<THREE.Group>((resolve, reject) => {
    const loader = loaderFor(url);
    loader.load(
      url,
      (result: unknown) => {
        const root =
          (result as { scene?: THREE.Group }).scene ?? (result as THREE.Group);
        resolve(normalise(root as THREE.Object3D, height, shouldPreserve));
      },
      undefined,
      (err) => reject(err)
    );
  });
  cache.set(key, p);
  // A failed load must not poison the cache for a later retry.
  p.catch(() => cache.delete(key));
  return p;
}

/**
 * Clones the model using SkeletonUtils.clone so skinned meshes and bone bindings
 * are independent for each instance.
 */
export function instantiate(source: THREE.Group, obj: ModelObj, env: THREE.Texture | null): THREE.Group {
  const clone = (SkeletonUtils.clone(source) as THREE.Group) || source.clone(true);
  clone.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = obj.id;
    mesh.material = obj.color === null
      ? cloneOriginal(mesh.material, obj.opacity, obj.wire)
      : overrideMaterial(obj.shade, obj.color, obj.opacity, obj.wire, env);
  });
  return clone;
}

function cloneOriginal(mat: THREE.Material | THREE.Material[], opacity: number, wire: boolean): THREE.Material | THREE.Material[] {
  const one = (m: THREE.Material) => {
    const c = m.clone();
    c.transparent = opacity < 0.999 || c.transparent;
    c.opacity = Math.min(c.opacity ?? 1, opacity);
    (c as THREE.MeshStandardMaterial).wireframe = wire;
    return c;
  };
  return Array.isArray(mat) ? mat.map(one) : one(mat);
}

function overrideMaterial(
  shade: SolidShade, color: string, opacity: number, wire: boolean, env: THREE.Texture | null
): THREE.Material {
  const base = {
    color: new THREE.Color(color),
    transparent: opacity < 0.999,
    opacity,
    wireframe: wire,
  };
  switch (shade) {
    case "flat":
      return new THREE.MeshBasicMaterial(base);
    case "metal":
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.25, metalness: 1, envMap: env, envMapIntensity: 0.9 });
    case "glossy":
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.2, metalness: 0.1, envMap: env, envMapIntensity: 0.5 });
    case "glass":
      return new THREE.MeshPhysicalMaterial({
        ...base, transparent: true, roughness: 0.06, transmission: 0.9, thickness: 0.4, envMap: env, envMapIntensity: 0.6,
      });
    case "matte":
    default:
      return new THREE.MeshStandardMaterial({ ...base, roughness: 0.85, metalness: 0, envMap: env, envMapIntensity: 0.35 });
  }
}

export function disposeInstance(group: THREE.Object3D) {
  group.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Geometry belongs to the shared source; only the cloned materials are ours.
    const m = mesh.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

export const MODEL_EXTENSIONS = ".fbx,.glb,.gltf,.obj";


/* ------------------------------------------------------------------ posing */

/**
 * The joints a person actually poses. A Mixamo rig carries 129 bones, most of
 * them finger segments; offering all of them would bury the shoulder in a list
 * of knuckles.
 */
export const POSE_BONES: { id: string; label: string; group: string }[] = [
  { id: "Hips", label: "Hips", group: "Body" },
  { id: "Spine", label: "Lower back", group: "Body" },
  { id: "Spine1", label: "Mid back", group: "Body" },
  { id: "Spine2", label: "Chest", group: "Body" },
  { id: "Neck", label: "Neck", group: "Body" },
  { id: "Head", label: "Head", group: "Body" },
  { id: "LeftShoulder", label: "L shoulder", group: "Arms" },
  { id: "LeftArm", label: "L upper arm", group: "Arms" },
  { id: "LeftForeArm", label: "L forearm", group: "Arms" },
  { id: "LeftHand", label: "L hand", group: "Arms" },
  { id: "RightShoulder", label: "R shoulder", group: "Arms" },
  { id: "RightArm", label: "R upper arm", group: "Arms" },
  { id: "RightForeArm", label: "R forearm", group: "Arms" },
  { id: "RightHand", label: "R hand", group: "Arms" },
  { id: "LeftUpLeg", label: "L thigh", group: "Legs" },
  { id: "LeftLeg", label: "L shin", group: "Legs" },
  { id: "LeftFoot", label: "L foot", group: "Legs" },
  { id: "RightUpLeg", label: "R thigh", group: "Legs" },
  { id: "RightLeg", label: "R shin", group: "Legs" },
  { id: "RightFoot", label: "R foot", group: "Legs" },
];

const BONE_PREFIXES = ["mixamorig:", "mixamorig", "Armature|", "Bip01_", "Bip01 ", "DEF-", "def_", ""];

const BONE_ALIASES: Record<string, string[]> = {
  Hips: ["hip", "hips", "pelvis", "root", "bip01_pelvis"],
  Spine: ["spine", "spine_01", "spine1", "bip01_spine"],
  Spine1: ["spine_02", "spine2", "chest", "bip01_spine1"],
  Spine2: ["spine_03", "upperchest", "chest2", "bip01_spine2"],
  Neck: ["neck", "neck_01", "bip01_neck"],
  Head: ["head", "bip01_head"],
  LeftShoulder: ["shoulder_l", "clavicle_l", "leftclavicle", "bip01_l_clavicle"],
  LeftArm: ["upperarm_l", "arm_l", "leftupperarm", "bip01_l_upperarm"],
  LeftForeArm: ["lowerarm_l", "forearm_l", "leftlowerarm", "bip01_l_forearm"],
  LeftHand: ["hand_l", "lefthand", "bip01_l_hand"],
  RightShoulder: ["shoulder_r", "clavicle_r", "rightclavicle", "bip01_r_clavicle"],
  RightArm: ["upperarm_r", "arm_r", "rightupperarm", "bip01_r_upperarm"],
  RightForeArm: ["lowerarm_r", "forearm_r", "rightlowerarm", "bip01_r_forearm"],
  RightHand: ["hand_r", "righthand", "bip01_r_hand"],
  LeftUpLeg: ["thigh_l", "upperleg_l", "leftthigh", "bip01_l_thigh"],
  LeftLeg: ["calf_l", "lowerleg_l", "leftshin", "bip01_l_calf"],
  LeftFoot: ["foot_l", "leftfoot", "bip01_l_foot"],
  RightUpLeg: ["thigh_r", "upperleg_r", "rightthigh", "bip01_r_thigh"],
  RightLeg: ["calf_r", "lowerleg_r", "rightshin", "bip01_r_calf"],
  RightFoot: ["foot_r", "rightfoot", "bip01_r_foot"],
};

/** Rig naming varies by exporter, so match on suffix or common aliases. */
export function findBones(root: THREE.Object3D): Map<string, THREE.Bone> {
  const found = new Map<string, THREE.Bone>();
  root.traverse((o) => {
    const bone = o as THREE.Bone;
    if (!bone.isBone) return;
    const lower = bone.name.toLowerCase();

    for (const spec of POSE_BONES) {
      if (found.has(spec.id)) continue;
      // Direct suffix check
      for (const prefix of BONE_PREFIXES) {
        if (bone.name === prefix + spec.id) {
          found.set(spec.id, bone);
          break;
        }
      }
      if (found.has(spec.id)) continue;
      // Alias check
      const aliases = BONE_ALIASES[spec.id] ?? [];
      for (const alias of aliases) {
        if (lower.endsWith(alias) || lower === alias) {
          found.set(spec.id, bone);
          break;
        }
      }
    }
  });
  return found;
}

export function isRigged(root: THREE.Object3D): boolean {
  let rigged = false;
  root.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) rigged = true;
  });
  return rigged;
}

/** Push a stored pose onto the bones, and reset anything it does not mention. */
export function applyPose(bones: Map<string, THREE.Bone>, pose: Record<string, [number, number, number]> | undefined) {
  for (const [id, bone] of bones) {
    const r = pose?.[id];
    if (r) bone.rotation.set(r[0], r[1], r[2]);
    else if (bone.userData.restRotation) {
      const rest = bone.userData.restRotation as [number, number, number];
      bone.rotation.set(rest[0], rest[1], rest[2]);
    }
  }
}

/** Remember the rest pose once, so "reset" can always get back to it. */
export function captureRest(bones: Map<string, THREE.Bone>) {
  for (const bone of bones.values()) {
    if (!bone.userData.restRotation) {
      bone.userData.restRotation = [bone.rotation.x, bone.rotation.y, bone.rotation.z];
    }
  }
}

/* ------------------------------------------------------------- Pose presets */

export interface PosePreset {
  id: string;
  label: string;
  blurb: string;
  pose: Record<string, [number, number, number]>;
}

export const POSE_PRESETS: PosePreset[] = [
  {
    id: "t_pose",
    label: "T-Pose",
    blurb: "Default rest pose with arms spread wide",
    pose: {
      Hips: [0, 0, 0],
      Spine: [0, 0, 0],
      Spine1: [0, 0, 0],
      Spine2: [0, 0, 0],
      Neck: [0, 0, 0],
      Head: [0, 0, 0],
      LeftShoulder: [0, 0, 0],
      LeftArm: [0, 0, 0],
      LeftForeArm: [0, 0, 0],
      LeftHand: [0, 0, 0],
      RightShoulder: [0, 0, 0],
      RightArm: [0, 0, 0],
      RightForeArm: [0, 0, 0],
      RightHand: [0, 0, 0],
      LeftUpLeg: [0, 0, 0],
      LeftLeg: [0, 0, 0],
      LeftFoot: [0, 0, 0],
      RightUpLeg: [0, 0, 0],
      RightLeg: [0, 0, 0],
      RightFoot: [0, 0, 0],
    },
  },
  {
    id: "standing",
    label: "Standing",
    blurb: "Relaxed natural stance with dropped arms",
    pose: {
      Hips: [0, 0, 0],
      Spine: [0.05, 0, 0],
      Spine1: [0.03, 0, 0],
      Neck: [-0.02, 0, 0],
      Head: [-0.04, 0, 0],
      LeftShoulder: [0, 0, -0.1],
      LeftArm: [0.1, 0, 1.25],
      LeftForeArm: [0, 0, 0.25],
      RightShoulder: [0, 0, 0.1],
      RightArm: [0.1, 0, -1.25],
      RightForeArm: [0, 0, -0.25],
      LeftUpLeg: [0.03, 0, -0.05],
      LeftLeg: [-0.05, 0, 0],
      RightUpLeg: [-0.02, 0, 0.05],
      RightLeg: [0.02, 0, 0],
    },
  },
  {
    id: "sitting",
    label: "Sitting",
    blurb: "Seated with bent knees and thighs forward",
    pose: {
      Hips: [0, 0, 0],
      Spine: [-0.15, 0, 0],
      Spine1: [0.08, 0, 0],
      Neck: [0.05, 0, 0],
      Head: [0.05, 0, 0],
      LeftShoulder: [0, 0, -0.05],
      LeftArm: [0.25, 0, 1.15],
      LeftForeArm: [0.4, 0, 0.5],
      RightShoulder: [0, 0, 0.05],
      RightArm: [0.25, 0, -1.15],
      RightForeArm: [0.4, 0, -0.5],
      LeftUpLeg: [-1.45, 0, -0.08],
      LeftLeg: [1.4, 0, 0],
      LeftFoot: [-0.15, 0, 0],
      RightUpLeg: [-1.45, 0, 0.08],
      RightLeg: [1.4, 0, 0],
      RightFoot: [-0.15, 0, 0],
    },
  },
  {
    id: "walking",
    label: "Walking",
    blurb: "Mid-stride forward motion",
    pose: {
      Hips: [0, 0.1, 0],
      Spine: [0.08, -0.05, 0],
      Spine1: [0.05, -0.05, 0],
      LeftShoulder: [0, 0, -0.05],
      LeftArm: [-0.4, 0, 1.2],
      LeftForeArm: [0.15, 0, 0.4],
      RightShoulder: [0, 0, 0.05],
      RightArm: [0.45, 0, -1.2],
      RightForeArm: [0.25, 0, -0.3],
      LeftUpLeg: [-0.55, 0, 0.02],
      LeftLeg: [0.25, 0, 0],
      LeftFoot: [0.1, 0, 0],
      RightUpLeg: [0.45, 0, -0.02],
      RightLeg: [0.65, 0, 0],
      RightFoot: [-0.2, 0, 0],
    },
  },
  {
    id: "running",
    label: "Running",
    blurb: "High-energy athletic sprint pose",
    pose: {
      Hips: [0.2, 0.15, 0],
      Spine: [0.2, -0.1, 0],
      Spine1: [0.15, -0.08, 0],
      LeftShoulder: [0.1, 0, -0.1],
      LeftArm: [-0.85, 0, 1.1],
      LeftForeArm: [1.1, 0, 0.8],
      RightShoulder: [-0.1, 0, 0.1],
      RightArm: [0.85, 0, -1.1],
      RightForeArm: [1.1, 0, -0.8],
      LeftUpLeg: [-1.15, 0, 0.05],
      LeftLeg: [1.3, 0, 0],
      LeftFoot: [-0.2, 0, 0],
      RightUpLeg: [0.8, 0, -0.05],
      RightLeg: [1.4, 0, 0],
      RightFoot: [-0.4, 0, 0],
    },
  },
  {
    id: "hero",
    label: "Hero / Confident",
    blurb: "Chest forward, hands near hips, confident stance",
    pose: {
      Hips: [0, 0, 0],
      Spine: [-0.08, 0, 0],
      Spine1: [-0.1, 0, 0],
      Spine2: [-0.05, 0, 0],
      Neck: [0.08, 0, 0],
      Head: [0.1, 0, 0],
      LeftShoulder: [0, 0, -0.15],
      LeftArm: [0.2, 0.2, 1.3],
      LeftForeArm: [0.85, 0, 0.9],
      RightShoulder: [0, 0, 0.15],
      RightArm: [0.2, -0.2, -1.3],
      RightForeArm: [0.85, 0, -0.9],
      LeftUpLeg: [0.05, 0, -0.18],
      LeftLeg: [0.05, 0, 0],
      RightUpLeg: [0.05, 0, 0.18],
      RightLeg: [0.05, 0, 0],
    },
  },
  {
    id: "waving",
    label: "Waving",
    blurb: "Friendly greeting with right hand raised",
    pose: {
      Hips: [0, 0, 0],
      Spine: [0.04, 0, 0],
      Neck: [-0.03, 0.1, 0.05],
      Head: [-0.05, 0.1, 0.05],
      LeftArm: [0.1, 0, 1.25],
      LeftForeArm: [0.1, 0, 0.2],
      RightShoulder: [0.1, 0, 0.2],
      RightArm: [-0.3, 0, -2.4],
      RightForeArm: [0.5, 0, -1.4],
      RightHand: [0, 0, -0.3],
      LeftUpLeg: [0.02, 0, -0.05],
      RightUpLeg: [-0.02, 0, 0.05],
    },
  },
];

/** Mirror pose between left and right limbs for symmetrical poses */
export function mirrorPose(pose: Record<string, [number, number, number]>): Record<string, [number, number, number]> {
  const result: Record<string, [number, number, number]> = {};
  const swapPairs: [string, string][] = [
    ["LeftShoulder", "RightShoulder"],
    ["LeftArm", "RightArm"],
    ["LeftForeArm", "RightForeArm"],
    ["LeftHand", "RightHand"],
    ["LeftUpLeg", "RightUpLeg"],
    ["LeftLeg", "RightLeg"],
    ["LeftFoot", "RightFoot"],
  ];

  // Copy non-paired bones (Spine, Hips, Head) with negated Y/Z rotation
  for (const [key, val] of Object.entries(pose)) {
    let paired = false;
    for (const [l, r] of swapPairs) {
      if (key === l || key === r) {
        paired = true;
        break;
      }
    }
    if (!paired) {
      result[key] = [val[0], -val[1], -val[2]];
    }
  }

  // Swap limbs
  for (const [l, r] of swapPairs) {
    if (pose[l]) {
      result[r] = [pose[l][0], -pose[l][1], -pose[l][2]];
    }
    if (pose[r]) {
      result[l] = [pose[r][0], -pose[r][1], -pose[r][2]];
    }
  }

  return result;
}

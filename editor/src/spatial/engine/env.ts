import * as THREE from "three";
import type { EnvPreset, EnvState } from "../types";

/**
 * Scene atmosphere. The single biggest cue that a sketch is in 3D is not the
 * geometry, it is the haze and the horizon behind it, so these presets are as
 * much a drawing tool as the brushes.
 */

export const ENV_PRESETS: Record<EnvPreset, Partial<EnvState>> = {
  void: {
    bgTop: "#0A0D18", bgBottom: "#05070E", fog: 0.25, fogColor: "#0A0D18",
    grid: true, floor: false, bloom: 0.45, bloomThreshold: 0.6, grain: 0.06,
    vignette: 0.35, chroma: 0.12, exposure: 1.1, saturation: 1.05,
    keyIntensity: 0.85, ambient: 0.28, lightAngle: 0.7, shadows: false,
  },
  studio: {
    bgTop: "#232A44", bgBottom: "#12162A", fog: 0.18, fogColor: "#1A2036",
    grid: true, floor: true, bloom: 0.2, bloomThreshold: 0.8, grain: 0.04,
    vignette: 0.28, chroma: 0.05, exposure: 1.0, saturation: 1.0,
    keyIntensity: 1.6, ambient: 0.55, lightAngle: 0.9, shadows: true,
  },
  night: {
    bgTop: "#0B1030", bgBottom: "#03040C", fog: 0.45, fogColor: "#0B1030",
    grid: true, floor: false, bloom: 0.85, bloomThreshold: 0.35, grain: 0.09,
    vignette: 0.5, chroma: 0.22, exposure: 1.2, saturation: 1.15,
    keyIntensity: 0.7, ambient: 0.25, lightAngle: 0.4, shadows: false,
  },
  dusk: {
    bgTop: "#2B1E4A", bgBottom: "#0E0A1C", fog: 0.34, fogColor: "#3A2350",
    grid: true, floor: true, bloom: 0.55, bloomThreshold: 0.55, grain: 0.07,
    vignette: 0.42, chroma: 0.16, exposure: 1.08, saturation: 1.12,
    keyIntensity: 1.3, ambient: 0.4, lightAngle: 0.25, shadows: true,
  },
  paper: {
    // Matches the flat canvas: soft paper ground, cool light, almost no film.
    bgTop: "#FDFEFF", bgBottom: "#C4D6F6", fog: 0.14, fogColor: "#DCE8FC",
    grid: true, floor: true, bloom: 0.04, bloomThreshold: 0.96, grain: 0.03,
    vignette: 0.12, chroma: 0.0, exposure: 1.02, saturation: 1.0,
    keyIntensity: 1.7, ambient: 0.85, lightAngle: 0.8, shadows: true,
  },
  cyclorama: {
    bgTop: "#3A4160", bgBottom: "#20263C", fog: 0.12, fogColor: "#2A3048",
    grid: false, floor: true, bloom: 0.15, bloomThreshold: 0.85, grain: 0.03,
    vignette: 0.22, chroma: 0.03, exposure: 1.0, saturation: 1.0,
    keyIntensity: 1.8, ambient: 0.7, lightAngle: 1.0, shadows: true,
  },
};

export const DEFAULT_ENV: EnvState = {
  preset: "paper",
  ...ENV_PRESETS.paper,
  turntable: 0,
} as EnvState;

export function applyPreset(env: EnvState, preset: EnvPreset): EnvState {
  return { ...env, ...ENV_PRESETS[preset], preset };
}

/* --------------------------------------------------------------- backdrop */

const bgVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const bgFrag = /* glsl */ `
uniform vec3 uTop;
uniform vec3 uBottom;
uniform float uGlowAmount;
uniform vec3 uGlowColor;
varying vec3 vDir;

void main() {
  float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 c = mix(uBottom, uTop, pow(h, 0.85));
  // A soft pool of light behind the subject, so strokes read against something.
  float pool = pow(max(0.0, 1.0 - length(vDir.xy - vec2(-0.15, 0.25))), 3.0);
  c += uGlowColor * pool * uGlowAmount;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Backdrop {
  mesh: THREE.Mesh;
  update(env: EnvState): void;
  dispose(): void;
}

export function createBackdrop(): Backdrop {
  const mat = new THREE.ShaderMaterial({
    vertexShader: bgVert,
    fragmentShader: bgFrag,
    uniforms: {
      uTop: { value: new THREE.Color("#0A0D18") },
      uBottom: { value: new THREE.Color("#05070E") },
      uGlowAmount: { value: 0.18 },
      uGlowColor: { value: new THREE.Color("#8FB4FF") },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  // Keep the sky centred on the camera so it never clips.
  mesh.onBeforeRender = (_r, _s, camera) => {
    mesh.position.copy(camera.position);
    mesh.scale.setScalar((camera as THREE.PerspectiveCamera).far * 0.9 || 500);
    mesh.updateMatrixWorld(true);
  };

  return {
    mesh,
    update(env) {
      mat.uniforms.uTop.value.set(env.bgTop);
      mat.uniforms.uBottom.value.set(env.bgBottom);
      mat.uniforms.uGlowAmount.value = env.preset === "paper" ? 0.16 : 0.2;
    },
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
    },
  };
}

/* ----------------------------------------------------------------- lights */

export interface Rig {
  group: THREE.Group;
  key: THREE.DirectionalLight;
  update(env: EnvState): void;
  dispose(): void;
}

export function createRig(): Rig {
  const group = new THREE.Group();

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 60;
  const c = key.shadow.camera;
  c.left = -12;
  c.right = 12;
  c.top = 12;
  c.bottom = -12;
  c.updateProjectionMatrix();
  group.add(key, key.target);

  const fill = new THREE.DirectionalLight(0x8fb6ff, 0.45);
  fill.position.set(-6, 3, -5);
  group.add(fill);

  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x20243a, 0.6);
  group.add(hemi);

  return {
    group,
    key,
    update(env) {
      const a = env.lightAngle * Math.PI;
      key.position.set(Math.cos(a) * 9, 9.5, Math.sin(a) * 9);
      key.target.position.set(0, 0, 0);
      key.target.updateMatrixWorld();
      key.intensity = env.keyIntensity;
      key.castShadow = env.shadows;
      fill.intensity = env.keyIntensity * 0.3;
      hemi.intensity = env.ambient;
    },
    dispose() {
      key.dispose();
      fill.dispose();
      hemi.dispose();
    },
  };
}

/* ------------------------------------------------------------------ floor */

const floorFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uCells;
varying vec2 vUv;

float gridLine(vec2 p, float w) {
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
  return 1.0 - min(min(g.x, g.y) / w, 1.0);
}

void main() {
  vec2 p = (vUv - 0.5) * uCells;
  float line = gridLine(p, 1.4) * 0.55 + gridLine(p * 0.2, 1.6) * 0.45;
  float fade = smoothstep(0.5, 0.05, length(vUv - 0.5));
  float a = line * fade * uOpacity;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const floorVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export interface Floor {
  group: THREE.Group;
  /** `redundant` is true when the construction plane is already lying on the ground. */
  update(env: EnvState, redundant: boolean): void;
  dispose(): void;
}

export function createFloor(): Floor {
  const group = new THREE.Group();

  const mat = new THREE.ShaderMaterial({
    vertexShader: floorVert,
    fragmentShader: floorFrag,
    uniforms: {
      uColor: { value: new THREE.Color("#4FE3DC") },
      uOpacity: { value: 0.12 },
      uCells: { value: 30 },
    },
    transparent: true,
    depthWrite: false,
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), mat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -0.002;
  group.add(grid);

  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.32 });
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), shadowMat);
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  group.add(catcher);

  return {
    group,
    update(env, redundant) {
      // Two grids on the same ground plane read as noise, not as space.
      grid.visible = env.grid && !redundant;
      catcher.visible = env.floor && env.shadows;
      mat.uniforms.uColor.value.set(env.preset === "paper" ? "#7E88A6" : "#4FE3DC");
      mat.uniforms.uOpacity.value = env.preset === "paper" ? 0.3 : 0.12;
    },
    dispose() {
      grid.geometry.dispose();
      catcher.geometry.dispose();
      mat.dispose();
      shadowMat.dispose();
    },
  };
}

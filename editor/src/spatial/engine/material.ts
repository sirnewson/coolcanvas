import * as THREE from "three";
import type { Brush } from "../types";
import { grainTexture, tipTexture } from "./textures";

/**
 * One material per (layer, brush) pair. All strokes that share a brush also
 * share this material and therefore render in a single draw call; colour and
 * per-point alpha ride along as vertex attributes.
 */

const vert = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying vec3 vNormal;
varying float vDepth;

void main() {
  vUv = uv;
  vColor = aColor;
  vAlpha = aAlpha;
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const frag = /* glsl */ `
uniform sampler2D uTip;
uniform sampler2D uGrain;
uniform float uGrainScale;
uniform float uGrainDepth;
uniform float uGlow;
uniform float uShade;
uniform float uOpacity;
uniform float uAlphaCut;
uniform vec3 uLight;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogAmount;
uniform float uTint;
uniform vec3 uTintColor;

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying vec3 vNormal;
varying float vDepth;

void main() {
  float tip = texture2D(uTip, vec2(vUv.x, clamp(vUv.y, 0.002, 0.998))).a;
  float grain = texture2D(uGrain, vUv * uGrainScale).r;
  float a = tip * vAlpha * uOpacity * mix(1.0, grain, uGrainDepth);
  if (a < uAlphaCut) discard;

  vec3 c = vColor;

  // Optional lambert term: flat brushes stay emissive, volume brushes read solid.
  if (uShade > 0.001) {
    vec3 n = normalize(vNormal);
    float ndl = abs(dot(n, normalize(uLight)));
    c *= mix(1.0, 0.38 + 0.82 * ndl, uShade);
  }

  c *= 1.0 + uGlow;
  c = mix(c, uTintColor, uTint);

  // Depth haze. More than anything else, this is what makes the space read as deep.
  float f = smoothstep(uFogNear, uFogFar, vDepth) * uFogAmount;
  c = mix(c, uFogColor, f);

  gl_FragColor = vec4(c, a);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface Globals {
  light: THREE.Vector3;
  fogColor: THREE.Color;
  fogNear: number;
  fogFar: number;
  fogAmount: number;
}

const live = new Set<THREE.ShaderMaterial>();

/** Soft media (washes, airbrush, glow) blend rather than occlude. */
function isSoft(brush: Brush): boolean {
  return brush.blend === "add" || brush.opacity < 0.7 || brush.geom === "spray";
}

export function makeStrokeMaterial(brush: Brush, layerOpacity: number): THREE.ShaderMaterial {
  const soft = isSoft(brush);
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: {
      uTip: { value: tipTexture(brush.tip, brush.streaks) },
      uGrain: { value: grainTexture(brush.grain) },
      uGrainScale: { value: brush.grain === "none" ? 1 : brush.grainScale },
      uGrainDepth: { value: brush.grain === "none" ? 0 : brush.grainDepth },
      uGlow: { value: brush.glow },
      uShade: { value: brush.shade },
      uOpacity: { value: layerOpacity },
      uAlphaCut: { value: soft ? 0.004 : 0.42 },
      uLight: { value: new THREE.Vector3(0.4, 0.8, 0.45) },
      uFogColor: { value: new THREE.Color("#0A0D18") },
      uFogNear: { value: 8 },
      uFogFar: { value: 40 },
      uFogAmount: { value: 0 },
      uTint: { value: 0 },
      uTintColor: { value: new THREE.Color("#4FE3DC") },
    },
    transparent: true,
    depthTest: true,
    depthWrite: !soft,
    side: THREE.DoubleSide,
    blending: brush.blend === "add" ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  mat.userData.soft = soft;
  live.add(mat);
  return mat;
}

export function disposeStrokeMaterial(mat: THREE.ShaderMaterial) {
  live.delete(mat);
  mat.dispose();
}

/** Push scene-wide values into every stroke material at once. */
export function updateGlobals(g: Globals) {
  live.forEach((m) => {
    m.uniforms.uLight.value.copy(g.light);
    m.uniforms.uFogColor.value.copy(g.fogColor);
    m.uniforms.uFogNear.value = g.fogNear;
    m.uniforms.uFogFar.value = g.fogFar;
    m.uniforms.uFogAmount.value = g.fogAmount;
  });
}

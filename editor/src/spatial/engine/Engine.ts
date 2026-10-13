import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

import type {
  Brush, CameraObj, CameraState, EnvState, Flat, GuideObj, Layer, LightObj, ModelObj, PlaneState,
  Prim, SceneObject, Solid, Stroke,
} from "../types";
import { findBrush } from "./brushes";
import { StrokeBatch } from "./batch";
import { buildStroke, geoToBufferGeometry } from "./geometry";
import { disposeStrokeMaterial, makeStrokeMaterial, updateGlobals } from "./material";
import { createBackdrop, createFloor, createRig } from "./env";
import { createPlaneVisual, planeBasis, type Basis } from "./plane";
import { buildSolidGeometry, makeSolidMaterial } from "./solids";
import { applyTransform, makePrimMaterial, primGeometry } from "./prims";
import { applyPose, captureRest, disposeInstance, findBones, instantiate, isRigged, loadModel } from "./models";
import { buildFlat, placeFlat, type FlatMesh } from "./flats";
import { objectBounds } from "./bounds";
import {
  buildCameraObject, buildLightObject, buildGuideObject,
  type BuiltCamera, type BuiltLight, type BuiltGuide,
} from "./sceneElements";

/* ------------------------------------------------------------ grade pass */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.35 },
    uChroma: { value: 0.12 },
    uSaturation: { value: 1.05 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uChroma, uSaturation, uTime;
    varying vec2 vUv;

    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      if (uChroma > 0.0005) {
        vec2 off = d * uChroma * 0.06 * r2;
        c.r = texture2D(tDiffuse, vUv + off).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, vUv - off).b;
      } else {
        c = texture2D(tDiffuse, vUv).rgb;
      }
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSaturation);
      c *= 1.0 - uVignette * smoothstep(0.1, 0.75, r2 * 2.0);
      if (uGrain > 0.0005) {
        float n = fract(sin(dot(vUv * 1024.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
        c += (n - 0.5) * uGrain * 0.35;
      }
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

/* ------------------------------------------------------------------ types */

export interface PickResult {
  id: string;
  point: THREE.Vector3;
  distance: number;
}

export type Quality = "high" | "balanced" | "battery";

/**
 * What the mesh itself is made of, ignoring where it sits. Rebuilding geometry
 * on every drag frame would tear the transform handles off the object they are
 * attached to, so a move must be applied in place.
 */
const shapeSig = (o: SceneObject): string => {
  switch (o.kind) {
    case "prim":
      return `${o.prim}|${o.detail}|${o.faceted}`;
    case "flat":
      return `${o.flat}|${o.w}|${o.h}|${o.text}|${o.fill}|${o.stroke}|${o.strokeWidth}|${o.radius}|${o.fontSize}|${o.fontFamily}|${o.align}|${o.textColor}|${o.src ?? ""}`;
    default:
      return "";
  }
};

const sig = (o: SceneObject): string => {
  switch (o.kind) {
    case "stroke":
      return `s|${o.layer}|${o.brush}|${o.color}|${o.size}|${o.opacity}|${o.pts.length}|${o.normal.join(",")}`;
    case "solid":
      return `o|${o.layer}|${o.color}|${o.opacity}|${o.mode}|${o.shade}|${o.height}|${o.bevel}|${o.centered}|${o.wire}|${o.profile.length}|${o.origin.join(",")}`;
    case "prim":
      return `p|${o.layer}|${o.prim}|${o.color}|${o.opacity}|${o.shade}|${o.detail}|${o.wire}|${o.faceted}|${o.pos.join(",")}|${o.rot.join(",")}|${o.scale.join(",")}`;
    case "model":
      return `m|${o.layer}|${o.src}|${o.color}|${o.opacity}|${o.shade}|${o.wire}|${o.pos.join(",")}|${o.rot.join(",")}|${o.scale.join(",")}|${JSON.stringify(o.pose ?? {})}`;
    case "flat":
      return `f|${o.layer}|${o.flat}|${o.u}|${o.v}|${o.w}|${o.h}|${o.spin}|${o.text}|${o.fill}|${o.stroke}|${o.strokeWidth}|${o.radius}|${o.fontSize}|${o.fontFamily}|${o.align}|${o.textColor}|${o.src ?? ""}|${o.billboard}|${o.origin.join(",")}|${o.an.join(",")}`;
    case "camera":
      return `c|${o.layer}|${o.name}|${o.pos.join(",")}|${o.rot.join(",")}|${o.fov}|${o.ortho}|${o.near}|${o.far}|${o.visible ?? true}`;
    case "light":
      return `l|${o.layer}|${o.name}|${o.lightKind}|${o.pos.join(",")}|${o.rot?.join(",") ?? ""}|${o.color}|${o.intensity}|${o.distance ?? 0}|${o.decay ?? 2}|${o.angle ?? 0}|${o.penumbra ?? 0}|${o.castShadow}`;
    case "guide":
      return `g|${o.layer}|${o.name}|${o.guideKind}|${o.pos.join(",")}|${o.to?.join(",") ?? ""}|${o.label ?? ""}|${o.color}|${o.size ?? 1}`;
    default:
      return "?";
  }
};

/* ----------------------------------------------------------------- engine */

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;
  private renderPass: RenderPass;

  private backdrop = createBackdrop();
  private rig = createRig();
  private floor = createFloor();
  private planeVis = createPlaneVisual();
  private envMap: THREE.Texture | null = null;

  private strokeRoot = new THREE.Group();
  private solidRoot = new THREE.Group();
  private overlayRoot = new THREE.Group();
  private cameraRoot = new THREE.Group();
  private lightRoot = new THREE.Group();
  private guideRoot = new THREE.Group();

  private batches = new Map<string, StrokeBatch>();
  private batchMats = new Map<string, THREE.ShaderMaterial>();
  private index = new Map<string, { key: string; sig: string }>();
  private solids = new Map<string, { mesh: THREE.Mesh; sig: string }>();
  private prims = new Map<string, { mesh: THREE.Mesh; sig: string; shape: string }>();
  private cameras = new Map<string, BuiltCamera & { sig: string }>();
  private lights = new Map<string, BuiltLight & { sig: string }>();
  private guides = new Map<string, BuiltGuide & { sig: string }>();
  private activeCameraId: string | null = null;
  private models = new Map<string, {
    group: THREE.Group;
    sig: string;
    src: string;
    bones: Map<string, THREE.Bone>;
    rigged: boolean;
  }>();

  /* Posing. Handles live in the overlay and follow their joints every frame. */
  private poseId: string | null = null;
  private poseHandles = new THREE.Group();
  private poseBoneName: string | null = null;
  /**
   * The handles are attached to this rather than to the bone itself.
   *
   * A rig is normalised by scaling its parent group, so every bone sits inside
   * a hierarchy scaled to roughly a hundredth. TransformControls multiplies its
   * own geometry by that matrix, and the rotate ring comes out the size of the
   * room. The proxy is an unscaled stand-in that carries the bone's world
   * orientation, and its rotation is mapped back onto the bone.
   */
  private boneProxy = new THREE.Object3D();
  onBonePosed?: (modelId: string, bone: string, euler: [number, number, number]) => void;
  private flats = new Map<string, { built: FlatMesh; sig: string; shape: string }>();
  private pendingModels = new Set<string>();
  private objects: SceneObject[] = [];
  private brushes: Brush[] = [];
  private layers: Layer[] = [];

  private live: THREE.Mesh | null = null;
  private selection = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x1f5fd0, transparent: true, opacity: 0.95, depthTest: false })
  );

  private env!: EnvState;
  private plane: PlaneState | null = null;
  private dirty = true;
  private raf = 0;
  private clock = new THREE.Clock();
  private turning = 0;
  private quality: Quality = "high";
  private disposed = false;

  private gizmo: TransformControls | null = null;
  private gizmoHelper: THREE.Object3D | null = null;
  /** True while the user is dragging a transform handle. */
  gizmoActive = false;

  /**
   * True the moment a handle is even under the pointer.
   *
   * `gizmoActive` only turns on after the handle's own pointerdown has been
   * processed, which is one event too late: without this, a press on a handle
   * starts a canvas drag as well, and the object ends up stuck to the pointer.
   */
  get gizmoBusy(): boolean {
    return this.gizmoActive || !!this.gizmo?.axis;
  }
  onGizmoChange?: (id: string, pos: number[], rot: number[], scale: number[]) => void;
  onGizmoDone?: () => void;

  onFrame?: (dt: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true, // needed for snapshots and video capture
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 400);
    this.camera.position.set(6, 5, 9);

    this.selection.frustumCulled = false;
    this.selection.renderOrder = 900;
    this.overlayRoot.add(this.selection);

    this.scene.add(this.backdrop.mesh, this.rig.group, this.floor.group, this.planeVis.group);
    this.scene.add(this.strokeRoot, this.solidRoot, this.overlayRoot, this.cameraRoot, this.lightRoot, this.guideRoot);

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.5, 0.6);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.grade);

    // A generated room gives metal and glass something to reflect.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  /* --------------------------------------------------------------- frame */

  request() {
    this.dirty = true;
  }

  setQuality(q: Quality) {
    if (this.quality === q) return;
    this.quality = q;
    this.renderer.setPixelRatio(q === "high" ? Math.min(devicePixelRatio, 2) : q === "balanced" ? Math.min(devicePixelRatio, 1.5) : 1);
    this.resize(this.width, this.height);
    this.request();
  }

  private width = 1;
  private height = 1;

  resize(w: number, h: number) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
    this.composer.setSize(this.width, this.height);
    this.bloom.setSize(this.width, this.height);
    this.request();
  }

  private loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.onFrame?.(dt);

    if (this.poseHandles.children.length) this.dirty = true;
    if (this.turning !== 0) {
      this.orbitBy(this.turning * dt, 0);
      this.dirty = true;
    }
    if (this.poseHandles.children.length) this.updateHandles();
    if (!this.dirty) return;
    this.dirty = false;
    this.grade.uniforms.uTime.value += dt * 60;
    this.composer.render();
  }

  setTurntable(speed: number) {
    this.turning = speed;
    if (speed !== 0) this.request();
  }

  /* -------------------------------------------------------------- camera */

  applyCamera(c: CameraState) {
    const phi = Math.max(0.02, Math.min(Math.PI - 0.02, c.phi));
    const sp = new THREE.Spherical(Math.max(0.15, c.dist), phi, c.theta);
    const target = new THREE.Vector3(...c.target);
    this.camera.position.setFromSpherical(sp).add(target);
    this.camera.lookAt(target);
    if (this.camera.fov !== c.fov) {
      this.camera.fov = c.fov;
      this.camera.updateProjectionMatrix();
    }
    this.request();
  }

  private orbitBy(dTheta: number, dPhi: number) {
    const target = this.currentTarget.clone();
    const off = this.camera.position.clone().sub(target);
    const sp = new THREE.Spherical().setFromVector3(off);
    sp.theta += dTheta;
    sp.phi = Math.max(0.02, Math.min(Math.PI - 0.02, sp.phi + dPhi));
    this.camera.position.setFromSpherical(sp).add(target);
    this.camera.lookAt(target);
  }

  currentTarget = new THREE.Vector3();

  /* ------------------------------------------------------------ env/plane */

  setEnv(env: EnvState) {
    this.env = env;
    this.backdrop.update(env);
    this.rig.update(env);
    this.floor.update(env, this.groundIsPlane());
    this.renderer.toneMappingExposure = env.exposure;
    this.renderer.shadowMap.enabled = env.shadows;

    const post = this.quality !== "battery";
    this.bloom.enabled = post && env.bloom > 0.001;
    this.bloom.strength = env.bloom;
    this.bloom.threshold = env.bloomThreshold;
    this.bloom.radius = 0.6;
    this.grade.enabled = true;
    this.grade.uniforms.uGrain.value = post ? env.grain : 0;
    this.grade.uniforms.uVignette.value = env.vignette;
    this.grade.uniforms.uChroma.value = post ? env.chroma : 0;
    this.grade.uniforms.uSaturation.value = env.saturation;

    const fogColor = new THREE.Color(env.fogColor);
    updateGlobals({
      light: this.rig.key.position.clone().normalize(),
      fogColor,
      fogNear: this.camera.position.length() * 0.35,
      fogFar: this.camera.position.length() * 2.6 + 12,
      fogAmount: env.fog,
    });
    this.scene.fog = env.fog > 0.001 ? new THREE.Fog(fogColor, this.camera.far * 0.25, this.camera.far * 0.85) : null;
    this.request();
  }

  setPlane(plane: PlaneState) {
    this.plane = plane;
    this.planeVis.update(plane, this.env?.preset === "paper" ? "#5B77C4" : "#4FE3DC");
    if (this.env) this.floor.update(this.env, this.groundIsPlane());
    this.request();
  }

  private groundIsPlane(): boolean {
    const p = this.plane;
    return !!p && p.visible && p.preset === "ground" && Math.abs(p.offset) < 0.05;
  }

  basisFor(plane: PlaneState): Basis {
    return planeBasis(plane);
  }

  /** The view-aligned sheet used when drawing free in space. */
  spaceBasis(depth: number): Basis {
    const n = new THREE.Vector3();
    this.camera.getWorldDirection(n).negate();
    const x = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).normalize();
    const y = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion).normalize();
    const origin = this.camera.position.clone().addScaledVector(n, -depth);
    return { origin, x, y, n };
  }

  /* -------------------------------------------------------------- objects */

  setBrushes(b: Brush[]) {
    this.brushes = b;
  }

  private batchKey(layer: string, brush: string) {
    return `${layer}::${brush}`;
  }

  private batchFor(layer: string, brushId: string): StrokeBatch {
    const key = this.batchKey(layer, brushId);
    let batch = this.batches.get(key);
    if (!batch) {
      const brush = findBrush(this.brushes, brushId);
      const layerObj = this.layers.find((l) => l.id === layer);
      const mat = makeStrokeMaterial(brush, layerObj?.opacity ?? 1);
      this.batchMats.set(key, mat);
      batch = new StrokeBatch(mat);
      batch.group.renderOrder = mat.userData.soft ? 10 : 0;
      this.batches.set(key, batch);
      this.strokeRoot.add(batch.group);
    }
    return batch;
  }

  /** Incrementally reconcile the scene with the document. */
  sync(objects: SceneObject[], layers: Layer[]) {
    this.layers = layers;
    this.objects = objects;
    const seen = new Set<string>();
    const hidden = new Set(layers.filter((l) => !l.visible).map((l) => l.id));

    for (const o of objects) {
      seen.add(o.id);
      const s = sig(o);
      switch (o.kind) {
        case "stroke": {
          const prev = this.index.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev) this.batches.get(prev.key)?.remove(o.id);
          const brush = findBrush(this.brushes, o.brush);
          const key = this.batchKey(o.layer, o.brush);
          this.batchFor(o.layer, o.brush).add(o.id, buildStroke(o, brush));
          this.index.set(o.id, { key, sig: s });
          break;
        }
        case "solid": {
          const prev = this.solids.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev) this.disposeSolid(o.id);
          this.addSolid(o, s);
          break;
        }
        case "prim": {
          const prev = this.prims.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev && prev.shape === shapeSig(o)) {
            // Same geometry: only the placement or the surface changed.
            applyTransform(prev.mesh, o.pos, o.rot, o.scale);
            this.restylePrim(prev.mesh, o);
            prev.sig = s;
            break;
          }
          if (prev) this.disposePrim(o.id);
          this.addPrim(o, s);
          break;
        }
        case "model": {
          const prev = this.models.get(o.id);
          if (prev && prev.sig === s) break;
          this.addModel(o, s, !!prev);
          break;
        }
        case "flat": {
          const prev = this.flats.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev && prev.shape === shapeSig(o)) {
            placeFlat(prev.built.mesh, o);
            prev.sig = s;
            break;
          }
          if (prev) this.disposeFlat(o.id);
          this.addFlat(o, s);
          break;
        }
        case "camera": {
          const prev = this.cameras.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev) this.disposeCamera(o.id);
          this.addCamera(o, s);
          break;
        }
        case "light": {
          const prev = this.lights.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev) this.disposeLight(o.id);
          this.addLight(o, s);
          break;
        }
        case "guide": {
          const prev = this.guides.get(o.id);
          if (prev && prev.sig === s) break;
          if (prev) this.disposeGuide(o.id);
          this.addGuide(o, s);
          break;
        }
        default:
          break;
      }
    }

    // Anything the document dropped.
    for (const [id, rec] of Array.from(this.index)) {
      if (!seen.has(id)) {
        this.batches.get(rec.key)?.remove(id);
        this.index.delete(id);
      }
    }
    for (const id of Array.from(this.solids.keys())) if (!seen.has(id)) this.disposeSolid(id);
    for (const id of Array.from(this.prims.keys())) if (!seen.has(id)) this.disposePrim(id);
    for (const id of Array.from(this.models.keys())) if (!seen.has(id)) this.disposeModel(id);
    for (const id of Array.from(this.flats.keys())) if (!seen.has(id)) this.disposeFlat(id);
    for (const id of Array.from(this.cameras.keys())) if (!seen.has(id)) this.disposeCamera(id);
    for (const id of Array.from(this.lights.keys())) if (!seen.has(id)) this.disposeLight(id);
    for (const id of Array.from(this.guides.keys())) if (!seen.has(id)) this.disposeGuide(id);

    // Layer visibility and opacity.
    for (const [key, batch] of this.batches) {
      const layerId = key.split("::")[0];
      batch.setVisible(!hidden.has(layerId));
      const mat = this.batchMats.get(key);
      const layer = layers.find((l) => l.id === layerId);
      if (mat && layer) mat.uniforms.uOpacity.value = layer.opacity;
    }
    for (const o of objects) {
      const vis = !hidden.has(o.layer);
      if (o.kind === "solid") { const r = this.solids.get(o.id); if (r) r.mesh.visible = vis; }
      else if (o.kind === "prim") { const r = this.prims.get(o.id); if (r) r.mesh.visible = vis; }
      else if (o.kind === "model") { const r = this.models.get(o.id); if (r) r.group.visible = vis; }
      else if (o.kind === "flat") { const r = this.flats.get(o.id); if (r) r.built.mesh.visible = vis; }
      else if (o.kind === "camera") { const r = this.cameras.get(o.id); if (r) { r.group.visible = vis; r.helper.visible = vis && (o.visible ?? true); } }
      else if (o.kind === "light") { const r = this.lights.get(o.id); if (r) { r.group.visible = vis; if (r.helper) r.helper.visible = vis; } }
      else if (o.kind === "guide") { const r = this.guides.get(o.id); if (r) r.group.visible = vis; }
    }
    this.request();
  }

  onModelError?: (id: string) => void;

  private addSolid(o: Solid, s: string) {
    const geo = buildSolidGeometry(o);
    if (!geo) return;
    const mesh = new THREE.Mesh(geo, makeSolidMaterial(o, this.envMap));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = o.id;
    if (o.wire) {
      mesh.add(new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x1f5fd0, transparent: true, opacity: 0.35 })
      ));
    }
    this.solidRoot.add(mesh);
    this.solids.set(o.id, { mesh, sig: s });
  }

  private addPrim(o: Prim, s: string) {
    // Geometry is shared by every primitive of the same kind and detail, so it
    // must never be disposed along with an individual object.
    const geo = primGeometry(o.prim, o.detail, o.faceted);
    const mesh = new THREE.Mesh(geo, makePrimMaterial(o.shade, o.color, o.opacity, this.envMap, o.faceted));
    (mesh.material as THREE.MeshStandardMaterial).wireframe = o.wire;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.id = o.id;
    applyTransform(mesh, o.pos, o.rot, o.scale);
    this.solidRoot.add(mesh);
    this.prims.set(o.id, { mesh, sig: s, shape: shapeSig(o) });
  }

  /** Colour, finish and wireframe, applied without replacing the object. */
  private restylePrim(mesh: THREE.Mesh, o: Prim) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    const sameKind =
      (o.shade === "flat") === (mat.type === "MeshBasicMaterial") &&
      (o.shade === "glass") === (mat.type === "MeshPhysicalMaterial");
    if (!sameKind) {
      mat.dispose();
      mesh.material = makePrimMaterial(o.shade, o.color, o.opacity, this.envMap, o.faceted);
      (mesh.material as THREE.MeshStandardMaterial).wireframe = o.wire;
      return;
    }
    mat.color.set(o.color);
    mat.opacity = o.opacity;
    mat.transparent = o.opacity < 0.999;
    mat.wireframe = o.wire;
    mat.flatShading = o.faceted;
    mat.needsUpdate = true;
  }

  private addModel(o: ModelObj, s: string, hadPrevious: boolean) {
    const prev = this.models.get(o.id);
    // Moving a model needs the transform reset, not the file re-read.
    if (prev && prev.src === o.src) {
      applyTransform(prev.group, o.pos, o.rot, o.scale);
      applyPose(prev.bones, o.pose);
      prev.sig = s;
      this.request();
      return;
    }
    if (hadPrevious) this.disposeModel(o.id);

    const token = o.id + ':' + o.src;
    this.pendingModels.add(token);
    void loadModel(o.src)
      .then((source) => {
        // The object may have been deleted or re-sourced while the file loaded.
        if (!this.pendingModels.has(token) || this.disposed) return;
        this.pendingModels.delete(token);
        const group = instantiate(source, o, this.envMap);
        const bones = findBones(group);
        captureRest(bones);
        applyPose(bones, o.pose);
        applyTransform(group, o.pos, o.rot, o.scale);
        this.solidRoot.add(group);
        this.models.set(o.id, { group, sig: s, src: o.src, bones, rigged: isRigged(group) });
        this.request();
      })
      .catch(() => {
        this.pendingModels.delete(token);
        this.onModelError?.(o.id);
      });
  }

  private addFlat(o: Flat, s: string) {
    const built = buildFlat(o, () => {
      // The image arrived after the mesh was built; repaint it in place.
      if (!this.flats.has(o.id) || this.disposed) return;
      this.disposeFlat(o.id);
      this.addFlat(o, s);
    });
    this.solidRoot.add(built.mesh);
    this.flats.set(o.id, { built, sig: s, shape: shapeSig(o) });
  }

  private disposeSolid(id: string) {
    const rec = this.solids.get(id);
    if (!rec) return;
    this.solidRoot.remove(rec.mesh);
    rec.mesh.geometry.dispose();
    (rec.mesh.material as THREE.Material).dispose();
    rec.mesh.children.forEach((c) => {
      const l = c as THREE.LineSegments;
      l.geometry?.dispose();
      (l.material as THREE.Material)?.dispose();
    });
    this.solids.delete(id);
  }

  private disposePrim(id: string) {
    const rec = this.prims.get(id);
    if (!rec) return;
    this.solidRoot.remove(rec.mesh);
    (rec.mesh.material as THREE.Material).dispose();
    this.prims.delete(id);
  }

  private disposeModel(id: string) {
    const rec = this.models.get(id);
    if (!rec) return;
    this.solidRoot.remove(rec.group);
    disposeInstance(rec.group);
    this.models.delete(id);
    Array.from(this.pendingModels).forEach((t) => {
      if (t.indexOf(id + ':') === 0) this.pendingModels.delete(t);
    });
  }

  private disposeFlat(id: string) {
    const rec = this.flats.get(id);
    if (!rec) return;
    this.solidRoot.remove(rec.built.mesh);
    rec.built.dispose();
    this.flats.delete(id);
  }

  private addCamera(o: CameraObj, s: string) {
    const built = buildCameraObject(o, this.width / (this.height || 1));
    this.cameraRoot.add(built.group);
    this.overlayRoot.add(built.helper);
    this.cameras.set(o.id, { ...built, sig: s });
    if (this.activeCameraId === o.id) {
      this.renderPass.camera = built.camera;
    }
  }

  private disposeCamera(id: string) {
    const rec = this.cameras.get(id);
    if (!rec) return;
    this.cameraRoot.remove(rec.group);
    this.overlayRoot.remove(rec.helper);
    rec.dispose();
    this.cameras.delete(id);
    if (this.activeCameraId === id) {
      this.setActiveCameraId(null);
    }
  }

  private addLight(o: LightObj, s: string) {
    const built = buildLightObject(o);
    this.lightRoot.add(built.group);
    if (built.helper) this.overlayRoot.add(built.helper);
    this.lights.set(o.id, { ...built, sig: s });
  }

  private disposeLight(id: string) {
    const rec = this.lights.get(id);
    if (!rec) return;
    this.lightRoot.remove(rec.group);
    if (rec.helper) this.overlayRoot.remove(rec.helper);
    rec.dispose();
    this.lights.delete(id);
  }

  private addGuide(o: GuideObj, s: string) {
    const built = buildGuideObject(o);
    this.guideRoot.add(built.group);
    this.guides.set(o.id, { ...built, sig: s });
  }

  private disposeGuide(id: string) {
    const rec = this.guides.get(id);
    if (!rec) return;
    this.guideRoot.remove(rec.group);
    rec.dispose();
    this.guides.delete(id);
  }

  setActiveCameraId(id: string | null) {
    this.activeCameraId = id;
    if (id && this.cameras.has(id)) {
      this.renderPass.camera = this.cameras.get(id)!.camera;
    } else {
      this.renderPass.camera = this.camera;
    }
    this.request();
  }

  getActiveCameraId(): string | null {
    return this.activeCameraId;
  }

  /**
   * Snaps the selected object to sit flush against the ground plane (y = 0).
   */
  snapToGround(id: string) {
    const target = this.meshFor(id);
    if (!target) return;
    target.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(target);
    if (box.isEmpty()) return;

    const deltaY = -box.min.y;
    target.position.y += deltaY;
    target.updateMatrixWorld(true);

    this.onGizmoChange?.(
      id,
      [target.position.x, target.position.y, target.position.z],
      [target.rotation.x, target.rotation.y, target.rotation.z],
      [target.scale.x, target.scale.y, target.scale.z]
    );
    this.onGizmoDone?.();
    this.request();
  }

  /**
   * Takes a still snapshot from any scene camera.
   */
  renderFromCamera(cameraObj: CameraObj, width = 1920, height = 1080, transparent = false): string {
    const aspect = width / height;
    const tempCam = cameraObj.ortho
      ? new THREE.OrthographicCamera(-2.5 * aspect, 2.5 * aspect, 2.5, -2.5, cameraObj.near || 0.1, cameraObj.far || 1000)
      : new THREE.PerspectiveCamera(cameraObj.fov || 50, aspect, cameraObj.near || 0.1, cameraObj.far || 1000);
    tempCam.position.set(...cameraObj.pos);
    tempCam.rotation.set(...cameraObj.rot);
    tempCam.updateMatrixWorld(true);

    const target = new THREE.WebGLRenderTarget(width, height, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      colorSpace: THREE.SRGBColorSpace,
    });

    const prevTarget = this.renderer.getRenderTarget();
    const prevBg = this.backdrop.mesh.visible;
    const prevOverlay = this.overlayRoot.visible;
    if (transparent) this.backdrop.mesh.visible = false;
    this.overlayRoot.visible = false;

    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, tempCam);

    const buffer = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buffer);

    this.renderer.setRenderTarget(prevTarget);
    this.backdrop.mesh.visible = prevBg;
    this.overlayRoot.visible = prevOverlay;
    target.dispose();

    // Invert vertically for 2D Canvas format
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const imgData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * 4;
      const dstRow = y * width * 4;
      imgData.data.set(buffer.subarray(srcRow, srcRow + width * 4), dstRow);
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");
  }

  /**
   * Clean export hierarchy for the complete scene.
   */
  getSceneExportGroup(): THREE.Group {
    const group = new THREE.Group();
    group.name = "Scene";

    // Clone all solid objects, primitives, models, flats
    this.solidRoot.children.forEach((c) => {
      group.add(c.clone(true));
    });

    // Add stroke meshes
    this.strokeRoot.children.forEach((c) => {
      group.add(c.clone(true));
    });

    // Add lights
    this.lights.forEach((rec) => {
      group.add(rec.light.clone(true));
    });

    return group;
  }

  /** True once a model has loaded and turns out to carry a skeleton. */
  isRiggedModel(id: string): boolean {
    return this.models.get(id)?.rigged ?? false;
  }

  /** The scene object standing in for a document object, whatever its kind. */
  private meshFor(id: string): THREE.Object3D | null {
    return (
      this.solids.get(id)?.mesh ??
      this.prims.get(id)?.mesh ??
      this.models.get(id)?.group ??
      this.flats.get(id)?.built.mesh ??
      this.cameras.get(id)?.mesh ??
      this.lights.get(id)?.proxy ??
      this.guides.get(id)?.group ??
      null
    );
  }

  /* ----------------------------------------------------------------- pose */

  private poseLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65, depthTest: false })
  );

  /** Show grabbable joints and skeleton armature for a rigged model, or clear them. */
  setPoseTarget(modelId: string | null) {
    if (this.poseId === modelId) return;
    this.poseId = modelId;
    this.clearHandles();
    if (!modelId) {
      this.poseBoneName = null;
      this.gizmo?.detach();
      this.request();
      return;
    }
    const rec = this.models.get(modelId);
    if (!rec || !rec.rigged) return;

    const geo = new THREE.SphereGeometry(1, 12, 10);
    for (const [name, bone] of rec.bones) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x2f6bf0, depthTest: false, transparent: true, opacity: 0.85 });
      const dot = new THREE.Mesh(geo, mat);
      dot.userData.bone = name;
      dot.userData.boneRef = bone;
      dot.renderOrder = 950;
      this.poseHandles.add(dot);
    }
    this.overlayRoot.add(this.poseHandles);
    this.overlayRoot.add(this.poseLines);
    this.request();
  }

  private clearHandles() {
    this.poseHandles.children.forEach((c) => {
      const m = c as THREE.Mesh;
      (m.material as THREE.Material).dispose();
    });
    if (this.poseHandles.children[0]) {
      ((this.poseHandles.children[0] as THREE.Mesh).geometry as THREE.BufferGeometry).dispose();
    }
    this.poseHandles.clear();
    this.overlayRoot.remove(this.poseHandles);
    this.overlayRoot.remove(this.poseLines);
    this.poseLines.geometry.dispose();
    this.poseLines.geometry = new THREE.BufferGeometry();
  }

  /** Keep the joints under the skin as it moves, at a constant screen size, and draw connecting armature lines. */
  private updateHandles() {
    if (!this.poseHandles.children.length || !this.poseId) return;
    const p = new THREE.Vector3();
    const parentP = new THREE.Vector3();
    const linePts: number[] = [];

    for (const child of this.poseHandles.children) {
      const dot = child as THREE.Mesh;
      const bone = dot.userData.boneRef as THREE.Bone;
      bone.updateWorldMatrix(true, false);
      bone.getWorldPosition(p);
      dot.position.copy(p);
      const d = this.camera.position.distanceTo(p);
      const r = Math.min(0.05, Math.max(0.004, d * 0.011));
      dot.scale.setScalar(r);
      const mat = dot.material as THREE.MeshBasicMaterial;
      const on = dot.userData.bone === this.poseBoneName;
      mat.color.set(on ? 0xff8a3d : 0x2f6bf0);
      mat.opacity = on ? 1 : 0.8;
      if (on && !this.gizmoActive) this.syncProxy(bone);

      if (bone.parent && (bone.parent as THREE.Bone).isBone) {
        bone.parent.updateWorldMatrix(true, false);
        bone.parent.getWorldPosition(parentP);
        linePts.push(p.x, p.y, p.z, parentP.x, parentP.y, parentP.z);
      }
    }
    this.poseHandles.updateMatrixWorld();

    if (linePts.length > 0) {
      this.poseLines.geometry.dispose();
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
      this.poseLines.geometry = lineGeo;
    }
  }

  /** Which joint is under the pointer, if any. */
  pickBone(x: number, y: number): string | null {
    if (!this.poseHandles.children.length) return null;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1), this.camera);
    const hit = rc.intersectObjects(this.poseHandles.children, false)[0];
    return hit ? ((hit.object.userData.bone as string) ?? null) : null;
  }

  /** Put the rotate handles on a joint so it can be turned. */
  attachBone(name: string | null) {
    this.poseBoneName = name;
    if (!name || !this.poseId) {
      this.gizmo?.detach();
      this.request();
      return;
    }
    const bone = this.models.get(this.poseId)?.bones.get(name);
    if (!bone) return;

    this.syncProxy(bone);
    if (!this.boneProxy.parent) this.scene.add(this.boneProxy);

    const tc = this.ensureGizmo();
    tc.setMode("rotate");
    tc.setSpace("local");
    tc.attach(this.boneProxy);
    if (this.gizmoHelper) this.gizmoHelper.visible = true;
    this.request();
  }

  /** Park the proxy on the bone, matching its position and world orientation. */
  private syncProxy(bone: THREE.Bone) {
    bone.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    bone.matrixWorld.decompose(pos, quat, scale);
    this.boneProxy.position.copy(pos);
    this.boneProxy.quaternion.copy(quat);
    this.boneProxy.scale.set(1, 1, 1);
    this.boneProxy.updateMatrixWorld();
  }

  /** Turning the proxy turns the bone, in the bone's own parent space. */
  private applyProxyToBone(): [number, number, number] | null {
    if (!this.poseId || !this.poseBoneName) return null;
    const bone = this.models.get(this.poseId)?.bones.get(this.poseBoneName);
    if (!bone || !bone.parent) return null;

    const parentQuat = new THREE.Quaternion();
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.matrixWorld.decompose(new THREE.Vector3(), parentQuat, new THREE.Vector3());

    bone.quaternion.copy(parentQuat.invert().multiply(this.boneProxy.quaternion));
    bone.updateMatrixWorld();
    return [bone.rotation.x, bone.rotation.y, bone.rotation.z];
  }

  /* ---------------------------------------------------------------- gizmo */

  private ensureGizmo(): TransformControls {
    if (this.gizmo) return this.gizmo;
    const tc = new TransformControls(this.camera, this.renderer.domElement);
    tc.setSize(0.85);
    tc.addEventListener("dragging-changed", (e) => {
      this.gizmoActive = (e as unknown as { value: boolean }).value;
      if (!this.gizmoActive) this.onGizmoDone?.();
    });
    tc.addEventListener("objectChange", () => {
      const o = tc.object;
      if (!o) return;
      // Posing drives the proxy; everything else reports a placement.
      if (this.poseBoneName && this.poseId && o === this.boneProxy) {
        const euler = this.applyProxyToBone();
        if (euler) this.onBonePosed?.(this.poseId, this.poseBoneName, euler);
        return;
      }
      if (!o.userData.id) return;
      this.onGizmoChange?.(
        o.userData.id as string,
        [o.position.x, o.position.y, o.position.z],
        [o.rotation.x, o.rotation.y, o.rotation.z],
        [o.scale.x, o.scale.y, o.scale.z]
      );
    });
    tc.addEventListener("change", () => this.request());
    this.gizmo = tc;
    this.gizmoHelper = tc.getHelper();
    this.overlayRoot.add(this.gizmoHelper);
    return tc;
  }

  /** Attach move/rotate/scale handles to an object, or clear them. */
  setGizmo(id: string | null, mode: "translate" | "rotate" | "scale", space: "world" | "local") {
    const target = id ? this.meshFor(id) : null;
    if (!target) {
      this.gizmo?.detach();
      if (this.gizmoHelper) this.gizmoHelper.visible = false;
      this.request();
      return;
    }
    const tc = this.ensureGizmo();
    tc.setMode(mode);
    tc.setSpace(space);
    tc.attach(target);
    if (this.gizmoHelper) this.gizmoHelper.visible = true;
    this.request();
  }


  /** The stroke currently under the pointer, drawn outside the batches. */
  setLive(stroke: Stroke | null) {
    if (this.live) {
      this.strokeRoot.remove(this.live);
      this.live.geometry.dispose();
      this.live = null;
    }
    if (stroke) {
      const brush = findBrush(this.brushes, stroke.brush);
      const geo = geoToBufferGeometry(buildStroke(stroke, brush));
      const key = `live::${stroke.brush}`;
      let mat = this.batchMats.get(key);
      if (!mat) {
        mat = makeStrokeMaterial(brush, 1);
        this.batchMats.set(key, mat);
      }
      this.live = new THREE.Mesh(geo, mat);
      this.live.frustumCulled = false;
      this.strokeRoot.add(this.live);
    }
    this.request();
  }

  setSelection(ids: string[]) {
    const pts: number[] = [];
    const byId = new Map(this.objects.map((o) => [o.id, o]));
    for (const id of ids) {
      const o = byId.get(id);
      if (!o) continue;
      if (o.kind === "stroke") {
        const n = Math.floor(o.pts.length / 4);
        for (let i = 0; i < n - 1; i++) {
          pts.push(o.pts[i * 4], o.pts[i * 4 + 1], o.pts[i * 4 + 2]);
          pts.push(o.pts[(i + 1) * 4], o.pts[(i + 1) * 4 + 1], o.pts[(i + 1) * 4 + 2]);
        }
      } else {
        pushBoxEdges(pts, this.boundsOf(o));
      }
    }
    this.selection.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.selection.geometry = g;
    this.selection.visible = pts.length > 0;
    this.request();
  }

  /* -------------------------------------------------------------- picking */

  ray(x: number, y: number): THREE.Ray {
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    return rc.ray;
  }

  private project(p: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    out.copy(p).project(this.camera);
    out.x = ((out.x + 1) / 2) * this.width;
    out.y = ((1 - out.y) / 2) * this.height;
    return out;
  }

  /**
   * Screen-space picking. Strokes live inside batched buffers, so a GPU
   * raycast could not tell them apart; measuring against the line you can
   * actually see is both faster and closer to what a tap means.
   */
  pickMany(x: number, y: number, radiusPx: number, layers: Set<string>): PickResult[] {
    const out: PickResult[] = [];
    const sp = new THREE.Vector3();
    const wp = new THREE.Vector3();
    const camPos = this.camera.position;

    for (const o of this.objects) {
      if (!layers.has(o.layer)) continue;
      if (o.kind === "stroke") {
        const n = Math.floor(o.pts.length / 4);
        if (n === 0) continue;
        const stride = n > 400 ? Math.ceil(n / 400) : 1;
        let best = Infinity;
        let bestPoint: THREE.Vector3 | null = null;
        for (let i = 0; i < n; i += stride) {
          wp.set(o.pts[i * 4], o.pts[i * 4 + 1], o.pts[i * 4 + 2]);
          this.project(wp, sp);
          if (sp.z > 1 || sp.z < -1) continue;
          const d = Math.hypot(sp.x - x, sp.y - y);
          if (d < best) {
            best = d;
            bestPoint = wp.clone();
          }
        }
        // Thick strokes should be grabbable across their whole width.
        const widthPx = this.worldToPixels(o.size * 0.5, bestPoint ?? camPos);
        if (bestPoint && best <= radiusPx + widthPx) {
          out.push({ id: o.id, point: bestPoint, distance: camPos.distanceTo(bestPoint) });
        }
      } else {
        const target = this.meshFor(o.id);
        if (!target || !target.visible) continue;
        const rc = new THREE.Raycaster();
        const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
        rc.setFromCamera(ndc, this.camera);
        const hit = rc.intersectObject(target, true)[0];
        if (hit) out.push({ id: o.id, point: hit.point.clone(), distance: hit.distance });
      }
    }
    out.sort((a, b) => a.distance - b.distance);
    return out;
  }

  pick(x: number, y: number, radiusPx: number, layers: Set<string>): PickResult | null {
    return this.pickMany(x, y, radiusPx, layers)[0] ?? null;
  }

  /** Marquee selection: anything whose visible extent falls inside the box. */
  pickInRect(x0: number, y0: number, x1: number, y1: number, layers: Set<string>): string[] {
    const out: string[] = [];
    const sp = new THREE.Vector3();
    const wp = new THREE.Vector3();
    const inside = (p: THREE.Vector3) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && p.z <= 1 && p.z >= -1;

    for (const o of this.objects) {
      if (!layers.has(o.layer)) continue;
      if (o.kind === "stroke") {
        const n = Math.floor(o.pts.length / 4);
        if (!n) continue;
        const stride = n > 200 ? Math.ceil(n / 200) : 1;
        let hits = 0;
        let total = 0;
        for (let i = 0; i < n; i += stride) {
          wp.set(o.pts[i * 4], o.pts[i * 4 + 1], o.pts[i * 4 + 2]);
          total++;
          if (inside(this.project(wp, sp))) hits++;
        }
        // Most of the stroke has to be in the box, so a marquee does not
        // sweep up long lines that merely pass through it.
        if (total && hits / total > 0.6) out.push(o.id);
      } else {
        const box = objectBounds(o);
        if (box.isEmpty()) continue;
        if (inside(this.project(box.getCenter(wp), sp))) out.push(o.id);
      }
    }
    return out;
  }

  /** How many pixels a world-space length covers at a given point. */
  worldToPixels(world: number, at: THREE.Vector3): number {
    const dist = this.camera.position.distanceTo(at);
    const viewHeight = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * Math.max(dist, 1e-4);
    return (world / viewHeight) * this.height;
  }

  /** Depth of the nearest existing surface under the pointer, for snapping. */
  surfaceDepth(x: number, y: number, layers: Set<string>): number | null {
    const hit = this.pick(x, y, 14, layers);
    if (!hit) return null;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return hit.point.clone().sub(this.camera.position).dot(dir);
  }

  /**
   * Extent of one object. A model's real size is only known once its file has
   * loaded, so that kind is measured from the scene rather than from the document.
   */
  boundsOf(o: SceneObject): THREE.Box3 {
    if (o.kind === "model") {
      const rec = this.models.get(o.id);
      if (rec) return new THREE.Box3().setFromObject(rec.group);
    }
    return objectBounds(o);
  }

  contentBounds(): THREE.Box3 {
    const box = new THREE.Box3();
    for (const o of this.objects) {
      box.union(this.boundsOf(o));
    }
    return box;
  }

  /* ------------------------------------------------------------ snapshots */

  /** Render at an arbitrary size without disturbing the on-screen view. */
  snapshot(w: number, h: number, transparent = false): string {
    const prevW = this.width;
    const prevH = this.height;
    const prevRatio = this.renderer.getPixelRatio();
    const bgVisible = this.backdrop.mesh.visible;

    this.renderer.setPixelRatio(1);
    if (transparent) this.backdrop.mesh.visible = false;
    this.resize(w, h);
    if (transparent) {
      this.renderer.setClearColor(0x000000, 0);
      this.renderPass.clearAlpha = 0;
    }
    this.composer.render();
    const url = this.renderer.domElement.toDataURL("image/png");

    this.backdrop.mesh.visible = bgVisible;
    this.renderPass.clearAlpha = 1;
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(prevRatio);
    this.resize(prevW, prevH);
    return url;
  }

  /** A small preview for the gallery. */
  thumbnail(size = 384): string {
    return this.snapshot(size, Math.round(size * 0.72));
  }

  /* --------------------------------------------------------------- teardown */

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.batches.forEach((b) => b.dispose());
    this.batchMats.forEach((m) => disposeStrokeMaterial(m));
    this.batches.clear();
    this.batchMats.clear();
    Array.from(this.solids.keys()).forEach((id) => this.disposeSolid(id));
    Array.from(this.prims.keys()).forEach((id) => this.disposePrim(id));
    Array.from(this.models.keys()).forEach((id) => this.disposeModel(id));
    Array.from(this.flats.keys()).forEach((id) => this.disposeFlat(id));
    this.clearHandles();
    this.scene.remove(this.boneProxy);
    this.gizmo?.dispose();
    this.live?.geometry.dispose();
    this.selection.geometry.dispose();
    (this.selection.material as THREE.Material).dispose();
    this.backdrop.dispose();
    this.rig.dispose();
    this.floor.dispose();
    this.planeVis.dispose();
    this.envMap?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}

function pushBoxEdges(out: number[], box: THREE.Box3) {
  if (box.isEmpty()) return;
  const { min, max } = box;
  const c: [number, number, number][] = [
    [min.x, min.y, min.z], [max.x, min.y, min.z], [max.x, max.y, min.z], [min.x, max.y, min.z],
    [min.x, min.y, max.z], [max.x, min.y, max.z], [max.x, max.y, max.z], [min.x, max.y, max.z],
  ];
  const e = [0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7];
  for (const i of e) out.push(c[i][0], c[i][1], c[i][2]);
}

export type { Stroke, Solid };

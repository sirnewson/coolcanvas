import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Brush, SceneObject, Sketch } from "../types";
import { findBrush } from "./brushes";
import { buildStroke } from "./geometry";
import { buildSolidGeometry } from "./solids";

/** Getting work out of the app: as a picture, as a model, as a file, as a film. */

export function download(name: string, data: Blob | string) {
  const url = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== "string") setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeName = (s: string) => s.replace(/[^\w\-. ]+/g, "").trim() || "coolsketch";

/* ------------------------------------------------------------------ files */

export function sketchToFile(sketch: Sketch): Blob {
  return new Blob([JSON.stringify({ format: "coolsketch", version: 1, sketch }, null, 2)], {
    type: "application/json",
  });
}

/** Parse an imported file. Never trust its shape. */
export function fileToSketch(text: string): Sketch | null {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== "object") return null;
  const s = (doc as { sketch?: unknown }).sketch;
  if (!s || typeof s !== "object") return null;
  const c = s as Partial<Sketch>;
  if (!Array.isArray(c.objects) || !Array.isArray(c.layers) || !c.layers.length) return null;
  const layerIds = new Set(c.layers.map((l) => l?.id).filter(Boolean) as string[]);
  const VALID_KINDS = new Set(["stroke", "solid", "prim", "model", "flat", "camera", "light", "guide"]);
  const objects = (c.objects as SceneObject[]).filter(
    (o) => o && typeof o.id === "string" && VALID_KINDS.has(o.kind) && layerIds.has(o.layer)
  );
  return {
    ...(c as Sketch),
    objects,
    activeLayer: layerIds.has(c.activeLayer ?? "") ? c.activeLayer! : c.layers[0].id,
    brushes: Array.isArray(c.brushes) ? c.brushes : [],
  };
}

/* -------------------------------------------------------------------- glb */

/**
 * Bake the sketch or complete assembled 3D scene into a standard .glb file.
 */
export async function exportGLB(
  objects: SceneObject[],
  brushes: Brush[],
  name: string,
  engine?: { getSceneExportGroup: () => THREE.Group } | null
): Promise<Blob> {
  const root = new THREE.Group();
  root.name = name;

  if (engine) {
    const exportedScene = engine.getSceneExportGroup();
    root.add(exportedScene);
  } else {
    const strokeGeos: THREE.BufferGeometry[] = [];
    for (const o of objects) {
      if (o.kind !== "stroke") continue;
      const g = buildStroke(o, findBrush(brushes, o.brush));
      if (!g.index.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(g.position, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(g.normal, 3));
      geo.setAttribute("uv", new THREE.BufferAttribute(g.uv, 2));
      geo.setAttribute("color", new THREE.BufferAttribute(g.color, 3));
      geo.setIndex(new THREE.BufferAttribute(g.index, 1));
      strokeGeos.push(geo);
    }
    if (strokeGeos.length) {
      const merged = BufferGeometryUtils.mergeGeometries(strokeGeos, false);
      strokeGeos.forEach((g) => g.dispose());
      if (merged) {
        const mesh = new THREE.Mesh(
          merged,
          new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75 })
        );
        mesh.name = "Strokes";
        root.add(mesh);
      }
    }

    for (const o of objects) {
      if (o.kind !== "solid") continue;
      const geo = buildSolidGeometry(o);
      if (!geo) continue;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(o.color),
          roughness: o.shade === "metal" || o.shade === "glossy" ? 0.2 : 0.85,
          metalness: o.shade === "metal" ? 1 : 0,
          transparent: o.opacity < 1,
          opacity: o.opacity,
          side: THREE.DoubleSide,
        })
      );
      mesh.name = `Solid ${o.id}`;
      root.add(mesh);
    }
  }

  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true });
  return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
}

/* ------------------------------------------------------------------ video */

export interface RecordOptions {
  canvas: HTMLCanvasElement;
  seconds: number;
  fps: number;
  /** Called every frame with 0..1 so the caller can drive the turntable. */
  onProgress?: (t: number) => void;
}

function pickMime(): string {
  const options = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const m of options) if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}

/** Record the live canvas to a video file. No extra libraries, no server. */
export function recordCanvas(opts: RecordOptions): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = opts.canvas.captureStream(opts.fps);
    const mime = pickMime();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12_000_000 } : undefined);
    } catch (e) {
      reject(e);
      return;
    }
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onerror = () => reject(new Error("Recording failed"));
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: mime || "video/webm" }));
    };

    const start = performance.now();
    const total = opts.seconds * 1000;
    const tick = () => {
      const t = (performance.now() - start) / total;
      opts.onProgress?.(Math.min(1, t));
      if (t >= 1) rec.stop();
      else requestAnimationFrame(tick);
    };
    rec.start();
    requestAnimationFrame(tick);
  });
}

export const PNG_SIZES: { id: string; label: string; w: number; h: number }[] = [
  { id: "square", label: "Square · 2048", w: 2048, h: 2048 },
  { id: "wide", label: "Wide 16:9 · 2560", w: 2560, h: 1440 },
  { id: "portrait", label: "Portrait 4:5 · 2048", w: 2048, h: 2560 },
  { id: "story", label: "Story 9:16 · 1440", w: 1440, h: 2560 },
  { id: "print", label: "Print 3:2 · 3600", w: 3600, h: 2400 },
];

import * as THREE from "three";
import type { Flat, FlatKind } from "../types";

/**
 * Flat elements are the 2D world living inside the 3D one. Each is drawn with
 * an ordinary 2D canvas — the same rectangles, type and sticky notes a flat
 * board has — and then mapped onto a plane in space. That is what lets a
 * moodboard, a label and a solid share one scene.
 */

export interface NoteStyle {
  id: string;
  name: string;
  fill: string;
  stroke: string;
  ink: string;
}

/** Matches the sticky palette on the flat canvas, so work reads the same in both. */
export const NOTE_STYLES: NoteStyle[] = [
  { id: "idea", name: "Idea", fill: "#FBF3CE", stroke: "#E4D69A", ink: "#4A421C" },
  { id: "question", name: "Question", fill: "#E7EFFC", stroke: "#BCD0EE", ink: "#1D3557" },
  { id: "important", name: "Important", fill: "#FBE3E0", stroke: "#EEBAB3", ink: "#5B2019" },
  { id: "research", name: "Research", fill: "#E4F2E6", stroke: "#B6D9BC", ink: "#1E4326" },
  { id: "todo", name: "Todo", fill: "#EAE6F7", stroke: "#C6BDE6", ink: "#2F2555" },
  { id: "plan", name: "Plan", fill: "#FBEBD4", stroke: "#E8CB9C", ink: "#523513" },
  { id: "quote", name: "Quote", fill: "#F0F0EE", stroke: "#D6D5CF", ink: "#38382F" },
  { id: "cool", name: "Cool", fill: "#DFF1F4", stroke: "#AFD8DF", ink: "#123B42" },
];

export const FLAT_KINDS: { id: FlatKind; name: string }[] = [
  { id: "rect", name: "Rectangle" },
  { id: "ellipse", name: "Ellipse" },
  { id: "text", name: "Text" },
  { id: "note", name: "Sticky note" },
  { id: "image", name: "Image" },
];

/* ------------------------------------------------------------------ paint */

const PX_PER_M = 640;
const MAX_PX = 2048;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  return out;
}

function drawText(ctx: CanvasRenderingContext2D, flat: Flat, W: number, H: number, pad: number, scale: number) {
  if (!flat.text) return;
  const size = flat.fontSize * scale;
  ctx.font = `500 ${size}px ${flat.fontFamily}`;
  ctx.fillStyle = flat.textColor;
  ctx.textBaseline = "top";
  ctx.textAlign = flat.align;

  const lines = wrapLines(ctx, flat.text, W - pad * 2);
  const lineHeight = size * 1.32;
  const blockH = lines.length * lineHeight;
  const x = flat.align === "left" ? pad : flat.align === "right" ? W - pad : W / 2;
  let y = Math.max(pad, (H - blockH) / 2);
  for (const line of lines) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
}

/** Render a flat element into a canvas at a resolution matched to its size. */
export function paintFlat(flat: Flat, image?: HTMLImageElement | null): HTMLCanvasElement {
  const scale = Math.min(PX_PER_M, MAX_PX / Math.max(flat.w, flat.h, 1e-3));
  const W = Math.max(8, Math.round(flat.w * scale));
  const H = Math.max(8, Math.round(flat.h * scale));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  const sw = flat.strokeWidth * scale;
  const pad = Math.max(sw, 0.02 * scale);

  switch (flat.flat) {
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, (W - sw) / 2, (H - sw) / 2, 0, 0, Math.PI * 2);
      if (flat.fill !== "none") {
        ctx.fillStyle = flat.fill;
        ctx.fill();
      }
      if (sw > 0 && flat.stroke !== "none") {
        ctx.lineWidth = sw;
        ctx.strokeStyle = flat.stroke;
        ctx.stroke();
      }
      drawText(ctx, flat, W, H, pad * 2, scale);
      break;
    }
    case "text": {
      drawText(ctx, flat, W, H, pad, scale);
      break;
    }
    case "note": {
      // A sticky reads as paper: a soft drop, a warm face, a hairline edge.
      ctx.save();
      ctx.shadowColor = "rgba(30,28,20,0.18)";
      ctx.shadowBlur = 0.02 * scale;
      ctx.shadowOffsetY = 0.006 * scale;
      roundRect(ctx, sw / 2, sw / 2, W - sw, H - sw, flat.radius * scale);
      ctx.fillStyle = flat.fill;
      ctx.fill();
      ctx.restore();
      if (sw > 0) {
        ctx.lineWidth = sw;
        ctx.strokeStyle = flat.stroke;
        ctx.stroke();
      }
      drawText(ctx, flat, W, H, 0.055 * scale, scale);
      break;
    }
    case "image": {
      roundRect(ctx, 0, 0, W, H, flat.radius * scale);
      ctx.save();
      ctx.clip();
      if (image && image.complete && image.naturalWidth) {
        // Cover-fit, centred, like any well-behaved image frame.
        const ar = image.naturalWidth / image.naturalHeight;
        const box = W / H;
        let dw = W;
        let dh = H;
        if (ar > box) dw = H * ar;
        else dh = W / ar;
        ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = "rgba(125,125,118,0.16)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "rgba(90,90,84,0.55)";
        ctx.font = `500 ${0.07 * scale}px ${flat.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Image", W / 2, H / 2);
      }
      ctx.restore();
      if (sw > 0 && flat.stroke !== "none") {
        roundRect(ctx, sw / 2, sw / 2, W - sw, H - sw, flat.radius * scale);
        ctx.lineWidth = sw;
        ctx.strokeStyle = flat.stroke;
        ctx.stroke();
      }
      break;
    }
    case "rect":
    default: {
      roundRect(ctx, sw / 2, sw / 2, W - sw, H - sw, flat.radius * scale);
      if (flat.fill !== "none") {
        ctx.fillStyle = flat.fill;
        ctx.fill();
      }
      if (sw > 0 && flat.stroke !== "none") {
        ctx.lineWidth = sw;
        ctx.strokeStyle = flat.stroke;
        ctx.stroke();
      }
      drawText(ctx, flat, W, H, pad * 2, scale);
      break;
    }
  }
  return cv;
}

/* ------------------------------------------------------------------ build */

const imageCache = new Map<string, HTMLImageElement>();

export function loadFlatImage(src: string, onReady: () => void): HTMLImageElement | null {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = onReady;
  img.src = src;
  imageCache.set(src, img);
  return img;
}

export interface FlatMesh {
  mesh: THREE.Mesh;
  dispose(): void;
}

export function buildFlat(flat: Flat, onImageReady: () => void): FlatMesh {
  const image = flat.flat === "image" && flat.src ? loadFlatImage(flat.src, onImageReady) : null;
  const tex = new THREE.CanvasTexture(paintFlat(flat, image));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: true,
    alphaTest: 0.02,
    toneMapped: false,
  });

  const geo = new THREE.PlaneGeometry(flat.w, flat.h);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.id = flat.id;
  placeFlat(mesh, flat);

  return {
    mesh,
    dispose() {
      geo.dispose();
      tex.dispose();
      mat.dispose();
    },
  };
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _n = new THREE.Vector3();
const _m = new THREE.Matrix4();

/** Put a flat back on its plane at (u, v), spun in place. */
export function placeFlat(mesh: THREE.Object3D, flat: Flat) {
  _x.set(...flat.ax);
  _y.set(...flat.ay);
  _n.set(...flat.an);
  _m.makeBasis(_x, _y, _n);
  mesh.quaternion.setFromRotationMatrix(_m);
  if (flat.spin) mesh.rotateZ(flat.spin);
  mesh.position
    .set(flat.origin[0], flat.origin[1], flat.origin[2])
    .addScaledVector(_x, flat.u)
    .addScaledVector(_y, flat.v);
  mesh.updateMatrixWorld();
}

export function flatBounds(flat: Flat): THREE.Box3 {
  const box = new THREE.Box3();
  _x.set(...flat.ax);
  _y.set(...flat.ay);
  const o = new THREE.Vector3(...flat.origin).addScaledVector(_x, flat.u).addScaledVector(_y, flat.v);
  for (const su of [-0.5, 0.5]) {
    for (const sv of [-0.5, 0.5]) {
      box.expandByPoint(
        new THREE.Vector3().copy(o).addScaledVector(_x, su * flat.w).addScaledVector(_y, sv * flat.h)
      );
    }
  }
  return box;
}

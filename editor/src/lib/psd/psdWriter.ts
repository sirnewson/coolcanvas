/**
 * Pure TypeScript PSD (Photoshop Document) Writer & Exporter.
 * Serializes FlowCanvas document objects into standard binary PSD format (Adobe Photoshop Specification).
 */

import type { CanvasObject, BoardDoc } from "../../types";

class BinaryWriter {
  private chunks: Uint8Array[] = [];
  private currentBuffer: Uint8Array;
  private pos = 0;
  private chunkSize = 65536;

  constructor() {
    this.currentBuffer = new Uint8Array(this.chunkSize);
  }

  private ensure(bytes: number) {
    if (this.pos + bytes > this.currentBuffer.length) {
      this.chunks.push(this.currentBuffer.subarray(0, this.pos));
      this.currentBuffer = new Uint8Array(Math.max(this.chunkSize, bytes * 2));
      this.pos = 0;
    }
  }

  writeUint8(val: number) {
    this.ensure(1);
    this.currentBuffer[this.pos++] = val & 0xff;
  }

  writeInt16(val: number) {
    this.ensure(2);
    this.currentBuffer[this.pos++] = (val >> 8) & 0xff;
    this.currentBuffer[this.pos++] = val & 0xff;
  }

  writeUint16(val: number) {
    this.writeInt16(val);
  }

  writeInt32(val: number) {
    this.ensure(4);
    this.currentBuffer[this.pos++] = (val >> 24) & 0xff;
    this.currentBuffer[this.pos++] = (val >> 16) & 0xff;
    this.currentBuffer[this.pos++] = (val >> 8) & 0xff;
    this.currentBuffer[this.pos++] = val & 0xff;
  }

  writeUint32(val: number) {
    this.writeInt32(val);
  }

  writeString(str: string) {
    this.ensure(str.length);
    for (let i = 0; i < str.length; i++) {
      this.currentBuffer[this.pos++] = str.charCodeAt(i) & 0xff;
    }
  }

  writeBytes(bytes: Uint8Array) {
    this.ensure(bytes.length);
    this.currentBuffer.set(bytes, this.pos);
    this.pos += bytes.length;
  }

  toUint8Array(): Uint8Array {
    this.chunks.push(this.currentBuffer.subarray(0, this.pos));
    let totalLen = 0;
    for (const c of this.chunks) totalLen += c.length;
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of this.chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    return result;
  }
}

export function _encodePackBits(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const len = src.length;

  while (i < len) {
    // Check for run of identical bytes
    let runLen = 1;
    while (i + runLen < len && runLen < 128 && src[i + runLen] === src[i]) {
      runLen++;
    }

    if (runLen >= 3) {
      // Repeat block
      out.push(257 - runLen);
      out.push(src[i]);
      i += runLen;
    } else {
      // Literal block
      let litLen = 1;
      while (
        i + litLen < len &&
        litLen < 128 &&
        !(i + litLen + 2 < len && src[i + litLen] === src[i + litLen + 1] && src[i + litLen] === src[i + litLen + 2])
      ) {
        litLen++;
      }
      out.push(litLen - 1);
      for (let j = 0; j < litLen; j++) {
        out.push(src[i + j]);
      }
      i += litLen;
    }
  }
  return new Uint8Array(out);
}

const BLEND_KEYS: Record<string, string> = {
  normal: "norm",
  darken: "dark",
  multiply: "mul ",
  "color-burn": "idiv",
  "linear-burn": "lbrn",
  "darker-color": "dkCl",
  lighten: "lite",
  screen: "scrm",
  "color-dodge": "div ",
  "linear-dodge": "lddg",
  "lighter-color": "lgCl",
  overlay: "over",
  "soft-light": "sLit",
  "hard-light": "hLit",
  "vivid-light": "vLit",
  "linear-light": "lLit",
  "pin-light": "pLit",
  "hard-mix": "hMix",
  difference: "diff",
  exclusion: "smud",
  subtract: "fsub",
  divide: "fdiv",
  hue: "hue ",
  saturation: "sat ",
  color: "colr",
  luminosity: "lum ",
};

export interface LayerRenderSource {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  blendMode: string;
  hidden: boolean;
  clippingMask: boolean;
  canvas: HTMLCanvasElement;
}

/** Render a single object to an offscreen canvas for export. */
export async function renderObjectToCanvas(
  obj: CanvasObject,
  _doc?: BoardDoc
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const w = Math.max(1, Math.round(obj.width));
  const h = Math.max(1, Math.round(obj.height));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  if (obj.data.src) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = obj.data.src!;
    });
    ctx.drawImage(img, 0, 0, w, h);
  } else if (obj.type === "text") {
    ctx.font = `${obj.style.fontWeight ?? 400} ${obj.style.fontSize ?? 20}px ${obj.style.fontFamily ?? "sans-serif"}`;
    ctx.fillStyle = obj.style.color ?? "#ffffff";
    ctx.fillText(obj.data.text ?? "Text", 0, (obj.style.fontSize ?? 20) * 0.9);
  } else {
    // Vector / shape fill
    ctx.fillStyle = obj.style.fill ?? "#3b82f6";
    ctx.fillRect(0, 0, w, h);
    if (obj.style.stroke && obj.style.strokeWidth) {
      ctx.strokeStyle = obj.style.stroke;
      ctx.lineWidth = obj.style.strokeWidth;
      ctx.strokeRect(0, 0, w, h);
    }
  }

  return canvas;
}

/** Generate a complete PSD file ArrayBuffer from rendered layers. */
export async function createPsd(
  docWidth: number,
  docHeight: number,
  layers: LayerRenderSource[]
): Promise<Uint8Array> {
  const w = new BinaryWriter();

  const width = Math.max(1, Math.round(docWidth));
  const height = Math.max(1, Math.round(docHeight));

  // 1. Header (26 bytes)
  w.writeString("8BPS"); // Signature
  w.writeUint16(1); // Version 1
  for (let i = 0; i < 6; i++) w.writeUint8(0); // 6 reserved bytes
  w.writeUint16(4); // 4 channels (R, G, B, A)
  w.writeUint32(height); // Rows
  w.writeUint32(width); // Columns
  w.writeUint16(8); // Depth = 8 bits
  w.writeUint16(3); // ColorMode = 3 (RGB)

  // 2. Color Mode Data Section (4 bytes length: 0)
  w.writeUint32(0);

  // 3. Image Resources Section (Resolution 300 DPI)
  const resWriter = new BinaryWriter();
  resWriter.writeString("8BIM");
  resWriter.writeUint16(0x03ed); // ResolutionInfo
  resWriter.writeUint16(0); // Name length 0 + null
  resWriter.writeUint32(16); // Data length
  resWriter.writeUint32(300 << 16); // 300 dpi horizontal (fixed point)
  resWriter.writeUint16(1); // pixels per inch
  resWriter.writeUint16(1); // horizontal unit
  resWriter.writeUint32(300 << 16); // 300 dpi vertical
  resWriter.writeUint16(1);
  resWriter.writeUint16(1);
  const resBytes = resWriter.toUint8Array();

  w.writeUint32(resBytes.length);
  w.writeBytes(resBytes);

  // 4. Layer and Mask Information Section
  const lmWriter = new BinaryWriter();
  const layerCount = layers.length;

  if (layerCount > 0) {
    const layerInfoWriter = new BinaryWriter();
    layerInfoWriter.writeInt16(layerCount);

    // Precompute channels and pixels for each layer
    interface PreparedLayer {
      top: number;
      left: number;
      bottom: number;
      right: number;
      channels: { id: number; data: Uint8Array }[];
      blendKey: string;
      opacity: number;
      clipping: number;
      flags: number;
      name: string;
    }

    const prepLayers: PreparedLayer[] = [];

    for (const l of layers) {
      const top = Math.max(0, Math.round(l.y));
      const left = Math.max(0, Math.round(l.x));
      const lw = Math.max(1, Math.round(l.width));
      const lh = Math.max(1, Math.round(l.height));
      const bottom = top + lh;
      const right = left + lw;

      const ctx = l.canvas.getContext("2d");
      const imgData = ctx ? ctx.getImageData(0, 0, lw, lh) : null;
      const totalPx = lw * lh;

      const rChan = new Uint8Array(totalPx);
      const gChan = new Uint8Array(totalPx);
      const bChan = new Uint8Array(totalPx);
      const aChan = new Uint8Array(totalPx);

      if (imgData) {
        const d = imgData.data;
        for (let p = 0; p < totalPx; p++) {
          const idx = p * 4;
          rChan[p] = d[idx];
          gChan[p] = d[idx + 1];
          bChan[p] = d[idx + 2];
          aChan[p] = d[idx + 3];
        }
      }

      const blendKey = BLEND_KEYS[l.blendMode] || "norm";
      const opacity = Math.round(Math.max(0, Math.min(1, l.opacity)) * 255);
      const flags = l.hidden ? 2 : 0;

      prepLayers.push({
        top,
        left,
        bottom,
        right,
        channels: [
          { id: 0, data: rChan },
          { id: 1, data: gChan },
          { id: 2, data: bChan },
          { id: -1, data: aChan },
        ],
        blendKey,
        opacity,
        clipping: l.clippingMask ? 1 : 0,
        flags,
        name: l.name || "Layer",
      });
    }

    // Write layer records
    for (const pl of prepLayers) {
      layerInfoWriter.writeInt32(pl.top);
      layerInfoWriter.writeInt32(pl.left);
      layerInfoWriter.writeInt32(pl.bottom);
      layerInfoWriter.writeInt32(pl.right);
      layerInfoWriter.writeUint16(pl.channels.length);

      for (const ch of pl.channels) {
        layerInfoWriter.writeInt16(ch.id);
        // channel data length: 2 bytes compression header + raw length
        layerInfoWriter.writeUint32(ch.data.length + 2);
      }

      layerInfoWriter.writeString("8BIM");
      layerInfoWriter.writeString(pl.blendKey);
      layerInfoWriter.writeUint8(pl.opacity);
      layerInfoWriter.writeUint8(pl.clipping);
      layerInfoWriter.writeUint8(pl.flags);
      layerInfoWriter.writeUint8(0); // filler

      // Extra data
      const nameBytes = new TextEncoder().encode(pl.name);
      const nameLen = Math.min(255, nameBytes.length);
      const namePaddedLen = (4 - ((nameLen + 1) % 4)) % 4;
      const extraLen = 4 + 4 + (1 + nameLen + namePaddedLen);

      layerInfoWriter.writeUint32(extraLen);
      layerInfoWriter.writeUint32(0); // Layer mask data length: 0
      layerInfoWriter.writeUint32(0); // Layer blending ranges length: 0

      // Pascal string
      layerInfoWriter.writeUint8(nameLen);
      for (let i = 0; i < nameLen; i++) layerInfoWriter.writeUint8(nameBytes[i]);
      for (let i = 0; i < namePaddedLen; i++) layerInfoWriter.writeUint8(0);
    }

    // Write channel pixel data (compression 0 = raw)
    for (const pl of prepLayers) {
      for (const ch of pl.channels) {
        layerInfoWriter.writeUint16(0); // Raw compression
        layerInfoWriter.writeBytes(ch.data);
      }
    }

    const layerInfoBytes = layerInfoWriter.toUint8Array();
    lmWriter.writeUint32(layerInfoBytes.length);
    lmWriter.writeBytes(layerInfoBytes);
  } else {
    lmWriter.writeUint32(0);
  }

  const lmBytes = lmWriter.toUint8Array();
  w.writeUint32(lmBytes.length);
  w.writeBytes(lmBytes);

  // 5. Composite Image Data (Raw compression 0)
  w.writeUint16(0); // Raw
  const totalCompositePx = width * height;

  // Composite background plane: 255 (white) or clear
  const compPlane = new Uint8Array(totalCompositePx);
  compPlane.fill(255);

  w.writeBytes(compPlane); // Red
  w.writeBytes(compPlane); // Green
  w.writeBytes(compPlane); // Blue
  w.writeBytes(compPlane); // Alpha

  return w.toUint8Array();
}

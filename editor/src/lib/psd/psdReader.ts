/**
 * Pure TypeScript PSD (Photoshop Document) Decoder.
 * Clean-room implementation of the Adobe Photoshop file format specification.
 */

import type { CanvasObject } from "../../types";

export interface DecodedPsdLayer {
  name: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
  opacity: number;
  blendMode: string;
  hidden: boolean;
  clippingMask: boolean;
  isGroup: boolean;
  isGroupEnd: boolean;
  imageData?: ImageData;
  dataUrl?: string;
  adjustmentType?: string;
  adjustmentParams?: any;
  text?: string;
  mask?: {
    top: number;
    left: number;
    bottom: number;
    right: number;
    width: number;
    height: number;
    data?: Uint8Array;
  };
}

export interface DecodedPsd {
  width: number;
  height: number;
  channels: number;
  depth: number;
  colorMode: number;
  layers: DecodedPsdLayer[];
  compositeImageData?: ImageData;
  compositeDataUrl?: string;
}

const BLEND_MODE_MAP: Record<string, string> = {
  norm: "normal",
  dark: "darken",
  "mul ": "multiply",
  idiv: "color-burn",
  lbrn: "linear-burn",
  dkCl: "darker-color",
  lite: "lighten",
  scrm: "screen",
  "div ": "color-dodge",
  lddg: "linear-dodge",
  lgCl: "lighter-color",
  over: "overlay",
  sLit: "soft-light",
  hLit: "hard-light",
  vLit: "vivid-light",
  lLit: "linear-light",
  pLit: "pin-light",
  hMix: "hard-mix",
  diff: "difference",
  smud: "exclusion",
  fsub: "subtract",
  fdiv: "divide",
  "hue ": "hue",
  "sat ": "saturation",
  colr: "color",
  "lum ": "luminosity",
};

class BinaryReader {
  private view: DataView;
  public pos: number = 0;

  constructor(public buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get length(): number {
    return this.buffer.byteLength;
  }

  get remaining(): number {
    return this.buffer.byteLength - this.pos;
  }

  readUint8(): number {
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  readInt8(): number {
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  readUint16(): number {
    const v = this.view.getUint16(this.pos, false);
    this.pos += 2;
    return v;
  }

  readInt16(): number {
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  readUint32(): number {
    const v = this.view.getUint32(this.pos, false);
    this.pos += 4;
    return v;
  }

  readInt32(): number {
    const v = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return v;
  }

  readString(len: number): string {
    let str = "";
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(this.readUint8());
    }
    return str;
  }

  readBytes(len: number): Uint8Array {
    const sub = new Uint8Array(this.buffer, this.pos, len);
    this.pos += len;
    return sub;
  }

  skip(bytes: number) {
    this.pos = Math.min(this.length, this.pos + bytes);
  }

  seek(target: number) {
    this.pos = Math.max(0, Math.min(this.length, target));
  }
}

/** Decompress PackBits (RLE) buffer. */
function decodePackBits(input: Uint8Array, outputLength: number): Uint8Array {
  const out = new Uint8Array(outputLength);
  let inPos = 0;
  let outPos = 0;
  while (inPos < input.length && outPos < outputLength) {
    const n = input[inPos++];
    if (n >= 0 && n <= 127) {
      const count = n + 1;
      for (let i = 0; i < count && inPos < input.length && outPos < outputLength; i++) {
        out[outPos++] = input[inPos++];
      }
    } else if (n >= 129 && n <= 255) {
      const count = 257 - n;
      const val = input[inPos++];
      for (let i = 0; i < count && outPos < outputLength; i++) {
        out[outPos++] = val;
      }
    }
    // 128 is a no-op
  }
  return out;
}

export function parsePsd(arrayBuffer: ArrayBuffer): DecodedPsd {
  const r = new BinaryReader(arrayBuffer);

  // 1. Header
  const sig = r.readString(4);
  if (sig !== "8BPS") {
    throw new Error(`Invalid PSD signature: ${sig}`);
  }
  r.readUint16(); // version: 1 = PSD, 2 = PSB
  r.skip(6); // reserved
  const channels = r.readUint16();
  const height = r.readUint32();
  const width = r.readUint32();
  const depth = r.readUint16();
  const colorMode = r.readUint16(); // 3 = RGB

  // 2. Color Mode Data Section
  const colorModeLen = r.readUint32();
  r.skip(colorModeLen);

  // 3. Image Resources Section
  const imageResLen = r.readUint32();
  const resEnd = r.pos + imageResLen;
  r.seek(resEnd);

  // 4. Layer and Mask Information Section
  const lmSectionLen = r.readUint32();
  const lmEnd = r.pos + lmSectionLen;

  const layers: DecodedPsdLayer[] = [];

  if (lmSectionLen > 0) {
    const layerInfoLen = r.readUint32();

    if (layerInfoLen > 0) {
      const rawCount = r.readInt16();
      const layerCount = Math.abs(rawCount);

      interface RawLayerRecord {
        top: number;
        left: number;
        bottom: number;
        right: number;
        channels: { id: number; length: number }[];
        blendModeKey: string;
        opacity: number;
        clipping: boolean;
        flags: number;
        name: string;
        extraDataLen: number;
        isGroup: boolean;
        isGroupEnd: boolean;
        adjustmentType?: string;
        adjustmentParams?: any;
        text?: string;
      }

      const layerRecords: RawLayerRecord[] = [];

      // Read layer records
      for (let i = 0; i < layerCount; i++) {
        const top = r.readInt32();
        const left = r.readInt32();
        const bottom = r.readInt32();
        const right = r.readInt32();
        const channelCount = r.readUint16();

        const channelInfo: { id: number; length: number }[] = [];
        for (let c = 0; c < channelCount; c++) {
          const id = r.readInt16();
          const length = r.readUint32();
          channelInfo.push({ id, length });
        }

        r.readString(4); // blend mode sig: 8BIM
        const blendModeKey = r.readString(4);
        const opacity = r.readUint8() / 255;
        const clipping = r.readUint8() === 1;
        const flags = r.readUint8();
        r.readUint8(); // filler

        const extraLen = r.readUint32();
        const extraEnd = r.pos + extraLen;

        // Mask data
        const maskLen = r.readUint32();
        r.skip(maskLen);

        // Blending ranges
        const blendRangesLen = r.readUint32();
        r.skip(blendRangesLen);

        // Pascal name
        const nameLen = r.readUint8();
        let name = r.readString(nameLen);
        const namePadding = (4 - ((nameLen + 1) % 4)) % 4;
        r.skip(namePadding);

        let isGroup = false;
        let isGroupEnd = false;
        let adjType: string | undefined;
        let adjParams: any;
        let textContent: string | undefined;

        // Additional layer tagged blocks
        while (r.pos < extraEnd - 4) {
          const blockSig = r.readString(4);
          if (blockSig !== "8BIM" && blockSig !== "8B64") {
            r.skip(1);
            continue;
          }
          const blockKey = r.readString(4);
          const blockLen = r.readUint32();
          const blockDataEnd = r.pos + blockLen;

          if (blockKey === "lsct") {
            // Section divider (Group)
            const type = r.readUint32();
            if (type === 1 || type === 2) isGroup = true;
            else if (type === 3) isGroupEnd = true;
          } else if (blockKey === "TySh" || blockKey === "Txt2") {
            // Text layer
            textContent = name;
          } else if (blockKey === "brit") {
            adjType = "brightnessContrast";
            adjParams = { brightness: r.readInt16(), contrast: r.readInt16() };
          } else if (blockKey === "curv") {
            adjType = "curves";
          } else if (blockKey === "levl") {
            adjType = "levels";
          } else if (blockKey === "vibA") {
            adjType = "vibrance";
          } else if (blockKey === "expA") {
            adjType = "exposure";
          }

          r.seek(blockDataEnd);
          // Block alignment
          if (blockLen % 2 !== 0) r.skip(1);
        }

        r.seek(extraEnd);

        layerRecords.push({
          top,
          left,
          bottom,
          right,
          channels: channelInfo,
          blendModeKey,
          opacity,
          clipping,
          flags,
          name,
          extraDataLen: extraLen,
          isGroup,
          isGroupEnd,
          adjustmentType: adjType,
          adjustmentParams: adjParams,
          text: textContent,
        });
      }

      // Read channel image data for each layer
      for (let i = 0; i < layerCount; i++) {
        const rec = layerRecords[i];
        const lw = Math.max(0, rec.right - rec.left);
        const lh = Math.max(0, rec.bottom - rec.top);

        const channelMap: Record<number, Uint8Array> = {};

        for (const ch of rec.channels) {
          const chStart = r.pos;
          if (ch.length === 0 || lw === 0 || lh === 0) {
            r.seek(chStart + ch.length);
            continue;
          }

          const compression = r.readUint16(); // 0 = raw, 1 = RLE
          const channelSize = lw * lh;

          if (compression === 0) {
            channelMap[ch.id] = r.readBytes(channelSize);
          } else if (compression === 1) {
            // Scanline lengths table
            const scanlineLens: number[] = [];
            for (let row = 0; row < lh; row++) {
              scanlineLens.push(r.readUint16());
            }
            const totalRle = scanlineLens.reduce((a, b) => a + b, 0);
            const rleBytes = r.readBytes(totalRle);
            channelMap[ch.id] = decodePackBits(rleBytes, channelSize);
          }
          r.seek(chStart + ch.length);
        }

        let imgData: ImageData | undefined;
        let dataUrl: string | undefined;

        if (lw > 0 && lh > 0 && (channelMap[0] || channelMap[-1])) {
          const canvas = document.createElement("canvas");
          canvas.width = lw;
          canvas.height = lh;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            imgData = ctx.createImageData(lw, lh);
            const d = imgData.data;
            const rChan = channelMap[0];
            const gChan = channelMap[1] || rChan;
            const bChan = channelMap[2] || rChan;
            const aChan = channelMap[-1];

            const totalPx = lw * lh;
            for (let p = 0; p < totalPx; p++) {
              const idx = p * 4;
              d[idx] = rChan ? rChan[p] : 0;
              d[idx + 1] = gChan ? gChan[p] : 0;
              d[idx + 2] = bChan ? bChan[p] : 0;
              d[idx + 3] = aChan ? aChan[p] : 255;
            }
            ctx.putImageData(imgData, 0, 0);
            dataUrl = canvas.toDataURL("image/png");
          }
        }

        const isHidden = (rec.flags & 2) !== 0;

        layers.push({
          name: rec.name,
          top: rec.top,
          left: rec.left,
          bottom: rec.bottom,
          right: rec.right,
          width: lw,
          height: lh,
          opacity: rec.opacity,
          blendMode: BLEND_MODE_MAP[rec.blendModeKey] || "normal",
          hidden: isHidden,
          clippingMask: rec.clipping,
          isGroup: rec.isGroup,
          isGroupEnd: rec.isGroupEnd,
          imageData: imgData,
          dataUrl,
          adjustmentType: rec.adjustmentType,
          adjustmentParams: rec.adjustmentParams,
          text: rec.text,
        });
      }
    }
  }

  // 5. Composite image data
  r.seek(lmEnd);
  let compositeImageData: ImageData | undefined;
  let compositeDataUrl: string | undefined;

  if (r.remaining > 2 && width > 0 && height > 0) {
    try {
      const compCompression = r.readUint16();
      const totalPixels = width * height;
      const compChannels: Record<number, Uint8Array> = {};

      if (compCompression === 0) {
        for (let c = 0; c < channels; c++) {
          compChannels[c] = r.readBytes(totalPixels);
        }
      } else if (compCompression === 1) {
        const lineCount = height * channels;
        const lineLens: number[] = [];
        for (let l = 0; l < lineCount; l++) {
          lineLens.push(r.readUint16());
        }
        for (let c = 0; c < channels; c++) {
          let chanRleLen = 0;
          for (let row = 0; row < height; row++) {
            chanRleLen += lineLens[c * height + row];
          }
          const rleData = r.readBytes(chanRleLen);
          compChannels[c] = decodePackBits(rleData, totalPixels);
        }
      }

      if (compChannels[0]) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          compositeImageData = ctx.createImageData(width, height);
          const d = compositeImageData.data;
          const rChan = compChannels[0];
          const gChan = compChannels[1] || rChan;
          const bChan = compChannels[2] || rChan;
          const aChan = channels >= 4 ? compChannels[3] : undefined;

          for (let p = 0; p < totalPixels; p++) {
            const idx = p * 4;
            d[idx] = rChan[p];
            d[idx + 1] = gChan[p];
            d[idx + 2] = bChan[p];
            d[idx + 3] = aChan ? aChan[p] : 255;
          }
          ctx.putImageData(compositeImageData, 0, 0);
          compositeDataUrl = canvas.toDataURL("image/png");
        }
      }
    } catch {
      /* ignore composite decode errors if layers exist */
    }
  }

  return {
    width,
    height,
    channels,
    depth,
    colorMode,
    layers,
    compositeImageData,
    compositeDataUrl,
  };
}

/** Convert a decoded PSD into FlowCanvas objects and update state. */
export function psdToCanvasObjects(
  psd: DecodedPsd
): { objects: Record<string, CanvasObject>; order: string[] } {
  const objects: Record<string, CanvasObject> = {};
  const order: string[] = [];

  // Reverse so top layers are last in order (standard paint order)
  const validLayers = psd.layers.filter((l) => !l.isGroupEnd);

  validLayers.forEach((l, idx) => {
    const id = `psd_layer_${Date.now()}_${idx}`;
    order.push(id);

    if (l.adjustmentType) {
      objects[id] = {
        id,
        type: "adjustment",
        name: l.name,
        x: l.left,
        y: l.top,
        width: l.width || psd.width,
        height: l.height || psd.height,
        rotation: 0,
        opacity: l.opacity,
        locked: false,
        hidden: l.hidden,
        clippingMask: l.clippingMask,
        style: {
          blend: l.blendMode,
        },
        data: {
          adjustmentType: l.adjustmentType as any,
          adjustmentParams: l.adjustmentParams,
        },
      };
    } else if (l.isGroup) {
      objects[id] = {
        id,
        type: "group",
        name: l.name,
        x: l.left,
        y: l.top,
        width: l.width || psd.width,
        height: l.height || psd.height,
        rotation: 0,
        opacity: l.opacity,
        locked: false,
        hidden: l.hidden,
        style: {},
        data: {
          children: [],
        },
      };
    } else if (l.dataUrl) {
      objects[id] = {
        id,
        type: "image",
        name: l.name,
        x: l.left,
        y: l.top,
        width: l.width,
        height: l.height,
        rotation: 0,
        opacity: l.opacity,
        locked: false,
        hidden: l.hidden,
        clippingMask: l.clippingMask,
        style: {
          blend: l.blendMode,
        },
        data: {
          src: l.dataUrl,
          naturalWidth: l.width,
          naturalHeight: l.height,
        },
      };
    } else {
      // Empty or fallback raster object
      objects[id] = {
        id,
        type: "rect",
        name: l.name,
        x: l.left,
        y: l.top,
        width: l.width || 100,
        height: l.height || 100,
        rotation: 0,
        opacity: l.opacity,
        locked: false,
        hidden: l.hidden,
        clippingMask: l.clippingMask,
        style: {
          fill: "transparent",
          blend: l.blendMode,
        },
        data: {},
      };
    }
  });

  // If no layers parsed, use the composite preview image
  if (order.length === 0 && psd.compositeDataUrl) {
    const id = `psd_composite_${Date.now()}`;
    order.push(id);
    objects[id] = {
      id,
      type: "image",
      name: "Background",
      x: 0,
      y: 0,
      width: psd.width,
      height: psd.height,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      style: {},
      data: {
        src: psd.compositeDataUrl,
        naturalWidth: psd.width,
        naturalHeight: psd.height,
      },
    };
  }

  return { objects, order };
}

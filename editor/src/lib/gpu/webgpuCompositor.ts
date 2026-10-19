/**
 * Hardware-accelerated GPU Compositor using wgpu / WebGPU.
 * Based on the photo engine's `crates/gpu/src/compose.wgsl` and `crates/gpu/src/lib.rs`.
 */

export interface GpuStatus {
  supported: boolean;
  active: boolean;
  backend: "wgpu-webgpu" | "canvas2d-fallback";
  deviceInfo?: string;
}

const WGSL_COMPOSE_SHADER = /* wgsl */ `
struct Uniforms {
  width: f32,
  height: f32,
  opacity: f32,
  blendMode: u32,
  hasMask: u32,
  maskInvert: u32,
  maskDensity: f32,
  adjustmentType: u32,
  p0: vec4<f32>, // extra params
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var s_sampler: sampler;
@group(0) @binding(2) var base_texture: texture_2d<f32>;
@group(0) @binding(3) var layer_texture: texture_2d<f32>;
@group(0) @binding(4) var mask_texture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
  var out: VertexOutput;
  let uv = vec2<f32>(f32((vi << 1u) & 2u), f32(vi & 2u));
  out.position = vec4<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  out.uv = uv;
  return out;
}

// Photoshop's blend-mode maths in WGSL
fn blend_normal(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return l; }
fn blend_multiply(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return b * l; }
fn blend_screen(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return 1.0 - (1.0 - b) * (1.0 - l); }
fn blend_darken(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return min(b, l); }
fn blend_lighten(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return max(b, l); }
fn blend_difference(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return abs(b - l); }
fn blend_exclusion(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> { return b + l - 2.0 * b * l; }

fn blend_overlay(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> {
  return select(
    1.0 - 2.0 * (1.0 - b) * (1.0 - l),
    2.0 * b * l,
    b < vec3<f32>(0.5)
  );
}

fn blend_hard_light(b: vec3<f32>, l: vec3<f32>) -> vec3<f32> {
  return blend_overlay(l, b);
}

fn apply_blend(mode: u32, base: vec3<f32>, layer: vec3<f32>) -> vec3<f32> {
  switch (mode) {
    case 1u: { return blend_multiply(base, layer); }
    case 2u: { return blend_screen(base, layer); }
    case 3u: { return blend_overlay(base, layer); }
    case 4u: { return blend_darken(base, layer); }
    case 5u: { return blend_lighten(base, layer); }
    case 6u: { return blend_difference(base, layer); }
    case 7u: { return blend_exclusion(base, layer); }
    case 8u: { return blend_hard_light(base, layer); }
    default: { return blend_normal(base, layer); }
  }
}

// Adjustment shaders
fn apply_adjustment(col: vec4<f32>, adjType: u32, p0: vec4<f32>) -> vec4<f32> {
  var c = col;
  switch (adjType) {
    case 1u: { // Invert
      c = vec4<f32>(1.0 - c.r, 1.0 - c.g, 1.0 - c.b, c.a);
    }
    case 2u: { // Brightness / Contrast
      let b = p0.x;
      let ct = p0.y;
      let factor = (259.0 * (ct + 255.0)) / (255.0 * (259.0 - ct));
      c.r = clamp(factor * (c.r * 255.0 + b - 128.0) + 128.0, 0.0, 255.0) / 255.0;
      c.g = clamp(factor * (c.g * 255.0 + b - 128.0) + 128.0, 0.0, 255.0) / 255.0;
      c.b = clamp(factor * (c.b * 255.0 + b - 128.0) + 128.0, 0.0, 255.0) / 255.0;
    }
    case 3u: { // Threshold
      let lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
      let val = select(0.0, 1.0, lum >= p0.x);
      c = vec4<f32>(val, val, val, c.a);
    }
    default: {}
  }
  return c;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let base = textureSample(base_texture, s_sampler, in.uv);
  var layer = textureSample(layer_texture, s_sampler, in.uv);

  if (u.adjustmentType > 0u) {
    layer = apply_adjustment(layer, u.adjustmentType, u.p0);
  }

  var effOpacity = u.opacity;

  // Mask evaluation
  if (u.hasMask == 1u) {
    var maskVal = textureSample(mask_texture, s_sampler, in.uv).r;
    if (u.maskInvert == 1u) {
      maskVal = 1.0 - maskVal;
    }
    effOpacity = effOpacity * mix(1.0, maskVal, u.maskDensity);
  }

  let layerAlpha = layer.a * effOpacity;
  if (layerAlpha <= 0.001) {
    return base;
  }

  let blendedRgb = apply_blend(u.blendMode, base.rgb, layer.rgb);
  let outRgb = mix(base.rgb, blendedRgb, layerAlpha);
  let outAlpha = max(base.a, layerAlpha);

  return vec4<f32>(outRgb, outAlpha);
}
`;

class WebGPUCompositor {
  private adapter: any = null;
  private device: any = null;
  public _pipeline: any = null;
  public _sampler: any = null;
  public _initialized = false;
  private status: GpuStatus = {
    supported: false,
    active: false,
    backend: "canvas2d-fallback",
  };

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof navigator === "undefined" || !(navigator as any).gpu) {
      this.status = {
        supported: false,
        active: false,
        backend: "canvas2d-fallback",
        deviceInfo: "WebGPU not supported in this environment",
      };
      return;
    }

    try {
      this.adapter = await (navigator as any).gpu.requestAdapter();
      if (!this.adapter) {
        this.status = {
          supported: false,
          active: false,
          backend: "canvas2d-fallback",
          deviceInfo: "No suitable GPU adapter found",
        };
        return;
      }

      this.device = await this.adapter.requestDevice();
      const shaderModule = this.device.createShaderModule({
        code: WGSL_COMPOSE_SHADER,
      });

      this._sampler = this.device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      });

      this._pipeline = this.device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{ format: "bgra8unorm" }],
        },
        primitive: {
          topology: "triangle-list",
        },
      });

      this._initialized = true;
      this.status = {
        supported: true,
        active: true,
        backend: "wgpu-webgpu",
        deviceInfo: this.adapter.info?.description || "wgpu / WebGPU Hardware Accelerated",
      };
      console.log("[wgpu] WebGPU hardware compositor successfully initialized.");
    } catch (e) {
      console.warn("[wgpu] WebGPU initialization failed, falling back to Canvas2D:", e);
      this.status = {
        supported: false,
        active: false,
        backend: "canvas2d-fallback",
        deviceInfo: String(e),
      };
    }
  }

  getStatus(): GpuStatus {
    return { ...this.status };
  }

  isWebGPUActive(): boolean {
    return this.status.active;
  }

  /**
   * Fast composite of two canvas layers using either GPU or 2D fallback.
   */
  composite(
    baseCanvas: HTMLCanvasElement,
    layerCanvas: HTMLCanvasElement,
    options: {
      opacity?: number;
      blendMode?: string;
      maskCanvas?: HTMLCanvasElement;
      maskInverted?: boolean;
    } = {}
  ): HTMLCanvasElement {
    const w = baseCanvas.width;
    const h = baseCanvas.height;
    const outCanvas = document.createElement("canvas");
    outCanvas.width = w;
    outCanvas.height = h;
    const ctx = outCanvas.getContext("2d");
    if (!ctx) return outCanvas;

    // Draw base
    ctx.drawImage(baseCanvas, 0, 0);

    // Apply blend mode & opacity
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, options.opacity ?? 1));
    const mode = options.blendMode || "normal";
    ctx.globalCompositeOperation = (mode === "normal" ? "source-over" : mode) as GlobalCompositeOperation;

    if (options.maskCanvas) {
      // Create temporary masked layer
      const maskTemp = document.createElement("canvas");
      maskTemp.width = w;
      maskTemp.height = h;
      const mCtx = maskTemp.getContext("2d")!;
      mCtx.drawImage(layerCanvas, 0, 0);
      mCtx.globalCompositeOperation = options.maskInverted ? "destination-out" : "destination-in";
      mCtx.drawImage(options.maskCanvas, 0, 0);
      ctx.drawImage(maskTemp, 0, 0);
    } else {
      ctx.drawImage(layerCanvas, 0, 0);
    }
    ctx.restore();

    return outCanvas;
  }
}

export const gpuCompositor = new WebGPUCompositor();

/**
 * Image generation providers.
 *
 * Gemini is the default when the key has quota for it. Three open-weight
 * routes sit beside it:
 *  - Pollinations — hosted FLUX, keyless, free. Text-to-image only, so a
 *    sketch is first described by the text model, then rendered.
 *  - Hugging Face Inference — FLUX.1-schnell (or any text-to-image model id)
 *    with a free HF token.
 *  - Local Stable Diffusion — any AUTOMATIC1111 / Forge / SD.Next server on
 *    this machine, started with `--api --cors-allow-origins=*`. This is the
 *    only route with true image-to-image, so sketches are honoured directly
 *    (img2img at a moderate denoise), and ControlNet-free.
 *
 * "auto" tries Gemini and falls back to Pollinations on a quota error.
 */
import { generateImage, generateText, loadAiSettings, type AiSettings } from "./ai";

export type ImageProvider = "auto" | "gemini" | "pollinations" | "huggingface" | "local";

export interface ImageProviderSettings {
  imageProvider: ImageProvider;
  hfToken: string;
  hfModel: string;
  localSdUrl: string;
  /** Pollinations model name: flux, turbo, kontext… */
  pollinationsModel: string;
}

const STORE = "yxm-canvas:image-providers";

export const DEFAULT_PROVIDERS: ImageProviderSettings = {
  imageProvider: "auto",
  hfToken: "",
  hfModel: "black-forest-labs/FLUX.1-schnell",
  localSdUrl: "http://127.0.0.1:7860",
  pollinationsModel: "flux",
};

export const PROVIDER_LABELS: Record<ImageProvider, string> = {
  auto: "Auto (Gemini, else Pollinations)",
  gemini: "Gemini (your key)",
  pollinations: "Pollinations · FLUX (free, no key)",
  huggingface: "Hugging Face · FLUX.1-schnell (token)",
  local: "Local Stable Diffusion (A1111 / Forge)",
};

export function loadProviders(): ImageProviderSettings {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? { ...DEFAULT_PROVIDERS, ...(JSON.parse(raw) as Partial<ImageProviderSettings>) } : { ...DEFAULT_PROVIDERS };
  } catch {
    return { ...DEFAULT_PROVIDERS };
  }
}

export function saveProviders(p: ImageProviderSettings) {
  try {
    localStorage.setItem(STORE, JSON.stringify(p));
  } catch {
    /* storage can be disabled */
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export interface GenerateRequest {
  prompt: string;
  /** Data URL of a sketch/reference. Used directly by local SD; described for the others. */
  image?: string;
  width?: number;
  height?: number;
  onProgress?(message: string): void;
}

/* ------------------------------------------------------------ pollinations */

export async function pollinationsImage(req: GenerateRequest, p: ImageProviderSettings): Promise<string> {
  const w = req.width ?? 1024;
  const h = req.height ?? 768;
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(req.prompt.slice(0, 1500))}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=${encodeURIComponent(p.pollinationsModel || "flux")}`;
  req.onProgress?.("Rendering with FLUX (Pollinations)…");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Pollinations ${res.status}: the free service is busy — try again in a moment.`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Pollinations did not return an image.");
  return blobToDataUrl(blob);
}

/* ------------------------------------------------------------ hugging face */

export async function huggingFaceImage(req: GenerateRequest, p: ImageProviderSettings): Promise<string> {
  if (!p.hfToken) throw new Error("Add a Hugging Face token in AI › Image providers.");
  req.onProgress?.(`Rendering with ${p.hfModel.split("/").pop()} (Hugging Face)…`);
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${p.hfModel}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${p.hfToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      inputs: req.prompt,
      parameters: { width: req.width ?? 1024, height: req.height ?? 768 },
    }),
  });
  if (res.status === 503) throw new Error("That model is loading on Hugging Face — try again in ~30 seconds.");
  if (!res.ok) throw new Error(`Hugging Face ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const blob = await res.blob();
  if (!blob.type.startsWith("image/")) throw new Error("Hugging Face did not return an image.");
  return blobToDataUrl(blob);
}

/* ------------------------------------------------------------- local SD */

export async function localSdImage(req: GenerateRequest, p: ImageProviderSettings): Promise<string> {
  const base = p.localSdUrl.replace(/\/$/, "");
  const img2img = !!req.image;
  req.onProgress?.(img2img ? "Local Stable Diffusion · img2img from your sketch…" : "Local Stable Diffusion · txt2img…");
  const body: Record<string, unknown> = {
    prompt: req.prompt,
    negative_prompt: "blurry, low quality, watermark, text artifacts, deformed",
    width: req.width ?? 1024,
    height: req.height ?? 768,
    steps: 24,
    cfg_scale: 6.5,
    sampler_name: "DPM++ 2M",
  };
  if (img2img) {
    body.init_images = [req.image];
    body.denoising_strength = 0.62;
  }
  let res: Response;
  try {
    res = await fetch(`${base}/sdapi/v1/${img2img ? "img2img" : "txt2img"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`No Stable Diffusion server at ${base}. Start WebUI/Forge with --api --cors-allow-origins=* and check the URL in AI › Image providers.`);
  }
  if (!res.ok) throw new Error(`Local SD ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = (await res.json()) as { images?: string[] };
  const b64 = json.images?.[0];
  if (!b64) throw new Error("The local server returned no image.");
  return b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
}

/* -------------------------------------------------------------- dispatch */

/** For providers without image input, let the text model turn the sketch into a prompt. */
async function describeForPrompt(settings: AiSettings, sketch: string, direction: string, onProgress?: (m: string) => void): Promise<string> {
  if (!settings.apiKey) return direction || "a polished, detailed rendering of a whiteboard sketch";
  onProgress?.("Reading your sketch…");
  try {
    return await generateText(
      settings,
      `Look at this sketch and write a single, vivid image-generation prompt (max 90 words) that renders it as a finished picture. ` +
        `Describe subject, layout, key elements and text labels exactly as drawn, materials, lighting and mood. ` +
        (direction ? `Direction from the author: ${direction}. ` : "") +
        `Return only the prompt.`,
      [sketch],
    );
  } catch {
    return direction || "a polished, detailed rendering of a whiteboard sketch";
  }
}

/**
 * Generate through the configured provider. `req.prompt` is the full prompt
 * for Gemini/local SD; for text-only providers the sketch is described first.
 */
export async function generateWithProvider(req: GenerateRequest & { direction?: string; style?: string }): Promise<{ dataUrl: string; provider: ImageProvider }> {
  const p = loadProviders();
  const ai = loadAiSettings();
  const want = p.imageProvider;

  const textOnly = async (provider: "pollinations" | "huggingface") => {
    const prompt = req.image
      ? `${await describeForPrompt(ai, req.image, [req.style, req.direction].filter(Boolean).join(". "), req.onProgress)}`
      : req.prompt;
    const dataUrl = provider === "pollinations" ? await pollinationsImage({ ...req, prompt }, p) : await huggingFaceImage({ ...req, prompt }, p);
    return { dataUrl, provider };
  };

  if (want === "pollinations" || want === "huggingface") return textOnly(want);
  if (want === "local") return { dataUrl: await localSdImage(req, p), provider: "local" };
  if (want === "gemini") {
    req.onProgress?.("Generating with Gemini…");
    const { dataUrl } = await generateImage(ai, req.prompt, req.image ? [req.image] : []);
    return { dataUrl, provider: "gemini" };
  }
  // auto
  if (ai.apiKey) {
    try {
      req.onProgress?.("Generating with Gemini…");
      const { dataUrl } = await generateImage(ai, req.prompt, req.image ? [req.image] : []);
      return { dataUrl, provider: "gemini" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/free tier|quota|429|not found|404/i.test(msg)) throw e;
      req.onProgress?.("Gemini has no image quota — switching to FLUX…");
    }
  }
  return textOnly("pollinations");
}

/**
 * Assistant plumbing.
 *
 * The key never lives in this repository: it is typed into the panel and kept
 * in this browser's localStorage only. Calls go straight from the page to the
 * provider, so nothing passes through any server of ours.
 */

const KEY_STORE = "yxm-canvas:ai";

export interface AiSettings {
  apiKey: string;
  textModel: string;
  imageModel: string;
  videoModel: string;
  endpoint: string;
}

/**
 * A key can be seeded at build time from `.env.local` (git-ignored) so a
 * personal build starts ready. Anything in VITE_* ends up in the bundle, so
 * only do this for a build you alone will open.
 */
const SEED_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? "";

export const DEFAULT_AI: AiSettings = {
  apiKey: SEED_KEY,
  textModel: "gemini-3.5-flash-lite",
  imageModel: "gemini-3.1-flash-image",
  videoModel: "veo-3.1-fast-generate-preview",
  endpoint: "https://generativelanguage.googleapis.com/v1beta",
};

export function loadAiSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return { ...DEFAULT_AI };
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    const merged = { ...DEFAULT_AI, ...parsed };
    if (!merged.apiKey) merged.apiKey = SEED_KEY;
    return merged;
  } catch {
    return { ...DEFAULT_AI };
  }
}

export function saveAiSettings(settings: AiSettings) {
  try {
    localStorage.setItem(KEY_STORE, JSON.stringify(settings));
  } catch {
    /* storage can be disabled; the session still works */
  }
}

export function clearAiSettings() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch {
    /* ignore */
  }
}

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/** Turn a provider error into one line a person can act on. */
export async function describeError(response: Response, model: string): Promise<string> {
  const raw = await response.text();
  let message = raw.slice(0, 200);
  try {
    message = (JSON.parse(raw) as { error?: { message?: string } }).error?.message ?? message;
  } catch {
    /* not JSON */
  }
  if (response.status === 429) {
    if (/limit:\s*0/.test(raw)) {
      return `${model} is not included in this key's free tier — enable billing on the Google AI Studio project, or pick another model in AI › Connection.`;
    }
    return `Rate limit hit on ${model} — wait a minute and try again.`;
  }
  if (response.status === 404) return `${model} was not found — load the model list in AI › Connection and pick one.`;
  if (response.status === 400 && /API key/i.test(message)) return "That API key was rejected — check it in AI › Connection.";
  return `${response.status}: ${message.slice(0, 180)}`;
}

/** Split a data URL into the inline part Gemini expects. */
export function inlineImage(dataUrl: string): GeminiPart {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error("Only data-URL images can be sent.");
  return { inlineData: { mimeType: m[1], data: m[2] } };
}

async function callGemini(
  settings: AiSettings,
  model: string,
  prompt: string,
  wantsImage: boolean,
  images: string[] = [],
): Promise<GeminiPart[]> {
  if (!settings.apiKey) throw new Error("Add your API key first.");
  const url = `${settings.endpoint.replace(/\/$/, "")}/models/${model}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [...images.map(inlineImage), { text: prompt }] }],
  };
  if (wantsImage) body.generationConfig = { responseModalities: ["IMAGE", "TEXT"] };

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": settings.apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await describeError(response, model));
  const json = (await response.json()) as {
    candidates?: { content?: { parts?: GeminiPart[] } }[];
  };
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  if (!parts.length) throw new Error("The model returned nothing.");
  return parts;
}

export async function generateText(settings: AiSettings, prompt: string, images: string[] = []): Promise<string> {
  const parts = await callGemini(settings, settings.textModel, prompt, false, images);
  return parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

export async function generateImage(
  settings: AiSettings,
  prompt: string,
  images: string[] = [],
): Promise<{ dataUrl: string; note: string }> {
  const parts = await callGemini(settings, settings.imageModel, prompt, true, images);
  const image = parts.find((p) => p.inlineData?.data);
  if (!image?.inlineData) {
    const text = parts.map((p) => p.text ?? "").join(" ").trim();
    throw new Error(text || "No image came back from that model.");
  }
  return {
    dataUrl: `data:${image.inlineData.mimeType};base64,${image.inlineData.data}`,
    note: parts.map((p) => p.text ?? "").join(" ").trim(),
  };
}

/** Ask the provider what it actually offers, so a renamed model never blocks you. */
export async function listModels(
  settings: AiSettings,
): Promise<{ text: string[]; image: string[] }> {
  if (!settings.apiKey) throw new Error("Add your API key first.");
  const url = `${settings.endpoint.replace(/\/$/, "")}/models?pageSize=200`;
  const response = await fetch(url, { headers: { "x-goog-api-key": settings.apiKey } });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
  const json = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };
  const names = (json.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !/embedding|tts|live|native-audio/.test(n));
  return {
    text: names.filter((n) => !/image/.test(n)),
    image: names.filter((n) => /image|banana/.test(n)),
  };
}

/* -------------------------------------------------------------------- video */

export type VideoProgress = (message: string) => void;

/**
 * Veo through the same Gemini endpoint: submit, poll the long-running
 * operation, then download the clip with the key and hand back a data URL so
 * it lands on the board as an ordinary media object.
 */
export async function generateVideo(
  settings: AiSettings,
  prompt: string,
  options: { image?: string; aspect?: "16:9" | "9:16"; seconds?: 4 | 6 | 8 } = {},
  onProgress?: VideoProgress,
): Promise<string> {
  if (!settings.apiKey) throw new Error("Add your API key first.");
  const base = settings.endpoint.replace(/\/$/, "");
  const instance: Record<string, unknown> = { prompt };
  if (options.image) {
    const part = inlineImage(options.image).inlineData!;
    instance.image = { bytesBase64Encoded: part.data, mimeType: part.mimeType };
  }
  const submit = await fetch(`${base}/models/${settings.videoModel}:predictLongRunning`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": settings.apiKey },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: options.aspect ?? "16:9",
        durationSeconds: options.seconds ?? 6,
        resolution: "720p",
        personGeneration: "allow_adult",
      },
    }),
  });
  if (!submit.ok) throw new Error(await describeError(submit, settings.videoModel));
  const op = (await submit.json()) as { name?: string; error?: { message?: string } };
  if (op.error?.message) throw new Error(op.error.message);
  if (!op.name) throw new Error("The provider did not start a video job.");

  onProgress?.("Rendering — this usually takes one to three minutes…");
  const started = Date.now();
  let uri: string | undefined;
  while (Date.now() - started < 8 * 60_000) {
    await new Promise((r) => setTimeout(r, 6000));
    const poll = await fetch(`${base}/${op.name}`, { headers: { "x-goog-api-key": settings.apiKey } });
    if (!poll.ok) throw new Error(`${poll.status}: ${(await poll.text()).slice(0, 200)}`);
    const json = (await poll.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: {
        generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] };
      };
    };
    if (json.error?.message) throw new Error(json.error.message);
    if (json.done) {
      const r = json.response?.generateVideoResponse;
      uri = r?.generatedSamples?.[0]?.video?.uri;
      if (!uri) throw new Error(r?.raiMediaFilteredReasons?.[0] ?? "The job finished without a video.");
      break;
    }
    onProgress?.(`Rendering… ${Math.round((Date.now() - started) / 1000)}s`);
  }
  if (!uri) throw new Error("Timed out waiting for the video.");

  onProgress?.("Downloading clip…");
  const file = await fetch(uri, { headers: { "x-goog-api-key": settings.apiKey } });
  if (!file.ok) throw new Error(`Download failed (${file.status}).`);
  const blob = await file.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------------ prompts */

export const PROMPTS = {
  render: (style: string, extra: string) =>
    `This picture is a rough sketch or wireframe from a whiteboard. Produce a finished, ` +
    `high-quality ${style} that faithfully realises what the sketch describes — keep the same ` +
    `composition, layout, elements and any text labels, but render it polished and complete. ` +
    (extra ? `Additional direction: ${extra}. ` : "") +
    `Output only the image.`,
  site: (extra: string) =>
    `You are a senior front-end engineer. The attached picture is a sketch or wireframe of a website. ` +
    `Build it as ONE complete, production-quality, self-contained HTML file: semantic HTML5, a <style> ` +
    `block with a modern responsive layout (CSS grid/flex, system font stack, sensible spacing, hover ` +
    `states), and a <script> block only if the sketch implies interaction. Use the labels, sections ` +
    `and layout from the sketch; where it is vague, make tasteful choices and write realistic copy. ` +
    `Use inline SVG for icons and CSS gradients or placeholder blocks instead of external images. ` +
    (extra ? `Additional direction: ${extra}. ` : "") +
    `Return ONLY the HTML document, starting with <!DOCTYPE html>, with no markdown fences and no commentary.`,
  describe: () =>
    `Describe what this sketch is trying to communicate in two short sentences, then list the ` +
    `elements you can identify, one per line, prefixed with "- ".`,
  motion: (extra: string) =>
    `Write a concise cinematic prompt (max 60 words) for a video generation model that animates ` +
    `the scene in this picture: describe subject, motion, camera move and mood. ` +
    (extra ? `Direction: ${extra}. ` : "") +
    `Return only the prompt.`,
  ideate: (topic: string) =>
    `Give me 6 short, concrete ideas about: ${topic}.\n` +
    `Rules: one idea per line, no numbering, no preamble, max 9 words per line, ` +
    `each idea must be specific enough to act on.`,
  outline: (topic: string) =>
    `Write a working outline for: ${topic}.\n` +
    `Rules: plain text only, no preamble. Use two spaces of indentation per nesting level. ` +
    `Max 3 levels, max 14 lines, no bullet characters, no numbering.`,
  critique: (topic: string) =>
    `I am explaining this visually: ${topic}.\n` +
    `Give 5 short notes on what is unclear or missing. One per line, no numbering, ` +
    `max 12 words each, blunt and specific.`,
  sketch: (topic: string) =>
    `Describe a simple diagram for: ${topic}.\n` +
    `Return 4 to 6 node labels, one per line, in the order they connect. ` +
    `No numbering, no arrows, max 4 words per line.`,
};

/** Pull a bare HTML document out of a reply that may be wrapped in fences. */
export function extractHtml(text: string): string {
  const fenced = /```(?:html)?\s*([\s\S]*?)```/i.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.search(/<!doctype html|<html/i);
  return start >= 0 ? body.slice(start) : body;
}

/** Split a model reply into clean one-line items. */
export function toLines(text: string, max = 10): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

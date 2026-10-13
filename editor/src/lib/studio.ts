/**
 * Studio actions — the long-running, selection-driven commands shared by the
 * menu bar, the options strip, the Effects tab and the AI tab. Each one reads
 * the store, reports progress through `ui.job`, and lands its result on the
 * board as ordinary objects so undo, layers and export all just work.
 */
import { useStore } from "../store/store";
import type { CanvasObject } from "../types";
import { createEmbed, createImage, createMedia } from "../store/factory";
import { PROMPTS, extractHtml, generateText, generateVideo, loadAiSettings } from "./ai";
import { PROVIDER_LABELS, generateWithProvider } from "./imageProviders";
import {
  TRACE_PRESETS,
  createVector,
  downloadText,
  rasteriseObject,
  rasteriseObjects,
  removeBackgroundAi,
  removeBackgroundColorKey,
  vectorToSvg,
  vectoriseImage,
  type TraceOptions,
} from "./imageTools";
import { measureImage } from "./images";
import { objectBounds } from "./geom";

const S = useStore.getState;

function job(label: string, progress?: number) {
  S().setUi({ job: { label, progress } });
}
function done(hint?: string) {
  S().setUi({ job: null });
  if (hint) S().flashHint(hint);
}
function fail(e: unknown) {
  S().setUi({ job: null });
  const msg = e instanceof Error ? e.message : String(e);
  S().flashHint(msg.length > 180 ? `${msg.slice(0, 180)}…` : msg);
}

export function selectedObjects(): CanvasObject[] {
  const { doc, selection } = S();
  return selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o);
}

function selectedImage(): CanvasObject | null {
  return selectedObjects().find((o) => o.type === "image" && o.data.src) ?? null;
}

/** Every object on the board when nothing is selected, else the selection. */
function subject(): CanvasObject[] {
  const sel = selectedObjects();
  if (sel.length) return sel;
  const { doc } = S();
  return doc.order.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o && !o.hidden);
}

function placeBeside(source: CanvasObject[], o: CanvasObject) {
  const right = Math.max(...source.map((s) => objectBounds(s).x + objectBounds(s).width));
  const top = Math.min(...source.map((s) => objectBounds(s).y));
  o.x = right + 40;
  o.y = top;
}

/* --------------------------------------------------------- image tools */

export async function removeBackground(mode: "ai" | "key" = "ai", tolerance = 0.12) {
  const img = selectedImage();
  if (!img) return S().flashHint("Select an image first");
  try {
    job(mode === "ai" ? "Loading cut-out model…" : "Keying out background…");
    const src =
      mode === "ai"
        ? await removeBackgroundAi(img.data.src!, img.data.crop, (stage, cur, total) =>
            job(`${stage.replace(/_/g, " ")}…`, total ? cur / total : undefined),
          )
        : await removeBackgroundColorKey(img.data.src!, img.data.crop, tolerance);
    const size = await measureImage(src);
    S().patchObject(img.id, {
      data: { ...img.data, src, naturalWidth: size.width, naturalHeight: size.height, crop: undefined },
      name: img.name ? `${img.name.replace(/ \(cut-out\)$/, "")} (cut-out)` : "Cut-out",
    });
    done("Background removed");
  } catch (e) {
    fail(e);
  }
}

export async function vectorise(preset: string | TraceOptions = "poster") {
  const img = selectedImage();
  if (!img) return S().flashHint("Select an image first");
  const opts = typeof preset === "string" ? TRACE_PRESETS.find((p) => p.id === preset)?.opts ?? TRACE_PRESETS[1].opts : preset;
  try {
    job("Tracing vector paths…");
    const traced = await vectoriseImage(img.data.src!, img.data.crop, opts);
    const vec = createVector(img, traced);
    S().addObjects([vec]);
    done(`${traced.paths.length} vector shapes`);
  } catch (e) {
    fail(e);
  }
}

export function exportSvg() {
  const vec = selectedObjects().find((o) => o.type === "vector");
  if (!vec) return S().flashHint("Select a vector object first");
  downloadText(`${(vec.name ?? "vector").replace(/[^\w.-]+/g, "_")}.svg`, vectorToSvg(vec), "image/svg+xml");
}

/**
 * Bake: rasterise the selection with its effects, shadow and blend applied,
 * and replace it with one flat image (Photoshop's "flatten" / "rasterise").
 */
export async function flattenSelection() {
  const objects = selectedObjects();
  if (!objects.length) return S().flashHint("Select something to flatten");
  const { doc } = S();
  const canvas = objects.length === 1 ? rasteriseObject(objects[0], doc, 2, 12) : rasteriseObjects(objects, doc, 2, 12, true);
  if (!canvas) return;
  const src = canvas.toDataURL("image/png");
  const b = objects.length === 1 ? objectBounds(objects[0]) : null;
  const size = await measureImage(src);
  const image = createImage({ x: 0, y: 0 }, src, size.width, size.height, 1e9);
  if (b) {
    image.x = b.x - 12;
    image.y = b.y - 12;
    image.width = b.width + 24;
    image.height = b.height + 24;
  } else {
    const xs = objects.map(objectBounds);
    const minX = Math.min(...xs.map((r) => r.x));
    const minY = Math.min(...xs.map((r) => r.y));
    const maxX = Math.max(...xs.map((r) => r.x + r.width));
    const maxY = Math.max(...xs.map((r) => r.y + r.height));
    image.x = minX - 12;
    image.y = minY - 12;
    image.width = maxX - minX + 24;
    image.height = maxY - minY + 24;
  }
  image.name = objects.length === 1 ? `${objects[0].name ?? "Object"} (flattened)` : "Flattened";
  S().removeObjects(objects.map((o) => o.id));
  S().addObjects([image]);
  S().flashHint("Flattened to one image");
}

/* -------------------------------------------------------------- AI */

function snapshotDataUrl(objects: CanvasObject[]): string {
  const canvas = rasteriseObjects(objects, S().doc, 1.5, 24, false);
  if (!canvas) throw new Error("Nothing to capture.");
  return canvas.toDataURL("image/png");
}

export type RenderStyle = "photo" | "illustration" | "ui" | "product" | "3d" | "diagram";

export const RENDER_STYLES: { id: RenderStyle; label: string; prompt: string }[] = [
  { id: "photo", label: "Photo", prompt: "photorealistic photograph with natural light" },
  { id: "illustration", label: "Illustration", prompt: "clean flat vector illustration with a warm palette" },
  { id: "ui", label: "UI design", prompt: "pixel-perfect modern app or web interface mock-up" },
  { id: "product", label: "Product shot", prompt: "studio product render on a seamless backdrop" },
  { id: "3d", label: "3D render", prompt: "soft-lit 3D render, clay-and-glass materials" },
  { id: "diagram", label: "Diagram", prompt: "crisp technical diagram with labelled parts" },
];

/** Sketch → finished picture, placed to the right of what was captured. */
export async function sketchToImage(style: RenderStyle, extra = "") {
  const source = subject();
  if (!source.length) return S().flashHint("Draw or select something first");
  try {
    job("Reading your sketch…");
    const snap = snapshotDataUrl(source);
    const stylePrompt = RENDER_STYLES.find((r) => r.id === style)?.prompt ?? style;
    const { dataUrl, provider } = await generateWithProvider({
      prompt: PROMPTS.render(stylePrompt, extra),
      image: snap,
      style: stylePrompt,
      direction: extra,
      onProgress: (m) => job(m),
    });
    const size = await measureImage(dataUrl);
    const image = createImage({ x: 0, y: 0 }, dataUrl, size.width, size.height, 640);
    placeBeside(source, image);
    image.name = `AI ${RENDER_STYLES.find((r) => r.id === style)?.label ?? "render"}`;
    S().addObjects([image]);
    S().zoomToBounds(objectBounds(image), 120);
    done(`Image generated · ${PROVIDER_LABELS[provider].split(" ·")[0].split(" (")[0]}`);
  } catch (e) {
    fail(e);
  }
}

/** Sketch → a single-file website, kept on the board as a site card. */
export async function sketchToSite(extra = "") {
  const source = subject();
  if (!source.length) return S().flashHint("Sketch the page first");
  const settings = loadAiSettings();
  try {
    job("Reading your wireframe…");
    const snap = snapshotDataUrl(source);
    job("Writing the site…");
    const reply = await generateText(settings, PROMPTS.site(extra), [snap]);
    const html = extractHtml(reply);
    if (!/<html|<!doctype/i.test(html)) throw new Error("The model did not return an HTML page.");
    const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || "Generated site";
    const card = createEmbed({ x: 0, y: 0 }, "site://generated");
    card.width = 360;
    card.height = 132;
    card.name = title;
    card.data = { ...card.data, embedKind: "site", title, html, provider: "AI site", url: "" };
    placeBeside(source, card);
    S().addObjects([card]);
    openSite(card);
    done("Site generated — it opened in a new tab");
  } catch (e) {
    fail(e);
  }
}

export function openSite(o: CanvasObject) {
  if (!o.data.html) return;
  const url = URL.createObjectURL(new Blob([o.data.html], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadSite(o: CanvasObject) {
  if (!o.data.html) return;
  downloadText(`${(o.data.title ?? "site").replace(/[^\w.-]+/g, "_")}.html`, o.data.html, "text/html");
}

/** Sketch → short video clip (Veo), animating the captured picture. */
export async function sketchToVideo(extra = "", seconds: 4 | 6 | 8 = 6) {
  const source = subject();
  if (!source.length) return S().flashHint("Draw or select something first");
  const settings = loadAiSettings();
  try {
    job("Reading your sketch…");
    const snap = snapshotDataUrl(source);
    // For a still that is already a photo or render, animate it directly;
    // for a rough sketch, let the image model produce a keyframe first.
    const onlyImages = source.every((o) => o.type === "image");
    let keyframe = snap;
    if (!onlyImages) {
      job("Rendering a keyframe…");
      keyframe = (
        await generateWithProvider({
          prompt: PROMPTS.render("cinematic film still", extra),
          image: snap,
          style: "cinematic film still",
          direction: extra,
          onProgress: (m) => job(m),
        })
      ).dataUrl;
    }
    job("Writing the motion prompt…");
    const motion = await generateText(settings, PROMPTS.motion(extra), [keyframe]);
    job("Submitting to Veo…");
    const dataUrl = await generateVideo(settings, motion, { image: keyframe, seconds }, (m) => job(m));
    const clip = createMedia({ x: 0, y: 0 }, dataUrl, "video", "AI video", 1280, 720);
    clip.width = 560;
    clip.height = 315 + 34;
    placeBeside(source, clip);
    clip.name = "AI video";
    S().addObjects([clip]);
    S().zoomToBounds(objectBounds(clip), 120);
    done("Video generated");
  } catch (e) {
    fail(e);
  }
}

/** Ask the model what it sees — returned as text for the AI tab. */
export async function describeSketch(): Promise<string> {
  const source = subject();
  if (!source.length) throw new Error("Nothing on the board to read.");
  const settings = loadAiSettings();
  try {
    job("Reading the board…");
    const snap = snapshotDataUrl(source);
    const text = await generateText(settings, PROMPTS.describe(), [snap]);
    done();
    return text;
  } catch (e) {
    fail(e);
    return "";
  }
}

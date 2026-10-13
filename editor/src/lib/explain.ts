/**
 * "Explain this visually ✦" and Smart Insert.
 *
 * Smart Insert: a phrase ("checkout flow", "how solar panels work") becomes a
 * connected chain of steps. Explain visually: the text of a selected object
 * becomes a flow, a mind map or a storyboard. Both use the text model for the
 * structure and the recipe builders for the objects, so results are ordinary
 * editable, docked shapes.
 */
import { useStore } from "../store/store";
import type { CanvasObject, Point } from "../types";
import { generateText, loadAiSettings, toLines } from "./ai";
import { buildChain, buildMindMap, buildStoryboard } from "./recipes";
import { objectBounds } from "./geom";

const S = useStore.getState;

function parseJson<T>(raw: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  let body = (fenced ? fenced[1] : raw).trim();
  const a = body.search(/[[{]/);
  const b = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  if (a >= 0 && b > a) body = body.slice(a, b + 1);
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function needKey(): boolean {
  if (loadAiSettings().apiKey) return true;
  S().openDock("assist");
  S().flashHint("Add your API key in the AI tab first");
  return false;
}

function place(objects: CanvasObject[], hint: string) {
  S().addObjects(objects, false);
  S().setSelection(objects.filter((o) => o.type !== "arrow").map((o) => o.id));
  window.setTimeout(() => S().fitSelection(), 30);
  S().flashHint(hint);
}

/* ------------------------------------------------------------ smart insert */

/** Phrase → 3–7 connected steps, placed at `at`. */
export async function smartInsert(phrase: string, at: Point): Promise<void> {
  if (!needKey()) return;
  S().setUi({ job: { label: `Structuring “${phrase}”…` } });
  try {
    const raw = await generateText(
      loadAiSettings(),
      `Turn this into the steps or parts of a simple visual chain: "${phrase}".\n` +
        `Return 3 to 7 short labels, one per line, in order, no numbering, max 4 words each. ` +
        `If it is a cycle, add a final line "LOOP". Return only the lines.`,
    );
    const lines = toLines(raw, 8);
    const loop = lines[lines.length - 1]?.toUpperCase() === "LOOP";
    const labels = loop ? lines.slice(0, -1) : lines;
    if (labels.length < 2) throw new Error("Could not make a chain from that.");
    S().setUi({ job: null });
    place(buildChain(labels, at, { loop }), `${labels.length} steps — every box and arrow is editable`);
  } catch (e) {
    S().setUi({ job: null });
    S().flashHint(e instanceof Error ? e.message : String(e));
  }
}

/* -------------------------------------------------------- explain visually */

export type ExplainKind = "flow" | "mindmap" | "storyboard";

export const EXPLAIN_KINDS: { id: ExplainKind; label: string; hint: string }[] = [
  { id: "flow", label: "Turn into flow", hint: "Steps joined by arrows" },
  { id: "mindmap", label: "Turn into diagram", hint: "A centre with branches" },
  { id: "storyboard", label: "Turn into storyboard", hint: "Frames with captions" },
];

/** Source text from the selection: text, notes, captions, outline rows. */
export function selectedText(): { text: string; anchor: CanvasObject } | null {
  const { doc, selection } = S();
  const objects = selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o);
  const parts: string[] = [];
  for (const o of objects) {
    if (o.data.text?.trim()) parts.push(o.data.text.trim());
    if (o.data.items?.length) parts.push(o.data.items.map((i) => `${"  ".repeat(i.level)}${i.text}`).join("\n"));
    if (o.data.front) parts.push(`${o.data.front} — ${o.data.back ?? ""}`);
  }
  const text = parts.join("\n").trim();
  return text && objects[0] ? { text, anchor: objects[0] } : null;
}

export async function explainVisually(kind: ExplainKind): Promise<void> {
  const src = selectedText();
  if (!src) return S().flashHint("Select some text or a note first");
  if (!needKey()) return;
  const b = objectBounds(src.anchor);
  const at = { x: b.x + b.width + 80, y: b.y };
  S().setUi({ job: { label: "Reading the text…" } });
  const settings = loadAiSettings();
  try {
    if (kind === "flow") {
      const raw = await generateText(
        settings,
        `Read this and express it as a sequence of 3–7 steps: """${src.text}"""\n` +
          `Return JSON only: {"steps":["..."],"loop":false,"edges":["optional label between step 1 and 2", ...]}. Labels max 4 words.`,
      );
      const j = parseJson<{ steps?: string[]; loop?: boolean; edges?: string[] }>(raw);
      if (!j?.steps?.length) throw new Error("Could not find steps in that text.");
      S().setUi({ job: null });
      place(buildChain(j.steps.slice(0, 7), at, { loop: !!j.loop, edgeLabels: j.edges }), "Flow built — drag any box, arrows follow");
      return;
    }
    if (kind === "mindmap") {
      const raw = await generateText(
        settings,
        `Read this and express it as a mind map: """${src.text}"""\n` +
          `Return JSON only: {"centre":"...","branches":[{"label":"...","children":["...","..."]}]}. 3–6 branches, up to 3 children each, labels max 4 words.`,
      );
      const j = parseJson<{ centre?: string; branches?: { label: string; children?: string[] }[] }>(raw);
      if (!j?.centre || !j.branches?.length) throw new Error("Could not find a structure in that text.");
      S().setUi({ job: null });
      place(buildMindMap(j.centre, j.branches.slice(0, 6), { x: at.x + 320, y: at.y + 200 }), "Diagram built");
      return;
    }
    const raw = await generateText(
      settings,
      `Read this and express it as a storyboard of 4–6 scenes: """${src.text}"""\n` +
        `Return JSON only: {"scenes":[{"title":"...","caption":"one sentence of what happens"}]}. Titles max 4 words.`,
    );
    const j = parseJson<{ scenes?: { title: string; caption?: string }[] }>(raw);
    if (!j?.scenes?.length) throw new Error("Could not find scenes in that text.");
    S().setUi({ job: null });
    place(buildStoryboard(j.scenes.slice(0, 8), at), "Storyboard built — drop pictures into the frames");
  } catch (e) {
    S().setUi({ job: null });
    S().flashHint(e instanceof Error ? e.message : String(e));
  }
}

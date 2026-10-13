/**
 * "What do you want to sketch?" — turns a thought into a structured board:
 * a brief, wireframes in device frames, a flow of connected nodes, notes and
 * a next-steps outline. The model returns a compact JSON scene; this module
 * validates it and builds real board objects, so everything it makes is
 * editable, connectable and undoable like anything drawn by hand.
 */
import { useStore } from "../store/store";
import type { CanvasObject, FrameKind, NoteKind, TextRole } from "../types";
import { createFrame, createList, createNote, createPlaceholder, createShape, createText } from "../store/factory";
import { generateText, loadAiSettings } from "./ai";
import { uid } from "./id";
import { objectBounds } from "./geom";

interface SceneItem {
  t: "frame" | "rect" | "ellipse" | "diamond" | "text" | "note" | "list" | "arrow" | "image";
  id?: string;
  label?: string;
  text?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  kind?: string;
  role?: string;
  fill?: string;
  items?: string[];
  from?: string;
  to?: string;
  parent?: string;
}

interface Scene {
  title?: string;
  objects?: SceneItem[];
}

export const BOARD_PROMPT = (idea: string, focus: string) =>
  `You are a product designer sketching on an infinite whiteboard. The user says: "${idea}".
${focus ? `They want the board to focus on: ${focus}.\n` : ""}
Lay out a complete working board that structures their thinking. Include, as fits the idea:
- a short brief at the top: a heading, one line of intent, and 2-3 sticky notes (goal, audience, open question)
- wireframes: one frame per key screen/page with labelled blocks inside. Use real, current web patterns: a 64px navbar with brand + links + primary button; hero with headline, subline, two buttons and an image slot; feature grid of 3 cards; stat tiles; data table with header row; sidebar (240px) + content layouts for app screens; forms with labelled fields and a primary action; pricing tiers; footer columns. Browser frames are 1200×800, phone frames 390×844.
- a flow diagram: 4-7 boxes connected with arrows showing the journey or process
- an outline of next steps or components
- more notes for risks or ideas

Return ONLY JSON, no prose, no markdown fences, with this shape:
{"title":"...","objects":[
 {"t":"text","id":"h1","text":"Heading","role":"heading","x":0,"y":0,"w":600},
 {"t":"note","id":"n1","text":"...","kind":"idea|question|important|todo|plan","x":0,"y":80},
 {"t":"frame","id":"f1","label":"Home page","kind":"browser|phone|tablet|plain","x":0,"y":320,"w":720,"h":480},
 {"t":"rect","id":"r1","label":"Hero","parent":"f1","x":24,"y":60,"w":672,"h":160,"fill":"#eef3fd"},
 {"t":"image","id":"i1","parent":"f1","x":24,"y":240,"w":200,"h":140},
 {"t":"ellipse","id":"e1","label":"Start","x":900,"y":320,"w":150,"h":80},
 {"t":"diamond","id":"d1","label":"Signed in?","x":1100,"y":320,"w":180,"h":110},
 {"t":"arrow","from":"e1","to":"d1","label":"opens"},
 {"t":"list","id":"l1","items":["Next steps","  Item one","  Item two"],"x":0,"y":900,"w":360}
]}
Rules: coordinates are pixels; children of a frame use coordinates relative to the frame's top-left and must fit inside it; keep the whole board within 0..2400 wide and 0..1800 tall; leave 40px gaps; every object needs a unique id; text in labels must be short and real (no lorem ipsum); 15 to 40 objects.`;

function parseScene(raw: string): Scene {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  let body = (fenced ? fenced[1] : raw).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start >= 0 && end > start) body = body.slice(start, end + 1);
  try {
    return JSON.parse(body) as Scene;
  } catch {
    throw new Error("The model did not return a valid board. Try rephrasing.");
  }
}

const NOTE_KINDS = new Set<NoteKind>(["idea", "question", "important", "research", "todo", "plan", "quote", "cool"]);
const FRAME_KINDS = new Set<FrameKind>(["plain", "browser", "phone", "tablet", "desktop", "watch"]);
const ROLES = new Set<TextRole>(["heading", "subhead", "body", "caption", "label"]);

/** Build board objects from a scene. Pure — returns objects, adds nothing. */
export function buildScene(scene: Scene, origin = { x: 0, y: 0 }): CanvasObject[] {
  const d = useStore.getState().defaults;
  const out: CanvasObject[] = [];
  const byId = new Map<string, CanvasObject>();
  const items = (scene.objects ?? []).filter((i) => i && typeof i === "object");
  const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

  // Frames first so children can resolve their parent.
  const ordered = [...items.filter((i) => i.t === "frame"), ...items.filter((i) => i.t !== "frame" && i.t !== "arrow")];
  for (const it of ordered) {
    const parent = it.parent ? byId.get(it.parent) : undefined;
    const px = parent ? parent.x : origin.x;
    const py = parent ? parent.y : origin.y;
    const x = px + num(it.x, 0);
    const y = py + num(it.y, 0);
    let o: CanvasObject | null = null;
    const label = (it.label ?? it.text ?? "").toString().slice(0, 120);

    if (it.t === "frame") {
      const kind = FRAME_KINDS.has(it.kind as FrameKind) ? (it.kind as FrameKind) : "plain";
      o = createFrame({ x, y }, label || "Frame", kind);
      o.width = num(it.w, 640);
      o.height = num(it.h, 420);
    } else if (it.t === "rect" || it.t === "ellipse" || it.t === "diamond") {
      o = createShape(it.t, { x, y }, d);
      o.x = x;
      o.y = y;
      o.width = num(it.w, 160);
      o.height = num(it.h, 80);
      o.style = {
        ...o.style,
        fill: typeof it.fill === "string" && /^#[0-9a-f]{3,8}$/i.test(it.fill) ? it.fill : "#ffffff",
        stroke: d.ink,
        strokeWidth: 1.5,
        radius: 6,
        fontSize: 14,
        align: "center",
        verticalAlign: "middle",
        color: d.ink,
      };
      o.data = { ...o.data, text: label };
    } else if (it.t === "text") {
      const role = ROLES.has(it.role as TextRole) ? (it.role as TextRole) : "body";
      o = createText({ x, y }, d, role);
      o.x = x;
      o.y = y;
      o.width = num(it.w, role === "heading" ? 600 : 360);
      o.data.text = label;
      o.height = Math.max(o.height, Math.ceil(label.length / (o.width / ((o.style.fontSize ?? 16) * 0.55)) + 1) * (o.style.fontSize ?? 16) * 1.4);
    } else if (it.t === "note") {
      const kind = NOTE_KINDS.has(it.kind as NoteKind) ? (it.kind as NoteKind) : "idea";
      o = createNote({ x, y }, kind, d);
      o.x = x;
      o.y = y;
      o.width = num(it.w, 200);
      o.height = num(it.h, 180);
      o.data.text = label;
    } else if (it.t === "list") {
      const lines = Array.isArray(it.items) ? it.items.map(String).slice(0, 20) : [label];
      o = createList(
        { x, y },
        d,
        lines.map((line) => ({
          id: uid("li"),
          text: line.trim(),
          level: Math.min(3, Math.floor((/^(\s*)/.exec(line)?.[1].length ?? 0) / 2)),
        })),
      );
      o.x = x;
      o.y = y;
      o.width = num(it.w, 340);
    } else if (it.t === "image") {
      o = createPlaceholder({ x, y }, num(it.w, 220), num(it.h, 160));
      o.x = x;
      o.y = y;
    }
    if (!o) continue;
    if (parent) o.parentId = parent.id;
    if (it.id) byId.set(String(it.id), o);
    out.push(o);
  }

  for (const it of items.filter((i) => i.t === "arrow")) {
    const a = it.from ? byId.get(it.from) : undefined;
    const b = it.to ? byId.get(it.to) : undefined;
    if (!a || !b) continue;
    const ab = objectBounds(a);
    const bb = objectBounds(b);
    const arrow: CanvasObject = {
      id: uid("arrow"),
      type: "arrow",
      x: ab.x + ab.width,
      y: ab.y + ab.height / 2,
      width: bb.x - (ab.x + ab.width),
      height: bb.y + bb.height / 2 - (ab.y + ab.height / 2),
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      style: { stroke: d.ink, strokeWidth: 1.5, arrowEnd: true, fontSize: 12 },
      data: {
        points: [0, 0, bb.x - (ab.x + ab.width), bb.y + bb.height / 2 - (ab.y + ab.height / 2)],
        from: { id: a.id },
        to: { id: b.id },
        text: it.label ? String(it.label).slice(0, 40) : undefined,
      },
    };
    out.push(arrow);
  }
  return out;
}

/** Ask, build, place, frame. Returns the title the model chose. */
export async function boardFromIdea(idea: string, focus = ""): Promise<string> {
  const settings = loadAiSettings();
  const s = useStore.getState;
  s().setUi({ job: { label: "Structuring your idea…" } });
  try {
    const raw = await generateText(settings, BOARD_PROMPT(idea, focus));
    const scene = parseScene(raw);
    const objects = buildScene(scene);
    if (!objects.length) throw new Error("The model returned an empty board.");
    s().addObjects(objects, false);
    // Nudge connectors so they dock to their nodes' nearest edges.
    const arrow = objects.find((o) => o.type === "arrow" && o.data.to);
    if (arrow) s().bindEndpoint(arrow.id, "to", arrow.data.to);
    s().setUi({ job: null });
    window.setTimeout(() => s().fitAll(), 30);
    s().flashHint(`${objects.length} objects sketched — everything is editable`);
    return scene.title ?? idea.slice(0, 40);
  } catch (e) {
    s().setUi({ job: null });
    s().flashHint(e instanceof Error ? e.message : String(e));
    throw e;
  }
}

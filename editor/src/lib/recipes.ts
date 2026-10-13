/**
 * Visual recipes — small ready-made thinking structures (Problem → Cause →
 * Solution, Before → Change → After…) plus the chain/tree/storyboard builders
 * that Smart Insert and "Explain visually" also use. Everything comes out as
 * plain objects with docked arrows, so it stays editable and re-routes.
 */
import type { CanvasObject, NoteKind, Point } from "../types";
import { createFrame, createNote, createText, stampRect, type Stamp } from "../store/factory";
import { uid } from "../lib/id";
import { useStore } from "../store/store";

const NODE_W = 170;
const NODE_H = 76;
const GAP = 60;

function arrowBetween(a: CanvasObject, b: CanvasObject, label?: string): CanvasObject {
  const ax = a.x + a.width;
  const ay = a.y + a.height / 2;
  const bx = b.x;
  const by = b.y + b.height / 2;
  return {
    id: uid("arrow"),
    type: "arrow",
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    style: { stroke: useStore.getState().defaults.ink, strokeWidth: 1.5, arrowEnd: true, fontSize: 12 },
    data: {
      points: [ax - Math.min(ax, bx), ay - Math.min(ay, by), bx - Math.min(ax, bx), by - Math.min(ay, by)],
      from: { id: a.id },
      to: { id: b.id },
      text: label,
    },
  };
}

function node(at: Point, label: string, opts: { fill?: string; type?: "rect" | "ellipse" | "diamond"; w?: number; h?: number } = {}): CanvasObject {
  const d = useStore.getState().defaults;
  const o = stampRect(at, opts.w ?? NODE_W, opts.h ?? NODE_H, {
    type: opts.type ?? "rect",
    fill: opts.fill ?? "#ffffff",
    stroke: d.ink,
    strokeWidth: 1.5,
    radius: 8,
    fontSize: 14,
    fontFamily: d.fontFamily,
    text: label,
  });
  return o;
}

/** A row (or column) of connected nodes; `loop` adds the closing arrow. */
export function buildChain(
  labels: string[],
  at: Point,
  opts: { direction?: "row" | "col"; loop?: boolean; fills?: string[]; type?: "rect" | "ellipse" | "diamond"; edgeLabels?: string[] } = {},
): CanvasObject[] {
  const dir = opts.direction ?? "row";
  const nodes = labels.map((label, i) =>
    node(
      dir === "row" ? { x: at.x + i * (NODE_W + GAP), y: at.y } : { x: at.x, y: at.y + i * (NODE_H + GAP) },
      label,
      { fill: opts.fills?.[i % (opts.fills.length || 1)], type: opts.type },
    ),
  );
  const arrows: CanvasObject[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) arrows.push(arrowBetween(nodes[i], nodes[i + 1], opts.edgeLabels?.[i]));
  if (opts.loop && nodes.length > 1) {
    const back = arrowBetween(nodes[nodes.length - 1], nodes[0], opts.edgeLabels?.[nodes.length - 1]);
    back.style.curve = 0.35;
    arrows.push(back);
  }
  return [...nodes, ...arrows];
}

/** Hub-and-spoke mind map: a centre node and branches around it. */
export function buildMindMap(centre: string, branches: { label: string; children?: string[] }[], at: Point): CanvasObject[] {
  const hub = node({ x: at.x - 100, y: at.y - 40 }, centre, { w: 200, h: 80, fill: "#fdf0b8", type: "ellipse" });
  const out: CanvasObject[] = [hub];
  const n = Math.max(1, branches.length);
  const radius = 260;
  branches.forEach((b, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const bx = at.x + Math.cos(a) * radius - NODE_W / 2;
    const by = at.y + Math.sin(a) * radius - NODE_H / 2;
    const branch = node({ x: bx, y: by }, b.label, { fill: "#eef3fd" });
    out.push(branch, arrowBetween(hub, branch));
    (b.children ?? []).slice(0, 3).forEach((c, j) => {
      const cx = bx + Math.cos(a) * 200 - NODE_W / 2 + NODE_W / 2;
      const cy = by + Math.sin(a) * 200 + (j - 1) * 70;
      const leaf = node({ x: cx, y: cy }, c, { w: 150, h: 54 });
      leaf.style.fontSize = 12;
      out.push(leaf, arrowBetween(branch, leaf));
    });
  });
  return out;
}

/** Storyboard: numbered frames with a caption under each. */
export function buildStoryboard(scenes: { title: string; caption?: string }[], at: Point): CanvasObject[] {
  const d = useStore.getState().defaults;
  const out: CanvasObject[] = [];
  const W = 260;
  const H = 170;
  scenes.slice(0, 8).forEach((s, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = at.x + col * (W + 40);
    const y = at.y + row * (H + 110);
    const frame = createFrame({ x, y }, `${i + 1}. ${s.title}`, "plain");
    frame.width = W;
    frame.height = H;
    const cap = createText({ x, y: y + H + 12 }, d, "caption");
    cap.width = W;
    cap.data.text = s.caption ?? s.title;
    cap.height = 40;
    out.push(frame, cap);
    if (i > 0 && col > 0) {
      const prev = out[(i - 1) * 2];
      out.push(arrowBetween(prev, frame));
    }
  });
  return out;
}

/** A row of sticky notes (for "notes" style recipes). */
export function buildNotes(items: { text: string; kind: NoteKind }[], at: Point): CanvasObject[] {
  const d = useStore.getState().defaults;
  return items.map((it, i) => {
    const n = createNote({ x: at.x + i * 230, y: at.y }, it.kind, d);
    n.width = 210;
    n.height = 180;
    n.data.text = it.text;
    return n;
  });
}

/* ---------------------------------------------------------------- recipes */

const chainRecipe = (id: string, label: string, steps: string[], group: string, extra: Parameters<typeof buildChain>[2] = {}): Stamp => ({
  id,
  label,
  group,
  width: steps.length * (NODE_W + GAP) - GAP,
  height: extra.loop ? NODE_H + 60 : NODE_H,
  build: (at) => buildChain(steps, at, extra),
});

export const RECIPES: Stamp[] = [
  chainRecipe("r-problem", "Problem → Cause → Solution", ["Problem", "Cause", "Solution"], "Reasoning", { fills: ["#fdeeec", "#fdf3c4", "#e2f3ec"] }),
  chainRecipe("r-before", "Before → Change → After", ["Before", "Change", "After"], "Reasoning", { fills: ["#f0efe9", "#eef3fd", "#e2f3ec"] }),
  chainRecipe("r-input", "Input → Process → Output", ["Input", "Process", "Output"], "Reasoning"),
  chainRecipe("r-goal", "Goal → Obstacles → Actions → Result", ["Goal", "Obstacles", "Actions", "Result"], "Reasoning", { fills: ["#fdf3c4", "#fdeeec", "#eef3fd", "#e2f3ec"] }),
  chainRecipe("r-what", "What? → So what? → Now what?", ["What?", "So what?", "Now what?"], "Reasoning", { type: "ellipse" }),
  chainRecipe("r-cause-effect", "Cause → Effect", ["Cause", "Effect"], "Reasoning", { edgeLabels: ["leads to"] }),
  chainRecipe("r-learn", "Idea → Test → Learn → Repeat", ["Idea", "Test", "Learn"], "Loops", { loop: true, edgeLabels: ["", "", "repeat"], fills: ["#fdf3c4", "#eef3fd", "#e2f3ec"] }),
  chainRecipe("r-build", "Build → Measure → Learn", ["Build", "Measure", "Learn"], "Loops", { loop: true }),
  chainRecipe("r-ooda", "Observe → Orient → Decide → Act", ["Observe", "Orient", "Decide", "Act"], "Loops", { loop: true }),
  chainRecipe("r-journey", "Discover → Consider → Buy → Retain", ["Discover", "Consider", "Buy", "Retain"], "Journeys", { fills: ["#eef3fd", "#eef3fd", "#e2f3ec", "#fdf3c4"] }),
  chainRecipe("r-funnel", "Aware → Interested → Trial → Paying", ["Aware", "Interested", "Trial", "Paying"], "Journeys"),
  chainRecipe("r-onboarding", "Sign up → Setup → First win → Habit", ["Sign up", "Setup", "First win", "Habit"], "Journeys"),
  chainRecipe("r-checkout", "Cart → Address → Payment → Confirm", ["Cart", "Address", "Payment", "Confirm"], "Journeys"),
  chainRecipe("r-system", "Sun → Panels → Inverter → Battery → House", ["Source", "Capture", "Convert", "Store", "Use"], "Systems"),
  chainRecipe("r-pipeline", "Collect → Clean → Model → Serve", ["Collect", "Clean", "Model", "Serve"], "Systems"),
  chainRecipe("r-request", "Client → API → Service → Database", ["Client", "API", "Service", "Database"], "Systems", { edgeLabels: ["request", "call", "query"] }),
  {
    id: "r-kanban",
    label: "Kanban · Backlog → Done",
    group: "Boards",
    width: 5 * 200 - 20,
    height: 420,
    build: (at) => {
      const d = useStore.getState().defaults;
      const out: CanvasObject[] = [];
      ["Backlog", "To do", "Doing", "Review", "Done"].forEach((c, i) => {
        const col = stampRect({ x: at.x + i * 200, y: at.y }, 180, 420, { fill: "#f6f5f2", stroke: "#f6f5f2", radius: 12, text: "" });
        const title = createText({ x: at.x + i * 200 + 14, y: at.y + 12 }, d, "label");
        title.data.text = c.toUpperCase();
        title.width = 150;
        out.push(col, title);
        if (i < 3) {
          const n = createNote({ x: at.x + i * 200 + 12, y: at.y + 44 }, i === 0 ? "idea" : i === 1 ? "todo" : "plan", d);
          n.width = 156;
          n.height = 110;
          n.data.text = ["Research pricing", "Draft onboarding", "Nav redesign"][i];
          out.push(n);
        }
      });
      return out;
    },
  },
  {
    id: "r-matrix",
    label: "Impact × Effort matrix",
    group: "Boards",
    width: 520,
    height: 520,
    build: (at) => {
      const d = useStore.getState().defaults;
      const q = (x: number, y: number, label: string, fill: string) => stampRect({ x, y }, 250, 250, { fill, stroke: "#e3e1d9", radius: 12, text: label, color: "#8a8a82", fontSize: 12, verticalAlign: "top", padding: 12 });
      const out = [
        q(at.x, at.y, "High impact · Low effort — do first", "#e2f3ec"),
        q(at.x + 270, at.y, "High impact · High effort — plan", "#eef3fd"),
        q(at.x, at.y + 270, "Low impact · Low effort — fill-ins", "#f6f5f2"),
        q(at.x + 270, at.y + 270, "Low impact · High effort — avoid", "#fdeeec"),
      ];
      const ax = createText({ x: at.x, y: at.y + 530 }, d, "label");
      ax.data.text = "EFFORT →";
      ax.width = 200;
      const ay = createText({ x: at.x - 90, y: at.y + 250 }, d, "label");
      ay.data.text = "IMPACT ↑";
      ay.width = 80;
      return [...out, ax, ay];
    },
  },
  {
    id: "r-journey-map",
    label: "Customer journey map",
    group: "Boards",
    width: 5 * 190,
    height: 380,
    build: (at) => {
      const d = useStore.getState().defaults;
      const stages = ["Discover", "Consider", "Buy", "Use", "Advocate"];
      const rows: [string, NoteKind][] = [["Doing", "plan"], ["Thinking", "idea"], ["Feeling", "question"], ["Pain point", "important"], ["Opportunity", "research"]];
      const out: CanvasObject[] = [];
      stages.forEach((s, i) => {
        out.push(stampRect({ x: at.x + 120 + i * 190, y: at.y }, 170, 44, { fill: "#1c1c1a", stroke: "#1c1c1a", color: "#fff", radius: 8, text: s, fontSize: 13 }));
      });
      rows.forEach(([r, kind], j) => {
        const label = createText({ x: at.x, y: at.y + 64 + j * 66 + 14 }, d, "label");
        label.data.text = r.toUpperCase();
        label.width = 110;
        out.push(label);
        stages.forEach((_s, i) => {
          const n = createNote({ x: at.x + 120 + i * 190, y: at.y + 64 + j * 66 }, kind, d);
          n.width = 170;
          n.height = 56;
          n.style.fontSize = 12;
          n.data.text = "";
          out.push(n);
        });
      });
      return out;
    },
  },
  {
    id: "r-notes",
    label: "Insight · Assumption · Risk · Decision",
    group: "Notes",
    width: 4 * 230 - 20,
    height: 180,
    build: (at) =>
      buildNotes(
        [
          { text: "Insight —", kind: "idea" },
          { text: "Assumption —", kind: "question" },
          { text: "Risk —", kind: "important" },
          { text: "Decision —", kind: "plan" },
        ],
        at,
      ),
  },
  {
    id: "r-storyboard",
    label: "Storyboard · 4 frames",
    group: "Boards",
    width: 4 * 300 - 40,
    height: 230,
    build: (at) => buildStoryboard([{ title: "Setup" }, { title: "Trigger" }, { title: "Action" }, { title: "Outcome" }], at),
  },
];

export const RECIPE_GROUPS = [...new Set(RECIPES.map((r) => r.group))];

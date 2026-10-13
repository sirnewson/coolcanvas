import { uid } from "./id";
import { ILLUSTRATIONS } from "./illustrations";
import {
  createCard,
  createFrame,
  createIcon,
  createList,
  createNote,
  createPlaceholder,
  createTable,
  createText,
  type StyleDefaults,
} from "../store/factory";
import type { CanvasObject, ObjectStyle, ObjectType, Point } from "../types";

function make(type: ObjectType, at: Point, w: number, h: number): CanvasObject {
  return {
    id: uid(type),
    type,
    x: at.x,
    y: at.y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    style: {},
    data: {},
  };
}

function box(
  at: Point,
  w: number,
  h: number,
  style: ObjectStyle & { text?: string } = {},
): CanvasObject {
  const { text, ...rest } = style;
  const o = make("rect", at, w, h);
  o.style = {
    stroke: "#17170f",
    fill: "transparent",
    strokeWidth: 1.5,
    radius: 4,
    fontSize: 13,
    align: "center",
    verticalAlign: "middle",
    color: "#17170f",
    ...rest,
  };
  o.data = { text: text ?? "" };
  return o;
}

function label(at: Point, text: string, size = 12, weight = 650, color = "#17170f"): CanvasObject {
  const o = make("text", at, 240, size * 1.4);
  o.style = { color, fontSize: size, fontWeight: weight, fontFamily: "sans", lineHeight: 1.35 };
  o.data = { text, textRole: "label" };
  return o;
}

function arrow(from: Point, to: Point, color = "#17170f", text?: string): CanvasObject {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const o = make("arrow", { x, y }, Math.abs(to.x - from.x), Math.abs(to.y - from.y));
  o.style = { stroke: color, strokeWidth: 1.8, arrowEnd: true, fontSize: 12 };
  o.data = { points: [from.x - x, from.y - y, to.x - x, to.y - y], text };
  return o;
}

function swatch(at: Point, hex: string): CanvasObject {
  const o = make("rect", at, 64, 64);
  o.style = { fill: hex, stroke: "transparent", strokeWidth: 0, radius: 2 };
  return o;
}

const icon = (id: string, at: Point, d: StyleDefaults, size = 74) => {
  const found = ILLUSTRATIONS.find((i) => i.id === id) ?? ILLUSTRATIONS[0];
  return createIcon(at, found, d, size);
};

export interface Template {
  id: string;
  label: string;
  note: string;
  build(at: Point, d: StyleDefaults): CanvasObject[];
}

export const TEMPLATES: Template[] = [
  {
    id: "breakdown",
    label: "Screenshot breakdown",
    note: "Drop your screenshot in the frame, then re-point the arrows.",
    build: (at, d) => {
      const frame = createFrame({ x: at.x, y: at.y }, "Screenshot", "browser");
      frame.width = 620;
      frame.height = 400;
      const placeholder = box({ x: at.x + 24, y: at.y + 56 }, 572, 320, {
        fill: "#f0efe9",
        stroke: "#c6c6be",
        dash: "dashed",
        text: "Paste or drop the screenshot here",
        color: "#7c7c72",
      });
      const notes = [
        { y: 0, t: "What works" },
        { y: 120, t: "What to change" },
        { y: 240, t: "Open question" },
      ];
      const objects: CanvasObject[] = [frame, placeholder];
      notes.forEach((n, i) => {
        const note = createNote({ x: at.x + 690, y: at.y + n.y }, i === 2 ? "question" : "idea", d);
        note.width = 220;
        note.height = 104;
        note.data.text = n.t;
        objects.push(note);
        objects.push(
          arrow(
            { x: at.x + 686, y: at.y + n.y + 52 },
            { x: at.x + 420 - i * 90, y: at.y + 120 + i * 80 },
            "#b53d2e",
          ),
        );
      });
      objects.push(label({ x: at.x, y: at.y - 34 }, "01 — WHAT I MEAN", 13, 700, "#7c7c72"));
      return objects;
    },
  },
  {
    id: "wireframe",
    label: "Wireframe kit",
    note: "Browser frame with a nav, hero and three cards.",
    build: (at) => {
      const frame = createFrame({ x: at.x, y: at.y }, "Homepage", "browser");
      frame.width = 900;
      frame.height = 620;
      const nav = box({ x: at.x + 24, y: at.y + 52 }, 852, 48, { radius: 3, fill: "#ffffff" });
      const logo = label({ x: at.x + 42, y: at.y + 68 }, "LOGO", 12, 700);
      const links = label({ x: at.x + 620, y: at.y + 69 }, "Work   Studio   Notes   Contact", 11, 500);
      const hero = box({ x: at.x + 24, y: at.y + 116 }, 852, 250, {
        fill: "#f0efe9",
        stroke: "#c6c6be",
        text: "Hero",
        color: "#7c7c72",
      });
      const cards = [0, 1, 2].map((i) =>
        box({ x: at.x + 24 + i * 288, y: at.y + 382 }, 276, 210, { fill: "#ffffff", radius: 4 }),
      );
      const cardLabels = [0, 1, 2].map((i) =>
        label({ x: at.x + 42 + i * 288, y: at.y + 552 }, `Card ${i + 1}`, 12, 600),
      );
      return [frame, nav, logo, links, hero, ...cards, ...cardLabels];
    },
  },
  {
    id: "flow",
    label: "Flow map",
    note: "Five docked nodes — move any of them and the arrows follow.",
    build: (at) => {
      const steps = ["Trigger", "Research", "Concept", "Build", "Ship"];
      const boxes = steps.map((t, i) =>
        box({ x: at.x + i * 210, y: at.y }, 160, 84, { text: t, fill: "#ffffff", radius: 4 }),
      );
      const arrows = boxes.slice(0, -1).map((b, i) => {
        const a = arrow(
          { x: at.x + i * 210 + 160, y: at.y + 42 },
          { x: at.x + (i + 1) * 210, y: at.y + 42 },
        );
        a.data.from = { id: b.id };
        a.data.to = { id: boxes[i + 1].id };
        return a;
      });
      return [label({ x: at.x, y: at.y - 34 }, "FLOW", 12, 700, "#7c7c72"), ...boxes, ...arrows];
    },
  },
  {
    id: "moodboard",
    label: "Moodboard grid",
    note: "Six slots and a palette strip. Drop images straight onto the slots.",
    build: (at) => {
      const slots: CanvasObject[] = [];
      for (let r = 0; r < 2; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          slots.push(createPlaceholder({ x: at.x + c * 280 + 130, y: at.y + r * 220 + 100 }));
        }
      }
      const palette = ["#1c1c1a", "#c9600f", "#f4ece0", "#486466", "#ddb86c"].map((hex, i) =>
        swatch({ x: at.x + i * 72, y: at.y + 460 }, hex),
      );
      return [
        label({ x: at.x, y: at.y - 34 }, "DIRECTION", 12, 700, "#7c7c72"),
        ...slots,
        ...palette,
        label({ x: at.x + 380, y: at.y + 480 }, "Palette", 12, 600, "#7c7c72"),
      ];
    },
  },
  {
    id: "shot",
    label: "Shot plan",
    note: "Camera, subject and light marks with a spec block.",
    build: (at, d) => {
      const stage = box({ x: at.x, y: at.y }, 520, 300, {
        stroke: "#9c9c94",
        dash: "dashed",
        radius: 2,
      });
      const subject = icon("person", { x: at.x + 260, y: at.y + 150 }, d, 96);
      const camera = icon("camera", { x: at.x + 260, y: at.y + 400 }, d, 88);
      const key = icon("light", { x: at.x + 60, y: at.y + 70 }, d, 72);
      const toSubject = arrow(
        { x: at.x + 260, y: at.y + 360 },
        { x: at.x + 260, y: at.y + 210 },
        "#b53d2e",
        "camera",
      );
      const keyBeam = arrow(
        { x: at.x + 100, y: at.y + 96 },
        { x: at.x + 222, y: at.y + 132 },
        "#c9600f",
        "key light",
      );
      const spec = createList({ x: at.x + 580, y: at.y }, d, [
        { id: uid("li"), text: "SHOT 03 — medium close up", level: 0 },
        { id: uid("li"), text: "35mm", level: 1 },
        { id: uid("li"), text: "Slow push in", level: 1 },
        { id: uid("li"), text: "4 seconds", level: 1 },
        { id: uid("li"), text: "Audio: room tone", level: 0 },
      ]);
      return [stage, subject, camera, key, toSubject, keyBeam, spec];
    },
  },
  {
    id: "mindmap",
    label: "Mind map",
    note: "A centre and five branches, already connected.",
    build: (at, d) => {
      const centre = box({ x: at.x + 320, y: at.y + 220 }, 200, 90, {
        text: "Central idea",
        fill: "#17170f",
        stroke: "#17170f",
        color: "#ffffff",
        radius: 45,
        fontSize: 16,
      });
      const branches = [
        { t: "Why", x: 0, y: 0 },
        { t: "Who", x: 640, y: 0 },
        { t: "How", x: 0, y: 440 },
        { t: "When", x: 640, y: 440 },
        { t: "Risks", x: 320, y: 520 },
      ];
      const nodes = branches.map((b) =>
        box({ x: at.x + b.x, y: at.y + b.y }, 180, 74, {
          text: b.t,
          fill: "#ffffff",
          radius: 37,
          fontSize: 15,
        }),
      );
      const links = nodes.map((n) => {
        const link = arrow({ x: at.x + 420, y: at.y + 265 }, { x: n.x + 90, y: n.y + 37 }, "#5b6470");
        link.style.arrowEnd = false;
        link.style.curve = 0.18;
        link.data.from = { id: centre.id };
        link.data.to = { id: n.id };
        return link;
      });
      void d;
      return [centre, ...nodes, ...links];
    },
  },
  {
    id: "deck",
    label: "Slide deck",
    note: "Four 16:9 slides — present them straight from the board.",
    build: (at, d) => {
      const titles = ["Title", "The problem", "The idea", "Next"];
      const out: CanvasObject[] = [];
      titles.forEach((t, i) => {
        const frame = createFrame({ x: at.x + i * 700, y: at.y }, `Slide ${i + 1}`);
        frame.width = 640;
        frame.height = 360;
        const heading = createText({ x: at.x + i * 700 + 48, y: at.y + 90 }, d, "heading");
        heading.data.text = t;
        heading.width = 460;
        heading.parentId = frame.id;
        const body = createText({ x: at.x + i * 700 + 48, y: at.y + 160 }, d, "body");
        body.data.text = "One line that carries the point.";
        body.width = 460;
        body.parentId = frame.id;
        out.push(frame, heading, body);
      });
      return out;
    },
  },
  {
    id: "flashcards",
    label: "Flashcards",
    note: "Four two-sided cards. Flip them from the toolbar or while presenting.",
    build: (at, d) =>
      [
        ["What is it?", "A visual workspace"],
        ["Who is it for?", "Anyone explaining an idea"],
        ["Why not a doc?", "Because the shape is the point"],
        ["First move?", "Drop a screenshot"],
      ].map(([front, back], i) =>
        createCard(
          { x: at.x + (i % 2) * 340 + 150, y: at.y + Math.floor(i / 2) * 230 + 95 },
          d,
          front,
          back,
        ),
      ),
  },
  {
    id: "infographic",
    label: "Infographic",
    note: "Headline, three stats, a chart and a table.",
    build: (at, d) => {
      const title = createText({ x: at.x, y: at.y }, d, "heading");
      title.data.text = "What the numbers say";
      title.style.fontFamily = "display";
      title.width = 620;
      const stats = ["72%", "3.4x", "18k"].map((value, i) => {
        const card = box({ x: at.x + i * 220, y: at.y + 80 }, 200, 130, {
          fill: "#ffffff",
          radius: 6,
          stroke: "#d9d7cd",
        });
        const big = label({ x: at.x + i * 220 + 18, y: at.y + 106 }, value, 40, 700);
        big.style.fontFamily = "display";
        const cap = label(
          { x: at.x + i * 220 + 18, y: at.y + 162 },
          ["of sessions", "faster to explain", "ideas mapped"][i],
          12,
          400,
          "#7c7c72",
        );
        return [card, big, cap];
      });
      const bars = [58, 96, 74, 132, 108].map((h, i) => {
        const bar = box({ x: at.x + i * 56, y: at.y + 400 - h }, 44, h, {
          fill: i === 3 ? "#1f5fd0" : "#c9c7bd",
          stroke: "transparent",
          radius: 3,
        });
        bar.style.strokeWidth = 0;
        return bar;
      });
      const table = createTable({ x: at.x + 360, y: at.y + 250 }, d);
      return [title, ...stats.flat(), ...bars, table];
    },
  },
  {
    id: "kanban",
    label: "Kanban board",
    note: "Three columns with sticky cards — drag them across as work moves.",
    build: (at, d) => {
      const columns = ["To do", "Doing", "Done"];
      const out: CanvasObject[] = [];
      columns.forEach((title, c) => {
        const x = at.x + c * 300;
        out.push(
          box({ x, y: at.y }, 270, 520, {
            fill: "#f4f3ef",
            stroke: "#e6e4de",
            radius: 10,
            strokeWidth: 1,
          }),
        );
        out.push(label({ x: x + 18, y: at.y + 18 }, title.toUpperCase(), 11, 700, "#8a8a80"));
        const counts = [3, 2, 2][c];
        for (let i = 0; i < counts; i += 1) {
          const card = createNote(
            { x: x + 16, y: at.y + 52 + i * 120 },
            (["idea", "plan", "research"] as const)[c],
            d,
          );
          card.width = 238;
          card.height = 104;
          card.style.radius = 8;
          card.data.text = "";
          out.push(card);
        }
      });
      return out;
    },
  },
  {
    id: "retro",
    label: "Retro",
    note: "Start, stop, continue — three lanes to fill with notes.",
    build: (at, d) => {
      const lanes = [
        { t: "Start", kind: "plan" as const },
        { t: "Stop", kind: "important" as const },
        { t: "Continue", kind: "research" as const },
      ];
      const out: CanvasObject[] = [];
      lanes.forEach((lane, c) => {
        const x = at.x + c * 320;
        out.push(box({ x, y: at.y }, 290, 460, { fill: "#ffffff", radius: 10, stroke: "#e6e4de" }));
        out.push(label({ x: x + 20, y: at.y + 20 }, lane.t, 15, 650));
        const note = createNote({ x: x + 20, y: at.y + 60 }, lane.kind, d);
        note.width = 250;
        note.height = 120;
        note.style.radius = 8;
        out.push(note);
      });
      return out;
    },
  },
  {
    id: "swot",
    label: "SWOT",
    note: "Four quadrants, labelled and ready.",
    build: (at, d) => {
      const cells = [
        { t: "Strengths", fill: "#e2f3ec" },
        { t: "Weaknesses", fill: "#fbe4e1" },
        { t: "Opportunities", fill: "#e4edfb" },
        { t: "Threats", fill: "#fdf3c4" },
      ];
      void d;
      return cells.flatMap((cell, i) => {
        const x = at.x + (i % 2) * 300;
        const y = at.y + Math.floor(i / 2) * 260;
        return [
          box({ x, y }, 290, 250, { fill: cell.fill, stroke: "transparent", radius: 10 }),
          label({ x: x + 20, y: y + 18 }, cell.t.toUpperCase(), 11, 700, "#55554d"),
        ];
      });
    },
  },
  {
    id: "journey",
    label: "Journey map",
    note: "Five stages across, three rows down: doing, thinking, feeling.",
    build: (at, d) => {
      const stages = ["Discover", "Consider", "Decide", "Use", "Return"];
      const rows = ["Doing", "Thinking", "Feeling"];
      const out: CanvasObject[] = [];
      rows.forEach((row, r) => {
        out.push(label({ x: at.x - 110, y: at.y + 74 + r * 150 }, row, 12, 650, "#8a8a80"));
      });
      stages.forEach((stage, c) => {
        const x = at.x + c * 230;
        out.push(
          box({ x, y: at.y }, 210, 46, {
            text: stage,
            fill: "#17170f",
            stroke: "#17170f",
            color: "#ffffff",
            radius: 8,
            fontSize: 13,
          }),
        );
        rows.forEach((_, r) => {
          out.push(
            box({ x, y: at.y + 60 + r * 150 }, 210, 132, {
              fill: "#ffffff",
              stroke: "#e6e4de",
              radius: 8,
            }),
          );
        });
      });
      void d;
      return out;
    },
  },
  {
    id: "storyboard",
    label: "Storyboard",
    note: "Six 16:9 panels with a caption line under each.",
    build: (at, d) => {
      const out: CanvasObject[] = [];
      for (let i = 0; i < 6; i += 1) {
        const x = at.x + (i % 3) * 340;
        const y = at.y + Math.floor(i / 3) * 280;
        out.push(createPlaceholder({ x: x + 160, y: y + 90 }));
        const caption = createText({ x, y: y + 190 }, d, "caption");
        caption.data.text = `Shot ${i + 1} — what happens here`;
        caption.width = 320;
        out.push(caption);
      }
      return out;
    },
  },
  {
    id: "brand",
    label: "Brand board",
    note: "Logo space, palette, type specimens and image slots.",
    build: (at, d) => {
      const title = createText({ x: at.x, y: at.y }, d, "heading");
      title.data.text = "Brand direction";
      title.style.fontFamily = "serif";
      title.width = 520;

      const logo = box({ x: at.x, y: at.y + 70 }, 300, 200, {
        fill: "#ffffff",
        stroke: "#e6e4de",
        radius: 10,
        text: "Logo",
        color: "#9c9c94",
      });
      const palette = ["#17170f", "#c9600f", "#f4ece0", "#486466", "#ddb86c", "#ffffff"].map(
        (hex, i) => {
          const sw = box({ x: at.x + 330 + (i % 3) * 86, y: at.y + 70 + Math.floor(i / 3) * 86 }, 78, 78, {
            fill: hex,
            stroke: "#e6e4de",
            radius: 8,
          });
          return sw;
        },
      );
      const specimen = createText({ x: at.x, y: at.y + 300 }, d, "heading");
      specimen.data.text = "Aa Bb Cc — display";
      specimen.style.fontFamily = "display";
      specimen.style.fontSize = 46;
      specimen.width = 520;
      const body = createText({ x: at.x, y: at.y + 366 }, d, "body");
      body.data.text = "Aa Bb Cc — the working face, set at a readable size for long copy.";
      body.width = 520;

      const shots = [0, 1, 2].map((i) =>
        createPlaceholder({ x: at.x + 700 + (i % 2) * 280, y: at.y + 160 + Math.floor(i / 2) * 220 }),
      );
      return [title, logo, ...palette, specimen, body, ...shots];
    },
  },
  {
    id: "roadmap",
    label: "Roadmap",
    note: "A timeline with four milestones docked to the line.",
    build: (at, d) => {
      const spine = make("line", { x: at.x, y: at.y + 160 }, 900, 0);
      spine.style = { stroke: "#c9c7bd", strokeWidth: 2 };
      spine.data = { points: [0, 0, 900, 0] };
      const stops = ["Now", "Next", "Later", "Someday"];
      const out: CanvasObject[] = [spine];
      stops.forEach((stop, i) => {
        const x = at.x + 40 + i * 280;
        const dot = make("ellipse", { x: x - 9, y: at.y + 151 }, 18, 18);
        dot.style = { fill: "#17170f", stroke: "#17170f", strokeWidth: 1 };
        const card = box({ x: x - 110, y: at.y + (i % 2 ? 200 : 40) }, 220, 110, {
          fill: "#ffffff",
          stroke: "#e6e4de",
          radius: 10,
          text: stop,
          fontSize: 14,
        });
        const link = make("line", { x: x - 1, y: at.y + (i % 2 ? 160 : 150) }, 2, 50);
        link.style = { stroke: "#c9c7bd", strokeWidth: 1.5, dash: "dashed" };
        link.data = { points: [0, 0, 0, 50] };
        out.push(link, dot, card);
      });
      void d;
      return out;
    },
  },
  {
    id: "week",
    label: "Week planner",
    note: "Seven columns with a header row — plan the week in notes.",
    build: (at, d) => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const out: CanvasObject[] = [];
      days.forEach((day, i) => {
        const x = at.x + i * 170;
        out.push(
          box({ x, y: at.y }, 158, 40, {
            text: day,
            fill: "#17170f",
            stroke: "#17170f",
            color: "#ffffff",
            radius: 8,
            fontSize: 12,
          }),
        );
        out.push(
          box({ x, y: at.y + 50 }, 158, 420, {
            fill: i > 4 ? "#f4f3ef" : "#ffffff",
            stroke: "#e6e4de",
            radius: 8,
          }),
        );
      });
      const first = createNote({ x: at.x + 12, y: at.y + 62 }, "todo", d);
      first.width = 134;
      first.height = 96;
      first.style.radius = 6;
      out.push(first);
      return out;
    },
  },
  {
    id: "empathy",
    label: "Empathy map",
    note: "Says, thinks, does, feels — around the person in the middle.",
    build: (at, d) => {
      const centre = make("ellipse", { x: at.x + 250, y: at.y + 200 }, 180, 140);
      centre.style = {
        fill: "#17170f",
        stroke: "#17170f",
        strokeWidth: 1,
        color: "#ffffff",
        fontSize: 15,
        align: "center",
        verticalAlign: "middle",
      };
      centre.data = { text: "Who?" };
      const quads = [
        { t: "Says", x: 0, y: 0 },
        { t: "Thinks", x: 340, y: 0 },
        { t: "Does", x: 0, y: 300 },
        { t: "Feels", x: 340, y: 300 },
      ];
      const out: CanvasObject[] = [centre];
      quads.forEach((q) => {
        out.push(
          box({ x: at.x + q.x, y: at.y + q.y }, 300, 240, {
            fill: "#ffffff",
            stroke: "#e6e4de",
            radius: 10,
          }),
        );
        out.push(label({ x: at.x + q.x + 18, y: at.y + q.y + 16 }, q.t.toUpperCase(), 11, 700, "#8a8a80"));
      });
      void d;
      return out;
    },
  },
  {
    id: "brief",
    label: "Idea brief",
    note: "A collapsible outline with a heading and two notes.",
    build: (at, d) => {
      const title = createText({ x: at.x, y: at.y }, d, "heading");
      title.data.text = "Untitled idea";
      title.width = 420;
      const outline = createList({ x: at.x, y: at.y + 64 }, d, [
        { id: uid("li"), text: "Problem", level: 0 },
        { id: uid("li"), text: "Who has it", level: 1 },
        { id: uid("li"), text: "Why now", level: 1 },
        { id: uid("li"), text: "Idea", level: 0 },
        { id: uid("li"), text: "How it works", level: 1 },
        { id: uid("li"), text: "What it replaces", level: 1 },
        { id: uid("li"), text: "Next step", level: 0 },
      ]);
      outline.width = 420;
      const q = createNote({ x: at.x + 470, y: at.y + 64 }, "question", d);
      q.data.text = "What am I not sure about?";
      q.width = 200;
      q.height = 160;
      const todo = createNote({ x: at.x + 470, y: at.y + 248 }, "todo", d);
      todo.data.text = "First thing to try";
      todo.width = 200;
      todo.height = 160;
      return [title, outline, q, todo];
    },
  },
];

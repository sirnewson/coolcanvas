/**
 * Web UI kit — the blocks a modern web app or marketing site is made of,
 * drawn in a clean contemporary style (soft surfaces, 8px radii, quiet
 * borders, one accent). Every block is a handful of ordinary objects, so once
 * it lands you can restyle, regroup or connect any part of it.
 */
import type { CanvasObject, Point } from "../types";
import { createPlaceholder, stampLabel, stampRect, type Stamp } from "../store/factory";

const INK = "#1c1c1a";
const MUTED = "#8a8a82";
const LINE = "#e3e1d9";
const SURFACE = "#f6f5f2";
const ACCENT = "#1f5fd0";
const ACCENT_SOFT = "#eef3fd";

type Opts = Parameters<typeof stampRect>[3];

const box = (at: Point, w: number, h: number, opts: Opts = {}) =>
  stampRect(at, w, h, { stroke: LINE, fill: "#ffffff", strokeWidth: 1, radius: 8, color: INK, ...opts });
const soft = (at: Point, w: number, h: number, opts: Opts = {}) =>
  box(at, w, h, { fill: SURFACE, stroke: SURFACE, ...opts });
const primary = (at: Point, w: number, h: number, text: string) =>
  box(at, w, h, { fill: ACCENT, stroke: ACCENT, color: "#ffffff", text, fontSize: 13, radius: 8 });
const ghost = (at: Point, w: number, h: number, text: string) =>
  box(at, w, h, { fill: "#ffffff", stroke: LINE, color: INK, text, fontSize: 13, radius: 8 });
const pill = (at: Point, w: number, text: string, fill = ACCENT_SOFT, color = ACCENT) =>
  box(at, w, 24, { fill, stroke: fill, color, text, fontSize: 11, radius: 12 });
const text = (at: Point, t: string, size = 13, weight = 400, width = 220, color = INK) => {
  const o = stampLabel(at, t, size, weight);
  o.width = width;
  o.style.color = color;
  o.height = Math.ceil(size * 1.4);
  return o;
};
const line = (at: Point, w: number, h = 8, color = LINE) =>
  stampRect(at, w, h, { fill: color, stroke: color, strokeWidth: 0, radius: 4 });
const avatar = (at: Point, size = 32) =>
  stampRect(at, size, size, { type: "ellipse", fill: "#d9d7cd", stroke: "#d9d7cd", strokeWidth: 0 });
const pic = (at: Point, w: number, h: number) => createPlaceholder({ x: at.x + w / 2, y: at.y + h / 2 }, w, h);

const shift = (at: Point, dx: number, dy: number): Point => ({ x: at.x + dx, y: at.y + dy });

/** The kit's drawing helpers, for anything else that composes web blocks. */
export const KIT = { box, soft, primary, ghost, pill, text, line, avatar, pic, shift, INK, MUTED, LINE, SURFACE, ACCENT, ACCENT_SOFT };

export const WEB_STAMPS: Stamp[] = [
  /* ------------------------------------------------------- navigation */
  {
    id: "web-nav",
    label: "Navbar",
    group: "Web · Navigation",
    width: 960,
    height: 64,
    build: (at) => [
      box(at, 960, 64, { radius: 0, stroke: LINE }),
      text(shift(at, 24, 22), "Brand", 16, 700, 120),
      text(shift(at, 320, 24), "Product", 13, 500, 70, MUTED),
      text(shift(at, 400, 24), "Pricing", 13, 500, 70, MUTED),
      text(shift(at, 480, 24), "Docs", 13, 500, 60, MUTED),
      text(shift(at, 550, 24), "Blog", 13, 500, 60, MUTED),
      ghost(shift(at, 760, 16), 80, 32, "Log in"),
      primary(shift(at, 852, 16), 84, 32, "Sign up"),
    ],
  },
  {
    id: "web-sidebar",
    label: "Sidebar nav",
    group: "Web · Navigation",
    width: 240,
    height: 560,
    build: (at) => [
      box(at, 240, 560, { radius: 0, fill: SURFACE, stroke: LINE }),
      text(shift(at, 20, 22), "Workspace", 14, 700, 160),
      box(shift(at, 12, 64), 216, 36, { fill: "#ffffff", stroke: LINE, radius: 8, text: "Dashboard", fontSize: 13, align: "left", padding: 14 }),
      text(shift(at, 26, 118), "Projects", 13, 500, 160, MUTED),
      text(shift(at, 26, 152), "Inbox", 13, 500, 160, MUTED),
      text(shift(at, 26, 186), "Reports", 13, 500, 160, MUTED),
      text(shift(at, 26, 220), "Team", 13, 500, 160, MUTED),
      text(shift(at, 26, 254), "Settings", 13, 500, 160, MUTED),
      avatar(shift(at, 20, 504), 32),
      text(shift(at, 60, 506), "Ada Lovelace", 12, 600, 150),
      text(shift(at, 60, 522), "ada@studio.co", 11, 400, 150, MUTED),
    ],
  },
  {
    id: "web-tabs",
    label: "Tabs",
    group: "Web · Navigation",
    width: 420,
    height: 40,
    build: (at) => [
      line(shift(at, 0, 38), 420, 1),
      text(shift(at, 0, 10), "Overview", 13, 600, 80),
      line(shift(at, 0, 36), 74, 2, INK),
      text(shift(at, 100, 10), "Activity", 13, 500, 80, MUTED),
      text(shift(at, 190, 10), "Members", 13, 500, 80, MUTED),
      text(shift(at, 290, 10), "Settings", 13, 500, 80, MUTED),
    ],
  },
  {
    id: "web-breadcrumb",
    label: "Breadcrumbs",
    group: "Web · Navigation",
    width: 320,
    height: 20,
    build: (at) => [text(at, "Home  /  Projects  /  Atlas redesign", 12, 500, 320, MUTED)],
  },
  {
    id: "web-footer",
    label: "Footer",
    group: "Web · Navigation",
    width: 960,
    height: 180,
    build: (at) => [
      box(at, 960, 180, { radius: 0, fill: SURFACE, stroke: SURFACE }),
      text(shift(at, 32, 28), "Brand", 15, 700, 160),
      text(shift(at, 32, 54), "Made with care in Lagos.", 12, 400, 200, MUTED),
      text(shift(at, 400, 28), "Product", 12, 700, 120),
      text(shift(at, 400, 52), "Features", 12, 400, 120, MUTED),
      text(shift(at, 400, 72), "Pricing", 12, 400, 120, MUTED),
      text(shift(at, 400, 92), "Changelog", 12, 400, 120, MUTED),
      text(shift(at, 580, 28), "Company", 12, 700, 120),
      text(shift(at, 580, 52), "About", 12, 400, 120, MUTED),
      text(shift(at, 580, 72), "Careers", 12, 400, 120, MUTED),
      text(shift(at, 580, 92), "Contact", 12, 400, 120, MUTED),
      text(shift(at, 760, 28), "Legal", 12, 700, 120),
      text(shift(at, 760, 52), "Privacy", 12, 400, 120, MUTED),
      text(shift(at, 760, 72), "Terms", 12, 400, 120, MUTED),
      text(shift(at, 32, 148), "© 2026 Brand Inc.", 11, 400, 200, MUTED),
    ],
  },

  /* ---------------------------------------------------------- marketing */
  {
    id: "web-hero",
    label: "Hero",
    group: "Web · Marketing",
    width: 960,
    height: 420,
    build: (at) => [
      box(at, 960, 420, { radius: 0, stroke: "transparent" }),
      pill(shift(at, 64, 80), 132, "New · v2.0 is out"),
      text(shift(at, 64, 124), "Ship the thing you", 44, 700, 460),
      text(shift(at, 64, 176), "actually meant to.", 44, 700, 460),
      text(shift(at, 64, 244), "One workspace to plan, sketch and explain — from first thought to launch.", 15, 400, 400, MUTED),
      primary(shift(at, 64, 300), 140, 44, "Start free"),
      ghost(shift(at, 216, 300), 140, 44, "See a demo"),
      pic(shift(at, 560, 60), 340, 300),
    ],
  },
  {
    id: "web-features",
    label: "Feature grid",
    group: "Web · Marketing",
    width: 960,
    height: 260,
    build: (at) => {
      const out: CanvasObject[] = [text(shift(at, 0, 0), "Everything you need", 24, 700, 400)];
      const cards = ["Plan", "Sketch", "Share"];
      cards.forEach((c, i) => {
        const x = at.x + i * 320;
        out.push(
          box({ x, y: at.y + 56 }, 296, 180, { radius: 12 }),
          soft({ x: x + 20, y: at.y + 76 }, 40, 40, { radius: 10, fill: ACCENT_SOFT, stroke: ACCENT_SOFT }),
          text({ x: x + 20, y: at.y + 132 }, c, 16, 700, 240),
          text({ x: x + 20, y: at.y + 158 }, "A short line about what this does and why it matters.", 12, 400, 250, MUTED),
        );
      });
      return out;
    },
  },
  {
    id: "web-pricing",
    label: "Pricing",
    group: "Web · Marketing",
    width: 960,
    height: 380,
    build: (at) => {
      const out: CanvasObject[] = [];
      const tiers: [string, string, boolean][] = [
        ["Starter", "$0", false],
        ["Pro", "$12", true],
        ["Team", "$39", false],
      ];
      tiers.forEach(([name, price, hot], i) => {
        const x = at.x + i * 320;
        out.push(
          box({ x, y: at.y }, 296, 380, { radius: 14, stroke: hot ? ACCENT : LINE, strokeWidth: hot ? 2 : 1 }),
          text({ x: x + 24, y: at.y + 24 }, name, 14, 600, 200, MUTED),
          text({ x: x + 24, y: at.y + 52 }, price, 36, 700, 200),
          text({ x: x + 24, y: at.y + 100 }, "per seat / month", 12, 400, 200, MUTED),
          text({ x: x + 24, y: at.y + 150 }, "✓  Unlimited boards", 13, 400, 240),
          text({ x: x + 24, y: at.y + 178 }, "✓  AI sketch tools", 13, 400, 240),
          text({ x: x + 24, y: at.y + 206 }, "✓  Export to any format", 13, 400, 240),
          hot ? primary({ x: x + 24, y: at.y + 312 }, 248, 44, "Choose Pro") : ghost({ x: x + 24, y: at.y + 312 }, 248, 44, `Choose ${name}`),
        );
        if (hot) out.push(pill({ x: x + 196, y: at.y + 24 }, 76, "Popular"));
      });
      return out;
    },
  },
  {
    id: "web-testimonial",
    label: "Testimonial",
    group: "Web · Marketing",
    width: 460,
    height: 170,
    build: (at) => [
      box(at, 460, 170, { radius: 14, fill: SURFACE, stroke: SURFACE }),
      text(shift(at, 28, 28), "“We replaced three tools with this and shipped two weeks earlier.”", 16, 500, 400),
      avatar(shift(at, 28, 112), 36),
      text(shift(at, 74, 114), "Jordan Ike", 13, 600, 200),
      text(shift(at, 74, 132), "Head of Product, Northwind", 11, 400, 220, MUTED),
    ],
  },
  {
    id: "web-cta",
    label: "CTA band",
    group: "Web · Marketing",
    width: 960,
    height: 160,
    build: (at) => [
      box(at, 960, 160, { radius: 16, fill: INK, stroke: INK }),
      text(shift(at, 48, 44), "Ready when you are.", 26, 700, 400, "#ffffff"),
      text(shift(at, 48, 88), "Free for individuals. No card needed.", 13, 400, 400, "#b4b1a8"),
      box(shift(at, 760, 58), 152, 44, { fill: "#ffffff", stroke: "#ffffff", color: INK, text: "Get started", fontSize: 13 }),
    ],
  },

  /* ------------------------------------------------------------- app UI */
  {
    id: "web-stats",
    label: "Stat tiles",
    group: "Web · App",
    width: 720,
    height: 100,
    build: (at) => {
      const out: CanvasObject[] = [];
      const stats: [string, string, string][] = [
        ["Revenue", "$48.2k", "+12%"],
        ["Active users", "3,208", "+4%"],
        ["Churn", "1.8%", "−0.3%"],
      ];
      stats.forEach(([k, v, d], i) => {
        const x = at.x + i * 240;
        out.push(
          box({ x, y: at.y }, 224, 100, { radius: 12 }),
          text({ x: x + 20, y: at.y + 18 }, k, 12, 500, 160, MUTED),
          text({ x: x + 20, y: at.y + 42 }, v, 26, 700, 160),
          pill({ x: x + 150, y: at.y + 18 }, 56, d, d.startsWith("+") ? "#e2f3ec" : "#fdeeec", d.startsWith("+") ? "#0f8a6a" : "#d4483b"),
        );
      });
      return out;
    },
  },
  {
    id: "web-chart",
    label: "Chart card",
    group: "Web · App",
    width: 480,
    height: 280,
    build: (at) => {
      const out: CanvasObject[] = [
        box(at, 480, 280, { radius: 12 }),
        text(shift(at, 20, 18), "Signups this month", 14, 600, 300),
        text(shift(at, 20, 40), "Daily, last 30 days", 11, 400, 300, MUTED),
      ];
      const bars = [40, 62, 48, 80, 66, 90, 74, 110, 96, 128, 104, 140];
      bars.forEach((h, i) => {
        out.push(line({ x: at.x + 24 + i * 36, y: at.y + 236 - h }, 24, h, i === bars.length - 1 ? ACCENT : ACCENT_SOFT));
      });
      out.push(line(shift(at, 20, 240), 440, 1));
      return out;
    },
  },
  {
    id: "web-table",
    label: "Data table",
    group: "Web · App",
    width: 720,
    height: 236,
    build: (at) => {
      const out: CanvasObject[] = [box(at, 720, 236, { radius: 12 })];
      const cols = [["Name", 24], ["Status", 300], ["Owner", 440], ["Updated", 580]] as const;
      cols.forEach(([c, x]) => out.push(text(shift(at, x, 18), c, 11, 600, 120, MUTED)));
      out.push(line(shift(at, 0, 44), 720, 1));
      const rows: [string, string, string, string][] = [
        ["Atlas redesign", "Active", "Ada", "2h ago"],
        ["Billing v2", "Review", "Sam", "Yesterday"],
        ["Onboarding flow", "Draft", "Kei", "3d ago"],
        ["Mobile nav", "Done", "Mira", "1w ago"],
      ];
      rows.forEach((r, i) => {
        const y = at.y + 60 + i * 44;
        out.push(
          text({ x: at.x + 24, y: y + 4 }, r[0], 13, 500, 240),
          pill({ x: at.x + 300, y: y - 2 }, 62, r[1], r[1] === "Done" ? "#e2f3ec" : r[1] === "Active" ? ACCENT_SOFT : SURFACE, r[1] === "Done" ? "#0f8a6a" : r[1] === "Active" ? ACCENT : MUTED),
          avatar({ x: at.x + 440, y: y - 4 }, 24),
          text({ x: at.x + 472, y: y + 4 }, r[2], 13, 400, 100),
          text({ x: at.x + 580, y: y + 4 }, r[3], 12, 400, 120, MUTED),
        );
        if (i < rows.length - 1) out.push(line({ x: at.x, y: y + 32 }, 720, 1));
      });
      return out;
    },
  },
  {
    id: "web-form",
    label: "Form",
    group: "Web · App",
    width: 400,
    height: 372,
    build: (at) => [
      box(at, 400, 372, { radius: 14 }),
      text(shift(at, 24, 22), "Create project", 18, 700, 300),
      text(shift(at, 24, 64), "Name", 12, 600, 200),
      box(shift(at, 24, 84), 352, 40, { text: "Atlas redesign", align: "left", padding: 12, fontSize: 13, color: INK }),
      text(shift(at, 24, 138), "Team", 12, 600, 200),
      box(shift(at, 24, 158), 352, 40, { text: "Design  ▾", align: "left", padding: 12, fontSize: 13, color: MUTED }),
      text(shift(at, 24, 212), "Visibility", 12, 600, 200),
      stampRect(shift(at, 24, 236), 18, 18, { type: "ellipse", fill: ACCENT, stroke: ACCENT }),
      text(shift(at, 50, 236), "Private", 13, 400, 200),
      stampRect(shift(at, 140, 236), 18, 18, { type: "ellipse", fill: "#ffffff", stroke: LINE }),
      text(shift(at, 166, 236), "Team", 13, 400, 200),
      box(shift(at, 24, 270), 40, 22, { fill: ACCENT, stroke: ACCENT, radius: 11 }),
      stampRect(shift(at, 44, 273), 16, 16, { type: "ellipse", fill: "#ffffff", stroke: "#ffffff" }),
      text(shift(at, 74, 272), "Notify the team", 13, 400, 200),
      ghost(shift(at, 196, 312), 84, 40, "Cancel"),
      primary(shift(at, 292, 312), 84, 40, "Create"),
    ],
  },
  {
    id: "web-modal",
    label: "Modal",
    group: "Web · App",
    width: 440,
    height: 220,
    build: (at) => [
      box(at, 440, 220, { radius: 16, shadow: true }),
      text(shift(at, 28, 26), "Delete this board?", 18, 700, 380),
      text(shift(at, 28, 62), "This removes the board and its history for everyone. This cannot be undone.", 13, 400, 380, MUTED),
      ghost(shift(at, 220, 156), 92, 40, "Keep it"),
      box(shift(at, 320, 156), 92, 40, { fill: "#d4483b", stroke: "#d4483b", color: "#ffffff", text: "Delete", fontSize: 13 }),
    ],
  },
  {
    id: "web-search",
    label: "Search bar",
    group: "Web · App",
    width: 360,
    height: 40,
    build: (at) => [
      box(at, 360, 40, { fill: SURFACE, stroke: SURFACE, radius: 20, text: "⌕   Search anything…", align: "left", padding: 16, fontSize: 13, color: MUTED }),
      pill(shift(at, 306, 8), 44, "⌘K", "#ffffff", MUTED),
    ],
  },
  {
    id: "web-toast",
    label: "Toast",
    group: "Web · App",
    width: 320,
    height: 56,
    build: (at) => [
      box(at, 320, 56, { fill: INK, stroke: INK, radius: 12 }),
      stampRect(shift(at, 16, 18), 20, 20, { type: "ellipse", fill: "#0f8a6a", stroke: "#0f8a6a" }),
      text(shift(at, 48, 12), "Changes saved", 13, 600, 200, "#ffffff"),
      text(shift(at, 48, 30), "Just now", 11, 400, 200, "#b4b1a8"),
      text(shift(at, 262, 20), "Undo", 12, 600, 60, "#7ba4f2"),
    ],
  },
  {
    id: "web-kanban",
    label: "Kanban",
    group: "Web · App",
    width: 760,
    height: 320,
    build: (at) => {
      const out: CanvasObject[] = [];
      const cols: [string, string[]][] = [
        ["Backlog", ["Research pricing", "Draft onboarding copy"]],
        ["In progress", ["Nav redesign", "Billing API", "Empty states"]],
        ["Done", ["Logo refresh"]],
      ];
      cols.forEach(([name, cards], i) => {
        const x = at.x + i * 256;
        out.push(soft({ x, y: at.y }, 240, 320, { radius: 12 }), text({ x: x + 16, y: at.y + 14 }, `${name}  ${cards.length}`, 12, 700, 200, MUTED));
        cards.forEach((c, j) => {
          const y = at.y + 44 + j * 76;
          out.push(
            box({ x: x + 12, y }, 216, 64, { radius: 10 }),
            text({ x: x + 24, y: y + 12 }, c, 13, 500, 190),
            pill({ x: x + 24, y: y + 34 }, 52, "Design", SURFACE, MUTED),
            avatar({ x: x + 192, y: y + 32 }, 20),
          );
        });
      });
      return out;
    },
  },
  {
    id: "web-card",
    label: "Content card",
    group: "Web · App",
    width: 300,
    height: 300,
    build: (at) => [
      box(at, 300, 300, { radius: 14 }),
      pic(shift(at, 1, 1), 298, 160),
      pill(shift(at, 20, 176), 64, "Article"),
      text(shift(at, 20, 208), "Designing calmer dashboards", 15, 700, 260),
      text(shift(at, 20, 232), "Six patterns that lower cognitive load without hiding data.", 12, 400, 260, MUTED),
      text(shift(at, 20, 270), "Read →", 12, 600, 100, ACCENT),
    ],
  },
  {
    id: "web-pagination",
    label: "Pagination",
    group: "Web · App",
    width: 300,
    height: 36,
    build: (at) => [
      ghost(at, 36, 36, "‹"),
      primary(shift(at, 44, 0), 36, 36, "1"),
      ghost(shift(at, 88, 0), 36, 36, "2"),
      ghost(shift(at, 132, 0), 36, 36, "3"),
      text(shift(at, 178, 10), "…", 13, 400, 20, MUTED),
      ghost(shift(at, 204, 0), 36, 36, "12"),
      ghost(shift(at, 248, 0), 36, 36, "›"),
    ],
  },

  /* ------------------------------------------------------------ controls */
  {
    id: "web-buttons",
    label: "Button set",
    group: "Web · Controls",
    width: 372,
    height: 40,
    build: (at) => [
      primary(at, 116, 40, "Primary"),
      ghost(shift(at, 128, 0), 116, 40, "Secondary"),
      box(shift(at, 256, 0), 116, 40, { fill: "transparent", stroke: "transparent", color: ACCENT, text: "Ghost", fontSize: 13 }),
    ],
  },
  {
    id: "web-input",
    label: "Text field",
    group: "Web · Controls",
    width: 280,
    height: 66,
    build: (at) => [
      text(at, "Email", 12, 600, 200),
      box(shift(at, 0, 22), 280, 44, { text: "you@company.com", align: "left", padding: 14, fontSize: 13, color: MUTED }),
    ],
  },
  {
    id: "web-select",
    label: "Select",
    group: "Web · Controls",
    width: 280,
    height: 44,
    build: (at) => [box(at, 280, 44, { text: "Choose an option                    ▾", align: "left", padding: 14, fontSize: 13, color: MUTED })],
  },
  {
    id: "web-toggle",
    label: "Toggle + checkbox",
    group: "Web · Controls",
    width: 260,
    height: 60,
    build: (at) => [
      box(at, 44, 24, { fill: ACCENT, stroke: ACCENT, radius: 12 }),
      stampRect(shift(at, 22, 3), 18, 18, { type: "ellipse", fill: "#ffffff", stroke: "#ffffff" }),
      text(shift(at, 56, 4), "Email me updates", 13, 400, 200),
      box(shift(at, 0, 36), 20, 20, { fill: ACCENT, stroke: ACCENT, radius: 5, text: "✓", color: "#ffffff", fontSize: 12 }),
      text(shift(at, 32, 38), "I agree to the terms", 13, 400, 200),
    ],
  },
  {
    id: "web-badges",
    label: "Badges",
    group: "Web · Controls",
    width: 300,
    height: 24,
    build: (at) => [
      pill(at, 64, "Beta"),
      pill(shift(at, 72, 0), 68, "Success", "#e2f3ec", "#0f8a6a"),
      pill(shift(at, 148, 0), 72, "Warning", "#fdf3c4", "#8a5a12"),
      pill(shift(at, 228, 0), 60, "Error", "#fdeeec", "#d4483b"),
    ],
  },
  {
    id: "web-avatars",
    label: "Avatar group",
    group: "Web · Controls",
    width: 150,
    height: 32,
    build: (at) => [
      avatar(at, 32),
      avatar(shift(at, 24, 0), 32),
      avatar(shift(at, 48, 0), 32),
      box(shift(at, 72, 0), 32, 32, { type: "ellipse", fill: SURFACE, stroke: "#ffffff", strokeWidth: 2, text: "+4", fontSize: 11, color: MUTED }),
    ],
  },


  /* --------------------------------------------------------- more app UI */
  {
    id: "web-accordion",
    label: "Accordion / FAQ",
    group: "Web · App",
    width: 560,
    height: 236,
    build: (at) => {
      const out: CanvasObject[] = [text(at, "Frequently asked", 20, 700, 400)];
      const rows = ["Is there a free plan?", "Can I cancel any time?", "Do you offer discounts for teams?", "Where is my data stored?"];
      rows.forEach((r, i) => {
        const y = at.y + 44 + i * 48;
        out.push(line({ x: at.x, y: y + 40 }, 560, 1), text({ x: at.x, y: y + 12 }, r, 14, 600, 480), text({ x: at.x + 536, y: y + 8 }, i === 0 ? "−" : "+", 18, 500, 24, MUTED));
      });
      out.push(text(shift(at, 0, 40 + 34), "Yes — Starter is free forever, no card needed.", 12, 400, 480, MUTED));
      return out;
    },
  },
  {
    id: "web-stepper",
    label: "Stepper",
    group: "Web · App",
    width: 560,
    height: 60,
    build: (at) => {
      const out: CanvasObject[] = [line(shift(at, 16, 15), 528, 2)];
      ["Account", "Details", "Payment", "Done"].forEach((s, i) => {
        const x = at.x + i * 176;
        const active = i <= 1;
        out.push(
          stampRect({ x, y: at.y }, 32, 32, { type: "ellipse", fill: active ? ACCENT : "#ffffff", stroke: active ? ACCENT : LINE, strokeWidth: 2, text: String(i + 1), color: active ? "#ffffff" : MUTED, fontSize: 12 }),
          text({ x: x - 20, y: at.y + 40 }, s, 11, active ? 600 : 500, 72, active ? INK : MUTED),
        );
      });
      return out;
    },
  },
  {
    id: "web-progress",
    label: "Progress + slider",
    group: "Web · App",
    width: 320,
    height: 70,
    build: (at) => [
      text(at, "Uploading · 64%", 12, 600, 200),
      line(shift(at, 0, 22), 320, 8, SURFACE),
      line(shift(at, 0, 22), 205, 8, ACCENT),
      line(shift(at, 0, 54), 320, 4, LINE),
      line(shift(at, 0, 54), 120, 4, INK),
      stampRect(shift(at, 112, 47), 18, 18, { type: "ellipse", fill: "#ffffff", stroke: INK, strokeWidth: 2 }),
    ],
  },
  {
    id: "web-tooltip",
    label: "Tooltip + badge",
    group: "Web · App",
    width: 220,
    height: 90,
    build: (at) => [
      box(shift(at, 0, 0), 150, 34, { fill: INK, stroke: INK, radius: 8, text: "Copied to clipboard", color: "#ffffff", fontSize: 12 }),
      stampRect(shift(at, 66, 32), 12, 12, { type: "diamond", fill: INK, stroke: INK, strokeWidth: 0 }),
      ghost(shift(at, 40, 50), 70, 36, "Copy"),
      stampRect(shift(at, 160, 40), 36, 36, { type: "ellipse", fill: SURFACE, stroke: SURFACE }),
      stampRect(shift(at, 186, 34), 20, 20, { type: "ellipse", fill: "#d4483b", stroke: "#ffffff", strokeWidth: 2, text: "3", color: "#ffffff", fontSize: 10 }),
    ],
  },
  {
    id: "web-calendar",
    label: "Date picker",
    group: "Web · App",
    width: 280,
    height: 280,
    build: (at) => {
      const out: CanvasObject[] = [box(at, 280, 280, { radius: 14 }), text(shift(at, 20, 18), "September 2026", 14, 700, 200), text(shift(at, 228, 16), "‹  ›", 14, 500, 40, MUTED)];
      ["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => out.push(text({ x: at.x + 22 + i * 35, y: at.y + 52 }, d, 10, 600, 20, MUTED)));
      for (let i = 0; i < 30; i += 1) {
        const c = (i + 1) % 7;
        const r = Math.floor((i + 1) / 7);
        const day = i + 1;
        if (day === 21) out.push(stampRect({ x: at.x + 14 + c * 35, y: at.y + 72 + r * 34 }, 28, 28, { type: "ellipse", fill: ACCENT, stroke: ACCENT }));
        out.push(text({ x: at.x + 22 + c * 35, y: at.y + 78 + r * 34 }, String(day), 11, 500, 20, day === 21 ? "#ffffff" : INK));
      }
      return out;
    },
  },
  {
    id: "web-chat",
    label: "Chat thread",
    group: "Web · App",
    width: 360,
    height: 250,
    build: (at) => [
      box(at, 360, 250, { radius: 14 }),
      avatar(shift(at, 16, 20), 28),
      box(shift(at, 52, 16), 220, 44, { fill: SURFACE, stroke: SURFACE, radius: 12, text: "Can we move the launch to Friday?", fontSize: 12, align: "left", padding: 12 }),
      box(shift(at, 110, 74), 234, 44, { fill: ACCENT, stroke: ACCENT, radius: 12, text: "Yes — I'll update the timeline.", color: "#ffffff", fontSize: 12, align: "left", padding: 12 }),
      avatar(shift(at, 16, 130), 28),
      box(shift(at, 52, 126), 160, 44, { fill: SURFACE, stroke: SURFACE, radius: 12, text: "Perfect, thanks!", fontSize: 12, align: "left", padding: 12 }),
      box(shift(at, 16, 194), 280, 40, { fill: "#ffffff", stroke: LINE, radius: 20, text: "Write a message…", align: "left", padding: 14, fontSize: 12, color: MUTED }),
      stampRect(shift(at, 304, 194), 40, 40, { type: "ellipse", fill: INK, stroke: INK, text: "↑", color: "#ffffff", fontSize: 16 }),
    ],
  },
  {
    id: "web-code",
    label: "Code block",
    group: "Web · App",
    width: 480,
    height: 170,
    build: (at) => [
      box(at, 480, 170, { fill: INK, stroke: INK, radius: 12 }),
      text(shift(at, 16, 12), "install.sh", 11, 500, 200, "#b4b1a8"),
      text(shift(at, 420, 12), "Copy", 11, 600, 50, "#7ba4f2"),
      text(shift(at, 16, 44), "$ npm create yxm@latest", 13, 500, 440, "#f1efe9"),
      text(shift(at, 16, 68), "$ cd my-app && npm run dev", 13, 500, 440, "#f1efe9"),
      text(shift(at, 16, 100), "  ➜ Local:  http://localhost:5180", 13, 400, 440, "#7ba4f2"),
      text(shift(at, 16, 124), "  ready in 312ms", 13, 400, 440, "#8fd694"),
    ],
  },
  {
    id: "web-timeline",
    label: "Timeline",
    group: "Web · App",
    width: 320,
    height: 220,
    build: (at) => {
      const out: CanvasObject[] = [line(shift(at, 11, 8), 2, 200, LINE)];
      const rows: [string, string, boolean][] = [["Order placed", "Mon 09:12", true], ["Packed", "Mon 14:40", true], ["Shipped", "Tue 08:05", true], ["Out for delivery", "Wed — today", false]];
      rows.forEach(([t, d, done], i) => {
        const y = at.y + i * 52;
        out.push(
          stampRect({ x: at.x, y: y + 2 }, 24, 24, { type: "ellipse", fill: done ? "#0f8a6a" : "#ffffff", stroke: done ? "#0f8a6a" : LINE, strokeWidth: 2, text: done ? "✓" : "", color: "#ffffff", fontSize: 11 }),
          text({ x: at.x + 38, y: y + 2 }, t, 13, 600, 240),
          text({ x: at.x + 38, y: y + 20 }, d, 11, 400, 240, MUTED),
        );
      });
      return out;
    },
  },
  {
    id: "web-logos",
    label: "Logo wall",
    group: "Web · Marketing",
    width: 960,
    height: 80,
    build: (at) => {
      const out: CanvasObject[] = [text(shift(at, 0, 0), "TRUSTED BY TEAMS AT", 10, 600, 300, MUTED)];
      ["Linear", "Vercel", "Notion", "Loom", "Pitch", "Raycast"].forEach((n, i) => out.push(text({ x: at.x + i * 160, y: at.y + 36 }, n, 20, 800, 140, "#b3b0a5")));
      return out;
    },
  },
  {
    id: "web-hero-center",
    label: "Hero · centered",
    group: "Web · Marketing",
    width: 960,
    height: 360,
    build: (at) => [
      box(at, 960, 360, { radius: 0, stroke: "transparent" }),
      pill(shift(at, 414, 56), 132, "Now in public beta"),
      text(shift(at, 130, 100), "Explain anything, visually.", 46, 700, 700),
      text(shift(at, 230, 168), "Sketch, structure and ship — one canvas from first thought to launch.", 15, 400, 500, MUTED),
      primary(shift(at, 330, 228), 140, 44, "Start free"),
      ghost(shift(at, 490, 228), 140, 44, "Watch the film"),
      text(shift(at, 380, 292), "No card · Free for individuals", 11, 400, 200, MUTED),
    ],
  },
  {
    id: "web-testimonials",
    label: "Testimonial grid",
    group: "Web · Marketing",
    width: 960,
    height: 200,
    build: (at) => {
      const out: CanvasObject[] = [];
      const q: [string, string, string][] = [
        ["“Replaced three tools. Shipped two weeks early.”", "Jordan Ike", "Head of Product, Northwind"],
        ["“The first whiteboard my engineers actually open.”", "Mira S.", "CTO, Loop"],
        ["“Our decks went from 40 slides to one board.”", "Kei Tanaka", "Founder, Halo"],
      ];
      q.forEach(([t, n, r], i) => {
        const x = at.x + i * 320;
        out.push(box({ x, y: at.y }, 296, 200, { radius: 14, fill: SURFACE, stroke: SURFACE }), text({ x: x + 24, y: at.y + 24 }, t, 15, 500, 250), avatar({ x: x + 24, y: at.y + 140 }, 32), text({ x: x + 66, y: at.y + 142 }, n, 12, 600, 200), text({ x: x + 66, y: at.y + 160 }, r, 11, 400, 200, MUTED));
      });
      return out;
    },
  },
  {
    id: "web-settings",
    label: "Settings page",
    group: "Web · Screens",
    width: 900,
    height: 520,
    build: (at) => [
      box(at, 900, 520, { radius: 0, stroke: LINE }),
      text(shift(at, 32, 28), "Settings", 24, 700, 300),
      ...["Profile", "Notifications", "Billing", "Security", "Integrations"].map((s, i) => text(shift(at, 32, 84 + i * 32), s, 13, i === 0 ? 700 : 500, 160, i === 0 ? INK : MUTED)),
      line(shift(at, 220, 80), 1, 400, LINE),
      text(shift(at, 260, 84), "Profile", 16, 700, 300),
      avatar(shift(at, 260, 120), 64),
      ghost(shift(at, 340, 134), 110, 36, "Change photo"),
      text(shift(at, 260, 212), "Full name", 12, 600, 200),
      box(shift(at, 260, 232), 380, 40, { text: "Ada Lovelace", align: "left", padding: 12, fontSize: 13 }),
      text(shift(at, 260, 290), "Email", 12, 600, 200),
      box(shift(at, 260, 310), 380, 40, { text: "ada@studio.co", align: "left", padding: 12, fontSize: 13 }),
      text(shift(at, 260, 368), "Time zone", 12, 600, 200),
      box(shift(at, 260, 388), 380, 40, { text: "Africa/Lagos  ▾", align: "left", padding: 12, fontSize: 13, color: MUTED }),
      primary(shift(at, 540, 456), 100, 40, "Save"),
    ],
  },
  /* ------------------------------------------------------------- screens */
  {
    id: "web-login",
    label: "Login screen",
    group: "Web · Screens",
    width: 420,
    height: 460,
    build: (at) => [
      box(at, 420, 460, { radius: 16 }),
      soft(shift(at, 186, 36), 48, 48, { radius: 12, fill: ACCENT_SOFT, stroke: ACCENT_SOFT }),
      text(shift(at, 40, 104), "Welcome back", 22, 700, 340),
      text(shift(at, 40, 136), "Sign in to continue to your workspace.", 13, 400, 340, MUTED),
      text(shift(at, 40, 176), "Email", 12, 600, 200),
      box(shift(at, 40, 196), 340, 44, { text: "you@company.com", align: "left", padding: 14, fontSize: 13, color: MUTED }),
      text(shift(at, 40, 252), "Password", 12, 600, 200),
      box(shift(at, 40, 272), 340, 44, { text: "••••••••••", align: "left", padding: 14, fontSize: 13, color: MUTED }),
      primary(shift(at, 40, 336), 340, 44, "Sign in"),
      text(shift(at, 40, 400), "No account?  Create one", 12, 500, 340, MUTED),
    ],
  },
  {
    id: "web-dashboard",
    label: "Dashboard layout",
    group: "Web · Screens",
    width: 1200,
    height: 720,
    build: (at) => [
      box(at, 1200, 720, { radius: 0, stroke: LINE }),
      box(at, 240, 720, { radius: 0, fill: SURFACE, stroke: LINE }),
      text(shift(at, 20, 22), "Workspace", 14, 700, 160),
      box(shift(at, 12, 64), 216, 36, { fill: "#ffffff", stroke: LINE, radius: 8, text: "Dashboard", fontSize: 13, align: "left", padding: 14 }),
      text(shift(at, 26, 118), "Projects", 13, 500, 160, MUTED),
      text(shift(at, 26, 152), "Reports", 13, 500, 160, MUTED),
      text(shift(at, 26, 186), "Team", 13, 500, 160, MUTED),
      box(shift(at, 240, 0), 960, 64, { radius: 0, stroke: LINE }),
      box(shift(at, 264, 12), 320, 40, { fill: SURFACE, stroke: SURFACE, radius: 20, text: "⌕   Search…", align: "left", padding: 16, fontSize: 13, color: MUTED }),
      primary(shift(at, 1076, 14), 100, 36, "+ New"),
      avatar(shift(at, 1030, 16), 32),
      text(shift(at, 272, 92), "Good morning, Ada", 22, 700, 400),
      text(shift(at, 272, 124), "Here is what changed since yesterday.", 13, 400, 400, MUTED),
      ...[0, 1, 2].map((i) => box(shift(at, 272 + i * 304, 160), 288, 96, { radius: 12 })),
      ...[0, 1, 2].map((i) => text(shift(at, 292 + i * 304, 178), ["Revenue", "Active users", "Open issues"][i], 12, 500, 160, MUTED)),
      ...[0, 1, 2].map((i) => text(shift(at, 292 + i * 304, 202), ["$48.2k", "3,208", "17"][i], 26, 700, 160)),
      box(shift(at, 272, 280), 592, 400, { radius: 12 }),
      text(shift(at, 292, 298), "Signups", 14, 600, 200),
      ...[40, 62, 48, 80, 66, 90, 74, 110, 96, 128, 104, 140, 122, 150].map((h, i) => line(shift(at, 296 + i * 40, 650 - h), 26, h, i === 13 ? ACCENT : ACCENT_SOFT)),
      box(shift(at, 888, 280), 288, 400, { radius: 12 }),
      text(shift(at, 908, 298), "Recent activity", 14, 600, 200),
      ...[0, 1, 2, 3, 4].map((i) => avatar(shift(at, 908, 336 + i * 60), 28)),
      ...[0, 1, 2, 3, 4].map((i) => text(shift(at, 946, 338 + i * 60), ["Sam moved Billing to Review", "Kei commented on Nav", "Mira closed 3 issues", "Ada invited Jordan", "Deploy v2.0.1 succeeded"][i], 12, 500, 220)),
      ...[0, 1, 2, 3, 4].map((i) => text(shift(at, 946, 356 + i * 60), ["2m", "18m", "1h", "3h", "5h"][i] + " ago", 11, 400, 220, MUTED)),
    ],
  },
  {
    id: "web-landing",
    label: "Landing page",
    group: "Web · Screens",
    width: 960,
    height: 1180,
    build: (at) => {
      const parts: CanvasObject[] = [];
      const nav = WEB_STAMPS.find((s) => s.id === "web-nav")!;
      const hero = WEB_STAMPS.find((s) => s.id === "web-hero")!;
      const features = WEB_STAMPS.find((s) => s.id === "web-features")!;
      const cta = WEB_STAMPS.find((s) => s.id === "web-cta")!;
      const footer = WEB_STAMPS.find((s) => s.id === "web-footer")!;
      const d = { ink: INK } as Parameters<Stamp["build"]>[1];
      parts.push(box(at, 960, 1180, { radius: 0, stroke: LINE }));
      parts.push(...nav.build(at, d));
      parts.push(...hero.build(shift(at, 0, 64), d));
      parts.push(...features.build(shift(at, 0, 520), d));
      parts.push(...cta.build(shift(at, 0, 820), d));
      parts.push(...footer.build(shift(at, 0, 1000), d));
      return parts;
    },
  },
];

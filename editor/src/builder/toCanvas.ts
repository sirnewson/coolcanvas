/**
 * Section → canvas objects, built from the section's *own copy*. Every
 * headline, button, card, quote and image slot becomes a separate object, so
 * on the board you can move, resize, restyle, replace pictures or connect any
 * part — the Framer-style editing pass happens on the canvas.
 */
import type { CanvasObject, SiteSection, SiteState } from "../types";
import { KIT } from "../lib/webkit";
import { createFrame, createImage, createPlaceholder, stampLabel } from "../store/factory";
import { THEMES } from "./LiveSections";
import { SECTIONS } from "./sections";
import type { SectionDefinition } from "./types";

const { box, primary, ghost, pill, text, line, avatar, shift } = KIT;

const W = 960;

function pieces(v: string | undefined, fallback: string[]): string[] {
  const lines = (v ?? "")
    .split(/\n|,\s*(?=[A-Z])/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length ? lines : fallback;
}
function parts(v: string, n = 3): string[] {
  const p = v.split("·").map((x) => x.trim());
  while (p.length < n) p.push("");
  return p;
}
function slot(at: { x: number; y: number }, w: number, h: number, src?: string): CanvasObject {
  if (src) {
    const o = createImage({ x: at.x + w / 2, y: at.y + h / 2 }, src, w, h, 1e9);
    o.width = w;
    o.height = h;
    o.x = at.x;
    o.y = at.y;
    o.style.radius = 12;
    return o;
  }
  const p = createPlaceholder({ x: at.x + w / 2, y: at.y + h / 2 }, w, h);
  p.style.radius = 12;
  return p;
}

type Build = (at: { x: number; y: number }, c: Record<string, string>, brand: string, def: SectionDefinition) => { objects: CanvasObject[]; height: number };

const BUILDERS: Record<string, Build> = {
  header: (at, c, brand) => {
    const links = pieces(c.nav_links ?? c.menu_links ?? c.products_dropdown, ["Product", "Pricing", "Docs", "Blog"]).slice(0, 5);
    const objects: CanvasObject[] = [box(at, W, 64, { radius: 0 }), text(shift(at, 24, 22), c.brand_name || brand || "Brand", 16, 700, 200)];
    links.forEach((l, i) => objects.push(text(shift(at, 300 + i * 90, 24), l, 13, 500, 86, KIT.MUTED)));
    if (c.search_ph) objects.push(box(shift(at, 300, 14), 300, 36, { fill: KIT.SURFACE, stroke: KIT.SURFACE, radius: 18, text: c.search_ph, align: "left", padding: 14, fontSize: 12, color: KIT.MUTED }));
    objects.push(primary(shift(at, W - 24 - 96, 16), 96, 32, c.cta_label || "Sign up"));
    return { objects, height: 64 };
  },
  hero: (at, c) => {
    const headline = c.headline || "A headline that says it plainly.";
    const sub = c.subheadline ?? c.subhead ?? c.subtext ?? "One line that explains the promise.";
    const split = !!(c.product_mock_desc || c.mockup_desc || c.widget_desc || c.image || c.form_fields);
    const objects: CanvasObject[] = [box(at, W, 420, { radius: 0, stroke: "transparent" })];
    const tw = split ? 440 : 760;
    const tx = split ? 64 : (W - tw) / 2;
    const h1 = text(shift(at, tx, 96), headline, 44, 700, tw);
    h1.height = 56 * Math.ceil(headline.length / 20);
    h1.style.align = split ? "left" : "center";
    const p = text(shift(at, tx, 96 + h1.height + 12), sub, 15, 400, tw, KIT.MUTED);
    p.height = 48;
    p.style.align = split ? "left" : "center";
    objects.push(h1, p);
    const by = p.y + 72;
    const bx = split ? at.x + 64 : at.x + W / 2 - 146;
    objects.push(primary({ x: bx, y: by }, 140, 44, c.primary_cta || c.cta_label || "Get started"));
    objects.push(ghost({ x: bx + 152, y: by }, 140, 44, c.secondary_cta || "Learn more"));
    if (split) objects.push(slot(shift(at, 560, 60), 340, 300, c.image));
    if (c.stat_1 || c.stat_2) {
      [c.stat_1, c.stat_2, c.stat_3].filter(Boolean).forEach((s, i) => objects.push(text({ x: bx + i * 150, y: by + 64 }, s as string, 14, 700, 140)));
    }
    return { objects, height: 420 };
  },
  features: (at, c, _b, def) => {
    const objects: CanvasObject[] = [text(at, c.section_title || "Everything you need", 26, 700, 600)];
    let height = 60;
    if (def.id === "FEAT_06") {
      [c.stat_1, c.stat_2, c.stat_3 ?? "24/7 support", c.stat_4 ?? "4.9★ rating"].filter(Boolean).forEach((s, i) => {
        const [num, label] = (s as string).split(/\s(.+)/);
        objects.push(box(shift(at, i * 240, 56), 224, 96, { radius: 12 }), text(shift(at, i * 240 + 20, 78), num, 26, 700, 180), text(shift(at, i * 240 + 20, 116), label ?? "", 12, 500, 180, KIT.MUTED));
      });
      return { objects, height: 160 };
    }
    if (def.id === "FEAT_07") {
      [c.step_1, c.step_2, c.step_3, c.step_4].filter(Boolean).forEach((s, i) => {
        const [t, body] = parts(s as string, 2);
        objects.push(
          box(shift(at, i * 240, 56), 224, 140, { radius: 12 }),
          box(shift(at, i * 240 + 20, 76), 32, 32, { type: "ellipse", fill: KIT.ACCENT, stroke: KIT.ACCENT, text: String(i + 1), color: "#fff", fontSize: 13 }),
          text(shift(at, i * 240 + 20, 122), t, 15, 700, 190),
          text(shift(at, i * 240 + 20, 146), body, 12, 400, 190, KIT.MUTED),
        );
      });
      return { objects, height: 210 };
    }
    if (def.id === "FEAT_12") {
      objects.length = 0;
      objects.push(box(at, W, 64, { fill: KIT.INK, stroke: KIT.INK, radius: 0 }), text(shift(at, 24, 20), c.marquee_text || "Design ++ Build ++ Ship ++", 18, 700, W - 48, "#fff"));
      return { objects, height: 64 };
    }
    const raw = [c.feature_1, c.feature_2, c.feature_3, c.box_1, c.box_2, c.box_3].filter(Boolean) as string[];
    const list = raw.length ? raw : pieces(c.features ?? c.checklist, ["Fast · Built for speed", "Secure · Private by design", "Simple · Nothing to learn"]);
    list.slice(0, 6).forEach((f, i) => {
      const [a, b, cc] = parts(f, 3);
      const icon = /^\p{Extended_Pictographic}/u.test(a) ? a : "";
      const title = icon ? b || a : a;
      const body = icon ? cc || b : b || cc;
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = at.x + col * 320;
      const y = at.y + 56 + row * 200;
      objects.push(
        box({ x, y }, 296, 180, { radius: 12 }),
        box({ x: x + 20, y: y + 20 }, 40, 40, { fill: KIT.ACCENT_SOFT, stroke: KIT.ACCENT_SOFT, radius: 10, text: icon, fontSize: 18 }),
        text({ x: x + 20, y: y + 76 }, title, 16, 700, 250),
        text({ x: x + 20, y: y + 104 }, body, 12, 400, 250, KIT.MUTED),
      );
      height = 56 + (row + 1) * 200;
    });
    return { objects, height };
  },
  proof: (at, c, _b, def) => {
    const objects: CanvasObject[] = [];
    if (def.id === "TST_05" || def.id === "TST_11") {
      objects.push(text(at, (c.section_title || "Trusted by").toUpperCase(), 10, 600, 300, KIT.MUTED));
      pieces(c.logos, ["Linear", "Vercel", "Notion", "Loom", "Pitch"]).slice(0, 6).forEach((n, i) => objects.push(text(shift(at, i * 160, 34), n, 20, 800, 150, "#b3b0a5")));
      return { objects, height: 80 };
    }
    if (def.id === "TST_08") {
      pieces(c.badges, ["SSL", "GDPR", "ISO 27001"]).slice(0, 5).forEach((b, i) => objects.push(pill(shift(at, i * 180, 0), 164, b)));
      return { objects, height: 40 };
    }
    if (c.quote && !c.quote_1) {
      objects.push(
        box(at, W, 190, { radius: 16, fill: KIT.SURFACE, stroke: KIT.SURFACE }),
        text(shift(at, 60, 44), `“${c.quote}”`, 22, 500, W - 120),
        avatar(shift(at, 60, 128), 36),
        text(shift(at, 106, 130), c.attribution_name || "Name", 13, 600, 300),
        text(shift(at, 106, 148), c.attribution_role || "Role", 11, 400, 300, KIT.MUTED),
      );
      return { objects, height: 190 };
    }
    objects.push(text(at, c.section_title || "What people say", 26, 700, 600));
    const quotes = [c.quote_1, c.quote_2, c.quote_3, c.case_1, c.case_2, c.review_1, c.video_1].filter(Boolean) as string[];
    (quotes.length ? quotes : ["'Amazing service' · Amara O.", "'We use it daily' · John D.", "'Tripled our bookings' · Sara N."]).slice(0, 3).forEach((q, i) => {
      const [t, who] = parts(q, 2);
      const x = at.x + i * 320;
      objects.push(box({ x, y: at.y + 56 }, 296, 170, { radius: 14, fill: KIT.SURFACE, stroke: KIT.SURFACE }), text({ x: x + 24, y: at.y + 80 }, t, 15, 500, 250), avatar({ x: x + 24, y: at.y + 170 }, 30), text({ x: x + 64, y: at.y + 176 }, who || "Customer", 12, 600, 200));
    });
    return { objects, height: 230 };
  },
  cta: (at, c) => {
    const objects: CanvasObject[] = [
      box(at, W, 160, { radius: 16, fill: KIT.INK, stroke: KIT.INK }),
      text(shift(at, 48, 40), c.headline || "Ready when you are.", 26, 700, 560, "#fff"),
      text(shift(at, 48, 84), c.subtext ?? c.trust_line ?? c.offer ?? "Free to start. No card needed.", 13, 400, 560, "#b4b1a8"),
    ];
    if (c.input_placeholder) {
      objects.push(box(shift(at, 560, 58), 220, 44, { text: c.input_placeholder, align: "left", padding: 14, fontSize: 13, color: KIT.MUTED }));
      objects.push(box(shift(at, 792, 58), 120, 44, { fill: "#fff", stroke: "#fff", color: KIT.INK, text: c.cta_label || "Subscribe", fontSize: 13 }));
    } else {
      objects.push(box(shift(at, 760, 58), 152, 44, { fill: "#fff", stroke: "#fff", color: KIT.INK, text: c.cta_label || c.primary_cta || "Get started", fontSize: 13 }));
    }
    return { objects, height: 160 };
  },
  pricing: (at, c) => {
    const objects: CanvasObject[] = [text(at, c.section_title || "Simple pricing", 26, 700, 600)];
    const plans = [c.plan_1, c.plan_2, c.plan_3, c.free_plan, c.pro_plan, c.teaser_1, c.teaser_2, c.pack_1, c.pack_2].filter(Boolean) as string[];
    (plans.length ? plans : ["Starter · $0 · Basics", "Pro · $12/mo · Everything", "Team · $39/mo · Admin + SSO"]).slice(0, 3).forEach((p, i) => {
      const [name, price, feats] = parts(p, 3);
      const hot = i === 1;
      const x = at.x + i * 320;
      objects.push(
        box({ x, y: at.y + 56 }, 296, 330, { radius: 14, stroke: hot ? KIT.ACCENT : KIT.LINE, strokeWidth: hot ? 2 : 1 }),
        text({ x: x + 24, y: at.y + 80 }, name, 14, 600, 200, KIT.MUTED),
        text({ x: x + 24, y: at.y + 108 }, price || "$0", 34, 700, 240),
        text({ x: x + 24, y: at.y + 170 }, feats.split(/,\s*/).map((f) => `✓  ${f}`).join("\n") || "✓  Everything included", 13, 400, 250),
        hot ? primary({ x: x + 24, y: at.y + 318 }, 248, 44, `Choose ${name}`) : ghost({ x: x + 24, y: at.y + 318 }, 248, 44, `Choose ${name}`),
      );
      const list = objects[objects.length - 2];
      list.height = 24 * Math.max(1, feats.split(/,\s*/).length);
    });
    return { objects, height: 400 };
  },
  faq: (at, c) => {
    const objects: CanvasObject[] = [text(at, c.section_title || "Questions, answered", 26, 700, 600)];
    const raw = c.faqs ?? c.tab_1_faqs ?? c.questions ?? "";
    const qs = raw
      .split("\n")
      .filter((l) => /^q[:.]/i.test(l.trim()) || (!/^a[:.]/i.test(l.trim()) && l.trim()))
      .map((l) => l.replace(/^q[:.]\s*/i, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    (qs.length ? qs : ["Is there a free plan?", "Can I cancel any time?", "Where is my data stored?"]).forEach((q, i) => {
      const y = at.y + 56 + i * 52;
      objects.push(line({ x: at.x, y: y + 44 }, W, 1), text({ x: at.x, y: y + 12 }, q, 15, 600, W - 60), text({ x: at.x + W - 30, y: y + 8 }, "+", 20, 500, 24, KIT.MUTED));
    });
    return { objects, height: 56 + Math.max(qs.length, 3) * 52 };
  },
  forms: (at, c) => {
    const fields = pieces(c.form_fields ?? c.fields, ["Name", "Email", "Message"]).slice(0, 6);
    const objects: CanvasObject[] = [box(at, 480, 100 + fields.length * 66 + 60, { radius: 14 }), text(shift(at, 28, 26), c.section_title || c.headline || "Get in touch", 20, 700, 400)];
    fields.forEach((f, i) => {
      const y = at.y + 72 + i * 66;
      objects.push(text({ x: at.x + 28, y }, f, 12, 600, 300), box({ x: at.x + 28, y: y + 20 }, 424, /message|notes|details/i.test(f) ? 80 : 40, { text: "", radius: 8 }));
      if (/message|notes|details/i.test(f)) {
        /* taller field consumes extra row */
      }
    });
    objects.push(primary({ x: at.x + 28, y: at.y + 72 + fields.length * 66 + 8 }, 424, 44, c.cta_label || c.submit_label || "Send"));
    return { objects, height: 100 + fields.length * 66 + 60 };
  },
  gallery: (at, c) => {
    const objects: CanvasObject[] = [text(at, c.section_title || "Gallery", 26, 700, 600)];
    const caps = pieces(c.images ?? c.image_captions ?? c.case_1, ["One", "Two", "Three", "Four", "Five", "Six"]).slice(0, 6);
    caps.forEach((cap, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = at.x + col * 320;
      const y = at.y + 56 + row * 236;
      objects.push(slot({ x, y }, 296, 200, c[`image_${i + 1}`] ?? (i === 0 ? c.image : undefined)), text({ x, y: y + 208 }, cap, 12, 600, 296));
    });
    return { objects, height: 56 + Math.ceil(caps.length / 3) * 236 };
  },
  footer: (at, c, brand) => {
    const objects: CanvasObject[] = [box(at, W, 180, { radius: 0, fill: KIT.SURFACE, stroke: KIT.SURFACE }), text(shift(at, 32, 28), c.brand_name || brand || "Brand", 15, 700, 200)];
    const cols = pieces(c.col_1_title ?? c.col_groups ?? c.links, ["Product: Features, Pricing", "Company: About, Careers", "Legal: Privacy, Terms"]).slice(0, 3);
    cols.forEach((col, i) => {
      const [title, rest] = col.split(/:\s*/);
      objects.push(text(shift(at, 400 + i * 180, 28), title, 12, 700, 160));
      (rest ?? "").split(/,\s*/).filter(Boolean).slice(0, 4).forEach((l, j) => objects.push(text(shift(at, 400 + i * 180, 52 + j * 20), l, 12, 400, 160, KIT.MUTED)));
    });
    objects.push(text(shift(at, 32, 148), c.copyright || `© 2026 ${c.brand_name || brand || "Brand"}`, 11, 400, 300, KIT.MUTED));
    return { objects, height: 180 };
  },
};

/** Whole site → one browser frame with every section laid out inside. */
export function siteToEditableObjects(site: SiteState, at: { x: number; y: number }): CanvasObject[] {
  const theme = THEMES.find((t) => t.id === site.theme)?.theme;
  const out: CanvasObject[] = [];
  const frame = createFrame({ x: at.x, y: at.y }, site.brief.brand || "Site", "browser");
  frame.width = W + 48;
  frame.data.url = `${(site.brief.brand || "site").toLowerCase().replace(/\s+/g, "")}.com`;
  if (theme) frame.style.fill = theme.bg2;
  out.push(frame);

  let y = at.y + 56;
  const x = at.x + 24;
  for (const q of site.sections) {
    const def = SECTIONS.find((s) => s.id === q.id);
    if (!def) continue;
    const build = BUILDERS[def.cat];
    if (!build) continue;
    const { objects, height } = build({ x, y }, q.content, site.brief.brand, def);
    const tag = stampLabel({ x: x + 4, y: y - 16 }, `${def.cat.toUpperCase()} · ${def.name}`, 10, 600);
    tag.style.color = KIT.MUTED;
    tag.width = 400;
    if (theme) {
      // Tint the kit's neutral palette toward the chosen theme.
      for (const o of objects) {
        if (o.style.fill === KIT.ACCENT) o.style.fill = theme.brand;
        if (o.style.stroke === KIT.ACCENT) o.style.stroke = theme.brand;
        if (o.style.fill === KIT.ACCENT_SOFT) o.style.fill = theme.brandLight;
        if (o.style.stroke === KIT.ACCENT_SOFT) o.style.stroke = theme.brandLight;
        if (o.style.color === KIT.ACCENT) o.style.color = theme.brand;
      }
    }
    out.push(tag, ...objects);
    y += height + 48;
  }
  frame.height = y - at.y;
  for (const o of out) if (o !== frame) o.parentId = frame.id;
  return out;
}

export function sectionsCount(site: SiteState): number {
  return site.sections.filter((q) => SECTIONS.some((s) => s.id === q.id)).length;
}

export type { SiteSection };

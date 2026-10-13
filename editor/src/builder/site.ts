/**
 * Site outputs: the build prompt for a model, a static HTML export rendered
 * from the live section components, and a conversion of the section stack
 * into editable wireframe objects on the canvas.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { SiteState } from "../types";
import { LAYOUT_NAMES, SECTIONS } from "./sections";
import { LIVE_COMPONENT_MAP, THEMES, applyBuilderTheme } from "./LiveSections";

export const sectionById = (id: string) => SECTIONS.find((s) => s.id === id);

/* ------------------------------------------------------------- prompt */

export function buildPrompt(site: SiteState): string {
  const { brief } = site;
  const blocks = site.sections
    .map((q, i) => {
      const s = sectionById(q.id);
      if (!s) return "";
      const content = s.contentFields
        .map((f) => (q.content[f.key] ? `    ${f.label}: ${q.content[f.key]}` : null))
        .filter(Boolean)
        .join("\n");
      const role =
        s.cat === "header"
          ? '<header> with role="banner"'
          : s.cat === "footer"
            ? '<footer> with role="contentinfo"'
            : s.cat === "hero"
              ? "first <section> in <main>, contains the page H1"
              : s.cat === "faq"
                ? "<section> with accordion ARIA pattern"
                : s.cat === "forms"
                  ? "<section> with <form>, labels required, inline errors"
                  : "<section> in <main>";
      return `
SECTION ${i + 1}: ${s.name} [${s.id}]
  Category: ${s.cat}
  Layout pattern: ${s.layout} — ${LAYOUT_NAMES[s.layout] ?? s.layout}
  Visual style family: ${s.visual.join(", ")}
  Behaviour variants: ${s.behavior.length ? s.behavior.join(", ") : "none (static)"}
  Semantic role: ${role}
  Required components: ${s.components.join(", ")}${content ? `\n  CONTENT:\n${content}` : ""}`;
    })
    .join("\n");

  const theme = THEMES.find((t) => t.id === site.theme)?.theme ?? THEMES[0].theme;

  return `You are building a complete, production-ready website. Output a SINGLE self-contained HTML file with all CSS and JavaScript inline. No external dependencies except Google Fonts.

SITE BRIEF
Brand name:      ${brief.brand || "[Brand Name]"}
Site type:       ${brief.type || "[Site Type]"}
What it does:    ${brief.offer || "[What the site does]"}
Target audience: ${brief.audience || "[Target audience]"}
Visual style:    ${brief.style || "[Visual style]"}

PALETTE (use as CSS custom properties)
  --color-bg: ${theme.bg}; --color-bg-alt: ${theme.bg2}; --color-text-primary: ${theme.ink};
  --color-text-secondary: ${theme.ink2}; --color-text-muted: ${theme.ink3}; --color-border: ${theme.border};
  --color-accent-primary: ${theme.brand}; --color-accent-bg: ${theme.brandLight};
  Body font family to load from Google Fonts: ${theme.font.split(",")[0].replace(/'/g, "")}; pick a matching display font.

DESIGN SYSTEM — define at :root before any section: the colours above, --font-display, --font-body,
--radius-sm 4px, --radius-md 8px, --radius-lg 16px, --shadow-md, --transition 0.2s ease,
--max-width 1200px, --padding-x clamp(20px, 5vw, 80px).

SECTIONS TO BUILD — IN THIS EXACT ORDER
${blocks}

LAYOUT SPECIFICATIONS
L1 one column centered max-width 760px · L2 two column 50/50 stacked under 768px · L3 media left 45/55 ·
L4 three-card grid → 2 → 1 · L5 four-card grid → 2 → 1 · L6 zigzag alternating rows · L7 sidebar + main ·
L8 full-bleed min-height 60vh · L9 masonry 3 → 2 → 1 · L10 carousel with scroll-snap and controls ·
L11 table with horizontal scroll wrapper and sticky first column · L12 feed of article cards.

ACCESSIBILITY — ALL REQUIRED
Skip link visible on focus · semantic landmarks · exactly one H1 · alt text on every image ·
every field has a <label> · accordions use aria-expanded / aria-controls · focus styles visible ·
colour contrast at least 4.5:1 for text.

Write realistic copy from the brief where content is missing. Return ONLY the HTML document,
starting with <!DOCTYPE html>, no markdown fences, no commentary.`;
}

/* ----------------------------------------------------------- static HTML */

/**
 * Renders the live preview components to a standalone page. Inline styles
 * travel as-is; a small stylesheet adds the font, resets and a mobile
 * collapse for the two-column grids.
 */
export function renderSiteHtml(site: SiteState): string {
  const themeDef = THEMES.find((t) => t.id === site.theme) ?? THEMES[0];
  applyBuilderTheme(themeDef.theme);
  const body = site.sections
    .map((q) => {
      const s = sectionById(q.id);
      const Comp = LIVE_COMPONENT_MAP[q.id];
      if (!s || !Comp) return "";
      const tag = s.cat === "header" ? "header" : s.cat === "footer" ? "footer" : "section";
      const inner = renderToStaticMarkup(createElement(Comp, { data: q.content, brand: site.brief.brand, type: site.brief.type }));
      return `<${tag} id="${q.uid}" data-section="${s.id}" aria-label="${s.name}">${inner}</${tag}>`;
    })
    .join("\n");
  const fontName = themeDef.theme.font.split(",")[0].replace(/'/g, "").trim();
  const title = site.brief.brand || "Site";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(site.brief.offer || "")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
  *,*::before,*::after{box-sizing:border-box}
  html,body{margin:0;background:${themeDef.theme.bg};color:${themeDef.theme.ink};font-family:${themeDef.theme.font};-webkit-font-smoothing:antialiased}
  h1,h2,h3,p{margin:0}
  main{display:block}
  .skip{position:absolute;left:-9999px;top:8px;background:${themeDef.theme.brand};color:#fff;padding:10px 14px;border-radius:8px;z-index:99}
  .skip:focus{left:8px}
  @media (max-width: 820px){
    [style*="grid-template-columns: 1fr 1fr"],[style*="grid-template-columns:1fr 1fr"],
    [style*="repeat(3"],[style*="repeat(4"],[style*="1fr 1fr 1fr"]{grid-template-columns:1fr !important}
    [style*="font-size: 56px"],[style*="font-size: 52px"],[style*="font-size: 48px"]{font-size:36px !important}
    [style*="padding: 100px 40px"],[style*="padding: 80px 40px"]{padding:56px 20px !important}
  }
</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<main id="main">
${body}
</main>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

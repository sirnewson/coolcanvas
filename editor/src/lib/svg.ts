import type { BoardDoc, Bounds, CanvasObject } from "../types";
import { BACKGROUNDS, FONTS, NOTE_COLORS, formatMeasure } from "./theme";
import { curveControl, elbowPoints, quadPoints } from "./geom";
import { strokeOutline } from "./freehand";
import { INDENT, LIST_PAD, rowHeight, visibleRows } from "./outline";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const num = (n: number) => Math.round(n * 100) / 100;
const paint = (c?: string) => (c && c !== "transparent" ? c : "none");

function dash(o: CanvasObject): string {
  const w = o.style.strokeWidth ?? 2;
  if (o.style.dash === "dashed") return ` stroke-dasharray="${w * 4} ${w * 3}"`;
  if (o.style.dash === "dotted") return ` stroke-dasharray="0.1 ${w * 2.6}" stroke-linecap="round"`;
  return "";
}

function strokeAttrs(o: CanvasObject): string {
  const w = o.style.strokeWidth ?? 0;
  if (!w || !o.style.stroke) return ` stroke="none"`;
  return ` stroke="${o.style.stroke}" stroke-width="${num(w)}"${dash(o)}`;
}

function fontAttrs(o: CanvasObject, size?: number, color?: string): string {
  return (
    ` font-family="${esc(FONTS[o.style.fontFamily ?? "sans"])}"` +
    ` font-size="${num(size ?? o.style.fontSize ?? 15)}"` +
    ` font-weight="${o.style.fontWeight ?? 400}"` +
    (o.style.fontStyle === "italic" ? ` font-style="italic"` : "") +
    ` fill="${color ?? o.style.color ?? "#17170f"}"`
  );
}

/** Rough wrap: SVG has no flow layout, so estimate from the glyph width. */
function wrap(text: string, width: number, size: number): string[] {
  const perLine = Math.max(1, Math.floor(width / (size * 0.54)));
  const out: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      if (line && (line + " " + word).length > perLine) {
        out.push(line);
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    out.push(line);
  }
  return out;
}

function textBlock(
  o: CanvasObject,
  text: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  align: "left" | "center" | "right" = "left",
): string {
  const lines = wrap(text, width, size);
  const lh = size * (o.style.lineHeight ?? 1.35);
  const anchor = align === "center" ? "middle" : align === "right" ? "end" : "start";
  const ax = align === "center" ? x + width / 2 : align === "right" ? x + width : x;
  const spans = lines
    .map((line, i) => `<tspan x="${num(ax)}" y="${num(y + size * 0.85 + i * lh)}">${esc(line)}</tspan>`)
    .join("");
  return `<text${fontAttrs(o, size, color)} text-anchor="${anchor}">${spans}</text>`;
}

function linePts(o: CanvasObject): [number, number, number, number] {
  const p = o.data.points;
  if (p && p.length >= 4) return [p[0], p[1], p[2], p[3]];
  return [0, 0, o.width, o.height];
}

function polyline(points: number[]): string {
  const parts: string[] = [];
  for (let i = 0; i < points.length; i += 2) {
    parts.push(`${i ? "L" : "M"}${num(points[i])} ${num(points[i + 1])}`);
  }
  return parts.join(" ");
}

function arrowHead(from: [number, number], to: [number, number], size: number, color: string): string {
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const wing = 0.42;
  const p = (a: number) =>
    `${num(to[0] - Math.cos(angle + a) * size)} ${num(to[1] - Math.sin(angle + a) * size)}`;
  return `<path d="M${num(to[0])} ${num(to[1])} L${p(wing)} L${p(-wing)} Z" fill="${color}"/>`;
}

function polygonPath(o: CanvasObject): string {
  const sides = Math.max(3, Math.min(24, o.data.sides ?? 6));
  const star = !!o.data.star;
  const inner = o.data.innerRatio ?? 0.5;
  const rx = o.width / 2;
  const ry = o.height / 2;
  const count = star ? sides * 2 : sides;
  const pts: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = star && i % 2 ? inner : 1;
    pts.push(`${num(rx + Math.cos(angle) * rx * r)} ${num(ry + Math.sin(angle) * ry * r)}`);
  }
  return `M${pts.join(" L")} Z`;
}

/** Gradient fills become a def; everything else is a flat colour. */
function fillOf(o: CanvasObject, defs: string[]): string {
  const g = o.style.gradient;
  if (!g) return paint(o.style.fill);
  const id = `grad-${o.id}`;
  const rad = ((g.angle ?? 0) * Math.PI) / 180;
  const x1 = num(50 - Math.cos(rad) * 50);
  const y1 = num(50 - Math.sin(rad) * 50);
  const x2 = num(50 + Math.cos(rad) * 50);
  const y2 = num(50 + Math.sin(rad) * 50);
  defs.push(
    `<linearGradient id="${id}" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">` +
      `<stop offset="0" stop-color="${g.from}"/><stop offset="1" stop-color="${g.to}"/></linearGradient>`,
  );
  return `url(#${id})`;
}

function renderObject(o: CanvasObject, doc: BoardDoc, defs: string[] = []): string {
  const s = o.style;
  let body = "";

  switch (o.type) {
    case "rect":
    case "frame": {
      const fill = o.type === "frame" ? (s.fill ?? "#ffffff") : s.fill;
      body = `<rect width="${num(o.width)}" height="${num(o.height)}" rx="${num(s.radius ?? 0)}" fill="${o.type === "frame" ? paint(fill) : fillOf(o, defs)}"${strokeAttrs(o)}/>`;
      if (o.type === "frame" && o.name) {
        body += `<text x="0" y="-8"${fontAttrs(o, 12, "#7c7c72")}>${esc(o.name)}</text>`;
      }
      break;
    }
    case "ellipse":
      body = `<ellipse cx="${num(o.width / 2)}" cy="${num(o.height / 2)}" rx="${num(Math.abs(o.width / 2))}" ry="${num(Math.abs(o.height / 2))}" fill="${fillOf(o, defs)}"${strokeAttrs(o)}/>`;
      break;
    case "triangle":
      body = `<path d="M${num(o.width / 2)} 0 L${num(o.width)} ${num(o.height)} L0 ${num(o.height)} Z" fill="${fillOf(o, defs)}"${strokeAttrs(o)} stroke-linejoin="round"/>`;
      break;
    case "diamond":
      body = `<path d="M${num(o.width / 2)} 0 L${num(o.width)} ${num(o.height / 2)} L${num(o.width / 2)} ${num(o.height)} L0 ${num(o.height / 2)} Z" fill="${fillOf(o, defs)}"${strokeAttrs(o)} stroke-linejoin="round"/>`;
      break;
    case "polygon":
      body = `<path d="${polygonPath(o)}" fill="${fillOf(o, defs)}"${strokeAttrs(o)} stroke-linejoin="round"/>`;
      break;
    case "line":
    case "arrow": {
      const [ax, ay, bx, by] = linePts(o);
      const from = { x: ax, y: ay };
      const to = { x: bx, y: by };
      const points = s.elbow
        ? elbowPoints(from, to)
        : s.curve
          ? quadPoints(from, curveControl(from, to, s.curve), to)
          : [ax, ay, bx, by];
      body = `<path d="${polyline(points)}" fill="none"${strokeAttrs(o)} stroke-linecap="round" stroke-linejoin="round"/>`;
      const head = Math.max(10, (s.strokeWidth ?? 2) * 4);
      const n = points.length;
      if (o.type === "arrow" && s.arrowEnd !== false) {
        body += arrowHead(
          [points[n - 4], points[n - 3]],
          [points[n - 2], points[n - 1]],
          head,
          s.stroke ?? "#17170f",
        );
      }
      if (o.type === "arrow" && s.arrowStart) {
        body += arrowHead([points[2], points[3]], [points[0], points[1]], head, s.stroke ?? "#17170f");
      }
      if (o.data.text) {
        body += textBlock(
          o,
          o.data.text,
          (ax + bx) / 2 - 52,
          (ay + by) / 2 - 8,
          104,
          s.fontSize ?? 12,
          s.stroke ?? "#17170f",
          "center",
        );
      }
      break;
    }
    case "measure": {
      const [ax, ay, bx, by] = linePts(o);
      const len = Math.hypot(bx - ax, by - ay);
      const nx = len ? -(by - ay) / len : 0;
      const ny = len ? (bx - ax) / len : 0;
      const color = s.stroke ?? "#b53d2e";
      body =
        `<path d="M${num(ax)} ${num(ay)} L${num(bx)} ${num(by)}" stroke="${color}" stroke-width="1" fill="none"/>` +
        `<path d="M${num(ax + nx * 6)} ${num(ay + ny * 6)} L${num(ax - nx * 6)} ${num(ay - ny * 6)}" stroke="${color}" stroke-width="1"/>` +
        `<path d="M${num(bx + nx * 6)} ${num(by + ny * 6)} L${num(bx - nx * 6)} ${num(by - ny * 6)}" stroke="${color}" stroke-width="1"/>` +
        `<text x="${num((ax + bx) / 2 + nx * 16)}" y="${num((ay + by) / 2 + ny * 16)}" text-anchor="middle"${fontAttrs(o, s.fontSize ?? 12, color)}>` +
        `${esc(o.data.label || formatMeasure(len, doc.settings.unit, doc.settings.unitScale))}</text>`;
      break;
    }
    case "draw": {
      const outline = strokeOutline({
        points: o.data.points ?? [],
        size: s.strokeWidth ?? 4,
        smoothing: s.smoothing ?? 1,
        thinning: true,
      });
      const sx = o.data.naturalWidth ? o.width / o.data.naturalWidth : 1;
      const sy = o.data.naturalHeight ? o.height / o.data.naturalHeight : 1;
      body = `<path transform="scale(${num(sx)} ${num(sy)})" d="${polyline(outline)} Z" fill="${s.fill ?? "#17170f"}"/>`;
      break;
    }
    case "text":
      body = textBlock(
        o,
        o.data.text ?? "",
        0,
        0,
        o.width,
        s.fontSize ?? 18,
        s.color ?? "#17170f",
        s.align ?? "left",
      );
      break;
    case "note": {
      const palette = NOTE_COLORS[o.data.noteKind ?? "idea"];
      body =
        `<rect width="${num(o.width)}" height="${num(o.height)}" fill="${s.fill ?? palette.bg}" rx="2"/>` +
        `<rect width="${num(o.width)}" height="4" fill="${palette.ink}" opacity="0.32"/>` +
        textBlock(o, o.data.text ?? "", 14, 18, o.width - 28, s.fontSize ?? 16, s.color ?? palette.ink);
      break;
    }
    case "image":
      body = o.data.src
        ? `<image href="${esc(o.data.src)}" width="${num(o.width)}" height="${num(o.height)}" preserveAspectRatio="xMidYMid slice"/>`
        : `<rect width="${num(o.width)}" height="${num(o.height)}" fill="#e8e8e4"/>`;
      break;
    case "embed":
      body =
        `<rect width="${num(o.width)}" height="${num(o.height)}" rx="${num(s.radius ?? 4)}" fill="${s.fill ?? "#ffffff"}"${strokeAttrs(o)}/>` +
        textBlock(o, o.data.title ?? o.data.url ?? "", 12, 14, o.width - 24, 13, "#17170f") +
        textBlock(o, o.data.url ?? "", 12, o.height - 26, o.width - 24, 11, "#1f5fd0");
      break;
    case "icon":
      body = `<path transform="scale(${num(o.width / 100)} ${num(o.height / 100)})" d="${o.data.path ?? ""}" fill="${paint(s.fill)}" stroke="${s.strokeWidth ? (s.stroke ?? "none") : "none"}" stroke-width="${num((s.strokeWidth ?? 0) / Math.max(0.001, (o.width / 100 + o.height / 100) / 2))}" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
    case "list": {
      const items = o.data.items ?? [];
      const rows = visibleRows(items);
      const rh = rowHeight(o);
      const size = s.fontSize ?? 15;
      const color = s.color ?? "#17170f";
      const kind = o.data.listKind ?? "bullet";
      let counter = 0;
      body = paint(s.fill) === "none" ? "" : `<rect width="${num(o.width)}" height="${num(o.height)}" fill="${s.fill}"/>`;
      rows.forEach((row, i) => {
        const y = LIST_PAD + i * rh;
        const x = LIST_PAD + row.item.level * INDENT;
        if (row.item.level === 0) counter += 1;
        if (kind === "bullet") {
          body += `<circle cx="${num(x + 3)}" cy="${num(y + size * 0.66)}" r="2.6" fill="${color}" opacity="0.75"/>`;
        } else if (kind === "number") {
          body += `<text x="${num(x - 4)}" y="${num(y + size * 0.9)}" font-family="${esc(FONTS.mono)}" font-size="${num(size * 0.85)}" fill="${color}" opacity="0.7">${counter}.</text>`;
        } else {
          body += `<rect x="${num(x - 2)}" y="${num(y + size * 0.18)}" width="${num(size * 0.72)}" height="${num(size * 0.72)}" rx="2" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.6"/>`;
        }
        body += `<text x="${num(x + 14)}" y="${num(y + size * 0.85)}"${fontAttrs(o, size, color)}${row.item.level === 0 ? ' font-weight="700"' : ""}>${esc(row.item.text)}</text>`;
      });
      break;
    }
    default:
      return "";
  }

  const transform =
    `translate(${num(o.x)} ${num(o.y)})` +
    (o.rotation ? ` rotate(${num(o.rotation)} ${num(o.width / 2)} ${num(o.height / 2)})` : "");
  const opacity = o.opacity !== 1 ? ` opacity="${num(o.opacity)}"` : "";
  return `<g transform="${transform}"${opacity}>${body}</g>`;
}

export function exportSvg(opts: {
  doc: BoardDoc;
  objects: CanvasObject[];
  bounds: Bounds;
  transparent: boolean;
  padding?: number;
}): string {
  const { doc, objects, bounds, transparent, padding = 24 } = opts;
  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const w = bounds.width + padding * 2;
  const h = bounds.height + padding * 2;
  const bg = transparent
    ? ""
    : `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${BACKGROUNDS[doc.settings.background].surface}"/>`;
  const defs: string[] = [];
  const body = objects
    .filter((o) => !o.hidden && o.type !== "group")
    .map((o) => renderObject(o, doc, defs))
    .join("\n  ");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(w)}" height="${num(h)}" viewBox="${num(x)} ${num(y)} ${num(w)} ${num(h)}">`,
    `  <title>${esc(doc.name)}</title>`,
    defs.length ? `  <defs>${defs.join("")}</defs>` : "",
    bg && `  ${bg}`,
    `  ${body}`,
    `</svg>`,
  ]
    .filter(Boolean)
    .join("\n");
}

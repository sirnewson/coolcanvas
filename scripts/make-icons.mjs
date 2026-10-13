/**
 * Draws CoolCanvas's own application icons for both studios and the desktop shell.
 *
 * The upstream engines' icons are the ArtCraft team's trademarks and were removed when the
 * source was vendored, so the fork draws its own. The master is an SVG per icon; a tiny
 * Python/Pillow pass rasterises the PNG and ICO sizes the Rust builds and the installer need.
 *
 *   node scripts/make-icons.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* CoolCanvas's palette: paper, ink, and one signal colour per studio. */
const INK = "#1a1a18";
const PAPER = "#faf9f6";

/** A 512-unit full-bleed tile, as both engines' icon pipelines expect. */
function tile(inner, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${PAPER}"/>
      <stop offset="1" stop-color="#ece9e2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <rect x="8" y="8" width="496" height="496" rx="106" fill="none" stroke="${INK}" stroke-opacity="0.09" stroke-width="3"/>
${inner(accent)}
</svg>`;
}

/* The canvas mark: an open frame with a corner turned up — the shell's own icon. */
const canvasMark = (accent) => `
  <rect x="112" y="112" width="288" height="288" rx="28" fill="none" stroke="${INK}" stroke-width="26" stroke-linejoin="round"/>
  <path d="M112 288 L196 206 L268 274 L324 222 L400 294" fill="none" stroke="${accent}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="196" cy="172" r="26" fill="${accent}"/>`;

/* Photo Studio: the frame with an aperture-style stack of layers. */
const photoMark = (accent) => `
  <rect x="96" y="128" width="256" height="224" rx="24" fill="none" stroke="${INK}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M96 286 L170 214 L232 272 L286 222 L352 286" fill="none" stroke="${INK}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="168" cy="186" r="22" fill="${INK}"/>
  <rect x="160" y="192" width="256" height="224" rx="24" fill="${PAPER}" stroke="${accent}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M160 350 L234 278 L296 336 L350 286 L416 350" fill="none" stroke="${accent}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`;

/* Vector Studio: a Bézier curve with its control points. */
const vectorMark = (accent) => `
  <path d="M112 368 C 160 176, 352 176, 400 368" fill="none" stroke="${INK}" stroke-width="26" stroke-linecap="round"/>
  <path d="M112 368 L 176 240 M400 368 L 336 240" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-dasharray="4 22"/>
  <rect x="84" y="340" width="56" height="56" rx="10" fill="${PAPER}" stroke="${INK}" stroke-width="20"/>
  <rect x="372" y="340" width="56" height="56" rx="10" fill="${PAPER}" stroke="${INK}" stroke-width="20"/>
  <circle cx="176" cy="240" r="26" fill="${accent}"/>
  <circle cx="336" cy="240" r="26" fill="${accent}"/>`;

const ICONS = [
  { id: "coolcanvas", svg: tile(canvasMark, "#1f5fd0"), dest: path.join(ROOT, "desktop", "build") },
  { id: "coolphoto", svg: tile(photoMark, "#1f5fd0"), dest: path.join(ROOT, "engines", "photo", "assets", "app-icon") },
  { id: "coolvector", svg: tile(vectorMark, "#d1562f"), dest: path.join(ROOT, "engines", "vector", "assets", "app-icon") },
];

const HICOLOR = [16, 24, 32, 48, 64, 128, 256, 512];
const ICO = [16, 24, 32, 48, 64, 128, 256];

const python = `
import io, sys, json, os
from PIL import Image
import xml.etree.ElementTree as ET
spec = json.loads(sys.stdin.read())

def render(svg_path, size, viewbox=None):
    """Rasterise our own icon SVG. The artwork is deliberately simple geometry, so a
    small renderer here keeps the build free of extra tools."""
    import subprocess
    # Pillow cannot read SVG; draw the shapes directly from the same description instead.
    raise SystemExit("unused")
`;

/**
 * Pillow cannot read SVG, and the icons are simple geometry, so the shapes are drawn
 * directly with Pillow at each size rather than pulling in a rasteriser.
 */
const draw = `
import json, math, os, sys
from PIL import Image, ImageDraw

spec = json.loads(sys.stdin.read())
S = 4  # supersampling factor for clean edges

def hexrgb(h, a=255):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

INK = hexrgb("${INK}")
PAPER = hexrgb("${PAPER}")

def rounded(d, box, r, fill=None, outline=None, width=0):
    d.rounded_rectangle(box, radius=r, fill=fill, outline=outline, width=width)

def polyline(d, pts, colour, width):
    d.line(pts, fill=colour, width=width, joint="curve")
    rad = width / 2
    for x, y in (pts[0], pts[-1]):
        d.ellipse([x - rad, y - rad, x + rad, y + rad], fill=colour)

def bezier(p0, p1, p2, p3, steps=96):
    out = []
    for i in range(steps + 1):
        t = i / steps
        u = 1 - t
        x = u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0]
        y = u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]
        out.append((x, y))
    return out

def paint(kind, accent_hex, size):
    n = size * S
    k = n / 512.0
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    accent = hexrgb(accent_hex)
    # Tile
    rounded(d, [0, 0, n - 1, n - 1], int(112 * k), fill=PAPER)
    rounded(d, [int(8*k), int(8*k), int(n - 1 - 8*k), int(n - 1 - 8*k)], int(106 * k),
            outline=(26, 26, 24, 26), width=max(1, int(3 * k)))

    if kind == "coolcanvas":
        w = int(26 * k)
        rounded(d, [112*k, 112*k, 400*k, 400*k], int(28*k), outline=INK, width=w)
        polyline(d, [(112*k, 288*k), (196*k, 206*k), (268*k, 274*k), (324*k, 222*k), (400*k, 294*k)], accent, w)
        r = 26 * k
        d.ellipse([196*k - r, 172*k - r, 196*k + r, 172*k + r], fill=accent)

    elif kind == "coolphoto":
        w = int(24 * k)
        rounded(d, [96*k, 128*k, 352*k, 352*k], int(24*k), outline=INK, width=w)
        polyline(d, [(96*k, 286*k), (170*k, 214*k), (232*k, 272*k), (286*k, 222*k), (352*k, 286*k)], INK, w)
        r = 22 * k
        d.ellipse([168*k - r, 186*k - r, 168*k + r, 186*k + r], fill=INK)
        rounded(d, [160*k, 192*k, 416*k, 416*k], int(24*k), fill=PAPER, outline=accent, width=w)
        polyline(d, [(160*k, 350*k), (234*k, 278*k), (296*k, 336*k), (350*k, 286*k), (416*k, 350*k)], accent, w)

    else:  # coolvector
        w = int(26 * k)
        curve = bezier((112*k, 368*k), (160*k, 176*k), (352*k, 176*k), (400*k, 368*k))
        polyline(d, curve, INK, w)
        for a, b in (((112*k, 368*k), (176*k, 240*k)), ((400*k, 368*k), (336*k, 240*k))):
            d.line([a, b], fill=accent + (), width=max(1, int(10 * k)))
        for cx, cy in ((84*k, 340*k), (372*k, 340*k)):
            rounded(d, [cx, cy, cx + 56*k, cy + 56*k], int(10*k), fill=PAPER, outline=INK, width=int(20*k))
        r = 26 * k
        for cx, cy in ((176*k, 240*k), (336*k, 240*k)):
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=accent)

    return img.resize((size, size), Image.LANCZOS)

for icon in spec:
    kind, accent, dest = icon["id"], icon["accent"], icon["dest"]
    os.makedirs(dest, exist_ok=True)
    for size in icon["hicolor"]:
        out = os.path.join(dest, "hicolor", f"{size}x{size}", "apps")
        os.makedirs(out, exist_ok=True)
        paint(kind, accent, size).save(os.path.join(out, icon["appid"] + ".png"))
    svgdir = os.path.join(dest, "hicolor", "scalable", "apps")
    os.makedirs(svgdir, exist_ok=True)
    open(os.path.join(svgdir, icon["appid"] + ".svg"), "w", encoding="utf8").write(icon["svg"])
    paint(kind, accent, 1024).save(os.path.join(dest, kind + "-1024.png"))
    paint(kind, accent, 512).save(os.path.join(dest, kind + "-512.png"))
    paint(kind, accent, 256).save(os.path.join(dest, kind + "-256.png"))
    paint(kind, accent, 512).save(os.path.join(dest, "icon.png"))
    ims = [paint(kind, accent, s) for s in icon["ico"]]
    ims[0].save(os.path.join(dest, kind + ".ico"), format="ICO", sizes=[(s, s) for s in icon["ico"]])
    ims[0].save(os.path.join(dest, "icon.ico"), format="ICO", sizes=[(s, s) for s in icon["ico"]])
    open(os.path.join(dest, kind + ".svg"), "w", encoding="utf8").write(icon["svg"])
    open(os.path.join(dest, kind + "-small.svg"), "w", encoding="utf8").write(icon["svg"])
    print("icons:", kind, "->", dest)
`;

const spec = ICONS.map((i) => ({
  id: i.id,
  accent: i.id === "coolvector" ? "#d1562f" : "#1f5fd0",
  dest: i.dest,
  appid: `com.yxmdigital.${i.id}`,
  svg: i.svg,
  hicolor: HICOLOR,
  ico: ICO,
}));

const result = spawnSync("python", ["-c", draw], {
  input: JSON.stringify(spec),
  stdio: ["pipe", "inherit", "inherit"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
});
if (result.status !== 0) {
  console.error("Icon generation needs Python with Pillow: python -m pip install pillow");
  process.exit(1);
}

// The engines also look for a .icns on macOS; Windows builds do not need it.
for (const icon of ICONS) {
  const readme = path.join(icon.dest, "README.md");
  fs.writeFileSync(
    readme,
    `# ${icon.id} icon\n\nCoolCanvas's own application icon, drawn by \`scripts/make-icons.mjs\`\n(original work, © 2026 YXM Digital). It replaces the upstream project's icons, which are\nthe ArtCraft team's trademarks and are not part of this fork.\n\nRegenerate with:\n\n    node scripts/make-icons.mjs\n`,
  );
}
console.log("CoolCanvas icons drawn.");

import { memo, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  Arrow as KArrow,
  Circle as KCircle,
  Path as KPath,
  Ellipse as KEllipse,
  Group as KGroup,
  Image as KImage,
  Line as KLine,
  Rect as KRect,
  Text as KText,
} from "react-konva";
import type Konva from "konva";

import type { CanvasObject, RenderMode, Unit } from "../types";
import { filterAttrs, filtersFor, hasEffects } from "../lib/effects";
import { useStore } from "../store/store";
import { FONTS, NOTE_COLORS, formatMeasure } from "../lib/theme";
import { strokeOutline } from "../lib/freehand";
import { displayText } from "../lib/text";
import { curveControl, elbowPoints, quadPoints } from "../lib/geom";
import { INDENT, LIST_PAD, rowHeight, visibleRows } from "../lib/outline";
import { CardShape, PlaceholderShape, TableShape } from "./extraShapes";
import { MediaShape } from "./MediaShape";

/**
 * Konva only applies filters and container shadows to a cached node. This
 * wrapper caches the object's visual whenever it carries effects or a
 * parametric shadow, re-rasterising on every change and at a resolution that
 * follows the zoom (bucketed, so a smooth zoom does not thrash the cache).
 */
function useCacheScale() {
  return useStore((s) => {
    const z = s.camera.zoom * (window.devicePixelRatio || 1);
    return z <= 0.6 ? 0.5 : z <= 1.2 ? 1 : z <= 2.2 ? 2 : 3;
  });
}

function EffectsGroup({ object: o, children }: { object: CanvasObject; children: ReactNode }) {
  const ref = useRef<Konva.Group | null>(null);
  const scale = useCacheScale();
  const effects = o.style.effects;
  const shadow = o.style.shadowSpec;
  const active = hasEffects(effects) || !!shadow;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!active) {
      if (node.isCached()) node.clearCache();
      node.filters([]);
      return;
    }
    node.setAttrs(filterAttrs(effects));
    node.filters(filtersFor(effects));
    const pad = (effects?.blur ?? 0) * 2 + (shadow ? shadow.blur + Math.max(Math.abs(shadow.offsetX), Math.abs(shadow.offsetY)) : 0) + 4;
    // Wait a frame so images inside have painted before the bitmap is taken.
    const raf = requestAnimationFrame(() => {
      try {
        node.cache({ offset: pad, pixelRatio: scale, imageSmoothingEnabled: true });
        node.getLayer()?.batchDraw();
      } catch {
        /* zero-size nodes cannot be cached */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [o, active, effects, shadow, scale]);

  return (
    <KGroup
      ref={ref}
      shadowColor={shadow?.color}
      shadowBlur={shadow?.blur ?? 0}
      shadowOffsetX={shadow?.offsetX ?? 0}
      shadowOffsetY={shadow?.offsetY ?? 0}
      shadowOpacity={shadow?.opacity ?? 0}
      shadowEnabled={!!shadow}
    >
      {children}
    </KGroup>
  );
}

/**
 * An image clipped inside a shape — the "drop a photo into a circle" mask.
 * The picture covers the box (like CSS object-fit: cover) and is clipped by
 * the same outline the shape draws, so rounded corners, stars and diamonds
 * all mask correctly.
 */
function ClippedImage({ object: o }: ShapeProps) {
  const image = useImageElement(o.data.src);
  if (!image) return null;
  const nw = o.data.naturalWidth ?? image.naturalWidth;
  const nh = o.data.naturalHeight ?? image.naturalHeight;
  const scale = Math.max(o.width / nw, o.height / nh) * (o.data.imageScale ?? 1);
  const w = nw * scale;
  const h = nh * scale;
  const ox = o.data.imageOffset?.x ?? 0;
  const oy = o.data.imageOffset?.y ?? 0;
  const clip = (ctx: Konva.Context) => {
    if (o.type === "rect") {
      const r = Math.min(o.style.radius ?? 0, o.width / 2, o.height / 2);
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(o.width, 0, o.width, o.height, r);
      ctx.arcTo(o.width, o.height, 0, o.height, r);
      ctx.arcTo(0, o.height, 0, 0, r);
      ctx.arcTo(0, 0, o.width, 0, r);
      ctx.closePath();
    } else if (o.type === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(o.width / 2, o.height / 2, o.width / 2, o.height / 2, 0, 0, Math.PI * 2);
      ctx.closePath();
    } else {
      const pts = polygonPoints(o);
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    }
  };
  return (
    <KGroup clipFunc={clip} listening={false}>
      <KImage
        image={image}
        x={(o.width - w) / 2 + ox + (o.data.flipX ? w : 0)}
        y={(o.height - h) / 2 + oy + (o.data.flipY ? h : 0)}
        width={w}
        height={h}
        scaleX={o.data.flipX ? -1 : 1}
        scaleY={o.data.flipY ? -1 : 1}
      />
    </KGroup>
  );
}

/** Traced or imported vector art: real paths that stay crisp at any zoom. */
function VectorShape({ object: o }: ShapeProps) {
  const vb = o.data.viewBox ?? { width: 100, height: 100 };
  const sx = o.width / Math.max(1, vb.width);
  const sy = o.height / Math.max(1, vb.height);
  const paths = o.data.paths ?? [];
  return (
    <KGroup scaleX={sx} scaleY={sy}>
      <KRect width={vb.width} height={vb.height} fill="transparent" listening />
      {paths.map((p, i) => (
        <KPath
          key={i}
          data={p.d}
          fill={solid(p.fill)}
          stroke={solid(p.stroke)}
          strokeWidth={p.strokeWidth ?? 0}
          opacity={p.opacity ?? 1}
          strokeScaleEnabled={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </KGroup>
  );
}

/** Deterministic jitter so sketch mode looks hand-drawn but never flickers. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dashArray(o: CanvasObject): number[] | undefined {
  const w = o.style.strokeWidth ?? 2;
  if (o.style.dash === "dashed") return [w * 4, w * 3];
  if (o.style.dash === "dotted") return [0.1, w * 2.6];
  return undefined;
}

const fontOf = (o: CanvasObject) => FONTS[o.style.fontFamily ?? "sans"];
const fontStyleOf = (o: CanvasObject) => {
  const weight = (o.style.fontWeight ?? 400) >= 600 ? "bold" : "normal";
  return o.style.fontStyle === "italic" ? `italic ${weight}` : weight;
};
const solid = (c?: string) => (c && c !== "transparent" ? c : undefined);

function sketchRectPoints(w: number, h: number, rand: () => number): number[] {
  const amp = Math.min(6, Math.max(1.5, Math.min(w, h) * 0.02));
  const j = () => (rand() - 0.5) * amp;
  const pts: number[] = [];
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    for (let i = 0; i < 3; i += 1) {
      const t = i / 3;
      pts.push(x1 + (x2 - x1) * t + j(), y1 + (y2 - y1) * t + j());
    }
  };
  edge(0, 0, w, 0);
  edge(w, 0, w, h);
  edge(w, h, 0, h);
  edge(0, h, 0, 0);
  return pts;
}

function sketchEllipsePoints(w: number, h: number, rand: () => number): number[] {
  const amp = Math.min(5, Math.max(1.2, Math.min(w, h) * 0.02));
  const pts: number[] = [];
  const steps = 26;
  for (let i = 0; i < steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const r = 1 + (rand() - 0.5) * 0.03;
    pts.push(
      w / 2 + (Math.cos(a) * w * r) / 2 + (rand() - 0.5) * amp,
      h / 2 + (Math.sin(a) * h * r) / 2 + (rand() - 0.5) * amp,
    );
  }
  return pts;
}

function jitterPolygon(points: number[], seed: string, amount = 3): number[] {
  const rand = seeded(seed);
  return points.map((v) => v + (rand() - 0.5) * amount);
}

function useImageElement(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    let alive = true;
    img.onload = () => {
      if (alive) setImage(img);
    };
    return () => {
      alive = false;
    };
  }, [src]);
  return image;
}

export interface ShapeProps {
  object: CanvasObject;
  mode: RenderMode;
  unit: Unit;
  unitScale: number;
  /** Hide the text of an object currently being edited in the DOM overlay. */
  editing: boolean;
}

/* --------------------------------------------------------------- polygons */

export function polygonPoints(o: CanvasObject): number[] {
  const { width: w, height: h } = o;
  if (o.type === "triangle") return [w / 2, 0, w, h, 0, h];
  if (o.type === "diamond") return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
  // Regular n-gon (hexagon by default), or a star when asked for.
  const sides = Math.max(3, Math.min(24, o.data.sides ?? 6));
  const star = !!o.data.star;
  const inner = o.data.innerRatio ?? 0.5;
  const rx = w / 2;
  const ry = h / 2;
  const count = star ? sides * 2 : sides;
  const pts: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = star && i % 2 ? inner : 1;
    pts.push(rx + Math.cos(angle) * rx * r, ry + Math.sin(angle) * ry * r);
  }
  return pts;
}

/** Gradient fills need start/end points, so they are computed per object. */
export function fillProps(o: CanvasObject): Record<string, unknown> {
  const g = o.style.gradient;
  if (!g) return { fill: solid(o.style.fill) };
  const rad = ((g.angle ?? 0) * Math.PI) / 180;
  const cx = o.width / 2;
  const cy = o.height / 2;
  const len = (Math.abs(Math.cos(rad)) * o.width + Math.abs(Math.sin(rad)) * o.height) / 2;
  return {
    fillLinearGradientStartPoint: { x: cx - Math.cos(rad) * len, y: cy - Math.sin(rad) * len },
    fillLinearGradientEndPoint: { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len },
    fillLinearGradientColorStops: [0, g.from, 1, g.to],
  };
}

function PolygonShape({ object: o, mode }: ShapeProps) {
  const pts = useMemo(() => {
    const base = polygonPoints(o);
    return mode === "sketch" ? jitterPolygon(base, o.id, 5) : base;
  }, [o, mode]);
  return (
    <KLine
      points={pts}
      closed
      {...fillProps(o)}
      stroke={o.style.stroke}
      strokeWidth={o.style.strokeWidth}
      dash={dashArray(o)}
      lineJoin="round"
      hitStrokeWidth={Math.max(12, (o.style.strokeWidth ?? 2) + 10)}
    />
  );
}

function RectShape({ object: o, mode }: ShapeProps) {
  const sketch = mode === "sketch";
  const points = useMemo(
    () => (sketch ? sketchRectPoints(o.width, o.height, seeded(o.id)) : []),
    [sketch, o.width, o.height, o.id],
  );
  if (sketch) {
    return (
      <KLine
        points={points}
        closed
        tension={0.16}
        fill={solid(o.style.fill)}
        stroke={o.style.stroke}
        strokeWidth={o.style.strokeWidth}
        dash={dashArray(o)}
        lineJoin="round"
        hitStrokeWidth={Math.max(12, (o.style.strokeWidth ?? 2) + 10)}
      />
    );
  }
  return (
    <KRect
      width={o.width}
      height={o.height}
      cornerRadius={o.style.radius ?? 0}
      {...fillProps(o)}
      stroke={o.style.stroke}
      strokeWidth={o.style.strokeWidth}
      dash={dashArray(o)}
      shadowColor={o.style.shadow ? "#000000" : undefined}
      shadowOpacity={o.style.shadow ? 0.14 : 0}
      shadowBlur={o.style.shadow ? 12 : 0}
      shadowOffsetY={o.style.shadow ? 4 : 0}
      hitStrokeWidth={Math.max(12, (o.style.strokeWidth ?? 2) + 10)}
    />
  );
}

function EllipseShape({ object: o, mode }: ShapeProps) {
  const sketch = mode === "sketch";
  const points = useMemo(
    () => (sketch ? sketchEllipsePoints(o.width, o.height, seeded(o.id)) : []),
    [sketch, o.width, o.height, o.id],
  );
  if (sketch) {
    return (
      <KLine
        points={points}
        closed
        tension={0.4}
        fill={solid(o.style.fill)}
        stroke={o.style.stroke}
        strokeWidth={o.style.strokeWidth}
        dash={dashArray(o)}
        hitStrokeWidth={Math.max(12, (o.style.strokeWidth ?? 2) + 10)}
      />
    );
  }
  return (
    <KEllipse
      x={o.width / 2}
      y={o.height / 2}
      radiusX={Math.abs(o.width / 2)}
      radiusY={Math.abs(o.height / 2)}
      {...fillProps(o)}
      stroke={o.style.stroke}
      strokeWidth={o.style.strokeWidth}
      dash={dashArray(o)}
      hitStrokeWidth={Math.max(12, (o.style.strokeWidth ?? 2) + 10)}
    />
  );
}

/* ------------------------------------------------------------ lines/arrows */

export function linePoints(o: CanvasObject): [number, number, number, number] {
  const p = o.data.points;
  if (p && p.length >= 4) return [p[0], p[1], p[2], p[3]];
  return [0, 0, o.width, o.height];
}

export function linePath(o: CanvasObject, mode: RenderMode): number[] {
  const [ax, ay, bx, by] = linePoints(o);
  const from = { x: ax, y: ay };
  const to = { x: bx, y: by };
  if (o.style.elbow) return elbowPoints(from, to);
  if (o.style.curve) return quadPoints(from, curveControl(from, to, o.style.curve), to);
  if (mode === "sketch") {
    const rand = seeded(o.id);
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const amp = Math.min(8, len * 0.03);
    const out: number[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const wobble = i === 0 || i === steps ? 0 : (rand() - 0.5) * amp;
      out.push(ax + dx * t + nx * wobble, ay + dy * t + ny * wobble);
    }
    return out;
  }
  return [ax, ay, bx, by];
}

function LineShape({ object: o, mode }: ShapeProps) {
  const points = linePath(o, mode);
  const arrowed = o.type === "arrow" && (o.style.arrowEnd || o.style.arrowStart);
  const common = {
    points,
    stroke: o.style.stroke,
    strokeWidth: o.style.strokeWidth,
    dash: dashArray(o),
    lineCap: "round" as const,
    lineJoin: "round" as const,
    tension: o.style.elbow ? 0 : mode === "sketch" ? 0.3 : 0,
    hitStrokeWidth: Math.max(18, (o.style.strokeWidth ?? 2) + 16),
  };
  if (arrowed) {
    return (
      <KArrow
        {...common}
        fill={o.style.stroke}
        pointerAtBeginning={!!o.style.arrowStart}
        pointerAtEnding={!!o.style.arrowEnd}
        pointerLength={Math.max(10, (o.style.strokeWidth ?? 2) * 4)}
        pointerWidth={Math.max(9, (o.style.strokeWidth ?? 2) * 3.4)}
      />
    );
  }
  return <KLine {...common} />;
}

/** Dimension line with end ticks and a live measurement (blueprint §14). */
function MeasureShape({ object: o, unit, unitScale }: ShapeProps) {
  const [ax, ay, bx, by] = linePoints(o);
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = len ? -dy / len : 0;
  const ny = len ? dx / len : 0;
  const tick = 6;
  const color = o.style.stroke ?? "#c0392b";
  const text = o.data.label || formatMeasure(len, unit, unitScale);
  const mid = { x: (ax + bx) / 2, y: (ay + by) / 2 };
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <>
      <KLine points={[ax, ay, bx, by]} stroke={color} strokeWidth={1} hitStrokeWidth={16} />
      <KLine
        points={[ax + nx * tick, ay + ny * tick, ax - nx * tick, ay - ny * tick]}
        stroke={color}
        strokeWidth={1}
      />
      <KLine
        points={[bx + nx * tick, by + ny * tick, bx - nx * tick, by - ny * tick]}
        stroke={color}
        strokeWidth={1}
      />
      <KGroup x={mid.x + nx * 14} y={mid.y + ny * 14} rotation={Math.abs(angle) > 90 ? angle + 180 : angle}>
        <KRect x={-28} y={-10} width={56} height={19} fill="#ffffff" opacity={0.86} cornerRadius={2} />
        <KText
          x={-28}
          y={-6}
          width={56}
          align="center"
          text={text}
          fontSize={o.style.fontSize ?? 12}
          fontFamily={FONTS.mono}
          fill={color}
        />
      </KGroup>
    </>
  );
}

function DrawShape({ object: o }: ShapeProps) {
  const outline = useMemo(
    () =>
      strokeOutline({
        points: o.data.points ?? [],
        size: o.style.strokeWidth ?? 4,
        smoothing: o.style.smoothing ?? 1,
        thinning: true,
      }),
    [o.data.points, o.style.strokeWidth, o.style.smoothing],
  );
  const sx = o.data.naturalWidth ? o.width / o.data.naturalWidth : 1;
  const sy = o.data.naturalHeight ? o.height / o.data.naturalHeight : 1;
  return (
    <KLine
      points={outline}
      closed
      fill={o.style.fill}
      scaleX={Number.isFinite(sx) && sx !== 0 ? sx : 1}
      scaleY={Number.isFinite(sy) && sy !== 0 ? sy : 1}
      lineJoin="round"
      hitStrokeWidth={14}
    />
  );
}

function TextShape({ object: o, editing }: ShapeProps) {
  if (editing) return null;
  const text = o.data.text || "";
  return (
    <KText
      text={text ? displayText(o, text) : "Type…"}
      width={o.width}
      fill={text ? o.style.color : "#a8a8a2"}
      fontSize={o.style.fontSize ?? 18}
      fontFamily={fontOf(o)}
      fontStyle={fontStyleOf(o)}
      align={o.style.align ?? "left"}
      lineHeight={o.style.lineHeight ?? 1.35}
      letterSpacing={o.style.letterSpacing ?? 0}
      wrap="word"
    />
  );
}

function NoteShape({ object: o, editing }: ShapeProps) {
  const kind = o.data.noteKind ?? "idea";
  const palette = NOTE_COLORS[kind];
  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={o.style.fill ?? palette.bg}
        cornerRadius={o.style.radius ?? 2}
        shadowColor="#000000"
        shadowOpacity={0.16}
        shadowBlur={10}
        shadowOffsetY={4}
      />
      <KRect width={o.width} height={4} fill={palette.ink} opacity={0.32} />
      {!editing && (
        <KText
          text={o.data.text ? displayText(o) : "Note…"}
          x={14}
          y={18}
          width={o.width - 28}
          height={o.height - 32}
          fill={o.data.text ? (o.style.color ?? palette.ink) : palette.ink}
          opacity={o.data.text ? 1 : 0.42}
          fontSize={o.style.fontSize ?? 16}
          fontFamily={fontOf(o)}
          lineHeight={o.style.lineHeight ?? 1.4}
          align={o.style.align ?? "left"}
          wrap="word"
        />
      )}
    </>
  );
}

function ImageShape({ object: o }: ShapeProps) {
  const image = useImageElement(o.data.src);
  if (!image) {
    return (
      <KRect
        width={o.width}
        height={o.height}
        fill="#e8e8e4"
        stroke="#d0d0c9"
        strokeWidth={1}
        cornerRadius={o.style.radius ?? 2}
      />
    );
  }
  const crop = o.data.crop;
  const nw = o.data.naturalWidth ?? image.naturalWidth;
  const nh = o.data.naturalHeight ?? image.naturalHeight;
  const flipX = o.data.flipX ? -1 : 1;
  const flipY = o.data.flipY ? -1 : 1;
  return (
    <KImage
      image={image}
      width={o.width}
      height={o.height}
      x={o.data.flipX ? o.width : 0}
      y={o.data.flipY ? o.height : 0}
      scaleX={flipX}
      scaleY={flipY}
      opacity={o.data.trace ? 0.35 : 1}
      cornerRadius={o.style.radius ?? 0}
      crop={
        crop
          ? {
              x: crop.x * nw,
              y: crop.y * nh,
              width: crop.width * nw,
              height: crop.height * nh,
            }
          : undefined
      }
      stroke={solid(o.style.stroke)}
      strokeWidth={o.style.strokeWidth}
    />
  );
}

/** Link and video reference cards, carried over from the earlier prototype. */
function EmbedShape({ object: o }: ShapeProps) {
  const thumb = useImageElement(o.data.src);
  const isVideo = o.data.embedKind === "video";
  const thumbHeight = isVideo ? o.height - 44 : 0;
  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={o.style.fill ?? "#ffffff"}
        stroke={o.style.stroke ?? "#d8d6cd"}
        strokeWidth={o.style.strokeWidth ?? 1}
        cornerRadius={o.style.radius ?? 4}
        shadowColor="#000000"
        shadowOpacity={0.08}
        shadowBlur={10}
        shadowOffsetY={3}
      />
      {isVideo && thumb && (
        <KImage image={thumb} width={o.width} height={thumbHeight} cornerRadius={[4, 4, 0, 0]} />
      )}
      {isVideo && !thumb && <KRect width={o.width} height={thumbHeight} fill="#1c1c1a" opacity={0.08} />}
      {isVideo && (
        <>
          <KCircle x={o.width / 2} y={thumbHeight / 2} radius={20} fill="#000000" opacity={0.55} />
          <KLine
            points={[o.width / 2 - 5, thumbHeight / 2 - 8, o.width / 2 + 9, thumbHeight / 2, o.width / 2 - 5, thumbHeight / 2 + 8]}
            closed
            fill="#ffffff"
          />
        </>
      )}
      <KText
        text={o.data.title || o.data.url || "Link"}
        x={12}
        y={isVideo ? thumbHeight + 10 : 16}
        width={o.width - 24}
        fontSize={13}
        fontStyle="bold"
        fontFamily={FONTS.sans}
        fill="#1c1c1a"
        ellipsis
        wrap="none"
      />
      <KText
        text={o.data.provider || ""}
        x={12}
        y={isVideo ? thumbHeight + 27 : 38}
        width={o.width - 24}
        fontSize={11}
        fontFamily={FONTS.mono}
        fill="#8a8a82"
        ellipsis
        wrap="none"
      />
      {o.data.embedKind === "site" && (
        <KGroup x={12} y={o.height - 46}>
          <KRect width={o.width - 24} height={32} cornerRadius={6} fill="#1f5fd0" />
          <KText
            text="Double-click to open the generated site"
            width={o.width - 24}
            height={32}
            align="center"
            verticalAlign="middle"
            fontSize={12}
            fontStyle="bold"
            fontFamily={FONTS.sans}
            fill="#ffffff"
          />
        </KGroup>
      )}
      {!isVideo && o.data.embedKind !== "site" && (
        <KText
          text={o.data.url || ""}
          x={12}
          y={58}
          width={o.width - 24}
          fontSize={11}
          fontFamily={FONTS.mono}
          fill="#2f6bd8"
          ellipsis
          wrap="none"
        />
      )}
    </>
  );
}

/** Vector illustration drawn in a 0-100 box and scaled to the object. */
function IconShape({ object: o }: ShapeProps) {
  const sx = o.width / 100;
  const sy = o.height / 100;
  return (
    <KPath
      data={o.data.path ?? ""}
      scaleX={sx}
      scaleY={sy}
      fill={solid(o.style.fill)}
      stroke={o.style.strokeWidth ? o.style.stroke : undefined}
      strokeWidth={(o.style.strokeWidth ?? 0) / Math.max(0.0001, (sx + sy) / 2)}
      lineCap="round"
      lineJoin="round"
      hitStrokeWidth={20}
    />
  );
}

/** Collapsible outline. Rows fold under whichever parent is collapsed. */
function ListShape({ object: o, editing }: ShapeProps) {
  const items = o.data.items ?? [];
  const rows = visibleRows(items);
  const rh = rowHeight(o);
  const size = o.style.fontSize ?? 15;
  const kind = o.data.listKind ?? "bullet";
  const color = o.style.color ?? "#17170f";
  let counter = 0;
  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={solid(o.style.fill) ?? "#000000"}
        opacity={solid(o.style.fill) ? 1 : 0.001}
        cornerRadius={o.style.radius ?? 0}
        stroke={solid(o.style.fill) ? solid(o.style.stroke) : undefined}
        strokeWidth={o.style.strokeWidth}
      />
      {!editing &&
        rows.map((row, i) => {
          const y = LIST_PAD + i * rh;
          const x = LIST_PAD + row.item.level * INDENT;
          if (row.item.level === 0) counter += 1;
          const marker =
            kind === "number" ? `${counter}.` : kind === "check" ? (row.item.checked ? "x" : "") : "";
          return (
            <KGroup key={row.item.id} y={y}>
              {row.hasChildren && (
                <KLine
                  points={
                    row.item.collapsed
                      ? [x - 14, size * 0.15, x - 6, size * 0.6, x - 14, size * 1.05]
                      : [x - 15, size * 0.35, x - 5, size * 0.35, x - 10, size * 0.95]
                  }
                  closed
                  fill={color}
                  opacity={0.55}
                />
              )}
              {kind === "bullet" && (
                <KCircle x={x + 3} y={size * 0.66} radius={2.6} fill={color} opacity={0.75} />
              )}
              {kind === "number" && (
                <KText
                  x={x - 4}
                  y={size * 0.16}
                  text={marker}
                  fontSize={size * 0.85}
                  fontFamily={FONTS.mono}
                  fill={color}
                  opacity={0.7}
                />
              )}
              {kind === "check" && (
                <>
                  <KRect
                    x={x - 2}
                    y={size * 0.18}
                    width={size * 0.72}
                    height={size * 0.72}
                    cornerRadius={2}
                    stroke={color}
                    strokeWidth={1.2}
                    opacity={0.6}
                  />
                  {row.item.checked && (
                    <KLine
                      points={[
                        x + 0.5,
                        size * 0.55,
                        x + size * 0.28,
                        size * 0.8,
                        x + size * 0.66,
                        size * 0.26,
                      ]}
                      stroke={color}
                      strokeWidth={1.8}
                      lineCap="round"
                    />
                  )}
                </>
              )}
              <KText
                x={x + 14}
                y={0}
                width={Math.max(20, o.width - x - 14 - LIST_PAD)}
                text={row.item.text || "…"}
                fontSize={size}
                fontFamily={fontOf(o)}
                fontStyle={row.item.level === 0 ? "bold" : "normal"}
                fill={color}
                opacity={row.item.checked ? 0.5 : 1}
                textDecoration={row.item.checked ? "line-through" : ""}
                lineHeight={1}
                ellipsis
                wrap="none"
              />
            </KGroup>
          );
        })}
    </>
  );
}

/* ------------------------------------------------------------------ frames */

function FrameShape({ object: o }: ShapeProps) {
  const kind = o.data.frameKind ?? "plain";
  const chrome = kind === "browser" ? 32 : 0;
  const radius = kind === "phone" ? 26 : kind === "watch" ? 40 : kind === "tablet" ? 16 : (o.style.radius ?? 2);
  const device = kind !== "plain" && kind !== "browser";
  return (
    <>
      <KText
        text={o.name ?? "Frame"}
        y={-20}
        fontSize={12}
        fontFamily={FONTS.mono}
        fill="#8a8a82"
      />
      <KRect
        width={o.width}
        height={o.height}
        fill={o.style.fill ?? "#ffffff"}
        stroke={o.style.stroke ?? "#b3b3ab"}
        strokeWidth={device ? 2 : (o.style.strokeWidth ?? 1)}
        cornerRadius={radius}
      />
      {kind === "browser" && (
        <>
          <KRect width={o.width} height={chrome} fill="#f1f0ec" cornerRadius={[radius, radius, 0, 0]} />
          <KLine points={[0, chrome, o.width, chrome]} stroke="#dcdad2" strokeWidth={1} />
          {[0, 1, 2].map((i) => (
            <KCircle key={i} x={16 + i * 16} y={chrome / 2} radius={4.5} fill={["#e9857c", "#e8c26a", "#87c58a"][i]} />
          ))}
          <KRect x={68} y={7} width={Math.max(40, o.width - 92)} height={18} fill="#ffffff" cornerRadius={9} />
          <KText
            x={80}
            y={12}
            text={o.data.url ?? "example.com"}
            fontSize={11}
            fontFamily={FONTS.mono}
            fill="#8a8a82"
          />
        </>
      )}
      {kind === "phone" && (
        <KRect x={o.width / 2 - 34} y={9} width={68} height={7} cornerRadius={4} fill="#1c1c1a" opacity={0.28} />
      )}
      {kind === "desktop" && (
        <>
          <KRect x={o.width / 2 - 46} y={o.height} width={92} height={12} fill="#c6c6be" />
          <KRect x={o.width / 2 - 80} y={o.height + 12} width={160} height={7} cornerRadius={4} fill="#b3b3ab" />
        </>
      )}
    </>
  );
}

function SmartShape(props: ShapeProps) {
  const o = props.object;
  const src = o.data.smartObject?.src || o.data.src;
  const sub = src ? { ...props, object: { ...o, data: { ...o.data, src } } } : props;
  return (
    <>
      <ImageShape {...sub} />
      {/* Smart Object badge icon in corner */}
      <KRect
        x={o.width - 20}
        y={o.height - 20}
        width={16}
        height={16}
        fill="rgba(0,0,0,0.6)"
        cornerRadius={3}
      />
      <KText
        x={o.width - 18}
        y={o.height - 18}
        text="📦"
        fontSize={10}
        listening={false}
      />
    </>
  );
}

function AdjustmentShape({ object: o }: ShapeProps) {
  return (
    <KGroup>
      <KRect
        width={o.width}
        height={o.height}
        fill="transparent"
        stroke="#3b82f6"
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    </KGroup>
  );
}

const RENDERERS: Record<string, (p: ShapeProps) => ReactElement | null> = {
  rect: RectShape,
  ellipse: EllipseShape,
  triangle: PolygonShape,
  diamond: PolygonShape,
  polygon: PolygonShape,
  line: LineShape,
  arrow: LineShape,
  measure: MeasureShape,
  draw: DrawShape,
  text: TextShape,
  note: NoteShape,
  image: ImageShape,
  embed: EmbedShape,
  icon: IconShape,
  list: ListShape,
  placeholder: ({ object }) => <PlaceholderShape object={object} />,
  table: ({ object, editing }) => <TableShape object={object} editing={editing} />,
  card: ({ object, editing }) => <CardShape object={object} editing={editing} />,
  media: ({ object }) => <MediaShape object={object} />,
  frame: FrameShape,
  vector: VectorShape,
  smart: SmartShape,
  adjustment: AdjustmentShape,
};

const CAPTIONED = new Set(["rect", "ellipse", "triangle", "diamond", "polygon"]);

/**
 * One object = one Konva Group positioned in world space. Keeping the visual
 * at local (0,0) means the Transformer, snapping and hit tests all operate on
 * the same simple box regardless of type.
 */
export const ShapeNode = memo(function ShapeNode({
  object: o,
  mode,
  unit,
  unitScale,
  editing,
  celOpacity = 1,
  onRef,
}: ShapeProps & {
  celOpacity?: number;
  onRef: (id: string, node: Konva.Group | null) => void;
}) {
  const Renderer = RENDERERS[o.type];
  if (!Renderer || o.hidden) return null;
  const masked = CAPTIONED.has(o.type) && !!o.data.src;
  // A masked shape draws its outline over the picture, with no fill of its own.
  const sub = {
    object: masked ? { ...o, style: { ...o.style, fill: "transparent", gradient: null } } : o,
    mode,
    unit,
    unitScale,
    editing,
  };
  const linear = o.type === "arrow" || o.type === "line";
  const [ax, ay, bx, by] = linePoints(o);
  const captionPad = o.style.padding ?? 10;
  const vAlign = o.style.verticalAlign ?? "middle";
  const captionY =
    vAlign === "top" ? captionPad : vAlign === "bottom" ? o.height - captionPad - 18 : o.height / 2 - 11;

  return (
    <KGroup
      id={o.id}
      name="object"
      ref={(node) => onRef(o.id, node)}
      x={o.x}
      y={o.y}
      rotation={o.rotation}
      // Konva treats any value other than source-over as "needs a buffer
      // canvas", and undefined counts — so always send a concrete mode.
      globalCompositeOperation={(o.style.blend as GlobalCompositeOperation) ?? "source-over"}
      opacity={o.opacity * celOpacity}
      listening={!o.locked && !o.data.trace && celOpacity === 1}
    >
      <EffectsGroup object={o}>
        {masked && <ClippedImage {...sub} object={o} />}
        <Renderer {...sub} />
      </EffectsGroup>
      {linear && o.data.text && (
        <KGroup x={(ax + bx) / 2} y={(ay + by) / 2}>
          <KRect x={-52} y={-11} width={104} height={20} fill="#ffffff" opacity={0.82} cornerRadius={3} />
          <KText
            text={o.data.text}
            x={-52}
            y={-7}
            width={104}
            align="center"
            fontSize={o.style.fontSize ?? 12}
            fontFamily={fontOf(o)}
            fill={o.style.stroke}
          />
        </KGroup>
      )}
      {CAPTIONED.has(o.type) && o.data.text && !editing && (
        <KText
          text={displayText(o)}
          x={captionPad}
          y={captionY}
          width={Math.max(0, o.width - captionPad * 2)}
          align={o.style.align ?? "center"}
          fontSize={o.style.fontSize ?? 15}
          fontFamily={fontOf(o)}
          fontStyle={fontStyleOf(o)}
          lineHeight={o.style.lineHeight ?? 1.3}
          fill={o.style.color ?? o.style.stroke}
          listening={false}
        />
      )}
    </KGroup>
  );
});

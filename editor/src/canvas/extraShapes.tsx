import { Group as KGroup, Line as KLine, Rect as KRect, Text as KText } from "react-konva";

import type { CanvasObject } from "../types";
import { FONTS } from "../lib/theme";

const solid = (c?: string) => (c && c !== "transparent" ? c : undefined);
const fontOf = (o: CanvasObject) => FONTS[o.style.fontFamily ?? "sans"];

/** Moodboard slot: an empty frame that swallows an image on double-click. */
export function PlaceholderShape({ object: o }: { object: CanvasObject }) {
  const w = o.width;
  const h = o.height;
  const cx = w / 2;
  const cy = h / 2 - 8;
  const s = Math.min(38, Math.min(w, h) * 0.24);
  return (
    <>
      <KRect
        width={w}
        height={h}
        fill={solid(o.style.fill) ?? "#f0efe9"}
        stroke={o.style.stroke ?? "#c6c6be"}
        strokeWidth={o.style.strokeWidth ?? 1.5}
        dash={[8, 6]}
        cornerRadius={o.style.radius ?? 3}
      />
      <KRect
        x={cx - s / 2}
        y={cy - s / 2}
        width={s}
        height={s * 0.78}
        cornerRadius={2}
        stroke="#a8a79e"
        strokeWidth={1.4}
      />
      <KLine
        points={[cx - s / 2 + 3, cy + s * 0.2, cx - s * 0.1, cy - s * 0.08, cx + s * 0.1, cy + s * 0.06, cx + s / 2 - 3, cy - s * 0.14]}
        stroke="#a8a79e"
        strokeWidth={1.4}
        lineJoin="round"
      />
      {h > 90 && (
        <KText
          y={cy + s}
          width={w}
          align="center"
          text={o.data.text || "Double-click to add an image"}
          fontSize={11.5}
          fontFamily={FONTS.sans}
          fill="#9c9c94"
        />
      )}
    </>
  );
}

/** Simple data table: first row is the header, columns share the width. */
export function TableShape({ object: o, editing }: { object: CanvasObject; editing: boolean }) {
  const rows = o.data.rows ?? [];
  const cols = Math.max(1, rows[0]?.length ?? 1);
  const rowH = rows.length ? o.height / rows.length : o.height;
  const colW = o.width / cols;
  const size = o.style.fontSize ?? 13;
  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={solid(o.style.fill) ?? "#ffffff"}
        stroke={o.style.stroke ?? "#d9d7cd"}
        strokeWidth={o.style.strokeWidth ?? 1}
        cornerRadius={o.style.radius ?? 3}
      />
      <KRect
        width={o.width}
        height={rowH}
        fill="#f2f1ec"
        cornerRadius={[o.style.radius ?? 3, o.style.radius ?? 3, 0, 0]}
      />
      {rows.map((_, r) =>
        r === 0 ? null : (
          <KLine
            key={`r${r}`}
            points={[0, r * rowH, o.width, r * rowH]}
            stroke="#e7e5dc"
            strokeWidth={1}
          />
        ),
      )}
      <KLine points={[0, rowH, o.width, rowH]} stroke="#d9d7cd" strokeWidth={1} />
      {Array.from({ length: cols - 1 }, (_, c) => (
        <KLine
          key={`c${c}`}
          points={[(c + 1) * colW, 0, (c + 1) * colW, o.height]}
          stroke="#e7e5dc"
          strokeWidth={1}
        />
      ))}
      {!editing &&
        rows.map((row, r) =>
          row.map((cell, c) => (
            <KText
              key={`${r}-${c}`}
              x={c * colW + 10}
              y={r * rowH + rowH / 2 - size * 0.62}
              width={colW - 20}
              text={cell}
              fontSize={size}
              fontFamily={fontOf(o)}
              fontStyle={r === 0 ? "bold" : "normal"}
              fill={o.style.color ?? "#17170f"}
              ellipsis
              wrap="none"
            />
          )),
        )}
    </>
  );
}

/** Flashcard: one face at a time, flipped from the toolbar or in a deck run. */
export function CardShape({ object: o, editing }: { object: CanvasObject; editing: boolean }) {
  const flipped = !!o.data.flipped;
  const text = (flipped ? o.data.back : o.data.front) ?? "";
  const size = o.style.fontSize ?? 20;
  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={solid(o.style.fill) ?? "#ffffff"}
        stroke={o.style.stroke ?? "#d9d7cd"}
        strokeWidth={o.style.strokeWidth ?? 1}
        cornerRadius={o.style.radius ?? 10}
        shadowColor="#000000"
        shadowOpacity={o.style.shadow ? 0.12 : 0}
        shadowBlur={o.style.shadow ? 16 : 0}
        shadowOffsetY={o.style.shadow ? 5 : 0}
      />
      <KText
        x={14}
        y={12}
        text={flipped ? "BACK" : "FRONT"}
        fontSize={9.5}
        fontFamily={FONTS.mono}
        letterSpacing={1.4}
        fill="#9c9c94"
      />
      {!editing && (
        <KGroup>
          <KText
            x={20}
            y={o.height / 2 - size}
            width={o.width - 40}
            height={o.height / 2}
            align={o.style.align ?? "center"}
            text={text || (flipped ? "Answer" : "Question?")}
            fontSize={size}
            fontFamily={fontOf(o)}
            lineHeight={1.3}
            fill={text ? (o.style.color ?? "#17170f") : "#a8a8a2"}
            wrap="word"
          />
        </KGroup>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Circle as KCircle, Image as KImage, Line as KLine, Rect as KRect, Text as KText } from "react-konva";

import type { CanvasObject } from "../types";
import { FONTS } from "../lib/theme";
import {
  MEDIA_BAR,
  currentTimeOf,
  durationOf,
  formatTime,
  getMedia,
  isPlaying,
  onMediaTick,
  playButtonAt,
  progressOf,
} from "../lib/media";

/**
 * Video and audio on the board with real transport: a play button, a scrub
 * bar and a running time, all drawn into the scene so they export cleanly.
 */
export function MediaShape({ object: o }: { object: CanvasObject }) {
  const [, force] = useState(0);
  const el = getMedia(o);

  useEffect(() => onMediaTick(() => force((n) => n + 1)), []);

  const audio = o.data.mediaKind === "audio";
  const playing = isPlaying(o.id);
  const progress = progressOf(o.id);
  const barY = o.height - MEDIA_BAR;
  const btn = playButtonAt(o);
  const radius = o.style.radius ?? 8;
  const accent = o.style.stroke ?? "#1f5fd0";

  return (
    <>
      <KRect
        width={o.width}
        height={o.height}
        fill={audio ? (o.style.fill ?? "#ffffff") : "#12120f"}
        stroke={o.style.stroke ?? "#d9d7cd"}
        strokeWidth={o.style.strokeWidth ?? 1}
        cornerRadius={radius}
        shadowColor="#000000"
        shadowOpacity={o.style.shadow ? 0.14 : 0}
        shadowBlur={o.style.shadow ? 16 : 0}
      />

      {!audio && el instanceof HTMLVideoElement && el.videoWidth > 0 && (
        <KImage
          image={el}
          width={o.width}
          height={barY}
          cornerRadius={[radius, radius, 0, 0]}
          listening={false}
        />
      )}

      {audio && (
        <>
          <KText
            x={62}
            y={o.height / 2 - 22}
            width={o.width - 78}
            text={o.data.title || "Audio"}
            fontSize={13}
            fontStyle="bold"
            fontFamily={FONTS.sans}
            fill={o.style.color ?? "#1a1a18"}
            ellipsis
            wrap="none"
          />
          {/* A static waveform: decoration that reads as sound. */}
          {Array.from({ length: Math.max(6, Math.floor((o.width - 90) / 6)) }, (_, i) => {
            const h = 4 + ((Math.sin(i * 1.7) + 1) / 2) * 22;
            const x = 64 + i * 6;
            const played = (x - 64) / Math.max(1, o.width - 90) < progress;
            return (
              <KLine
                key={i}
                points={[x, o.height / 2 + 6 - h / 2, x, o.height / 2 + 6 + h / 2]}
                stroke={played ? accent : "#c9c7bd"}
                strokeWidth={2.5}
                lineCap="round"
              />
            );
          })}
        </>
      )}

      {/* play / pause */}
      <KCircle
        x={btn.x}
        y={btn.y}
        radius={btn.r}
        fill={audio ? accent : "rgba(0,0,0,0.55)"}
        stroke={audio ? undefined : "rgba(255,255,255,0.7)"}
        strokeWidth={audio ? 0 : 1.2}
      />
      {playing ? (
        <>
          <KRect
            x={btn.x - btn.r * 0.26}
            y={btn.y - btn.r * 0.36}
            width={btn.r * 0.16}
            height={btn.r * 0.72}
            fill="#ffffff"
          />
          <KRect
            x={btn.x + btn.r * 0.1}
            y={btn.y - btn.r * 0.36}
            width={btn.r * 0.16}
            height={btn.r * 0.72}
            fill="#ffffff"
          />
        </>
      ) : (
        <KLine
          points={[
            btn.x - btn.r * 0.22,
            btn.y - btn.r * 0.4,
            btn.x + btn.r * 0.42,
            btn.y,
            btn.x - btn.r * 0.22,
            btn.y + btn.r * 0.4,
          ]}
          closed
          fill="#ffffff"
        />
      )}

      {!audio && (
        <>
          <KRect
            y={barY}
            width={o.width}
            height={MEDIA_BAR}
            fill="#1a1a18"
            cornerRadius={[0, 0, radius, radius]}
          />
          <KRect x={12} y={barY + MEDIA_BAR / 2 - 2} width={o.width - 96} height={4} cornerRadius={2} fill="#3a3a34" />
          <KRect
            x={12}
            y={barY + MEDIA_BAR / 2 - 2}
            width={Math.max(0, (o.width - 96) * progress)}
            height={4}
            cornerRadius={2}
            fill={accent}
          />
          <KCircle
            x={12 + (o.width - 96) * progress}
            y={barY + MEDIA_BAR / 2}
            radius={5}
            fill="#ffffff"
          />
          <KText
            x={o.width - 78}
            y={barY + MEDIA_BAR / 2 - 6}
            width={66}
            align="right"
            text={`${formatTime(currentTimeOf(o.id))} / ${formatTime(durationOf(o.id))}`}
            fontSize={10.5}
            fontFamily={FONTS.mono}
            fill="#c9c7bd"
          />
        </>
      )}

      {audio && (
        <>
          <KRect x={62} y={o.height - 22} width={o.width - 140} height={3} cornerRadius={2} fill="#e6e4de" />
          <KRect
            x={62}
            y={o.height - 22}
            width={Math.max(0, (o.width - 140) * progress)}
            height={3}
            cornerRadius={2}
            fill={accent}
          />
          <KText
            x={o.width - 72}
            y={o.height - 27}
            width={60}
            align="right"
            text={`${formatTime(currentTimeOf(o.id))} / ${formatTime(durationOf(o.id))}`}
            fontSize={10}
            fontFamily={FONTS.mono}
            fill="#8a8a80"
          />
        </>
      )}
    </>
  );
}

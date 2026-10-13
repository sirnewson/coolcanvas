import { useEffect, useMemo, useRef } from "react";

import { useStore } from "../store/store";
import { celMembers } from "../lib/export";
import { objectBounds } from "../lib/geom";
import type { BoardDoc, CanvasObject } from "../types";
import { NumberField, Segmented } from "./controls";
import { IconClose, IconExport, IconPlus } from "./icons";

function CelThumb({ doc, celId }: { doc: BoardDoc; celId: string }) {
  const cel = doc.objects[celId];
  const members = useMemo(() => celMembers(doc, celId), [doc, celId]);
  if (!cel) return null;
  const b = objectBounds(cel);
  const W = 58;
  const H = 40;
  const scale = Math.min(W / Math.max(1, b.width), H / Math.max(1, b.height));
  const ox = (W - b.width * scale) / 2;
  const oy = (H - b.height * scale) / 2;
  const contents = doc.order
    .map((id) => doc.objects[id])
    .filter((o): o is CanvasObject => !!o && members.has(o.id) && o.id !== celId && !o.hidden);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cel-thumb">
      <rect x={ox} y={oy} width={b.width * scale} height={b.height * scale} fill="#ffffff" stroke="#d9d7cd" />
      {contents.slice(0, 60).map((o) => {
        const ob = objectBounds(o);
        return (
          <rect
            key={o.id}
            x={ox + (ob.x - b.x) * scale}
            y={oy + (ob.y - b.y) * scale}
            width={Math.max(1, ob.width * scale)}
            height={Math.max(1, ob.height * scale)}
            fill={o.style.fill && o.style.fill !== "transparent" ? o.style.fill : "#8f8e86"}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}

/**
 * Procreate-style animation assist: frames are cels, laid out on the board and
 * played back in order with onion skins behind the current one.
 */
export function Timeline() {
  const open = useStore((s) => s.ui.timelineOpen);
  const doc = useStore((s) => s.doc);
  const playback = useStore((s) => s.playback);
  const presenting = useStore((s) => s.ui.presenting);
  const state = useStore.getState;
  const direction = useRef(1);
  const stripRef = useRef<HTMLDivElement | null>(null);

  const { cels, fps, loop, onion } = doc.animation;

  /* Playback runs on a timer: rAF pauses in background tabs, a timer does not. */
  useEffect(() => {
    if (!playback.playing || cels.length < 2) return;
    const id = window.setInterval(() => {
      const s = useStore.getState();
      const count = s.doc.animation.cels.length;
      if (!count) return;
      let next = s.playback.index + direction.current;
      if (s.doc.animation.loop === "pingpong") {
        if (next >= count) {
          direction.current = -1;
          next = count - 2;
        } else if (next < 0) {
          direction.current = 1;
          next = 1;
        }
      } else if (next >= count) {
        if (s.doc.animation.loop === "once") {
          s.togglePlay(false);
          next = count - 1;
        } else next = 0;
      }
      s.setPlayhead(Math.max(0, Math.min(count - 1, next)));
    }, 1000 / Math.max(1, fps));
    return () => window.clearInterval(id);
  }, [playback.playing, fps, cels.length]);

  // Keep the active cel in view in the strip.
  useEffect(() => {
    const el = stripRef.current?.children[playback.index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [playback.index]);

  if (!open || presenting) return null;

  const jump = (index: number) => {
    state().setPlayhead(index);
    const cel = doc.objects[doc.animation.cels[index]];
    if (cel) {
      const b = objectBounds(cel);
      state().centerOn({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
      state().setSelection([cel.id]);
    }
  };

  return (
    <div className="timeline" data-ui>
      <div className="timeline-controls">
        <button
          type="button"
          className={`play${playback.playing ? " is-on" : ""}`}
          onClick={() => state().togglePlay()}
          disabled={cels.length < 2}
          title={playback.playing ? "Pause" : "Play"}
        >
          {playback.playing ? "❚❚" : "▶"}
        </button>
        <NumberField
          label="FPS"
          value={fps}
          min={1}
          max={60}
          onChange={(v) => state().setAnimation({ fps: v })}
        />
        <Segmented
          compact
          value={loop}
          options={[
            { value: "loop", label: "Loop" },
            { value: "pingpong", label: "Ping" },
            { value: "once", label: "Once" },
          ]}
          onChange={(v) => state().setAnimation({ loop: v })}
        />
        <NumberField
          label="Onion"
          value={onion}
          min={0}
          max={4}
          onChange={(v) => state().setAnimation({ onion: v })}
        />
      </div>

      <div className="timeline-strip" ref={stripRef}>
        {cels.map((celId, i) => (
          <div key={celId} className={`cel${i === playback.index ? " is-active" : ""}`}>
            <button type="button" className="cel-open" onClick={() => jump(i)} title={`Cel ${i + 1}`}>
              <CelThumb doc={doc} celId={celId} />
              <em>{i + 1}</em>
            </button>
            <div className="cel-tools">
              <button type="button" title="Move earlier" onClick={() => state().moveCel(i, i - 1)}>
                ‹
              </button>
              <button type="button" title="Move later" onClick={() => state().moveCel(i, i + 1)}>
                ›
              </button>
              <button
                type="button"
                title="Remove from animation"
                onClick={() => state().removeCel(celId)}
              >
                <IconClose width={11} height={11} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="cel-add"
          onClick={() => state().addCel(true)}
          title="Add a cel — copies the current one so you can draw the next pose"
        >
          <IconPlus />
          <em>Add cel</em>
        </button>
      </div>

      <div className="timeline-end">
        <button
          type="button"
          className="mini-btn"
          disabled={!cels.length}
          onClick={() => state().setUi({ exportOpen: true })}
        >
          <IconExport width={14} height={14} />
          Export
        </button>
        <button
          type="button"
          className="mini-btn"
          onClick={() => state().setUi({ timelineOpen: false })}
        >
          Hide
        </button>
      </div>
    </div>
  );
}

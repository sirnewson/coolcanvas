import { useMemo } from "react";

import { useStore } from "../store/store";
import { FILLS, FONT_LABELS, INK, NOTE_COLORS } from "../lib/theme";
import { stepFontSize } from "../lib/text";
import { boundsOfObjects } from "../lib/geom";
import type { CanvasObject, FontKey, NoteKind } from "../types";
import { ColorField } from "./controls";
import { isPlaying, restart, setLoop, setMuted, togglePlay } from "../lib/media";
import { IconCopy, IconGroup, IconLock, IconTrash, IconUnlock } from "./icons";

/**
 * The fast lane. Everything here is one click from the selection; the dock
 * holds the full set. Image selections get the annotate actions first, since
 * "explain this picture" is the job FlowCanvas is built around.
 */
export function ContextToolbar() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const camera = useStore((s) => s.camera);
  const presenting = useStore((s) => s.ui.presenting);
  const editingId = useStore((s) => s.editingId);
  const cropId = useStore((s) => s.cropId);
  const state = useStore.getState;

  const objects = useMemo(
    () => selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
    [selection, doc],
  );
  const box = useMemo(() => boundsOfObjects(objects), [objects]);

  if (!objects.length || !box || presenting || editingId || cropId) return null;

  const types = new Set(objects.map((o) => o.type));
  const has = (...t: string[]) => t.some((x) => types.has(x as CanvasObject["type"]));
  const first = objects[0];
  const single = objects.length === 1 ? first : null;
  const hasText = has("text", "note", "list", "card", "rect", "ellipse", "triangle", "diamond", "polygon");

  const left = camera.x + (box.x + box.width / 2) * camera.zoom;
  // Sit above the rotate handle (rotateAnchorOffset 24 + anchor), never on it.
  const top = camera.y + box.y * camera.zoom - 46;

  const inkValue = first.style.stroke ?? first.style.color ?? first.style.fill;
  const setInk = (hex: string) => {
    const patch = has("text")
      ? { color: hex }
      : has("draw")
        ? { fill: hex }
        : has("note")
          ? { color: hex }
          : { stroke: hex };
    state().patchStyle(selection, patch, { ink: hex });
  };

  return (
    <div
      className="context-toolbar"
      data-ui
      style={{ left, top, transform: "translate(-50%, -100%)" }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {single?.type === "media" && (
        <>
          <button className="ct-btn is-text" type="button" onClick={() => togglePlay(single)}>
            {isPlaying(single.id) ? "Pause" : "Play"}
          </button>
          <button className="ct-btn is-text" type="button" onClick={() => restart(single)}>
            Restart
          </button>
          <button
            className={`ct-btn is-text${single.data.muted ? "" : " is-on"}`}
            type="button"
            onClick={() => {
              state().patchData(single.id, { muted: !single.data.muted });
              setMuted(single, !single.data.muted);
            }}
          >
            {single.data.muted ? "Muted" : "Sound"}
          </button>
          <button
            className={`ct-btn is-text${single.data.loop ? " is-on" : ""}`}
            type="button"
            onClick={() => {
              state().patchData(single.id, { loop: !single.data.loop });
              setLoop(single, !single.data.loop);
            }}
          >
            Loop
          </button>
          <span className="ct-rule" />
        </>
      )}

      {single?.type === "image" && (
        <>
          <span className="ct-tag">annotate</span>
          <button className="ct-btn is-text" type="button" onClick={() => state().setTool("arrow")}>
            Arrow
          </button>
          <button className="ct-btn is-text" type="button" onClick={() => state().setTool("ellipse")}>
            Circle
          </button>
          <button className="ct-btn is-text" type="button" onClick={() => state().setTool("highlighter")}>
            Highlight
          </button>
          <button className="ct-btn is-text" type="button" onClick={() => state().setTool("text")}>
            Label
          </button>
          <button className="ct-btn is-text" type="button" onClick={() => state().setTool("measure")}>
            Measure
          </button>
          <span className="ct-rule" />
          <button className="ct-btn is-text" type="button" onClick={() => state().setCropId(single.id)}>
            Crop
          </button>
          <button
            className={`ct-btn is-text${single.data.trace ? " is-on" : ""}`}
            type="button"
            onClick={() => {
              state().patchData(single.id, { trace: !single.data.trace });
              state().patchObject(single.id, { locked: !single.data.trace });
              state().flashHint(single.data.trace ? "Trace off" : "Traceable — sketch over it");
            }}
          >
            Trace
          </button>
          <span className="ct-rule" />
        </>
      )}

      {hasText && (
        <>
          <select
            className="ct-select"
            value={first.style.fontFamily ?? "sans"}
            title="Typeface"
            onChange={(e) => {
              state().patchStyle(
                selection,
                { fontFamily: e.target.value as FontKey },
                { fontFamily: e.target.value as FontKey },
              );
              state().fitText(selection);
            }}
          >
            {(Object.keys(FONT_LABELS) as FontKey[]).map((f) => (
              <option key={f} value={f}>
                {FONT_LABELS[f]}
              </option>
            ))}
          </select>
          <div className="ct-size">
            <button
              type="button"
              title="Smaller"
              onClick={() => {
                const next = stepFontSize(first.style.fontSize ?? 18, -1);
                state().patchStyle(selection, { fontSize: next });
                state().fitText(selection);
              }}
            >
              A−
            </button>
            <span>{Math.round(first.style.fontSize ?? 18)}</span>
            <button
              type="button"
              title="Bigger"
              onClick={() => {
                const next = stepFontSize(first.style.fontSize ?? 18, 1);
                state().patchStyle(selection, { fontSize: next });
                state().fitText(selection);
              }}
            >
              A+
            </button>
          </div>
          <button
            className={`ct-btn is-text${(first.style.fontWeight ?? 400) >= 600 ? " is-on" : ""}`}
            type="button"
            title="Bold"
            style={{ fontWeight: 700 }}
            onClick={() => {
              state().patchStyle(selection, {
                fontWeight: (first.style.fontWeight ?? 400) >= 600 ? 400 : 650,
              });
              state().fitText(selection);
            }}
          >
            B
          </button>
          <button
            className={`ct-btn is-text${first.style.fontStyle === "italic" ? " is-on" : ""}`}
            type="button"
            title="Italic"
            style={{ fontStyle: "italic" }}
            onClick={() =>
              state().patchStyle(selection, {
                fontStyle: first.style.fontStyle === "italic" ? "normal" : "italic",
              })
            }
          >
            I
          </button>
          <button
            className="ct-btn is-text"
            type="button"
            title="Alignment"
            onClick={() => {
              const order = ["left", "center", "right"] as const;
              const next = order[(order.indexOf((first.style.align ?? "left") as "left") + 1) % 3];
              state().patchStyle(selection, { align: next });
            }}
          >
            {first.style.align === "center" ? "◫" : first.style.align === "right" ? "◨" : "◧"}
          </button>
          <span className="ct-rule" />
        </>
      )}

      {!has("image", "embed") && (
        <ColorField value={inkValue} swatches={INK} onChange={setInk} label="Ink" />
      )}

      {has("rect", "ellipse", "triangle", "diamond", "frame") && (
        <ColorField
          value={first.style.fill}
          swatches={FILLS}
          allowNone
          label="Fill"
          onChange={(hex) => state().patchStyle(selection, { fill: hex }, { fill: hex })}
        />
      )}

      {has("rect", "ellipse", "triangle", "diamond", "line", "arrow", "draw", "measure") && (
        <div className="ct-weights">
          {[1, 2, 4, 8].map((w) => (
            <button
              key={w}
              type="button"
              className={(first.style.strokeWidth ?? 2) === w ? "is-active" : ""}
              title={`${w}px`}
              onClick={() => state().patchStyle(selection, { strokeWidth: w }, { strokeWidth: w })}
            >
              <span style={{ height: Math.min(7, w) }} />
            </button>
          ))}
        </div>
      )}

      {has("note") && (
        <div className="ct-notes">
          {(Object.keys(NOTE_COLORS) as NoteKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              title={NOTE_COLORS[kind].label}
              className={first.data.noteKind === kind ? "is-active" : ""}
              style={{ background: NOTE_COLORS[kind].bg }}
              onClick={() => {
                for (const o of objects) {
                  state().patchData(o.id, { noteKind: kind });
                  state().patchStyle([o.id], {
                    fill: NOTE_COLORS[kind].bg,
                    color: NOTE_COLORS[kind].ink,
                  });
                }
                state().setDefaults({ noteKind: kind });
              }}
            />
          ))}
        </div>
      )}

      {has("arrow", "line") && (
        <>
          <button
            className="ct-btn is-text"
            type="button"
            title="Straight, curved or elbow"
            onClick={() => {
              const curved = !!first.style.curve;
              const elbow = !!first.style.elbow;
              const next = elbow ? "straight" : curved ? "elbow" : "curved";
              state().patchStyle(
                selection,
                { curve: next === "curved" ? 0.35 : 0, elbow: next === "elbow" },
                { arrowStyle: next },
              );
            }}
          >
            {first.style.elbow ? "Elbow" : first.style.curve ? "Curved" : "Straight"}
          </button>
          <button
            className="ct-btn is-text"
            type="button"
            title="Swap arrowheads"
            onClick={() =>
              state().patchStyle(selection, {
                arrowStart: !first.style.arrowStart,
                arrowEnd: first.style.arrowStart ? true : !first.style.arrowEnd,
              })
            }
          >
            {first.style.arrowStart && first.style.arrowEnd ? "↔" : first.style.arrowStart ? "←" : "→"}
          </button>
        </>
      )}

      <span className="ct-rule" />

      {objects.length > 1 && (
        <button className="ct-btn" type="button" title="Group · Ctrl+G" onClick={() => state().group()}>
          <IconGroup />
        </button>
      )}
      {single?.type === "group" && (
        <button
          className="ct-btn"
          type="button"
          title="Ungroup · Ctrl+Shift+G"
          onClick={() => state().ungroup()}
        >
          <IconGroup />
        </button>
      )}
      <button
        className="ct-btn"
        type="button"
        title="Duplicate · Ctrl+D"
        onClick={() => state().duplicateSelection()}
      >
        <IconCopy />
      </button>
      <button
        className="ct-btn"
        type="button"
        title={first.locked ? "Unlock" : "Lock"}
        onClick={() => state().setLocked(selection, !first.locked)}
      >
        {first.locked ? <IconUnlock /> : <IconLock />}
      </button>
      <button
        className="ct-btn is-danger"
        type="button"
        title="Delete · Del"
        onClick={() => state().deleteSelection()}
      >
        <IconTrash />
      </button>
    </div>
  );
}

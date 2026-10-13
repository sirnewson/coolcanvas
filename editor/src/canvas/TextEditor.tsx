import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Editors currently mounted. React's StrictMode mounts, unmounts and remounts
 * every component in development; without this the unmount commit would fire
 * on that throwaway pass and delete the object that was just created.
 */
const liveEditors = new Set<string>();

import type { Camera, CanvasObject } from "../types";
import { FONTS, NOTE_COLORS } from "../lib/theme";
import {
  LIST_PAD,
  listHeight,
  mergeOutline,
  parseOutline,
  rowHeight,
  serializeOutline,
} from "../lib/outline";
import { measureTextHeight, measureTextWidth } from "../lib/text";
import { useStore } from "../store/store";

interface Props {
  object: CanvasObject;
  camera: Camera;
}

/**
 * Editing happens in a real textarea floating over the canvas: native caret,
 * IME, selection and mobile keyboards all come for free.
 */
export function TextEditor({ object: o, camera }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const isList = o.type === "list";
  const isTable = o.type === "table";
  const isCard = o.type === "card";
  const [value, setValue] = useState(() => {
    if (isList) return serializeOutline(o.data.items ?? []);
    if (isTable) return (o.data.rows ?? []).map((row) => row.join("\t")).join("\n");
    if (isCard) return (o.data.flipped ? o.data.back : o.data.front) ?? "";
    return o.data.text ?? "";
  });
  const created = useRef(!o.data.text && !isList);
  const done = useRef(false);

  useLayoutEffect(() => {
    // Focus after the current task: the browser still has a compatibility
    // mousedown to dispatch for the click that opened this editor, and that
    // would otherwise move focus straight back to the document.
    const t = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    const state = useStore.getState();
    const text = value;
    if (!state.doc.objects[o.id]) {
      state.setEditing(null);
      return;
    }
    if (!text.trim() && created.current && (o.type === "text" || o.type === "note")) {
      state.removeObjects([o.id]);
      state.setEditing(null);
      return;
    }
    if (isTable) {
      // One row per line, tab between cells.
      const rows = text
        .split("\n")
        .filter((line) => line.trim().length)
        .map((line) => line.split("\t").map((cell) => cell.trim()));
      if (rows.length) {
        state.patchData(o.id, { rows });
        state.patchObject(o.id, { height: rows.length * 38 });
      }
      state.setEditing(null);
      return;
    }
    if (isCard) {
      state.patchData(o.id, o.data.flipped ? { back: text } : { front: text });
      state.setEditing(null);
      return;
    }
    if (isList) {
      // Indentation is the outline: two spaces (or a tab) per level.
      const items = mergeOutline(o.data.items ?? [], parseOutline(text));
      state.patchData(o.id, { items });
      state.patchObject(o.id, { height: listHeight({ ...o, data: { ...o.data, items } }) });
      state.setEditing(null);
      return;
    }
    const patch: Partial<CanvasObject> = {};
    if (o.type === "text") {
      if (o.data.autoWidth) patch.width = Math.min(1600, measureTextWidth(o, text));
      patch.height = measureTextHeight({ ...o, width: patch.width ?? o.width }, text);
    }
    if (text !== (o.data.text ?? "")) state.patchData(o.id, { text });
    if (patch.height) state.patchObject(o.id, patch);
    state.setEditing(null);
  };

  // Anything that closes the editor — a tool change, a click elsewhere,
  // undo — still has to keep what was typed.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    liveEditors.add(o.id);
    return () => {
      liveEditors.delete(o.id);
      const id = o.id;
      const run = commitRef.current;
      window.setTimeout(() => {
        if (!liveEditors.has(id)) run();
      }, 0);
    };
  }, [o.id]);

  // The box grows under the caret rather than after you finish — and point
  // text grows sideways too, like a Photoshop click-to-type layer.
  useEffect(() => {
    const el = ref.current;
    if (!el || o.type !== "text") return;
    if (o.data.autoWidth) {
      el.style.width = `${Math.min(1600, measureTextWidth(o, value)) * camera.zoom}px`;
      el.style.whiteSpace = "pre";
    }
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, o, camera.zoom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        e.stopPropagation();
        commit();
      }
    };
    const el = ref.current;
    el?.addEventListener("keydown", onKey);
    return () => el?.removeEventListener("keydown", onKey);
  });

  const isNote = o.type === "note";
  const isShape =
    o.type === "rect" || o.type === "ellipse" || o.type === "triangle" || o.type === "diamond";
  const pad = isNote ? 14 : isList ? LIST_PAD : isTable ? 8 : isCard ? 20 : 0;
  const fontSize = (o.style.fontSize ?? (isShape ? 15 : 18)) * camera.zoom;
  const palette = NOTE_COLORS[o.data.noteKind ?? "idea"];

  const width = (isShape ? Math.max(o.width - 20, 40) : o.width - pad * 2) * camera.zoom;
  const height = (o.type === "text" ? o.height : o.height - pad * 2) * camera.zoom;
  const monoEdit = isTable;
  const listLine = isList ? rowHeight(o) / (o.style.fontSize ?? 15) : undefined;
  const left = camera.x + (o.x + (isShape ? 10 : pad)) * camera.zoom;
  const top =
    camera.y +
    (o.y + (isShape ? o.height / 2 - (o.style.fontSize ?? 15) * 0.8 : pad + (isNote ? 4 : 0))) *
      camera.zoom;

  return (
    <textarea
      ref={ref}
      data-ui
      className="text-editor"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      spellCheck={false}
      style={{
        left,
        top,
        width,
        height: o.type === "text" ? undefined : height,
        minHeight: fontSize * 1.35,
        fontSize,
        lineHeight: listLine ?? (isShape ? 1.2 : (o.style.lineHeight ?? 1.35)),
        fontFamily: monoEdit ? FONTS.mono : FONTS[o.style.fontFamily ?? "sans"],
        fontWeight: o.style.fontWeight ?? 400,
        color: o.style.color ?? (isNote ? palette.ink : o.style.stroke ?? "#1c1c1a"),
        textAlign: isShape ? "center" : (o.style.align ?? "left"),
        textTransform: o.style.textTransform === "uppercase" ? "uppercase" : o.style.textTransform === "capitalize" ? "capitalize" : undefined,
        letterSpacing: o.style.letterSpacing ? `${o.style.letterSpacing * camera.zoom}px` : undefined,
        fontStyle: o.style.fontStyle === "italic" ? "italic" : undefined,
        transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
        transformOrigin: "top left",
      }}
    />
  );
}

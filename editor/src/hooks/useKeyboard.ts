import { useEffect } from "react";

import { useStore } from "../store/store";
import { dupState } from "../lib/duplicate";
import { screenToWorld } from "../lib/geom";
import type { ToolId } from "../types";

const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  h: "hand",
  p: "pen",
  e: "eraser",
  a: "arrow",
  l: "line",
  m: "measure",
  r: "rect",
  o: "ellipse",
  g: "polygon",
  t: "text",
  n: "note",
  b: "list",
  f: "frame",
};

const SHIFT_TOOL_KEYS: Record<string, ToolId> = {
  p: "highlighter",
  r: "triangle",
  o: "diamond",
};

/** Keys that behave as "hold to use, release to go back" (blueprint §8). */
const QUICK_KEYS = new Set(["a", "l", "r", "o", "p", "m", "g"]);
const TAP_MS = 260;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function useKeyboard(actions: { insertImage(): void; exportBoard(): void }) {
  useEffect(() => {
    const heldSince = new Map<string, number>();
    let pointer = { x: 0, y: 0 };
    const track = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", track);

    const onKeyDown = (e: KeyboardEvent) => {
      const state = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (isTyping(e.target)) return;
      if (state.ui.home) return;

      if (key === "escape") {
        if (state.cropId) state.setCropId(null);
        else if (state.ui.commandOpen || state.ui.radial || state.ui.menu || state.ui.exportOpen) {
          state.setUi({ commandOpen: false, radial: null, menu: null, exportOpen: false });
        } else if (state.ui.boardsOpen || state.ui.shortcutsOpen) {
          state.setUi({ boardsOpen: false, shortcutsOpen: false });
        } else if (state.ui.presenting) state.setUi({ presenting: false });
        else if (state.tool !== "select") state.setTool("select");
        else state.clearSelection();
        return;
      }

      if (mod && key === "k") {
        e.preventDefault();
        state.setUi({ commandOpen: !state.ui.commandOpen });
        return;
      }
      if (key === "/" && !mod) {
        e.preventDefault();
        state.setUi({ commandOpen: true });
        return;
      }
      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        state.setUi({ shortcutsOpen: true });
        return;
      }

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && key === "y") {
        e.preventDefault();
        state.redo();
        return;
      }
      if (mod && key === "a") {
        e.preventDefault();
        state.selectAll();
        return;
      }
      if (mod && key === "c") {
        e.preventDefault();
        state.copySelection();
        return;
      }
      if (mod && key === "x") {
        e.preventDefault();
        state.cutSelection();
        return;
      }
      if (mod && key === "v") {
        // Image/text pastes are handled by the window paste listener.
        if (state.clipboard.length) {
          e.preventDefault();
          state.pasteClipboard(screenToWorld({ x: pointer.x, y: pointer.y }, state.camera));
        }
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        state.duplicateSelection(dupState.dx, dupState.dy);
        return;
      }
      if (mod && key === "g") {
        e.preventDefault();
        if (e.shiftKey) state.ungroup();
        else state.group();
        return;
      }
      if (mod && key === "e") {
        // Chrome claims plain Ctrl+E for the address bar, so Shift works too.
        e.preventDefault();
        actions.exportBoard();
        return;
      }
      if (mod && (key === "]" || key === "[")) {
        e.preventDefault();
        state.reorder(state.selection, key === "]" ? "front" : "back");
        return;
      }
      if (mod && key === "l") {
        e.preventDefault();
        const locked = state.selection.some((id) => state.doc.objects[id]?.locked);
        state.setLocked(state.selection, !locked);
        return;
      }

      if (key === "enter" && state.selection.length === 1 && !state.editingId) {
        const target = state.doc.objects[state.selection[0]];
        const editable = ["text", "note", "list", "table", "card", "rect", "ellipse", "triangle", "diamond", "polygon"];
        if (target && editable.includes(target.type) && !target.locked) {
          e.preventDefault();
          state.setEditing(target.id);
          return;
        }
      }

      if (key === "delete" || key === "backspace") {
        if (state.selection.length) {
          e.preventDefault();
          state.deleteSelection();
        }
        return;
      }

      if (key.startsWith("arrow")) {
        if (!state.selection.length) return;
        e.preventDefault();
        const step = e.shiftKey ? state.prefs.nudgeStep * 10 : state.prefs.nudgeStep;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        state.translateObjects(state.selection, dx, dy);
        return;
      }

      if (mod) return;

      if (key === "0") return void state.resetView();
      if (key === "1") return void state.fitAll();
      if (key === "2") return void state.fitSelection();
      if (key === "=" || key === "+") return void state.setZoom(state.camera.zoom * 1.25);
      if (key === "-") return void state.setZoom(state.camera.zoom / 1.25);
      if (key === "i") return void actions.insertImage();
      if (key === " " || key === "spacebar") return;

      const tool = e.shiftKey ? SHIFT_TOOL_KEYS[key] : TOOL_KEYS[key];
      if (tool && !e.repeat) {
        e.preventDefault();
        heldSince.set(key, performance.now());
        state.setTool(tool, QUICK_KEYS.has(key) && !e.shiftKey);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const since = heldSince.get(key);
      heldSince.delete(key);
      if (since === undefined) return;
      const state = useStore.getState();
      // A quick tap latches the tool; a deliberate hold releases it again.
      if (performance.now() - since > TAP_MS && state.quickTool) state.setTool("select");
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [actions]);
}

import { useEffect, useMemo, useRef } from "react";

import { useStore } from "../store/store";
import { exportBoardFile, pickBoardFile } from "../lib/file";
import { PRESETS, SHADOW_PRESETS } from "../lib/effects";
import { TRACE_PRESETS } from "../lib/imageTools";
import {
  RENDER_STYLES,
  exportSvg,
  flattenSelection,
  removeBackground,
  selectedObjects,
  sketchToImage,
  sketchToSite,
  sketchToVideo,
  vectorise,
} from "../lib/studio";
import { createCard, createList, createNote, createTable, createText } from "../store/factory";
import { screenToWorld } from "../lib/geom";
import { ARRANGEMENTS, arrangeSelection } from "../lib/arrange";
import { EXPLAIN_KINDS, explainVisually } from "../lib/explain";

export interface MenuItem {
  label: string;
  hint?: string;
  run?: () => void;
  disabled?: boolean;
  checked?: boolean;
  /** Renders a rule above this item. */
  rule?: boolean;
  /** Nested menu, opened on hover. */
  items?: MenuItem[];
}

export interface Menu {
  id: string;
  label: string;
  items: MenuItem[];
}

/**
 * The menu bar is the exhaustive map of the app, Photoshop-style: every
 * command is reachable here even when its panel is closed. Items call the
 * same store actions the rail, dock and shortcuts use.
 */
export function useMenus(onInsertImage: () => void): Menu[] {
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const ui = useStore((s) => s.ui);
  const theme = useStore((s) => s.theme);
  const clipboard = useStore((s) => s.clipboard.length > 0);
  const s = useStore.getState;

  return useMemo(() => {
    const objects = selectedObjects();
    const has = selection.length > 0;
    const hasImage = objects.some((o) => o.type === "image");
    const hasVector = objects.some((o) => o.type === "vector");
    const hasGroup = objects.some((o) => o.type === "group");
    const centre = () => {
      const { viewport, camera } = s();
      return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
    };
    const add = (make: () => ReturnType<typeof createText>) => () => {
      const o = make();
      s().addObjects([o]);
    };

    const file: Menu = {
      id: "file",
      label: "File",
      items: [
        { label: "New board", hint: "", run: () => s().newBoard() },
        { label: "Open gallery", run: () => s().setUi({ home: true }) },
        { label: "All boards…", run: () => s().setUi({ boardsOpen: true }) },
        { label: "Open PSD file…", rule: true, run: () => void import("../lib/psd/psdActions").then((m) => m.openPsdDialog()) },
        { label: "Save / Export As PSD…", run: () => void import("../lib/psd/psdActions").then((m) => m.exportCurrentToPsd()) },
        { label: "Open board file…", rule: true, run: () => void pickBoardFile().then((d) => d && s().loadDoc(d)) },
        { label: "Save board to file", run: () => exportBoardFile(doc) },
        { label: "Place image…", hint: "I", rule: true, run: onInsertImage },
        { label: "Export…", hint: "Ctrl+E", run: () => s().setUi({ exportOpen: true }) },
        { label: "Export vector as SVG", disabled: !hasVector, run: exportSvg },
        { label: "Site Builder…", rule: true, run: () => s().setUi({ builderOpen: true }) },
        { label: "Present", hint: "Esc exits", run: () => s().setUi({ presenting: true }) },
      ],
    };

    const edit: Menu = {
      id: "edit",
      label: "Edit",
      items: [
        { label: "Undo", hint: "Ctrl+Z", disabled: !canUndo, run: () => s().undo() },
        { label: "Redo", hint: "Ctrl+⇧Z", disabled: !canRedo, run: () => s().redo() },
        { label: "Cut", hint: "Ctrl+X", rule: true, disabled: !has, run: () => s().cutSelection() },
        { label: "Copy", hint: "Ctrl+C", disabled: !has, run: () => s().copySelection() },
        { label: "Paste", hint: "Ctrl+V", disabled: !clipboard, run: () => s().pasteClipboard() },
        { label: "Duplicate", hint: "Ctrl+D", disabled: !has, run: () => s().duplicateSelection() },
        { label: "Delete", hint: "Del", disabled: !has, run: () => s().deleteSelection() },
        { label: "Select all", hint: "Ctrl+A", rule: true, run: () => s().selectAll() },
        { label: "Select same type", disabled: !has, run: () => s().selectSame() },
        { label: "Group", hint: "Ctrl+G", rule: true, disabled: selection.length < 2, run: () => s().group() },
        { label: "Ungroup", hint: "Ctrl+⇧G", disabled: !hasGroup, run: () => s().ungroup() },
        { label: "Lock", hint: "Ctrl+L", disabled: !has, run: () => s().setLocked(selection, true) },
        { label: "Hide", disabled: !has, run: () => s().setHidden(selection, true) },
        { label: "Copy style", rule: true, disabled: !has, run: () => s().copyStyle() },
        { label: "Paste style", disabled: !has, run: () => s().pasteStyle() },
        {
          label: "Arrange",
          rule: true,
          disabled: selection.length < 2,
          items: ARRANGEMENTS.map((a) => ({ label: a.label, run: () => arrangeSelection(a.id) })),
        },
        { label: "Bring to front", hint: "Ctrl+]", disabled: !has, run: () => s().reorder(selection, "front") },
        { label: "Send to back", hint: "Ctrl+[", disabled: !has, run: () => s().reorder(selection, "back") },
      ],
    };

    const view: Menu = {
      id: "view",
      label: "View",
      items: [
        { label: "Zoom in", hint: "+", run: () => s().setZoom(s().camera.zoom * 1.25) },
        { label: "Zoom out", hint: "−", run: () => s().setZoom(s().camera.zoom / 1.25) },
        { label: "Fit board", hint: "1", run: () => s().fitAll() },
        { label: "Fit selection", hint: "2", disabled: !has, run: () => s().fitSelection() },
        { label: "Actual size", hint: "0", run: () => s().resetView() },
        { label: "Minimap", rule: true, checked: ui.minimapOpen, run: () => s().setUi({ minimapOpen: !ui.minimapOpen }) },
        { label: "Animation timeline", checked: ui.timelineOpen, run: () => s().setUi({ timelineOpen: !ui.timelineOpen }) },
        { label: "Right panel", checked: ui.dockOpen, run: () => s().setUi({ dockOpen: !ui.dockOpen }) },
        { label: "Time-lapse replay", run: () => s().setUi({ timelapseOpen: true }) },
        {
          label: "Rendering",
          rule: true,
          items: (["sketch", "normal", "precision"] as const).map((m) => ({
            label: m[0].toUpperCase() + m.slice(1),
            checked: doc.settings.renderMode === m,
            run: () => s().setRenderMode(m),
          })),
        },
        { label: "Snap to objects", checked: doc.settings.snapToObjects, run: () => s().setSnap({ objects: !doc.settings.snapToObjects }) },
        { label: "Snap to grid", checked: doc.settings.snapToGrid, run: () => s().setSnap({ grid: !doc.settings.snapToGrid }) },
        { label: theme === "dark" ? "Light interface" : "Dark interface", rule: true, run: () => s().setTheme(theme === "dark" ? "light" : "dark") },
        { label: "Keyboard shortcuts", hint: "?", run: () => s().setUi({ shortcutsOpen: true }) },
        { label: "Command menu", hint: "Ctrl+K", run: () => s().setUi({ commandOpen: true }) },
      ],
    };

    const insert: Menu = {
      id: "insert",
      label: "Insert",
      items: [
        { label: "Text", hint: "T", run: add(() => createText(centre(), s().defaults)) },
        { label: "Sticky note", hint: "N", run: add(() => createNote(centre(), s().defaults.noteKind, s().defaults)) },
        { label: "Outline", hint: "B", run: add(() => createList(centre(), s().defaults)) },
        { label: "Table", run: add(() => createTable(centre(), s().defaults)) },
        { label: "Flashcard", run: add(() => createCard(centre(), s().defaults)) },
        { label: "Image…", hint: "I", rule: true, run: onInsertImage },
        { label: "Frame", hint: "F", run: () => s().setTool("frame") },
        { label: "Blocks, art & templates…", rule: true, run: () => s().setUi({ stampsOpen: true }) },
        { label: "Site Builder — whole pages…", run: () => s().setUi({ builderOpen: true }) },
        { label: "Paste a link", hint: "Ctrl+V", disabled: true },
      ],
    };

    const image: Menu = {
      id: "image",
      label: "Image",
      items: [
        { label: "Remove background (AI)", disabled: !hasImage, run: () => void removeBackground("ai") },
        { label: "Remove flat background (fast)", disabled: !hasImage, run: () => void removeBackground("key") },
        {
          label: "Vectorize",
          rule: true,
          disabled: !hasImage,
          items: TRACE_PRESETS.map((p) => ({ label: p.label, run: () => void vectorise(p.id) })),
        },
        { label: "Crop", disabled: !hasImage || selection.length !== 1, run: () => s().setCropId(selection[0]) },
        {
          label: "Clip image into shape",
          rule: true,
          disabled: !(objects.length === 2 && objects.some((o) => o.type === "image") && objects.some((o) => ["rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type))),
          run: () => {
            const img = objects.find((o) => o.type === "image");
            const shape = objects.find((o) => ["rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type));
            if (img && shape) s().clipImageIntoShape(img.id, shape.id);
          },
        },
        {
          label: "Release image from shape",
          disabled: !objects.some((o) => ["rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type) && o.data.src),
          run: () => {
            const shape = objects.find((o) => ["rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type) && o.data.src);
            if (shape) s().releaseImage(shape.id);
          },
        },
        { label: "Flip horizontal", rule: true, disabled: !has, run: () => s().flip("h") },
        { label: "Flip vertical", disabled: !has, run: () => s().flip("v") },
        { label: "Flatten to image", rule: true, disabled: !has, run: () => void flattenSelection() },
        { label: "Adjustments…", disabled: !has, run: () => s().openDock("effects") },
      ],
    };

    const effects: Menu = {
      id: "effects",
      label: "Effects",
      items: [
        ...PRESETS.filter((p) => p.id !== "none").map((p) => ({
          label: p.label,
          disabled: !has,
          run: () => {
            s().patchEffects(selection, null);
            s().patchEffects(selection, p.effects);
          },
        })),
        {
          label: "Shadow",
          rule: true,
          disabled: !has,
          items: SHADOW_PRESETS.map((p) => ({ label: p.label, run: () => s().setShadow(selection, p.spec) })),
        },
        { label: "Clear effects", disabled: !has, run: () => { s().patchEffects(selection, null); s().setShadow(selection, null); } },
        { label: "Effects panel…", rule: true, run: () => s().openDock("effects") },
      ],
    };

    const ai: Menu = {
      id: "ai",
      label: "AI",
      items: [
        {
          label: "Sketch → image",
          items: RENDER_STYLES.map((r) => ({ label: r.label, run: () => void sketchToImage(r.id) })),
        },
        { label: "Sketch → website", run: () => void sketchToSite() },
        {
          label: "Explain selection visually",
          disabled: !objects.some((o) => o.data.text?.trim() || o.data.items?.length),
          items: EXPLAIN_KINDS.map((k) => ({ label: k.label, run: () => void explainVisually(k.id) })),
        },
        { label: "Sketch → video (Veo)", run: () => void sketchToVideo() },
        { label: "AI panel…", rule: true, run: () => s().openDock("assist") },
      ],
    };

    const layer: Menu = {
      id: "layer",
      label: "Layer",
      items: [
        {
          label: "New Adjustment Layer",
          items: [
            { label: "Curves", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "curves" })) },
            { label: "Levels", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "levels" })) },
            { label: "Vibrance", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "vibrance" })) },
            { label: "Brightness / Contrast", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "brightnessContrast" })) },
            { label: "Exposure", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "exposure" })) },
            { label: "Hue / Saturation", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "hueSaturation" })) },
            { label: "Color Balance", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "colorBalance" })) },
            { label: "Black & White", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "blackAndWhite" })) },
            { label: "Invert", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "invert" })) },
            { label: "Threshold", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "threshold" })) },
            { label: "Posterize", run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.newAdjustment", { type: "posterize" })) },
          ],
        },
        { label: "Add Layer Mask", rule: true, disabled: !has, run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.addMask")) },
        { label: "Toggle Clipping Mask", hint: "Ctrl+Alt+G", disabled: !has, run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.toggleClipping")) },
        { label: "Convert to Smart Object", rule: true, disabled: !has, run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.convertToSmartObject")) },
        { label: "Rasterize Layer", disabled: !has, run: () => void import("../lib/commands/registry").then((r) => r.executeCommand("layer.rasterize")) },
        { label: "Duplicate Layer", hint: "Ctrl+D", rule: true, disabled: !has, run: () => s().duplicateSelection() },
        { label: "Delete Layer", hint: "Del", disabled: !has, run: () => s().deleteSelection() },
      ],
    };

    return [file, edit, view, insert, layer, image, effects, ai];
  }, [selection, doc, canUndo, canRedo, ui, theme, clipboard, onInsertImage, s]);
}

function Item({ item, close }: { item: MenuItem; close: () => void }) {
  if (item.items) {
    return (
      <div className={`menu-item has-sub${item.disabled ? " is-disabled" : ""}`}>
        <span>{item.label}</span>
        <span className="menu-arrow">›</span>
        <div className="menu-sub">
          {item.items.map((sub, i) => (
            <Item key={i} item={sub} close={close} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      className={`menu-item${item.disabled ? " is-disabled" : ""}${item.checked ? " is-checked" : ""}`}
      disabled={item.disabled}
      onClick={() => {
        close();
        item.run?.();
      }}
    >
      <span className="menu-check">{item.checked ? "✓" : ""}</span>
      <span>{item.label}</span>
      {item.hint && <kbd>{item.hint}</kbd>}
    </button>
  );
}

export function MenuBar({ onInsertImage }: { onInsertImage: () => void }) {
  const menus = useMenus(onInsertImage);
  const open = useStore((s) => s.ui.menuOpen);
  const setUi = useStore((s) => s.setUi);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setUi({ menuOpen: null });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUi({ menuOpen: null });
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setUi]);

  const close = () => setUi({ menuOpen: null });

  return (
    <nav className="menubar" ref={ref} aria-label="Menu">
      {menus.map((m) => (
        <div key={m.id} className={`menu${open === m.id ? " is-open" : ""}`}>
          <button
            type="button"
            className="menu-btn"
            onClick={() => setUi({ menuOpen: open === m.id ? null : m.id })}
            onPointerEnter={() => open && open !== m.id && setUi({ menuOpen: m.id })}
          >
            {m.label}
          </button>
          {open === m.id && (
            <div className="menu-pop" role="menu">
              {m.items.map((item, i) => (
                <div key={i} className={item.rule ? "menu-rule-wrap" : undefined}>
                  <Item item={item} close={close} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

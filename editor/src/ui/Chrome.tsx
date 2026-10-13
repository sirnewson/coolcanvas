import { useEffect, useRef, useState } from "react";

import { useStore } from "../store/store";
import { MenuBar } from "./MenuBar";
import { formatMeasure } from "../lib/theme";
import type { RenderMode } from "../types";
import { boundsOfObjects } from "../lib/geom";
import type { CanvasObject } from "../types";
import {
  IconBoards,
  IconExport,
  IconFilm,
  IconFit,
  IconGlobe,
  IconKeyboard,
  IconMap,
  IconMoon,
  IconMinus,
  IconPlus,
  IconPresent,
  IconRedo,
  IconStudioPhoto,
  IconStudioVector,
  IconSun,
  IconUndo,
} from "./icons";

export function Topbar({
  onInsertImage,
  compact,
  onToggleSpatial,
  isSpatial,
  onOpenStudio,
}: {
  onInsertImage: () => void;
  compact?: boolean;
  onToggleSpatial?: () => void;
  isSpatial?: boolean;
  onOpenStudio?: (studio: "photo" | "vector") => void;
}) {
  const name = useStore((s) => s.doc.name);
  const setBoardName = useStore((s) => s.setBoardName);
  const saveStatus = useStore((s) => s.saveStatus);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const minimapOpen = useStore((s) => s.ui.minimapOpen);
  const timelineOpen = useStore((s) => s.ui.timelineOpen);
  const theme = useStore((s) => s.theme);
  const state = useStore.getState;
  const [draft, setDraft] = useState(name);

  useEffect(() => setDraft(name), [name]);

  return (
    <header className="topbar" data-ui>
      <div className="topbar-left">
        <button
          type="button"
          className="home-btn"
          onClick={() => state().setUi({ home: true })}
          title="Gallery"
        >
          <span className="wordmark">
            Cool<span>CANVAS</span>
          </span>
        </button>
        {!compact && <MenuBar onInsertImage={onInsertImage} />}
        <input
          className="board-name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => setBoardName(draft.trim() || "Untitled board")}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          aria-label="Board name"
        />
        <span className={`save-status is-${saveStatus}`}>
          {saveStatus === "saved" ? "saved" : saveStatus === "saving" ? "saving…" : "offline"}
        </span>
      </div>

      <div className="topbar-right">
        {onOpenStudio && (
          <div className="topbar-group studio-switch">
            <button type="button" className="ghost" onClick={() => onOpenStudio("photo")} title="Photo Studio — layers, masks, adjustments, PSD">
              <IconStudioPhoto />
              <span>Photo</span>
            </button>
            <button type="button" className="ghost" onClick={() => onOpenStudio("vector")} title="Vector Studio — paths, boolean shapes, SVG and PDF">
              <IconStudioVector />
              <span>Vector</span>
            </button>
          </div>
        )}
        {onToggleSpatial && (
          <div className="topbar-group">
            <button
              type="button"
              className={`ghost${isSpatial ? " is-active" : ""}`}
              onClick={onToggleSpatial}
              title="Switch to 3D Spatial Canvas (CoolSketch)"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 700,
                fontSize: "12px",
                background: isSpatial ? "rgba(79, 227, 220, 0.18)" : "rgba(255, 255, 255, 0.06)",
                color: isSpatial ? "#4FE3DC" : "inherit",
                borderRadius: "18px",
                padding: "5px 12px",
              }}
            >
              <span style={{ fontSize: "14px" }}>🧊</span>
              <span>{isSpatial ? "2D Board" : "3D Spatial"}</span>
            </button>
          </div>
        )}
        <div className="topbar-group">
          <button
            type="button"
            className="ghost"
            disabled={!canUndo}
            onClick={() => state().undo()}
            title="Undo · Ctrl+Z"
            aria-label="Undo"
          >
            <IconUndo />
          </button>
          <button
            type="button"
            className="ghost"
            disabled={!canRedo}
            onClick={() => state().redo()}
            title="Redo · Ctrl+Shift+Z"
            aria-label="Redo"
          >
            <IconRedo />
          </button>
        </div>

        <div className="topbar-group">
          <button
            type="button"
            className={`ghost${minimapOpen ? " is-active" : ""}`}
            onClick={() => state().setUi({ minimapOpen: !minimapOpen })}
            title="Minimap"
            aria-label="Minimap"
          >
            <IconMap />
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => state().setUi({ boardsOpen: true })}
            title="Boards"
            aria-label="Boards"
          >
            <IconBoards />
          </button>
          <button
            type="button"
            className={`ghost${timelineOpen ? " is-active" : ""}`}
            onClick={() => state().setUi({ timelineOpen: !timelineOpen })}
            title="Animation timeline"
            aria-label="Animation timeline"
          >
            <IconFilm />
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => state().setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => state().setUi({ shortcutsOpen: true })}
            title="Keyboard shortcuts"
            aria-label="Keyboard shortcuts"
          >
            <IconKeyboard />
          </button>
        </div>

        {/* GPU Compositor indicator */}
        <div
          className="gpu-status-pill"
          title="Hardware accelerated compositor: WebGPU (wgpu) / Canvas2D"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "12px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#9ca3af",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: typeof navigator !== "undefined" && (navigator as any).gpu ? "#10b981" : "#eab308",
              boxShadow: typeof navigator !== "undefined" && (navigator as any).gpu ? "0 0 6px #10b981" : "none",
            }}
          />
          <span>wgpu</span>
        </div>

        {/* Quick PSD Import & Export buttons */}
        <button
          type="button"
          className="outline"
          title="Open Photoshop PSD file"
          onClick={() => void import("../lib/psd/psdActions").then((m) => m.openPsdDialog())}
        >
          <span>PSD</span>
        </button>

        <button
          type="button"
          className="outline"
          onClick={() => state().setUi({ builderOpen: true })}
          title="Site Builder — real sections, live preview, HTML out"
        >
          <IconGlobe />
          Site
        </button>
        <button
          type="button"
          className="outline"
          onClick={() => state().setUi({ presenting: true })}
          title="Present · Esc to exit"
        >
          <IconPresent />
          Present
        </button>
        <button type="button" className="primary" onClick={() => state().setUi({ exportOpen: true })}>
          <IconExport />
          Export
        </button>
        <span className="avatar" aria-hidden>
          Y
        </span>
      </div>
    </header>
  );
}

const ZOOM_STEPS = [0.25, 0.5, 1, 2, 4];

export function ZoomBar() {
  const zoom = useStore((s) => s.camera.zoom);
  const state = useStore.getState;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="zoombar" data-ui ref={ref}>
      <button type="button" onClick={() => state().setZoom(zoom / 1.25)} aria-label="Zoom out" title="Zoom out">
        <IconMinus />
      </button>
      <button
        type="button"
        className="zoom-value"
        onClick={() => setOpen((v) => !v)}
        title="Zoom presets"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" onClick={() => state().setZoom(zoom * 1.25)} aria-label="Zoom in" title="Zoom in">
        <IconPlus />
      </button>
      <span className="zoombar-rule" />
      <button type="button" onClick={() => state().fitAll()} title="Fit board · 1" aria-label="Fit board">
        <IconFit />
      </button>

      {open && (
        <div className="zoom-menu">
          {ZOOM_STEPS.map((z) => (
            <button key={z} type="button" onClick={pick(() => state().setZoom(z))}>
              {z * 100}%
            </button>
          ))}
          <span className="menu-rule" />
          <button type="button" onClick={pick(() => state().fitAll())}>
            Fit board <kbd>1</kbd>
          </button>
          <button type="button" onClick={pick(() => state().fitSelection())}>
            Fit selection <kbd>2</kbd>
          </button>
          <button type="button" onClick={pick(() => state().resetView())}>
            Reset view <kbd>0</kbd>
          </button>
        </div>
      )}
    </div>
  );
}

const MODES: RenderMode[] = ["sketch", "normal", "precision"];

/** Technical readout strip: what is selected, in board units. */
export function StatusBar() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const mode = useStore((s) => s.doc.settings.renderMode);
  const snapObjects = useStore((s) => s.doc.settings.snapToObjects);
  const snapGrid = useStore((s) => s.doc.settings.snapToGrid);
  const state = useStore.getState;

  const objects = selection
    .map((id) => doc.objects[id])
    .filter((o): o is CanvasObject => !!o);
  const box = boundsOfObjects(objects);
  const fmt = (v: number) => formatMeasure(v, doc.settings.unit, doc.settings.unitScale);

  return (
    <div className="statusbar" data-ui>
      <span className="status-cell">
        {doc.order.length} object{doc.order.length === 1 ? "" : "s"}
      </span>
      {box && (
        <span className="status-cell is-mono">
          {selection.length > 1 ? `${selection.length} selected · ` : ""}
          {fmt(box.width)} × {fmt(box.height)}
        </span>
      )}
      <span className="status-spacer" />
      <div className="status-modes">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={mode === m ? "is-active" : ""}
            onClick={() => state().setRenderMode(m)}
            title={`${m} mode`}
          >
            {m}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`status-toggle${snapObjects ? " is-on" : ""}`}
        onClick={() => state().setSnap({ objects: !snapObjects })}
        title="Snap to objects and guides"
      >
        snap
      </button>
      <button
        type="button"
        className={`status-toggle${snapGrid ? " is-on" : ""}`}
        onClick={() => state().setSnap({ grid: !snapGrid })}
        title="Snap to grid"
      >
        grid
      </button>
    </div>
  );
}

export function HintToast() {
  const hint = useStore((s) => s.ui.hint);
  if (!hint) return null;
  return (
    <div className="hint" role="status">
      {hint}
    </div>
  );
}

export function PresentBar() {
  const presenting = useStore((s) => s.ui.presenting);
  const setUi = useStore((s) => s.setUi);
  if (!presenting) return null;
  return (
    <div className="present-bar" data-ui>
      <span>Presenting</span>
      <button type="button" onClick={() => setUi({ presenting: false })}>
        Exit
      </button>
    </div>
  );
}

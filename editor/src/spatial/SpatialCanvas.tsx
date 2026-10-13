import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "./store/store";
import { SpatialViewport, frameAll, getEngine, setView } from "./ui/SpatialViewport";
import {
  CameraPanel, CreatePanel, DesignPanel, ExportPanel, LayersPanel, LightPanel,
  ObjectPanel, OutlinerPanel, RigPanel, ScenePanel, SetupPanel,
} from "./ui/SpatialPanels";
import { UNITS, formatLength } from "./ui/units";
import { SpatialControls } from "./ui/SpatialControls";
import type { ToolId, UnitSystem } from "./types";
import "./spatial.css";

/* ------------------------------------------------------------------ icons */

const I = (d: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const IconDraw = I(<><path d="M14.5 3.5 20.5 9.5 11 19a4 4 0 0 1-2.2 1.1l-3.6.6.6-3.6A4 4 0 0 1 6.9 15z" /><path d="m12.5 5.5 6 6" /></>);
const IconErase = I(<><path d="M8.5 20.5H20" /><path d="M15.5 3.7 3.7 15.5a2 2 0 0 0 0 2.8l2.3 2.2h5l10-10a2 2 0 0 0 0-2.8l-2.7-2.7a2 2 0 0 0-2.8 0Z" /></>);
const IconSelect = I(<><path d="M5.5 3.5 18 11.2l-5.3 1.4-2.3 5.1z" /><path d="m13.5 13.5 5.5 5.5" /></>);
const IconPull = I(<><path d="M4 16.5 12 20.5 20 16.5" /><path d="M4 16.5V12l8-4 8 4v4.5" /><path d="M12 8V2.5" /><path d="M9.5 5 12 2.5 14.5 5" /></>);
const IconPlane = I(<><path d="M2.5 15 12 19.5 21.5 15 12 10.5z" /><path d="M12 10.5V4" /><path d="m9 6.5 3-3 3 3" /></>);
const IconBack = I(<><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>);
const IconFrame = I(<><path d="M7.5 3.5v17" /><path d="M16.5 3.5v17" /><path d="M3.5 7.5h17" /><path d="M3.5 16.5h17" /></>);
const IconUndo = I(<><path d="M4 9.5h9.5a5.5 5.5 0 0 1 0 11H8" /><path d="M7.5 6 4 9.5 7.5 13" /></>);
const IconRedo = I(<><path d="M20 9.5h-9.5a5.5 5.5 0 0 0 0 11H16" /><path d="m16.5 6 3.5 3.5-3.5 3.5" /></>);

const TABS = [
  { id: "outliner", label: "Outliner" },
  { id: "create", label: "Create" },
  { id: "object", label: "Object" },
  { id: "rig", label: "Rig" },
  { id: "camera", label: "Camera" },
  { id: "lighting", label: "Light" },
  { id: "scene", label: "Scene" },
  { id: "design", label: "Brush" },
  { id: "layers", label: "Layers" },
  { id: "export", label: "Export" },
  { id: "setup", label: "Setup" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const TOOLS: { id: ToolId; label: string; key: string; icon: React.ReactNode }[] = [
  { id: "draw", label: "Draw", key: "B", icon: IconDraw },
  { id: "erase", label: "Erase", key: "E", icon: IconErase },
  { id: "select", label: "Select", key: "V", icon: IconSelect },
  { id: "pull", label: "Pull into form", key: "P", icon: IconPull },
  { id: "plane", label: "Move plane", key: "G", icon: IconPlane },
];

/* ================================================================== shell */

export interface SpatialCanvasProps {
  onBackTo2D?: () => void;
}

export function SpatialCanvas({ onBackTo2D }: SpatialCanvasProps) {
  const s = useStore();
  const [tab, setTab] = useState<TabId>("create");
  const [dockOpen, setDockOpen] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 1900);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* Selecting something jumps to the panel that can edit it — but never away
     from Create or Outliner unless user specifically selects a camera/light/object. */
  const selCount = s.selection.length;
  useEffect(() => {
    if (selCount === 1) {
      const obj = s.sketch.objects.find((o) => o.id === s.selection[0]);
      if (obj?.kind === "camera") {
        setTab("camera");
        return;
      }
      if (obj?.kind === "light") {
        setTab("lighting");
        return;
      }
    }
    if (selCount > 0) {
      setTab((t) => (t === "design" || t === "setup" ? "object" : t));
    }
  }, [selCount, s.selection, s.sketch.objects]);

  useEffect(() => {
    if (s.posing) {
      setTab("rig");
    }
  }, [s.posing]);

  /* Autosave, with a thumbnail that lags slightly behind. */
  useEffect(() => {
    if (!s.dirty || !s.prefs.autoSave) return;
    const t = window.setTimeout(() => {
      let thumb: string | undefined;
      try {
        if (s.sketch.objects.length) thumb = getEngine()?.thumbnail(420);
      } catch {
        /* a snapshot failure must never block saving the work */
      }
      void s.persist(thumb);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [s.dirty, s.sketch.objects.length, s.prefs.autoSave, s]);

  /* Shortcuts. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const st = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); st.redo(); return; }
      if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); st.selectAll(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); st.duplicateSelection(); return; }
      if (mod) return;
      switch (e.key.toLowerCase()) {
        case "b": st.setTool("draw"); break;
        case "e": st.setTool("erase"); break;
        case "v": st.setTool("select"); break;
        case "p": st.setTool("pull"); break;
        case "g": st.setTool("plane"); break;
        case "x": st.setSpace(st.space === "plane" ? "space" : "plane"); break;
        case "f": frameAll(); break;
        case "1": setView("front"); break;
        case "2": setView("right"); break;
        case "3": setView("top"); break;
        case "4": setView("iso"); break;
        case "[": st.setSize(st.size * 0.85); break;
        case "]": st.setSize(st.size * 1.18); break;
        case "tab": e.preventDefault(); document.body.classList.toggle("spatial-focus"); break;
        case "delete":
        case "backspace":
          if (st.selection.length) { e.preventDefault(); st.removeObjects(st.selection); }
          break;
        case "escape": st.clearSelection(); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const layer = s.sketch.layers.find((l) => l.id === s.sketch.activeLayer);

  return (
    <div className={`spatial${dockOpen ? "" : " dock-closed"}`}>
      <SpatialViewport toast={toast} />

      {/* ------------------------------------------------------- top bar */}
      <header className="topbar">
        <div className="topbar-left">
          <button className="ghost" onClick={onBackTo2D} title="Back to the flat canvas">
            {IconBack}
            <span>Canvas</span>
          </button>
          <span className="topbar-rule" />
          <input
            className="board-name"
            value={s.sketch.name}
            onChange={(e) => s.renameSketch(e.target.value)}
            aria-label="Sketch name"
          />
          <span className="save-status">{s.dirty ? "Saving…" : "Saved"}</span>
        </div>

        <div className="topbar-right">
          <div className="segmented is-compact">
            <button className={s.space === "plane" ? "is-active" : ""} onClick={() => s.setSpace("plane")} title="Draw on the construction plane">
              On plane
            </button>
            <button className={s.space === "space" ? "is-active" : ""} onClick={() => s.setSpace("space")} title="Draw on a sheet facing you">
              In space
            </button>
          </div>
          <span className="topbar-rule" />
          <div className="topbar-group">
            <button className="tool" onClick={s.undo} disabled={!s.past.length} title="Undo">{IconUndo}</button>
            <button className="tool" onClick={s.redo} disabled={!s.future.length} title="Redo">{IconRedo}</button>
            <button className="tool" onClick={() => frameAll()} title="Frame everything (F)">{IconFrame}</button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------- toolbar */}
      <nav className="toolbar show-keys" aria-label="Spatial tools">
        <div className="tool-group">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={s.tool === t.id ? "tool is-active" : "tool"}
              onClick={() => s.setTool(t.id)}
              title={`${t.label} · ${t.key}`}
              aria-label={t.label}
            >
              {t.icon}
              <span className="tool-key">{t.key}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ------------------------------------------------- depth / plane hud */}
      <div className="sp-hud">
        {s.space === "plane" ? (
          <div className="sp-hud-group">
            {(["ground", "front", "side"] as const).map((p) => (
              <button key={p} className={s.sketch.plane.preset === p ? "is-active" : ""} onClick={() => s.setPlanePreset(p)}>
                {p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
            <span className="sp-hud-sep" />
            <span className="sp-hud-read">{formatLength(s.sketch.plane.offset, s.sketch.units)}</span>
          </div>
        ) : (
          <div className="sp-hud-group">
            <span className="sp-hud-label">Depth</span>
            <input type="range" min={0.3} max={30} step={0.1} value={s.depth}
              onChange={(e) => s.setDepth(parseFloat(e.target.value))} aria-label="Drawing depth" />
            <span className="sp-hud-read">{formatLength(s.depth, s.sketch.units)}</span>
          </div>
        )}
      </div>

      <SpatialControls />

      {/* ----------------------------------------------------------- dock */}
      {dockOpen ? (
        <aside className="dock">
          <div className="dock-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                data-tab={t.id}
                className={tab === t.id ? "is-active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === "object" && selCount > 0 && <sup>{selCount}</sup>}
                {t.id === "outliner" && <sup>{s.sketch.objects.length}</sup>}
              </button>
            ))}
            <button className="dock-collapse" onClick={() => setDockOpen(false)} title="Hide the panel">›</button>
          </div>
          <div className="dock-body">
            {tab === "outliner" && <OutlinerPanel />}
            {tab === "create" && <CreatePanel toast={toast} />}
            {tab === "object" && <ObjectPanel />}
            {tab === "rig" && <RigPanel />}
            {tab === "camera" && <CameraPanel />}
            {tab === "lighting" && <LightPanel />}
            {tab === "scene" && <ScenePanel />}
            {tab === "design" && <DesignPanel />}
            {tab === "layers" && <LayersPanel />}
            {tab === "export" && <ExportPanel toast={toast} />}
            {tab === "setup" && <SetupPanel />}
          </div>
        </aside>
      ) : (
        <button className="dock-reopen" onClick={() => setDockOpen(true)} title="Show the panel">‹</button>
      )}

      {/* ------------------------------------------------------ status bar */}
      <footer className="statusbar">
        <span className="status-cell">{layer?.name ?? "—"}</span>
        <span className="status-cell">{s.space === "plane" ? `${s.sketch.plane.preset} plane` : "free space"}</span>
        <span className="status-cell is-mono">Brush {formatLength(s.size, s.sketch.units)}</span>
        {s.sketch.plane.snap && <span className="status-cell is-mono">Snap {formatLength(s.sketch.plane.grid, s.sketch.units)}</span>}
        <span className="status-spacer" />
        <span className="status-cell is-mono">
          {s.sketch.objects.length} object{s.sketch.objects.length === 1 ? "" : "s"}
          {selCount > 0 && ` · ${selCount} selected`}
        </span>
        <select className="sp-units" value={s.sketch.units} onChange={(e) => s.setUnits(e.target.value as UnitSystem)} aria-label="Units">
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </footer>

      {toastMsg && <div className="sp-toast">{toastMsg}</div>}
    </div>
  );
}

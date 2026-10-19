import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { useStore, type DockTab } from "../store/store";
import { Inspector } from "./Inspector";
import { LayersPanel } from "./LayersPanel";
import { AdjustmentsPanel } from "./studio/AdjustmentsPanel";
import { TypographyPanel } from "./studio/TypographyPanel";
import { ColorPanel } from "./studio/ColorPanel";
import { BrushesPanel } from "./studio/BrushesPanel";
import { CanvasSettings } from "./CanvasSettings";
import { Assistant } from "./Assistant";
import { EffectsPanel } from "./EffectsPanel";
import { Preferences } from "./Preferences";
import {
  IconChevron,
  IconGrid,
  IconLayers,
  IconSettings,
  IconSliders,
  IconSparkle,
  IconWand,
  IconText,
  IconDropper,
  IconPen,
} from "./icons";

const TABS: { id: DockTab; label: string; Icon: any; badge?: string }[] = [
  { id: "design", label: "Properties", Icon: IconSliders },
  { id: "adjustments", label: "Adjustments", Icon: () => <span>◐</span> },
  { id: "layers", label: "Layers", Icon: IconLayers },
  { id: "type", label: "Type", Icon: IconText },
  { id: "brushes", label: "Brushes", Icon: IconPen },
  { id: "color", label: "Color", Icon: IconDropper },
  { id: "effects", label: "Effects", Icon: IconWand },
  { id: "canvas", label: "Canvas", Icon: IconGrid },
  { id: "assist", label: "AI", Icon: IconSparkle },
  { id: "prefs", label: "Setup", Icon: IconSettings },
];

/** The panel body, shared by the desktop dock and the touch bottom sheet. */
export function DockBody({ tab }: { tab: DockTab }) {
  return (
    <div className="dock-body">
      {tab === "design" && <Inspector />}
      {tab === "adjustments" && <AdjustmentsPanel />}
      {tab === "layers" && <LayersPanel />}
      {tab === "type" && <TypographyPanel />}
      {tab === "brushes" && <BrushesPanel />}
      {tab === "color" && <ColorPanel />}
      {tab === "effects" && <EffectsPanel />}
      {tab === "canvas" && <CanvasSettings />}
      {tab === "assist" && <Assistant />}
      {tab === "prefs" && <Preferences />}
    </div>
  );
}

export function DockTabs({
  tab,
  onPick,
  aside,
}: {
  tab: DockTab;
  onPick(t: DockTab): void;
  aside?: ReactNode;
}) {
  const selectionCount = useStore((s) => s.selection.length);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <header className="dock-tabs">
      <div className="dock-tabs-scroll" ref={scrollRef} onWheel={handleWheel}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "is-active" : ""}
            onClick={() => onPick(t.id)}
            title={t.label}
          >
            <t.Icon />
            <span>{t.label}</span>
            {t.id === "design" && selectionCount > 1 && <sup>{selectionCount}</sup>}
          </button>
        ))}
      </div>
      {aside}
    </header>
  );
}

/**
 * The Photo Studio dock: Properties, Adjustments, Layers, Typography, Color, Setup.
 * Stretchable & resizable via drag handle on left edge.
 */
export function Dock() {
  const open = useStore((s) => s.ui.dockOpen);
  const tab = useStore((s) => s.ui.dockTab);
  const setUi = useStore((s) => s.setUi);

  const [dockWidth, setDockWidth] = useState<number>(() => {
    const saved = localStorage.getItem("yxm_dock_w");
    return saved ? Math.max(320, Math.min(720, Number(saved))) : 380;
  });
  const isResizing = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--dock-w", `${dockWidth}px`);
    try {
      localStorage.setItem("yxm_dock_w", String(dockWidth));
    } catch {
      /* ignore storage quota */
    }
  }, [dockWidth]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(300, Math.min(750, window.innerWidth - ev.clientX));
      setDockWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  if (!open) {
    return (
      <button
        type="button"
        className="dock-reopen"
        data-ui
        onClick={() => setUi({ dockOpen: true })}
        title="Show panel"
      >
        <IconChevron style={{ transform: "rotate(180deg)" }} />
      </button>
    );
  }

  return (
    <aside className="dock" style={{ width: `${dockWidth}px` }} data-ui>
      <div
        className="dock-resize-handle"
        onMouseDown={startResize}
        title="Drag left/right to stretch panel width"
      />
      <DockTabs
        tab={tab}
        onPick={(t) => setUi({ dockTab: t })}
        aside={
          <button
            type="button"
            className="dock-collapse"
            onClick={() => setUi({ dockOpen: false })}
            title="Hide panel"
          >
            <IconChevron />
          </button>
        }
      />
      <DockBody tab={tab} />
    </aside>
  );
}

/**
 * Touch layout: bottom sheet for tablets and phones.
 */
export function DockSheet() {
  const open = useStore((s) => s.ui.sheetOpen);
  const tab = useStore((s) => s.ui.dockTab);
  const setUi = useStore((s) => s.setUi);

  return (
    <div className={`sheet${open ? " is-open" : ""}`} data-ui>
      <div className="sheet-grip" onClick={() => setUi({ sheetOpen: !open })}>
        <i />
      </div>
      <DockTabs
        tab={tab}
        onPick={(t) => setUi({ dockTab: t, sheetOpen: true })}
        aside={
          open ? (
            <button
              type="button"
              className="dock-collapse"
              onClick={() => setUi({ sheetOpen: false })}
              title="Close"
            >
              <IconChevron style={{ transform: "rotate(90deg)" }} />
            </button>
          ) : undefined
        }
      />
      {open && <DockBody tab={tab} />}
    </div>
  );
}

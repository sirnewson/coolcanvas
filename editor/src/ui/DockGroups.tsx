import { useCallback, useEffect, useRef, useState } from "react";

import { useStore, type DockTab } from "../store/store";
import { DockBody } from "./Dock";
import { IconChevron } from "./icons";

/**
 * The panel dock, arranged the way a photo editor arranges one: several groups
 * stacked down the side, each with its own tab strip, each collapsible, and the
 * whole column resizable. Opening a studio then changes the document, not the
 * shape of the window.
 *
 * Panel names follow the studios' own names, so the same thing is called the
 * same thing in all three workspaces.
 */

interface Group {
  id: string;
  /** Shown on the group's header when it is collapsed. */
  title: string;
  tabs: { id: DockTab; label: string }[];
}

const GROUPS: Group[] = [
  {
    id: "color",
    title: "Color",
    tabs: [
      { id: "color", label: "Color" },
      { id: "brushes", label: "Brushes" },
    ],
  },
  {
    id: "properties",
    title: "Properties",
    tabs: [
      { id: "design", label: "Properties" },
      { id: "adjustments", label: "Adjustments" },
      { id: "type", label: "Type" },
      { id: "effects", label: "Effects" },
    ],
  },
  {
    id: "layers",
    title: "Layers",
    tabs: [{ id: "layers", label: "Layers" }],
  },
  {
    id: "document",
    title: "Document",
    tabs: [
      { id: "canvas", label: "Canvas" },
      { id: "assist", label: "AI" },
      { id: "prefs", label: "Setup" },
    ],
  },
];

const OPEN_KEY = "coolcanvas:dock-groups";
const ACTIVE_KEY = "coolcanvas:dock-active";

function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function DockGroups() {
  const open = useStore((s) => s.ui.dockOpen);
  const setUi = useStore((s) => s.setUi);
  const selectionCount = useStore((s) => s.selection.length);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    stored(OPEN_KEY, { color: false, properties: true, layers: true, document: false }),
  );
  const [active, setActive] = useState<Record<string, DockTab>>(() =>
    stored(ACTIVE_KEY, { color: "color", properties: "design", layers: "layers", document: "canvas" } as Record<string, DockTab>),
  );
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem("yxm_dock_w");
    return saved ? Math.max(300, Math.min(750, Number(saved))) : 340;
  });
  const resizing = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--dock-w", `${width}px`);
    try {
      localStorage.setItem("yxm_dock_w", String(width));
      localStorage.setItem(OPEN_KEY, JSON.stringify(openGroups));
      localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
    } catch {
      /* storage can be disabled */
    }
  }, [width, openGroups, active]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      if (resizing.current) setWidth(Math.max(300, Math.min(750, window.innerWidth - ev.clientX)));
    };
    const up = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, []);

  if (!open) {
    return (
      <button type="button" className="dock-reopen" data-ui onClick={() => setUi({ dockOpen: true })} title="Show the panels">
        <IconChevron style={{ transform: "rotate(180deg)" }} />
      </button>
    );
  }

  return (
    <aside className="dock is-grouped" style={{ width: `${width}px` }} data-ui>
      <div className="dock-resize-handle" onMouseDown={startResize} title="Drag to resize the panels" />

      <div className="dock-groups">
        {GROUPS.map((group) => {
          const isOpen = openGroups[group.id] !== false;
          const current = active[group.id] ?? group.tabs[0].id;
          return (
            <section key={group.id} className={`panel-group${isOpen ? " is-open" : ""}`}>
              <header className="panel-group-bar">
                <button
                  type="button"
                  className="panel-group-twisty"
                  onClick={() => setOpenGroups((g) => ({ ...g, [group.id]: !isOpen }))}
                  title={isOpen ? `Collapse ${group.title}` : `Expand ${group.title}`}
                  aria-expanded={isOpen}
                >
                  <IconChevron style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                </button>
                <div className="panel-tabs">
                  {group.tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={current === t.id && isOpen ? "is-active" : ""}
                      onClick={() => {
                        setActive((a) => ({ ...a, [group.id]: t.id }));
                        setOpenGroups((g) => ({ ...g, [group.id]: true }));
                        setUi({ dockTab: t.id });
                      }}
                    >
                      {t.label}
                      {t.id === "design" && selectionCount > 1 && <sup>{selectionCount}</sup>}
                    </button>
                  ))}
                </div>
              </header>
              {isOpen && (
                <div className="panel-group-body">
                  <DockBody tab={current} />
                </div>
              )}
            </section>
          );
        })}
      </div>

      <button type="button" className="dock-collapse is-foot" onClick={() => setUi({ dockOpen: false })} title="Hide the panels">
        <IconChevron />
      </button>
    </aside>
  );
}

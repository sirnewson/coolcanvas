import { useEffect, useMemo, useRef, useState } from "react";

import { useStore } from "../store/store";
import { DEFAULT_STYLE, STAMPS, createIcon, type Stamp } from "../store/factory";
import { WEB_STAMPS } from "../lib/webkit";
import { StockPanel } from "./StockPanel";
import { RECIPES, RECIPE_GROUPS } from "../lib/recipes";
import { smartInsert } from "../lib/explain";
import { ILLUSTRATIONS, ILLUSTRATION_GROUPS, type Illustration } from "../lib/illustrations";
import { TEMPLATES, type Template } from "../lib/templates";
import { boundsOfObjects, objectBounds, screenToWorld } from "../lib/geom";
import { measureImage, pickImageFiles, readFileAsDataUrl } from "../lib/images";
import type { CanvasObject } from "../types";
import { BACKGROUNDS } from "../lib/theme";

/* ------------------------------------------------------------ object menu */

export function ObjectMenu() {
  const menu = useStore((s) => s.ui.menu);
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);
  const state = useStore.getState;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => state().setUi({ menu: null });
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [menu, state]);

  const fillSlot = async (id: string) => {
    const files = await pickImageFiles();
    if (!files[0]) return;
    const src = await readFileAsDataUrl(files[0]);
    const size = await measureImage(src);
    state().fillPlaceholder(id, src, size.width, size.height);
  };

  const replaceImage = async (id: string) => {
    const files = await pickImageFiles();
    if (!files[0]) return;
    const src = await readFileAsDataUrl(files[0]);
    const size = await measureImage(src);
    state().patchData(id, {
      src,
      naturalWidth: size.width,
      naturalHeight: size.height,
      crop: undefined,
    });
  };

  if (!menu || !selection.length) return null;
  const single = selection.length === 1 ? doc.objects[selection[0]] : undefined;
  const run = (fn: () => void) => () => {
    state().setUi({ menu: null });
    fn();
  };

  const items: ({ label: string; hint?: string; run: () => void } | "rule")[] = [
    { label: "Cut", hint: "Ctrl+X", run: run(() => state().cutSelection()) },
    { label: "Copy", hint: "Ctrl+C", run: run(() => state().copySelection()) },
    { label: "Paste", hint: "Ctrl+V", run: run(() => state().pasteClipboard()) },
    { label: "Duplicate", hint: "Ctrl+D", run: run(() => state().duplicateSelection()) },
    "rule",
    { label: "Copy style", run: run(() => state().copyStyle()) },
    { label: "Paste style", run: run(() => state().pasteStyle()) },
    { label: "Select same type", run: run(() => state().selectSame()) },
    "rule",
    { label: "Bring to front", hint: "Ctrl+]", run: run(() => state().reorder(selection, "front")) },
    { label: "Send to back", hint: "Ctrl+[", run: run(() => state().reorder(selection, "back")) },
    { label: "Flip horizontally", run: run(() => state().flip("h")) },
    { label: "Flip vertically", run: run(() => state().flip("v")) },
    "rule",
    ...(selection.length > 1
      ? [{ label: "Group", hint: "Ctrl+G", run: run(() => state().group()) }]
      : []),
    ...(single?.type === "group"
      ? [{ label: "Ungroup", hint: "Ctrl+Shift+G", run: run(() => state().ungroup()) }]
      : []),
    ...(single?.type === "placeholder"
      ? [{ label: "Choose an image…", run: run(() => fillSlot(single.id)) }]
      : []),
    ...(single?.type === "card"
      ? [
          {
            label: single.data.flipped ? "Show the front" : "Show the back",
            run: run(() => state().patchData(single.id, { flipped: !single.data.flipped })),
          },
        ]
      : []),
    ...(single?.type === "table"
      ? [
          {
            label: "Add a row",
            run: run(() => {
              const rows = [...(single.data.rows ?? [])];
              rows.push(new Array(rows[0]?.length ?? 1).fill(""));
              state().patchData(single.id, { rows });
              state().patchObject(single.id, { height: rows.length * 38 });
            }),
          },
          {
            label: "Add a column",
            run: run(() => {
              const rows = (single.data.rows ?? []).map((r) => [...r, ""]);
              state().patchData(single.id, { rows });
              state().patchObject(single.id, { width: single.width + 150 });
            }),
          },
        ]
      : []),
    ...(single?.type === "image"
      ? [
          { label: "Replace the image…", run: run(() => replaceImage(single.id)) },
          { label: "Crop", run: run(() => state().setCropId(single.id)) },
          {
            label: single.data.trace ? "Leave trace mode" : "Trace over this",
            run: run(() => {
              state().patchData(single.id, { trace: !single.data.trace });
              state().patchObject(single.id, { locked: !single.data.trace });
            }),
          },
        ]
      : []),
    "rule",
    {
      label: single?.locked ? "Unlock" : "Lock",
      hint: "Ctrl+L",
      run: run(() => state().setLocked(selection, !single?.locked)),
    },
    { label: "Hide", run: run(() => state().setHidden(selection, true)) },
    "rule",
    { label: "Delete", hint: "Del", run: run(() => state().deleteSelection()) },
  ];

  return (
    <div
      ref={ref}
      className="object-menu"
      data-ui
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item === "rule" ? (
          <span key={`r${i}`} className="menu-rule" />
        ) : (
          <button key={item.label} type="button" onClick={item.run}>
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- minimap */

export function Minimap() {
  const doc = useStore((s) => s.doc);
  const camera = useStore((s) => s.camera);
  const viewport = useStore((s) => s.viewport);
  const open = useStore((s) => s.ui.minimapOpen);
  const presenting = useStore((s) => s.ui.presenting);
  const state = useStore.getState;

  const objects = useMemo(
    () =>
      doc.order
        .map((id) => doc.objects[id])
        .filter((o): o is CanvasObject => !!o && !o.hidden && o.type !== "group"),
    [doc],
  );

  const world = useMemo(() => {
    const b = boundsOfObjects(objects);
    const view = {
      x: -camera.x / camera.zoom,
      y: -camera.y / camera.zoom,
      width: viewport.width / camera.zoom,
      height: viewport.height / camera.zoom,
    };
    if (!b) return view;
    const x = Math.min(b.x, view.x);
    const y = Math.min(b.y, view.y);
    return {
      x,
      y,
      width: Math.max(b.x + b.width, view.x + view.width) - x,
      height: Math.max(b.y + b.height, view.y + view.height) - y,
    };
  }, [objects, camera, viewport]);

  if (!open || presenting || !objects.length) return null;

  const W = 168;
  const H = 108;
  const pad = 8;
  const scale = Math.min((W - pad * 2) / (world.width || 1), (H - pad * 2) / (world.height || 1));
  const ox = pad + ((W - pad * 2) - world.width * scale) / 2;
  const oy = pad + ((H - pad * 2) - world.height * scale) / 2;
  const map = (x: number, y: number) => ({ x: ox + (x - world.x) * scale, y: oy + (y - world.y) * scale });

  const view = map(-camera.x / camera.zoom, -camera.y / camera.zoom);
  const dark = BACKGROUNDS[doc.settings.background].dark;

  return (
    <div className="minimap" data-ui>
      <svg
        width={W}
        height={H}
        onPointerDown={(e) => {
          const rect = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          const wx = world.x + (e.clientX - rect.left - ox) / scale;
          const wy = world.y + (e.clientY - rect.top - oy) / scale;
          state().centerOn({ x: wx, y: wy });
        }}
      >
        <rect width={W} height={H} fill={dark ? "#1b2836" : "#f2f1ec"} />
        {objects.map((o) => {
          const b = objectBounds(o);
          const p = map(b.x, b.y);
          const isFrame = o.type === "frame";
          return (
            <rect
              key={o.id}
              x={p.x}
              y={p.y}
              width={Math.max(1.5, b.width * scale)}
              height={Math.max(1.5, b.height * scale)}
              fill={isFrame ? "none" : dark ? "#7f9ab4" : "#a9a89f"}
              stroke={isFrame ? (dark ? "#7f9ab4" : "#8f8e86") : "none"}
              strokeWidth={0.8}
              rx={1}
            />
          );
        })}
        <rect
          x={view.x}
          y={view.y}
          width={(viewport.width / camera.zoom) * scale}
          height={(viewport.height / camera.zoom) * scale}
          fill="rgba(47,107,216,0.12)"
          stroke="#2f6bd8"
          strokeWidth={1}
        />
      </svg>
      <button
        type="button"
        className="minimap-close"
        title="Hide minimap"
        onClick={() => state().setUi({ minimapOpen: false })}
      >
        ×
      </button>
    </div>
  );
}

/* ----------------------------------------------------------- insert panel */

type InsertTab = "recipes" | "stamps" | "web" | "images" | "art" | "templates";

/** Vector thumbnail of a stamp — the blocks it is made of, to scale. */
const stampPreviewCache = new Map<string, CanvasObject[]>();
function StampPreview({ stamp }: { stamp: Stamp }) {
  let objects = stampPreviewCache.get(stamp.id);
  if (!objects) {
    objects = stamp.build({ x: 0, y: 0 }, DEFAULT_STYLE);
    stampPreviewCache.set(stamp.id, objects);
  }
  const W = 104;
  const H = 64;
  const pad = 6;
  const scale = Math.min((W - pad * 2) / Math.max(1, stamp.width), (H - pad * 2) / Math.max(1, stamp.height));
  const ox = pad + (W - pad * 2 - stamp.width * scale) / 2;
  const oy = pad + (H - pad * 2 - stamp.height * scale) / 2;
  return (
    <svg className="stamp-preview" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      {objects.slice(0, 120).map((o, i) => {
        const b = objectBounds(o);
        const fill =
          o.type === "text"
            ? o.style.color ?? "#1c1c1a"
            : o.type === "placeholder"
              ? "#e6e4de"
              : o.style.fill && o.style.fill !== "transparent"
                ? o.style.fill
                : "none";
        const stroke = o.type === "text" ? "none" : o.style.stroke && o.style.stroke !== "transparent" ? o.style.stroke : "none";
        const h = o.type === "text" ? Math.max(1, Math.min(b.height * scale, (o.style.fontSize ?? 12) * scale * 0.7)) : Math.max(1, b.height * scale);
        const w = o.type === "text" ? Math.min(b.width * scale, ((o.data.text?.length ?? 8) * (o.style.fontSize ?? 12) * 0.55) * scale) : Math.max(1, b.width * scale);
        return (
          <rect
            key={i}
            x={ox + b.x * scale}
            y={oy + b.y * scale + (o.type === "text" ? (b.height * scale - h) / 2 : 0)}
            width={w}
            height={h}
            fill={fill}
            stroke={stroke}
            strokeWidth={0.6}
            rx={o.type === "ellipse" ? Math.min(w, h) / 2 : Math.min(2, (o.style.radius ?? 0) * scale)}
            opacity={o.type === "text" ? 0.7 : 1}
          />
        );
      })}
    </svg>
  );
}

/**
 * Everything you can drop onto the board in one click: rough UI blocks,
 * line illustrations, and whole starter layouts.
 */
export function InsertPanel() {
  const open = useStore((s) => s.ui.stampsOpen);
  const [tab, setTab] = useState<InsertTab>("recipes");
  const [search, setSearch] = useState("");
  const [grouping, setGrouping] = useState(true);
  const state = useStore.getState;
  if (!open) return null;
  const q = search.trim().toLowerCase();
  const hit = (...parts: (string | undefined)[]) => !q || parts.some((p) => p?.toLowerCase().includes(q));

  const centre = () => {
    const { viewport, camera } = useStore.getState();
    return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
  };

  const place = (objects: CanvasObject[], name: string, group = true) => {
    if (!objects.length) return;
    state().addObjects(objects, false);
    state().setSelection(objects.filter((o) => !o.parentId).map((o) => o.id));
    if (group && grouping && objects.length > 1) state().group();
    state().flashHint(`${name} added`);
  };

  const placeStamp = (stamp: Stamp) => {
    const c = centre();
    place(
      stamp.build({ x: c.x - stamp.width / 2, y: c.y - stamp.height / 2 }, useStore.getState().defaults),
      stamp.label,
    );
  };

  const placeIllustration = (art: Illustration) => {
    place([createIcon(centre(), art, useStore.getState().defaults)], art.label, false);
  };

  const placeTemplate = (template: Template) => {
    const c = centre();
    const objects = template.build({ x: c.x - 300, y: c.y - 200 }, useStore.getState().defaults);
    state().addObjects(objects, false);
    state().setSelection(objects.filter((o) => !o.parentId).map((o) => o.id));
    state().flashHint(template.note);
    window.setTimeout(() => state().fitSelection(), 30);
  };

  const stampGroups = [...new Set(STAMPS.map((s) => s.group))];

  return (
    <div className="stamps" data-ui>
      <header>
        <h3>Insert</h3>
        <button type="button" onClick={() => state().setUi({ stampsOpen: false })} aria-label="Close">
          ×
        </button>
      </header>
      <div className="insert-tabs">
        {(
          [
            ["recipes", "Recipes"],
            ["stamps", "Blocks"],
            ["web", "Web"],
            ["images", "Images"],
            ["art", "Art"],
            ["templates", "Templates"],
          ] as [InsertTab, string][]
        ).map(([id, labelText]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "is-active" : ""}
            onClick={() => setTab(id)}
          >
            {labelText}
          </button>
        ))}
      </div>

      <div className="insert-tools">
        <input
          className="insert-search"
          placeholder="Search — or type an idea and press ✦"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim()) void smartInsert(search.trim(), centre());
          }}
        />
        <button
          type="button"
          className="insert-smart"
          disabled={!search.trim()}
          onClick={() => void smartInsert(search.trim(), centre())}
          title="Smart insert — turn what you typed into a connected chain"
        >
          ✦
        </button>
        <button
          type="button"
          className={`insert-toggle${grouping ? " is-on" : ""}`}
          onClick={() => setGrouping((v) => !v)}
          title={grouping ? "Blocks arrive grouped — click to insert loose parts" : "Blocks arrive as loose parts — click to group them"}
        >
          {grouping ? "Grouped" : "Loose"}
        </button>
      </div>
      <div className="stamps-body">
        {tab === "recipes" && (
          <>
            <p className="insert-blurb">Small thinking structures. Every box and arrow stays editable; arrows re-route when you move things.</p>
            {RECIPE_GROUPS.map((g) => (
              <div key={g} className="stamp-group">
                <h4>{g}</h4>
                <div className="recipe-list">
                  {RECIPES.filter((r) => r.group === g && hit(r.label, r.group)).map((r) => (
                    <button key={r.id} type="button" className="recipe" onClick={() => placeStamp(r)} title={`Insert ${r.label}`}>
                      <StampPreview stamp={r} />
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="insert-smart-hint">
              <b>✦ Smart insert</b>
              <span>Type “checkout flow” or “how solar panels work” in the search box and press Enter — you get a connected chain to edit.</span>
            </div>
          </>
        )}
        {tab === "images" && <StockPanel />}
        {tab === "web" && (
          <button type="button" className="web-builder-cta" onClick={() => state().setUi({ stampsOpen: false, builderOpen: true })}>
            <b>Open Site Builder</b>
            <span>111 real sections · live preview · export HTML</span>
          </button>
        )}
        {tab === "web" &&
          [...new Set(WEB_STAMPS.map((s) => s.group))].map((g) => (
            <div key={g} className="stamp-group">
              <h4>{g.replace("Web · ", "")}</h4>
              <div className="web-grid">
                {WEB_STAMPS.filter((s) => s.group === g && hit(s.label, s.group)).map((s) => (
                  <button key={s.id} type="button" className="web-tile" onClick={() => placeStamp(s)} title={`Insert ${s.label}`}>
                    <StampPreview stamp={s} />
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        {tab === "stamps" &&
          stampGroups.map((g) => (
            <div key={g} className="stamp-group">
              <h4>{g}</h4>
              <div className="stamp-grid">
                {STAMPS.filter((s) => s.group === g && hit(s.label, s.group)).map((s) => (
                  <button key={s.id} type="button" onClick={() => placeStamp(s)} title={`Insert ${s.label}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ))}

        {tab === "art" &&
          ILLUSTRATION_GROUPS.map((g) => (
            <div key={g} className="stamp-group">
              <h4>{g}</h4>
              <div className="art-grid">
                {ILLUSTRATIONS.filter((i) => i.group === g && hit(i.label, i.group)).map((art) => (
                  <button
                    key={art.id}
                    type="button"
                    title={art.label}
                    onClick={() => placeIllustration(art)}
                  >
                    <svg viewBox="0 0 100 100" width="28" height="28" aria-hidden>
                      <path
                        d={art.path}
                        fill={art.filled ? "currentColor" : "none"}
                        stroke={art.filled ? "none" : "currentColor"}
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <em>{art.label}</em>
                  </button>
                ))}
              </div>
            </div>
          ))}

        {tab === "templates" && (
          <div className="template-list">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => placeTemplate(t)}>
                <strong>{t.label}</strong>
                <span>{t.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

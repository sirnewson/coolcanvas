import { useCallback, useEffect, useState } from "react";

import { useStore } from "../store/store";
import { deleteBoard, listBoards, saveBoard } from "../persist/idb";
import { TEMPLATES } from "../lib/templates";
import { exportBoardFile, pickBoardFile } from "../lib/file";
import { objectBounds } from "../lib/geom";
import { BACKGROUNDS } from "../lib/theme";
import type { BoardDoc, CanvasObject, PageSize } from "../types";
import { uid } from "../lib/id";
import { NumberField } from "./controls";
import { SketchStarter } from "./Studio";
import { SITE_TEMPLATES, siteFromTemplate } from "../builder/templates";
import { THEMES } from "../builder/LiveSections";
import { emptyDoc } from "../store/store";
import { DEFAULT_STYLE } from "../store/factory";

/** Templates preview exactly like recents: a throwaway doc built once per template. */
let templateDocs: BoardDoc[] | null = null;
function templatePreviews(): BoardDoc[] {
  if (templateDocs) return templateDocs;
  templateDocs = TEMPLATES.map((t) => {
    const doc = emptyDoc(t.label);
    for (const o of t.build({ x: 0, y: 0 }, DEFAULT_STYLE)) {
      doc.objects[o.id] = o;
      doc.order.push(o.id);
    }
    return doc;
  });
  return templateDocs;
}

type HomeView = "home" | "new" | "templates" | "canvases" | "starred";

/** One-path icons keep the sidebar light; the set is small and consistent. */
function Ico({ d }: { d: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const PRESETS: (PageSize | null)[] = [
  null,
  { label: "Square", width: 1080, height: 1080 },
  { label: "Portrait", width: 1080, height: 1350 },
  { label: "Story", width: 1080, height: 1920 },
  { label: "Wide", width: 1920, height: 1080 },
  { label: "Desktop", width: 1440, height: 900 },
  { label: "Phone", width: 390, height: 844 },
  { label: "A4", width: 794, height: 1123 },
];

/** Vector thumbnail built from object bounds — cheap, offline, always fresh. */
function Preview({ board }: { board: BoardDoc }) {
  const objects = board.order
    .map((id) => board.objects[id])
    .filter((o): o is CanvasObject => !!o && !o.hidden && o.type !== "group");
  const theme = BACKGROUNDS[board.settings.background];
  const W = 260;
  const H = 150;
  if (!objects.length) {
    return (
      <span className="board-preview is-empty" style={{ background: theme.surface }}>
        empty
      </span>
    );
  }
  const xs = objects.map((o) => objectBounds(o));
  const x0 = Math.min(...xs.map((b) => b.x));
  const y0 = Math.min(...xs.map((b) => b.y));
  const x1 = Math.max(...xs.map((b) => b.x + b.width));
  const y1 = Math.max(...xs.map((b) => b.y + b.height));
  const pad = 12;
  const scale = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (H - pad * 2) / Math.max(1, y1 - y0));
  const ox = pad + (W - pad * 2 - (x1 - x0) * scale) / 2;
  const oy = pad + (H - pad * 2 - (y1 - y0) * scale) / 2;

  const colour = (o: CanvasObject) => {
    if (o.type === "note") return o.style.fill ?? "#fdf0b8";
    if (o.type === "image" || o.type === "embed") return "#c9c7bd";
    if (o.type === "frame") return "none";
    if (o.type === "text" || o.type === "list") return theme.dark ? "#93a7bb" : "#8f8e86";
    return o.style.fill && o.style.fill !== "transparent" ? o.style.fill : theme.dark ? "#7f9ab4" : "#a9a89f";
  };

  return (
    <svg className="board-preview" viewBox={`0 0 ${W} ${H}`} style={{ background: theme.surface }}>
      {objects.slice(0, 160).map((o) => {
        const b = objectBounds(o);
        return (
          <rect
            key={o.id}
            x={ox + (b.x - x0) * scale}
            y={oy + (b.y - y0) * scale}
            width={Math.max(1.5, b.width * scale)}
            height={Math.max(1.5, b.height * scale)}
            fill={colour(o)}
            stroke={o.type === "frame" ? (theme.dark ? "#7f9ab4" : "#8f8e86") : "none"}
            strokeWidth={0.8}
            rx={1}
          />
        );
      })}
    </svg>
  );
}

export function Home({ onOpenSpatial }: { onOpenSpatial?: () => void }) {
  const open = useStore((s) => s.ui.home);
  const currentId = useStore((s) => s.doc.id);
  const state = useStore.getState;
  const [boards, setBoards] = useState<BoardDoc[]>([]);
  const [custom, setCustom] = useState({ width: 1200, height: 800 });
  const [customOpen, setCustomOpen] = useState(false);
  const [view, setView] = useState<HomeView>("home");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    const current = useStore.getState().doc;
    if (current.order.length) await saveBoard(current);
    setBoards((await listBoards()).sort((a, b) => b.updatedAt - a.updatedAt));
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!open) return null;

  const enter = () => state().setUi({ home: false });

  const startBoard = async (page: PageSize | null, name?: string) => {
    await refresh();
    state().newBoard(name ?? (page ? `${page.label} board` : "Untitled board"));
    if (page) state().setPage(page);
    enter();
    window.setTimeout(() => (page ? state().fitAll() : state().resetView()), 20);
  };

  const startTemplate = async (id: string) => {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    await refresh();
    state().newBoard(template.label);
    const objects = template.build({ x: 0, y: 0 }, useStore.getState().defaults);
    state().addObjects(objects, false);
    enter();
    window.setTimeout(() => state().fitAll(), 20);
  };

  const openBoard = async (board: BoardDoc) => {
    await refresh();
    state().loadDoc(board);
    enter();
    window.setTimeout(() => state().fitAll(), 20);
  };

  const duplicate = async (board: BoardDoc) => {
    const copy: BoardDoc = {
      ...JSON.parse(JSON.stringify(board)),
      id: uid("board"),
      name: `${board.name} copy`,
      updatedAt: Date.now(),
    };
    await saveBoard(copy);
    setBoards((list) => [copy, ...list]);
  };

  const importFile = async () => {
    const doc = await pickBoardFile();
    if (!doc) {
      state().flashHint("That file could not be read as a board");
      return;
    }
    await saveBoard(doc);
    await openBoard(doc);
  };

  const q = search.trim().toLowerCase();
  const shownBoards = q ? boards.filter((b) => b.name.toLowerCase().includes(q)) : boards;
  const shownTemplates = q ? TEMPLATES.filter((t) => t.label.toLowerCase().includes(q)) : TEMPLATES;
  const shownSites = q ? SITE_TEMPLATES.filter((t) => t.label.toLowerCase().includes(q)) : SITE_TEMPLATES;
  const showAll = view === "home";

  /** Everything this canvas can make. Each one opens the surface that does it. */
  const openTool = (patch: Record<string, unknown>) => {
    state().setUi({ home: false, ...patch });
  };
  const TOOLS: { id: string; label: string; blurb: string; icon: React.ReactNode; run: () => void }[] = [
    {
      id: "spatial", label: "3D Spatial", blurb: "Sketch on planes, pull outlines into form, place solids and models",
      icon: <Ico d="M12 2.8 20.5 7.4v9.2L12 21.2 3.5 16.6V7.4M3.5 7.4 12 12l8.5-4.6M12 12v9.2" />,
      run: () => onOpenSpatial?.(),
    },
    {
      id: "ai", label: "AI sketch", blurb: "Describe an idea and get a board to edit",
      icon: <Ico d="m12 3.5 1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9zM18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2" />,
      run: () => openTool({ dockOpen: true, dockTab: "assist" }),
    },
    {
      id: "site", label: "Site Builder", blurb: "111 real sections, live preview, export HTML",
      icon: <Ico d="M3.5 6.5h17v12h-17zM3.5 10h17M6.5 8.2h.01M9 8.2h.01" />,
      run: () => openTool({ builderOpen: true }),
    },
    {
      id: "images", label: "Images & stock", blurb: "Search the stock library, cut out, trace and place",
      icon: <Ico d="M3.5 5.5h17v13h-17zM3.5 15l5-4.5 4 3.5 3-2.5 5 4M15.5 9.2h.01" />,
      run: () => openTool({ stampsOpen: true }),
    },
    {
      id: "video", label: "Time-lapse", blurb: "Replay the whole board being drawn, and save it as video",
      icon: <Ico d="M4.5 6.5h12v11h-12zM16.5 10l4-2.5v9l-4-2.5" />,
      run: () => openTool({ timelapseOpen: true }),
    },
  ];

  const NAV: { id: HomeView; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "Home", icon: <Ico d="M3.5 10.5 12 3.5l8.5 7M5.5 9.5v9a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-9" /> },
    { id: "new", label: "New canvas", icon: <Ico d="M12 6v12M6 12h12" /> },
    { id: "templates", label: "Templates", icon: <Ico d="M4 5.5h7v5H4zM13 5.5h7v12h-7zM4 12.5h7v5H4z" /> },
    { id: "canvases", label: "My canvases", icon: <Ico d="M3.5 7.5a2 2 0 0 1 2-2h3.2l1.6 2h8.2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /> },
    { id: "starred", label: "Starred", icon: <Ico d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z" /> },
  ];

  return (
    <div className="home" data-ui>
      <aside className="hm-side">
        <div className="hm-brand">
          <span className="wordmark">
            Cool<span>CANVAS</span>
          </span>
          <p>Think in space.</p>
        </div>

        <nav className="hm-nav" aria-label="Sections">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              className={view === n.id ? "is-active" : ""}
              onClick={() => (n.id === "new" ? startBoard(null) : setView(n.id))}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="hm-nav-head">Create with</div>
        <nav className="hm-nav" aria-label="Tools">
          {TOOLS.map((t) => (
            <button key={t.id} type="button" onClick={t.run} title={t.blurb}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="hm-nav-head">Files</div>
        <nav className="hm-nav" aria-label="Files">
          <button type="button" onClick={importFile}>
            <Ico d="M12 3.8v11.7M8 11.5l4 4 4-4M4.5 18v.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V18" />
            <span>Import</span>
          </button>
          <button type="button" onClick={() => boards[0] && exportBoardFile(boards[0])} disabled={!boards.length}>
            <Ico d="M12 15.5V3.8M8 7.5l4-4 4 4M4.5 14v4.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V14" />
            <span>Export</span>
          </button>
        </nav>

        <div className="hm-promo">
          <p>
            Visual thinking
            <br />
            for a brighter
            <br />
            tomorrow.
          </p>
          <button type="button" onClick={() => startBoard(null)}>
            Start a canvas <span aria-hidden>→</span>
          </button>
        </div>
      </aside>

      <main className="hm-main">
        <header className="hm-top">
          <label className="hm-search">
            <Ico d="M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM16 16l4 4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search canvases and templates"
              aria-label="Search"
            />
          </label>
          <div className="hm-top-actions">
            {!!boards.length && (
              <button type="button" className="ghost-btn" onClick={enter}>
                Back to board
              </button>
            )}
            <span className="avatar" aria-hidden>
              Y
            </span>
            <button type="button" className="primary" onClick={() => startBoard(null)}>
              + New canvas
            </button>
          </div>
        </header>

        {showAll && (
          <section className="hm-hero">
            <img className="hm-hero-art" src="/hero-banner.png" alt="" draggable={false} />
            <div className="hm-hero-copy">
              <p className="kicker">Visual thinking for a brighter tomorrow</p>
              <h1>
                Think in space. <em>Explain it visually.</em>
              </h1>
              <p className="hm-sub">
                Turn ideas into clear visuals — boards, wireframes, flows, sites and 3D.
                Start with a prompt, a template, or a blank canvas.
              </p>
            </div>
            <div className="hm-hero-starter">
              <SketchStarter
                onStart={async () => {
                  await refresh();
                  state().newBoard("Untitled board");
                  enter();
                }}
              />
            </div>
          </section>
        )}

        <div className="home-body">
          {(showAll || view === "new") && (
            <section className="home-row">
              <h2>New canvas</h2>
              <div className="size-chips">
                {PRESETS.map((preset) => (
                  <button key={preset?.label ?? "free"} type="button" className="size-chip" onClick={() => startBoard(preset)}>
                    <i
                      style={{
                        width: preset ? Math.round(18 * Math.min(1, preset.width / preset.height)) : 18,
                        height: preset ? Math.round(18 * Math.min(1, preset.height / preset.width)) : 12,
                      }}
                      className={preset ? "" : "is-free"}
                    />
                    <b>{preset?.label ?? "Freeform"}</b>
                    {preset && (
                      <small>
                        {preset.width}×{preset.height}
                      </small>
                    )}
                  </button>
                ))}
                <div className={`size-chip is-custom${customOpen ? " is-open" : ""}`}>
                  <button type="button" onClick={() => setCustomOpen((v) => !v)}>
                    <b>Custom…</b>
                  </button>
                  {customOpen && (
                    <div className="size-pop">
                      <NumberField label="W" value={custom.width} min={16} max={12000} onChange={(v) => setCustom((c) => ({ ...c, width: v }))} />
                      <NumberField label="H" value={custom.height} min={16} max={12000} onChange={(v) => setCustom((c) => ({ ...c, height: v }))} />
                      <button type="button" className="mini-btn" onClick={() => startBoard({ ...custom, label: "Custom" })}>
                        Create
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {(showAll || view === "templates") && (
            <section>
              <div className="home-row-head">
                <h2>Templates</h2>
                <span>Boards to start from, and complete websites for the Site Builder — all editable.</span>
              </div>
              <div className="tpl-rail">
                {shownTemplates.map((t) => {
                  const i = TEMPLATES.indexOf(t);
                  return (
                    <button key={t.id} type="button" className="tpl-card" onClick={() => startTemplate(t.id)}>
                      <Preview board={templatePreviews()[i]} />
                      <strong>{t.label}</strong>
                      <span>Board</span>
                    </button>
                  );
                })}
                {shownSites.map((t) => {
                  const th = THEMES.find((x) => x.id === t.theme)?.theme ?? THEMES[0].theme;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className="tpl-card is-site"
                      onClick={async () => {
                        await refresh();
                        state().newBoard(`${t.label} site`);
                        state().setSite(siteFromTemplate(t));
                        state().setUi({ home: false, builderOpen: true });
                      }}
                    >
                      <span className="tpl-site-thumb" style={{ background: th.bg }}>
                        <i style={{ background: th.ink }} />
                        <i style={{ background: th.brand, width: "38%" }} />
                        <i style={{ background: th.border, width: "70%" }} />
                        <em>
                          <b style={{ background: th.white }} />
                          <b style={{ background: th.white }} />
                          <b style={{ background: th.white }} />
                        </em>
                      </span>
                      <strong>{t.label}</strong>
                      <span>Website · {t.sections.length} sections</span>
                    </button>
                  );
                })}
                {!shownTemplates.length && !shownSites.length && <p className="ins-note">Nothing matches “{search}”.</p>}
              </div>
            </section>
          )}

          <section>
            <h2>{view === "starred" ? "Starred" : "Recent"}</h2>
            {!shownBoards.length && (
              <p className="ins-note">{q ? `Nothing matches “${search}”.` : "Nothing saved yet — start a canvas above."}</p>
            )}
            <div className="board-grid">
              {shownBoards.map((board) => (
                <article key={board.id} className={board.id === currentId ? "is-current" : ""}>
                  <button type="button" className="board-card" onClick={() => openBoard(board)}>
                    <Preview board={board} />
                    <strong>{board.name}</strong>
                    <span>
                      {board.order.length} object{board.order.length === 1 ? "" : "s"}
                      {board.animation?.cels?.length ? ` · ${board.animation.cels.length} cels` : ""}
                      {" · "}
                      {new Date(board.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <div className="board-actions">
                    <button type="button" onClick={() => duplicate(board)}>
                      Duplicate
                    </button>
                    <button type="button" onClick={() => exportBoardFile(board)}>
                      Save file
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      disabled={board.id === currentId}
                      onClick={async () => {
                        await deleteBoard(board.id);
                        setBoards((list) => list.filter((b) => b.id !== board.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

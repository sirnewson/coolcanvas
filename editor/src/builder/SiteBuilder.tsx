import { useEffect, useMemo, useRef, useState } from "react";

import { useStore } from "../store/store";
import type { SiteSection, SiteState } from "../types";
import { CATS, SECTIONS } from "./sections";
import type { SectionDefinition } from "./types";
import { LIVE_COMPONENT_MAP, THEMES, applyBuilderTheme } from "./LiveSections";
import { SITE_TEMPLATES, emptySite, newSection, siteFromTemplate } from "./templates";
import { buildPrompt, renderSiteHtml, sectionById } from "./site";
import { siteToEditableObjects } from "./toCanvas";
import { StockPanel } from "../ui/StockPanel";
import { STOCK_MIME, stockToDataUrl, type StockImage } from "../lib/stock";
import { readFileAsDataUrl } from "../lib/images";
import { extractHtml, generateText, loadAiSettings } from "../lib/ai";
import { downloadText } from "../lib/imageTools";
import { createEmbed } from "../store/factory";
import { openSite } from "../lib/studio";
import { screenToWorld } from "../lib/geom";
import { IconChevron, IconClose, IconCopy, IconTrash } from "../ui/icons";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 834, mobile: 390 };

const SITE_TYPES = ["SaaS product", "E-commerce", "Portfolio / agency", "Service business", "Hospitality / hotel", "Media / blog", "Landing page", "Web app / dashboard"];

/* ------------------------------------------------------------ preview */

function SectionPreview({ q, brand, type, mini }: { q: SiteSection; brand: string; type: string; mini?: boolean }) {
  const Comp = LIVE_COMPONENT_MAP[q.id];
  const s = sectionById(q.id);
  if (!Comp) {
    return (
      <div className="sb-fallback">
        <b>{s?.name ?? q.id}</b>
        <span>{s?.purpose}</span>
      </div>
    );
  }
  if (mini) {
    return (
      <div className="sb-mini">
        <div className="sb-mini-inner">
          <Comp data={q.content} brand={brand} type={type} />
        </div>
      </div>
    );
  }
  return <Comp data={q.content} brand={brand} type={type} />;
}

/* ------------------------------------------------------------- builder */

/**
 * The site builder: a section library on the left, the live page in the
 * middle (with a device toggle and per-section overlays), and the brief plus
 * the selected section's copy on the right. State lives in `doc.site`, so it
 * saves with the board and undoes like everything else.
 */
export function SiteBuilder() {
  const open = useStore((s) => s.ui.builderOpen);
  const stored = useStore((s) => s.doc.site);
  const state = useStore.getState;
  const site: SiteState = stored ?? emptySite();

  const [cat, setCat] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [device, setDevice] = useState<Device>("desktop");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"library" | "templates" | "images">(site.sections.length ? "library" : "templates");
  const [dropOver, setDropOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pageHeight, setPageHeight] = useState(0);

  // The page is scaled with a transform, which leaves its layout box at full
  // size; a wrapper sized to the scaled page keeps the stage tidy.
  useEffect(() => {
    if (!open) return;
    const el = pageRef.current;
    if (!el) return;
    const measure = () => setPageHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, site.sections.length, site.theme, device]);

  // The section palette is a module-level object; re-key the preview so
  // every component re-renders with the new colours.
  const themeDef = THEMES.find((t) => t.id === site.theme) ?? THEMES[0];
  applyBuilderTheme(themeDef.theme);

  useEffect(() => {
    if (!open) return;
    const el = previewRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, (el.clientWidth - 48) / DEVICE_WIDTH[device]));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, device]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !promptOpen) state().setUi({ builderOpen: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, promptOpen, state]);

  const library = useMemo(() => {
    let items = cat === "all" ? SECTIONS : SECTIONS.filter((s) => s.cat === cat);
    const q = query.trim().toLowerCase();
    if (q) items = items.filter((s) => `${s.name} ${s.purpose} ${s.id} ${s.fits.join(" ")}`.toLowerCase().includes(q));
    return items;
  }, [cat, query]);

  if (!open) return null;

  const update = (patch: Partial<SiteState>) => state().setSite({ ...site, ...patch });
  const setSections = (sections: SiteSection[]) => update({ sections });
  const add = (def: SectionDefinition) => {
    const sec = newSection(def.id);
    // Headers go first, footers last, everything else appends.
    const next = [...site.sections];
    if (def.cat === "header") next.unshift(sec);
    else if (def.cat === "footer") next.push(sec);
    else {
      const footerAt = next.findIndex((q) => sectionById(q.id)?.cat === "footer");
      next.splice(footerAt < 0 ? next.length : footerAt, 0, sec);
    }
    setSections(next);
    setSelected(sec.uid);
  };
  const remove = (uidToRemove: string) => {
    setSections(site.sections.filter((q) => q.uid !== uidToRemove));
    if (selected === uidToRemove) setSelected(null);
  };
  const move = (uidToMove: string, dir: -1 | 1) => {
    const i = site.sections.findIndex((q) => q.uid === uidToMove);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= site.sections.length) return;
    const next = [...site.sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  };
  const duplicate = (uidToCopy: string) => {
    const i = site.sections.findIndex((q) => q.uid === uidToCopy);
    if (i < 0) return;
    const copy = { ...site.sections[i], uid: newSection(site.sections[i].id).uid, content: { ...site.sections[i].content } };
    const next = [...site.sections];
    next.splice(i + 1, 0, copy);
    setSections(next);
    setSelected(copy.uid);
  };
  const setContent = (uidToEdit: string, key: string, value: string) =>
    setSections(site.sections.map((q) => (q.uid === uidToEdit ? { ...q, content: { ...q.content, [key]: value } } : q)));

  const loadTemplate = (id: string) => {
    const t = SITE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (site.sections.length && !window.confirm("Replace the current sections with this template?")) return;
    state().setSite(siteFromTemplate(t));
    setSelected(null);
    setTab("library");
  };

  const centre = () => {
    const { viewport, camera } = state();
    return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
  };

  const exportHtml = () => {
    if (!site.sections.length) return state().flashHint("Add a section first");
    const html = renderSiteHtml(site);
    downloadText(`${(site.brief.brand || "site").replace(/[^\w.-]+/g, "_")}.html`, html, "text/html");
    update({ html });
  };
  const previewInTab = () => {
    if (!site.sections.length) return state().flashHint("Add a section first");
    const html = renderSiteHtml(site);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const toCanvas = () => {
    if (!site.sections.length) return state().flashHint("Add a section first");
    const c = centre();
    const objects = siteToEditableObjects(site, { x: c.x - 500, y: c.y - 300 });
    state().addObjects(objects, false);
    state().setSelection([objects[0].id]);
    state().setUi({ builderOpen: false });
    window.setTimeout(() => state().fitSelection(), 30);
    state().flashHint("Site laid out on the board — every block is editable");
  };
  const generate = async () => {
    if (!site.sections.length) return state().flashHint("Add a section first");
    const settings = loadAiSettings();
    if (!settings.apiKey) {
      state().setUi({ builderOpen: false });
      state().openDock("assist");
      return state().flashHint("Add your API key in the AI tab first");
    }
    setBusy(true);
    state().setUi({ job: { label: "Writing the site with AI…" } });
    try {
      const reply = await generateText(settings, buildPrompt(site));
      const html = extractHtml(reply);
      if (!/<html|<!doctype/i.test(html)) throw new Error("The model did not return an HTML page.");
      update({ html });
      const card = createEmbed(centre(), "site://generated");
      card.width = 360;
      card.height = 132;
      card.name = site.brief.brand || "Generated site";
      card.data = { ...card.data, embedKind: "site", title: card.name, html, provider: "AI site", url: "" };
      state().addObjects([card]);
      openSite(card);
      state().setUi({ job: null });
      state().flashHint("Site generated — opened in a new tab and kept on the board");
    } catch (e) {
      state().setUi({ job: null });
      state().flashHint(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** First picture slot a section exposes: gallery tiles fill in order, everything else uses `image`. */
  const setSectionImage = (uidTarget: string, src: string) => {
    const q = site.sections.find((x) => x.uid === uidTarget);
    if (!q) return;
    const def = sectionById(q.id);
    let key = "image";
    if (def?.cat === "gallery") {
      for (let i = 1; i <= 6; i += 1) {
        if (!q.content[`image_${i}`]) {
          key = `image_${i}`;
          break;
        }
      }
    }
    setContent(uidTarget, key, src);
    state().flashHint(def?.cat === "gallery" ? "Picture added to the gallery" : "Picture set on the section");
  };
  const onSectionDrop = async (e: React.DragEvent, uidTarget: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOver(null);
    const stock = e.dataTransfer.getData(STOCK_MIME);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
    const url = (e.dataTransfer.getData("text/uri-list") || "").trim();
    let src: string | null = null;
    state().setUi({ job: { label: "Fetching picture…" } });
    try {
      if (stock) src = await stockToDataUrl((JSON.parse(stock) as StockImage).full);
      else if (file) src = await readFileAsDataUrl(file);
      else if (/^https?:/.test(url)) src = await stockToDataUrl(url);
    } finally {
      state().setUi({ job: null });
    }
    if (src) setSectionImage(uidTarget, src);
  };
  const pickImage = (img: StockImage) => {
    const target = selected ?? site.sections.find((q) => ["hero", "gallery"].includes(sectionById(q.id)?.cat ?? ""))?.uid;
    if (!target) return state().flashHint("Select a section first");
    void stockToDataUrl(img.full).then((src) => setSectionImage(target, src));
  };

  /**
   * Inline editing: double-click any text that came from a content field and
   * type over it. Text that is still a component default has no field to
   * write to, so the panel opens instead.
   */
  const onInlineEdit = (e: React.MouseEvent, q: SiteSection) => {
    const el = e.target as HTMLElement;
    if (!el || el.children.length > 2) return;
    const current = (el.textContent ?? "").trim();
    if (!current) return;
    const key = Object.keys(q.content).find((k) => (q.content[k] ?? "").trim() === current);
    setSelected(q.uid);
    if (!key) {
      state().flashHint("This text is a default — set it in the panel on the right");
      return;
    }
    el.contentEditable = "true";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const finish = () => {
      el.contentEditable = "false";
      el.removeEventListener("blur", finish);
      el.removeEventListener("keydown", onKey);
      const next = (el.textContent ?? "").trim();
      if (next && next !== current) setContent(q.uid, key, next);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        el.blur();
      }
      if (ev.key === "Escape") {
        el.textContent = current;
        el.blur();
      }
      ev.stopPropagation();
    };
    el.addEventListener("blur", finish);
    el.addEventListener("keydown", onKey);
  };

  const selectedSection = site.sections.find((q) => q.uid === selected) ?? null;
  const selectedDef = selectedSection ? sectionById(selectedSection.id) : null;
  const width = DEVICE_WIDTH[device];

  return (
    <div className="sb" data-ui>
      {/* -------------------------------------------------------- top */}
      <header className="sb-top">
        <button type="button" className="sb-close" onClick={() => state().setUi({ builderOpen: false })} title="Back to the board · Esc">
          <IconClose />
        </button>
        <span className="sb-title">
          Site <em>Builder</em>
        </span>
        <span className="sb-rule" />
        <input
          className="sb-input"
          placeholder="Brand name"
          value={site.brief.brand}
          onChange={(e) => update({ brief: { ...site.brief, brand: e.target.value } })}
        />
        <select className="sb-input" value={site.brief.type} onChange={(e) => update({ brief: { ...site.brief, type: e.target.value } })}>
          <option value="">Site type…</option>
          {SITE_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select className="sb-input" value={site.theme} onChange={(e) => update({ theme: e.target.value })} title="Palette">
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="sb-spacer" />
        <div className="sb-devices">
          {(["desktop", "tablet", "mobile"] as Device[]).map((d) => (
            <button key={d} type="button" className={device === d ? "is-active" : ""} onClick={() => setDevice(d)}>
              {d}
            </button>
          ))}
        </div>
        <span className="sb-rule" />
        <button type="button" className="sb-btn" onClick={() => setPromptOpen(true)} disabled={!site.sections.length}>
          Prompt
        </button>
        <button type="button" className="sb-btn" onClick={previewInTab} disabled={!site.sections.length}>
          Preview
        </button>
        <button type="button" className="sb-btn" onClick={exportHtml} disabled={!site.sections.length}>
          Export HTML
        </button>
        <button type="button" className="sb-btn" onClick={toCanvas} disabled={!site.sections.length}>
          To canvas
        </button>
        <button type="button" className="sb-btn is-primary" onClick={() => void generate()} disabled={busy || !site.sections.length}>
          {busy ? "Writing…" : "✦ Generate with AI"}
        </button>
      </header>

      <div className="sb-body">
        {/* ------------------------------------------------ library */}
        <aside className="sb-left">
          <div className="sb-tabs">
            <button type="button" className={tab === "library" ? "is-active" : ""} onClick={() => setTab("library")}>
              Sections <small>{SECTIONS.length}</small>
            </button>
            <button type="button" className={tab === "templates" ? "is-active" : ""} onClick={() => setTab("templates")}>
              Templates
            </button>
            <button type="button" className={tab === "images" ? "is-active" : ""} onClick={() => setTab("images")}>
              Images
            </button>
          </div>

          {tab === "images" && (
            <div className="sb-scroll">
              <p className="sb-note">
                {selectedSection ? `Click a picture to put it in “${selectedDef?.name}”, or drag any picture onto a section.` : "Select a section, then click a picture — or drag one onto any section."}
              </p>
              <StockPanel onPick={pickImage} />
            </div>
          )}

          {tab === "templates" && (
            <div className="sb-scroll">
              <p className="sb-note">Complete sites with the copy already written. Load one, then edit anything.</p>
              {SITE_TEMPLATES.map((t) => {
                const preview = siteFromTemplate(t);
                return (
                  <button key={t.id} type="button" className="sb-template" onClick={() => loadTemplate(t.id)}>
                    <span className="sb-template-thumb">
                      {preview.sections.slice(0, 4).map((q) => (
                        <SectionPreview key={q.uid} q={q} brand={t.brief.brand} type={t.brief.type} mini />
                      ))}
                    </span>
                    <b>{t.label}</b>
                    <span>{t.note}</span>
                  </button>
                );
              })}
              <button type="button" className="sb-btn" onClick={() => state().setSite(emptySite())} style={{ marginTop: 8 }}>
                Start empty
              </button>
            </div>
          )}

          {tab === "library" && (
            <>
              <input className="sb-search" placeholder="Search 111 sections…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="sb-cats">
                {CATS.map((c) => (
                  <button key={c} type="button" className={cat === c ? "is-active" : ""} onClick={() => setCat(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <div className="sb-scroll">
                {library.map((def) => {
                  const used = site.sections.some((q) => q.id === def.id);
                  return (
                    <div key={def.id} className={`sb-card${used ? " is-used" : ""}`}>
                      <div className="sb-card-preview">
                        <SectionPreview q={{ uid: def.id, id: def.id, content: {} }} brand={site.brief.brand} type={site.brief.type} mini />
                      </div>
                      <div className="sb-card-meta">
                        <b>{def.name}</b>
                        <span>{def.purpose}</span>
                      </div>
                      <button type="button" className="sb-add" onClick={() => add(def)} title="Add to page">
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        {/* ------------------------------------------------ preview */}
        <main className="sb-stage" ref={previewRef} onClick={() => setSelected(null)}>
          {site.sections.length === 0 ? (
            <div className="sb-empty">
              <h2>Build a page from real sections.</h2>
              <p>Pick a template on the left, or add sections one by one. Click a section to edit its copy, double-click text to type over it, drop pictures straight onto sections — and use “To canvas” to move, resize and restyle every element freely.</p>
            </div>
          ) : (
            <div className="sb-page-wrap" style={{ width: width * scale, height: pageHeight * scale }}>
            <div className="sb-page" ref={pageRef} style={{ width, transform: `scale(${scale})` }} key={site.theme}>
              <div className="sb-chrome">
                <i /> <i /> <i />
                <span>{(site.brief.brand || "yourbrand").toLowerCase().replace(/\s+/g, "")}.com</span>
              </div>
              {site.sections.map((q, i) => {
                const def = sectionById(q.id);
                return (
                  <div
                    key={q.uid}
                    className={`sb-section${selected === q.uid ? " is-selected" : ""}${dropOver === q.uid ? " is-drop" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(q.uid);
                    }}
                    onDoubleClick={(e) => onInlineEdit(e, q)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dropOver !== q.uid) setDropOver(q.uid);
                    }}
                    onDragLeave={() => dropOver === q.uid && setDropOver(null)}
                    onDrop={(e) => void onSectionDrop(e, q.uid)}
                  >
                    <div className="sb-section-body">
                      <SectionPreview q={q} brand={site.brief.brand} type={site.brief.type} />
                    </div>
                    <div className="sb-overlay" onClick={(e) => e.stopPropagation()}>
                      <span className="sb-overlay-name">
                        {i + 1} · {def?.name ?? q.id}
                      </span>
                      <button type="button" onClick={() => move(q.uid, -1)} disabled={i === 0} title="Move up">
                        <IconChevron style={{ transform: "rotate(-90deg)" }} />
                      </button>
                      <button type="button" onClick={() => move(q.uid, 1)} disabled={i === site.sections.length - 1} title="Move down">
                        <IconChevron style={{ transform: "rotate(90deg)" }} />
                      </button>
                      <button type="button" onClick={() => duplicate(q.uid)} title="Duplicate">
                        <IconCopy />
                      </button>
                      <button type="button" onClick={() => setSelected(q.uid)} title="Edit copy">
                        Edit
                      </button>
                      <button type="button" className="is-danger" onClick={() => remove(q.uid)} title="Remove">
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </main>

        {/* ------------------------------------------------ inspector */}
        <aside className="sb-right">
          {selectedSection && selectedDef ? (
            <div className="sb-scroll">
              <div className="sb-panel-head">
                <b>{selectedDef.name}</b>
                <span>{selectedDef.purpose}</span>
              </div>
              {selectedDef.contentFields.map((f) => (
                <label key={f.key} className="sb-field">
                  <span>{f.label}</span>
                  {f.type === "textarea" ? (
                    <textarea
                      rows={3}
                      placeholder={f.ph}
                      value={selectedSection.content[f.key] ?? ""}
                      onChange={(e) => setContent(selectedSection.uid, f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      placeholder={f.ph}
                      value={selectedSection.content[f.key] ?? ""}
                      onChange={(e) => setContent(selectedSection.uid, f.key, e.target.value)}
                    />
                  )}
                </label>
              ))}
              {(selectedDef.cat === "hero" || selectedDef.cat === "gallery") && (
                <div className="sb-field">
                  <span>Picture{selectedDef.cat === "gallery" ? "s" : ""}</span>
                  <div className="sb-pics">
                    {Object.keys(selectedSection.content)
                      .filter((k) => /^image(_\d+)?$/.test(k) && selectedSection.content[k])
                      .map((k) => (
                        <span key={k} className="sb-pic">
                          <img src={selectedSection.content[k]} alt="" />
                          <button type="button" onClick={() => setContent(selectedSection.uid, k, "")} title="Remove">
                            ×
                          </button>
                        </span>
                      ))}
                    <button type="button" className="sb-pic-add" onClick={() => setTab("images")}>
                      + Find a picture
                    </button>
                  </div>
                </div>
              )}
              <div className="sb-panel-meta">
                <span>Layout · {selectedDef.layout}</span>
                <span>Components · {selectedDef.components.join(", ")}</span>
                <span>Fits · {selectedDef.fits.join(", ")}</span>
              </div>
              <button type="button" className="sb-btn is-danger" onClick={() => remove(selectedSection.uid)}>
                Remove section
              </button>
            </div>
          ) : (
            <div className="sb-scroll">
              <div className="sb-panel-head">
                <b>Site brief</b>
                <span>Feeds the AI build and the generated copy.</span>
              </div>
              {(
                [
                  ["offer", "What it does", "e.g. Analytics that explain themselves"],
                  ["audience", "Who it is for", "e.g. Product teams at growing startups"],
                  ["style", "Visual style", "e.g. Clean, confident, modern"],
                ] as const
              ).map(([key, label, ph]) => (
                <label key={key} className="sb-field">
                  <span>{label}</span>
                  <input value={site.brief[key]} placeholder={ph} onChange={(e) => update({ brief: { ...site.brief, [key]: e.target.value } })} />
                </label>
              ))}
              <div className="sb-panel-head" style={{ marginTop: 14 }}>
                <b>Palette</b>
              </div>
              <div className="sb-themes">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={site.theme === t.id ? "is-active" : ""}
                    onClick={() => update({ theme: t.id })}
                    title={t.label}
                  >
                    <i style={{ background: t.theme.bg }} />
                    <i style={{ background: t.theme.brand }} />
                    <i style={{ background: t.theme.ink }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="sb-panel-head" style={{ marginTop: 14 }}>
                <b>Page</b>
                <span>
                  {site.sections.length} section{site.sections.length === 1 ? "" : "s"} · click one in the preview to edit its copy
                </span>
              </div>
              <ol className="sb-outline">
                {site.sections.map((q) => (
                  <li key={q.uid}>
                    <button type="button" onClick={() => setSelected(q.uid)}>
                      {sectionById(q.id)?.name ?? q.id}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>

      {promptOpen && (
        <div className="sb-modal-backdrop" onClick={() => setPromptOpen(false)}>
          <div className="sb-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <b>Build prompt</b>
              <span>Paste into any model to get the full site, or use Generate with AI.</span>
              <button
                type="button"
                className="sb-btn"
                onClick={() => {
                  void navigator.clipboard.writeText(buildPrompt(site));
                  state().flashHint("Prompt copied");
                }}
              >
                Copy
              </button>
              <button type="button" className="sb-close" onClick={() => setPromptOpen(false)}>
                <IconClose />
              </button>
            </header>
            <pre>{buildPrompt(site)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

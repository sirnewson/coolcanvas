import { useMemo, useState } from "react";

import { useStore } from "../store/store";
import type { CanvasObject, FontKey, FrameKind, NoteKind, TextRole } from "../types";
import {
  FILLS,
  INK,
  NOTE_COLORS,
  TEXT_ROLES,
  formatMeasure,
} from "../lib/theme";
import { listHeight } from "../lib/outline";
import { measureImage, pickImageFiles, readFileAsDataUrl } from "../lib/images";
import { isPlaying, restart, setLoop, setMuted, togglePlay } from "../lib/media";
import { createNote } from "../store/factory";
import { screenToWorld } from "../lib/geom";
import {
  ColorField,
  NumberField,
  Row,
  Section,
  Segmented,
  Slider,
  StrokeControl,
  Toggle,
  CapsuleRow,
  CapsuleSlider,
  CapsuleColor,
  FontPicker,
} from "./controls";
import {
  IconAlignBottom,
  IconAlignCenterH,
  IconAlignCenterV,
  IconAlignLeft,
  IconAlignRight,
  IconAlignTop,
  IconDistributeH,
  IconDistributeV,
  IconFlipH,
  IconFlipV,
  IconDropper,
  IconToBack,
  IconToFront,
} from "./icons";


function shared<T>(objects: CanvasObject[], get: (o: CanvasObject) => T): T | null {
  if (!objects.length) return null;
  const first = get(objects[0]);
  return objects.every((o) => get(o) === first) ? first : null;
}

export function Inspector() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const state = useStore.getState;
  const [lockAspect, setLockAspect] = useState(false);
  const [repeat, setRepeat] = useState({ count: 3, dx: 40, dy: 0, rotate: 0, scale: 1 });
  const [alignTo, setAlignTo] = useState<"selection" | "page">("selection");

  const objects = useMemo(
    () => selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
    [selection, doc],
  );

  if (!objects.length) return <Defaults />;

  const types = new Set(objects.map((o) => o.type));
  const has = (...t: string[]) => t.some((x) => types.has(x as CanvasObject["type"]));
  const single = objects.length === 1 ? objects[0] : null;
  const first = objects[0];
  const many = objects.length > 1;
  const strokeLike = has(
    "rect",
    "ellipse",
    "triangle",
    "diamond",
    "polygon",
    "line",
    "arrow",
    "frame",
    "measure",
    "icon",
  );
  const boxy = has(
    "rect", "ellipse", "triangle", "diamond", "polygon",
    "note", "image", "frame", "embed", "icon", "list",
  );
  const textish = has("text", "note", "rect", "ellipse", "triangle", "diamond", "polygon", "list");

  const patchAll = (patch: Partial<CanvasObject>) => state().patchObjects(selection, patch);
  const gradient = first.style.gradient;

  const fmt = (v: number) => formatMeasure(v, doc.settings.unit, doc.settings.unitScale);
  const hasPage = !!doc.settings.page;

  const kindIcon = single?.type === "adjustment"
    ? "◐"
    : single?.type === "smart"
    ? "📦"
    : single?.type === "text"
    ? "T"
    : single?.type === "group"
    ? "📁"
    : single?.type === "image"
    ? "🖼️"
    : "◆";

  const kindLabel = single?.type === "adjustment"
    ? (single.data.adjustmentType ?? "Adjustment")
    : single?.type === "smart"
    ? "Smart Object"
    : single?.type === "text"
    ? "Type Layer"
    : single?.type === "image"
    ? "Pixel Layer"
    : single?.type ?? "Object";

  return (
    <>
      {/* Photocraft Pro Layer Header (Image 6) */}
      <div className="pc-props-header">
        <div className="pc-props-thumb-box">
          <span className="pc-props-icon">{kindIcon}</span>
        </div>
        <div className="pc-props-title-group">
          <input
            className="pc-props-name"
            value={single?.name ?? (many ? `${objects.length} layers selected` : "Object")}
            disabled={!single}
            placeholder="Layer name"
            onChange={(e) => single && state().rename(single.id, e.target.value)}
          />
          <span className="pc-props-subinfo">
            {kindLabel} {single ? `· ${Math.round(single.width)} × ${Math.round(single.height)}px` : ""}
          </span>
        </div>
        <div className="pc-props-kind-pill">{kindLabel} ▾</div>
      </div>

      {/* Quick Actions Collapsible Section (Image 6) */}
      <Section title="Quick Actions" icon={<span className="pc-sec-icon is-purple">⚡</span>}>
        <div className="pc-quick-actions-grid">
          {single?.type === "smart" ? (
            <>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => {
                  alert("Smart object contents opened for editing.");
                }}
              >
                <span className="pc-action-icon">⬡</span>
                <span>Edit Contents</span>
              </button>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => state().patchObject(single.id, { type: "image" })}
              >
                <span className="pc-action-icon">▤</span>
                <span>Rasterize Smart Object</span>
              </button>
            </>
          ) : single?.type === "text" ? (
            <>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => state().patchObject(single.id, { type: "polygon" })}
              >
                <span className="pc-action-icon">⬡</span>
                <span>Convert to Shape</span>
              </button>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => state().patchObject(single.id, { type: "image" })}
              >
                <span className="pc-action-icon">▤</span>
                <span>Rasterize Type</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => state().duplicateSelection()}
              >
                <span className="pc-action-icon">❐</span>
                <span>Duplicate Layer</span>
              </button>
              <button
                type="button"
                className="pc-quick-action-btn"
                onClick={() => {
                  if (single) {
                    state().patchObject(single.id, {
                      mask: {
                        type: "pixel",
                        density: 1,
                        feather: 0,
                        inverted: false,
                        enabled: true,
                      },
                    });
                  }
                }}
              >
                <span className="pc-action-icon">⊡</span>
                <span>Add Layer Mask</span>
              </button>
              {single && !single.clippingMask && (
                <button
                  type="button"
                  className="pc-quick-action-btn"
                  onClick={() => state().patchObject(single.id, { clippingMask: true })}
                >
                  <span className="pc-action-icon">⬚</span>
                  <span>Create Clipping Mask</span>
                </button>
              )}
              {single && single.clippingMask && (
                <button
                  type="button"
                  className="pc-quick-action-btn"
                  onClick={() => state().patchObject(single.id, { clippingMask: false })}
                >
                  <span className="pc-action-icon">⬚</span>
                  <span>Release Clipping Mask</span>
                </button>
              )}
              {single && (single.type as string) !== "smart" && (
                <button
                  type="button"
                  className="pc-quick-action-btn"
                  onClick={() => {
                    state().patchObject(single.id, {
                      type: "smart",
                      name: `${single.name || single.type} (Smart Object)`,
                      data: {
                        ...single.data,
                        smartObject: {
                          src: single.data.src,
                          width: single.width,
                          height: single.height,
                          smartFilters: [],
                        },
                      },
                    });
                  }}
                >
                  <span className="pc-action-icon">⬡</span>
                  <span>Convert to Smart Object</span>
                </button>
              )}
            </>
          )}
        </div>
      </Section>

      {/* Layer Tools Bar (Image 6) */}
      {single && (
        <Section title={kindLabel.toUpperCase()} icon={<span className="pc-sec-icon is-blue">🖼</span>}>
          <div className="pc-layer-tools-bar">
            <button
              type="button"
              className="pc-layer-tool-btn is-active"
              title="Duplicate"
              onClick={() => state().duplicateSelection()}
            >
              ❐
            </button>
            <button
              type="button"
              className="pc-layer-tool-btn"
              title="Mask"
              onClick={() => {
                state().patchObject(single.id, {
                  mask: { type: "pixel", density: 1, feather: 0, inverted: false, enabled: true },
                });
              }}
            >
              ⊡
            </button>
            <span className="pc-tool-bar-divider" />
            <button
              type="button"
              className="pc-layer-tool-btn"
              title="Centre Horizontally"
              onClick={() => state().align("hcenter", alignTo)}
            >
              ✛
            </button>
            <button
              type="button"
              className="pc-layer-tool-btn"
              title="Centre Vertically"
              onClick={() => state().align("vcenter", alignTo)}
            >
              ✥
            </button>
            <span className="pc-tool-bar-divider" />
            <button
              type="button"
              className={`pc-layer-tool-btn ${single.locked ? "is-active" : ""}`}
              title={single.locked ? "Unlock" : "Lock"}
              onClick={() => state().patchObject(single.id, { locked: !single.locked })}
            >
              {single.locked ? "🔒" : "🔓"}
            </button>
            <button
              type="button"
              className={`pc-layer-tool-btn ${single.hidden ? "is-muted" : ""}`}
              title={single.hidden ? "Show" : "Hide"}
              onClick={() => state().patchObject(single.id, { hidden: !single.hidden })}
            >
              {single.hidden ? "👁‍🗨" : "👁"}
            </button>
          </div>
        </Section>
      )}

      {/* Mask Properties (if object has mask) */}
      {single?.mask && (
        <Section title="Layer Mask">
          <Row label="Density">
            <Slider
              value={single.mask.density}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) =>
                state().patchObject(single.id, {
                  mask: { ...single.mask!, density: v },
                })
              }
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </Row>
          <Row label="Feather">
            <Slider
              value={single.mask.feather}
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                state().patchObject(single.id, {
                  mask: { ...single.mask!, feather: v },
                })
              }
              format={(v) => `${v}px`}
            />
          </Row>
          <Row>
            <div className="btn-row">
              <button
                type="button"
                className="btn-sm"
                onClick={() =>
                  state().patchObject(single.id, {
                    mask: { ...single.mask!, inverted: !single.mask!.inverted },
                  })
                }
              >
                Invert Mask
              </button>
              <button
                type="button"
                className="btn-sm is-danger"
                onClick={() => state().patchObject(single.id, { mask: undefined })}
              >
                Delete Mask
              </button>
            </div>
          </Row>
        </Section>
      )}

      <Section
        title={many ? `${objects.length} Objects Selected` : (single?.type ? `${single.type.charAt(0).toUpperCase() + single.type.slice(1)} Layer` : "Layer")}
      >
        <div className="pc-layer-arrange-row">
          <div className="pc-arrange-btn-group">
            <button type="button" className="pc-tool-btn" title="Bring to Front" onClick={() => state().reorder(selection, "front")}>
              <IconToFront />
            </button>
            <button type="button" className="pc-tool-btn" title="Send to Back" onClick={() => state().reorder(selection, "back")}>
              <IconToBack />
            </button>
            <button type="button" className="pc-tool-btn" title="Flip Horizontally" onClick={() => state().flip("h")}>
              <IconFlipH />
            </button>
            <button type="button" className="pc-tool-btn" title="Flip Vertically" onClick={() => state().flip("v")}>
              <IconFlipV />
            </button>
          </div>
          <div className="pc-arrange-locks-group">
            <button
              type="button"
              className={`pc-pill-toggle ${shared(objects, (o) => o.locked) ? "is-active" : ""}`}
              onClick={() => state().setLocked(selection, !shared(objects, (o) => o.locked))}
            >
              🔒 Lock
            </button>
            <button
              type="button"
              className={`pc-pill-toggle ${shared(objects, (o) => o.hidden) ? "is-active" : ""}`}
              onClick={() => state().setHidden(selection, !shared(objects, (o) => o.hidden))}
            >
              👁 Hide
            </button>
          </div>
        </div>
      </Section>

      <Section title="Transform" icon={<span className="pc-sec-icon is-indigo">✥</span>}>
        <div className="pc-props-transform-grid">
          <div className="pc-props-wh-row">
            <NumberField
              label="W"
              min={1}
              value={shared(objects, (o) => Math.round(o.width))}
              onChange={(v) => {
                const width = Math.max(1, v);
                if (!lockAspect) return patchAll({ width });
                for (const o of objects) {
                  state().patchObject(o.id, { width, height: (o.height / o.width) * width });
                }
              }}
            />
            <button
              type="button"
              className={`pc-link-btn ${lockAspect ? "is-linked" : ""}`}
              title={lockAspect ? "Maintain aspect ratio (linked)" : "Maintain aspect ratio (unlinked)"}
              onClick={() => setLockAspect((v) => !v)}
            >
              {lockAspect ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.5 7h7a2.5 2.5 0 0 1 0 5h-7a2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 0 0 0 3h7a1.5 1.5 0 0 0 0-3h-7zM2 9.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M2.5 7A2.5 2.5 0 0 1 5 4.5h2a.5.5 0 0 1 0 1H5a1.5 1.5 0 0 0 0 3h2a.5.5 0 0 1 0 1H5A2.5 2.5 0 0 1 2.5 7zm6.5-2.5a.5.5 0 0 1 .5-.5h2A2.5 2.5 0 0 1 14 6.5a2.5 2.5 0 0 1-2.5 2.5h-2a.5.5 0 0 1 0-1h2a1.5 1.5 0 0 0 0-3h-2a.5.5 0 0 1-.5-.5z"/>
                </svg>
              )}
            </button>
            <NumberField
              label="H"
              min={1}
              value={shared(objects, (o) => Math.round(o.height))}
              onChange={(v) => {
                const height = Math.max(1, v);
                if (!lockAspect) return patchAll({ height });
                for (const o of objects) {
                  state().patchObject(o.id, { height, width: (o.width / o.height) * height });
                }
              }}
            />
          </div>
          <div className="pc-props-xy-row">
            <NumberField
              label="X"
              value={shared(objects, (o) => Math.round(o.x))}
              onChange={(v) => {
                const base = objects[0].x;
                state().translateObjects(selection, v - base, 0);
              }}
            />
            <div className="pc-link-spacer" />
            <NumberField
              label="Y"
              value={shared(objects, (o) => Math.round(o.y))}
              onChange={(v) => {
                const base = objects[0].y;
                state().translateObjects(selection, 0, v - base);
              }}
            />
          </div>
          <div className="pc-props-rot-row">
            <NumberField
              label="∠"
              suffix="°"
              min={-360}
              max={360}
              value={shared(objects, (o) => Math.round(o.rotation))}
              onChange={(v) => patchAll({ rotation: v })}
            />
            {single && (
              <span className="ins-readout">
                {fmt(single.width)} × {fmt(single.height)}
              </span>
            )}
          </div>
        </div>
      </Section>

      {(many || hasPage) && (
        <Section
          title="Align"
          aside={
            hasPage ? (
              <Segmented
                compact
                value={alignTo}
                options={[
                  { value: "selection", label: "Selection" },
                  { value: "page", label: "Canvas" },
                ]}
                onChange={(v) => setAlignTo(v)}
              />
            ) : undefined
          }
        >
          <Row>
            <div className="btn-row">
              <button type="button" title="Align left" onClick={() => state().align("left", alignTo)}>
                <IconAlignLeft />
              </button>
              <button
                type="button"
                title="Centre horizontally"
                onClick={() => state().align("hcenter", alignTo)}
              >
                <IconAlignCenterH />
              </button>
              <button type="button" title="Align right" onClick={() => state().align("right", alignTo)}>
                <IconAlignRight />
              </button>
              <button type="button" title="Align top" onClick={() => state().align("top", alignTo)}>
                <IconAlignTop />
              </button>
              <button
                type="button"
                title="Centre vertically"
                onClick={() => state().align("vcenter", alignTo)}
              >
                <IconAlignCenterV />
              </button>
              <button type="button" title="Align bottom" onClick={() => state().align("bottom", alignTo)}>
                <IconAlignBottom />
              </button>
            </div>
          </Row>
          {many && (
            <Row>
              <div className="btn-row">
                <button
                  type="button"
                  title="Distribute horizontally"
                  onClick={() => state().distribute("h")}
                >
                  <IconDistributeH />
                </button>
                <button
                  type="button"
                  title="Distribute vertically"
                  onClick={() => state().distribute("v")}
                >
                  <IconDistributeV />
                </button>
              </div>
            </Row>
          )}
        </Section>
      )}

      <Section title="Appearance" icon={<span className="pc-sec-icon is-cyan">💧</span>}>
        {/* Fill & Opacity Row */}
        {(boxy || has("draw")) && (
          <Row label="Fill">
            <div className="pc-fill-opacity-group">
              <ColorField
                value={has("draw") ? shared(objects, (o) => o.style.fill) ?? undefined : shared(objects, (o) => o.style.fill) ?? undefined}
                swatches={FILLS}
                allowNone
                onChange={(hex) => state().patchStyle(selection, { fill: hex }, { fill: hex })}
              />
              <div className="pc-inline-opacity-slider">
                <Slider
                  label="Opacity"
                  value={Math.round((shared(objects, (o) => o.opacity) ?? 1) * 100)}
                  min={0}
                  max={100}
                  onChange={(v) => patchAll({ opacity: v / 100 })}
                  format={(v) => `${v}%`}
                />
              </div>
            </div>
          </Row>
        )}

        {/* Stroke Control Row */}
        {strokeLike && (
          <Row label="Stroke">
            <StrokeControl
              color={shared(objects, (o) => o.style.stroke) ?? undefined}
              width={shared(objects, (o) => o.style.strokeWidth) ?? 2}
              dash={(shared(objects, (o) => o.style.dash ?? "solid") as any)}
              swatches={INK}
              onColorChange={(hex) => state().patchStyle(selection, { stroke: hex }, { ink: hex })}
              onWidthChange={(w) => state().patchStyle(selection, { strokeWidth: w }, { strokeWidth: w })}
              onDashChange={(d) => state().patchStyle(selection, { dash: d }, { dash: d })}
            />
          </Row>
        )}

        {/* Corners & Radius Row */}
        {has("rect", "image", "frame", "embed", "note", "card", "table", "placeholder") && (
          <Row label="Corners">
            <div className="pc-corners-radius-group">
              <select
                className="ins-select pc-corner-preset-select"
                value={String(shared(objects, (o) => o.style.radius ?? 0) ?? "0")}
                onChange={(e) =>
                  state().patchStyle(selection, { radius: Number(e.target.value) }, { radius: Number(e.target.value) })
                }
              >
                <option value="0">Sharp (0px)</option>
                <option value="6">Rounded (6px)</option>
                <option value="12">Soft (12px)</option>
                <option value="16">Round (16px)</option>
                <option value="999">Pill / Circle</option>
              </select>
              <NumberField
                value={Math.min(120, shared(objects, (o) => o.style.radius ?? 0) ?? 0)}
                min={0}
                max={120}
                suffix="px"
                onChange={(v) => state().patchStyle(selection, { radius: v }, { radius: v })}
                className="pc-corner-val-field"
              />
            </div>
          </Row>
        )}

        {/* Shadow Row */}
        {boxy && (
          <Row label="Effects">
            <Toggle
              label="Drop shadow"
              checked={!!shared(objects, (o) => o.style.shadow)}
              onChange={(v) => state().patchStyle(selection, { shadow: v })}
            />
          </Row>
        )}
      </Section>

      {has("media") && single && (
        <Section title={single.data.mediaKind === "audio" ? "Audio" : "Video"}>
          <Row>
            <div className="btn-row">
              <button type="button" onClick={() => togglePlay(single)}>
                {isPlaying(single.id) ? "Pause" : "Play"}
              </button>
              <button type="button" onClick={() => restart(single)}>
                Restart
              </button>
            </div>
          </Row>
          <Row label="Title">
            <input
              className="ins-input"
              value={single.data.title ?? ""}
              onChange={(e) => state().patchData(single.id, { title: e.target.value })}
            />
          </Row>
          <Row>
            <Toggle
              label="Loop"
              checked={!!single.data.loop}
              onChange={(v) => {
                state().patchData(single.id, { loop: v });
                setLoop(single, v);
              }}
            />
            <Toggle
              label="Muted"
              checked={!!single.data.muted}
              onChange={(v) => {
                state().patchData(single.id, { muted: v });
                setMuted(single, v);
              }}
            />
          </Row>
          <p className="ins-note">
            Click the play button on the canvas, or scrub the bar under it. Video starts muted so a
            board never surprises you with sound.
          </p>
        </Section>
      )}

      {has("placeholder") && single && (
        <Section title="Image slot">
          <Row>
            <button
              type="button"
              className="mini-btn"
              onClick={async () => {
                const files = await pickImageFiles();
                if (!files[0]) return;
                const src = await readFileAsDataUrl(files[0]);
                const size = await measureImage(src);
                state().fillPlaceholder(single.id, src, size.width, size.height);
              }}
            >
              Choose an image…
            </button>
          </Row>
          <p className="ins-note">
            Or double-click the slot on the canvas, or drop a file straight onto it — the picture
            fills the box exactly.
          </p>
        </Section>
      )}

      {has("table") && single && (
        <Section title="Table">
          <Row>
            <div className="btn-row">
              <button
                type="button"
                onClick={() => {
                  const rows = [...(single.data.rows ?? [])];
                  rows.push(new Array(rows[0]?.length ?? 1).fill(""));
                  state().patchData(single.id, { rows });
                  state().patchObject(single.id, { height: rows.length * 38 });
                }}
              >
                + Row
              </button>
              <button
                type="button"
                onClick={() => {
                  const rows = (single.data.rows ?? []).slice(0, -1);
                  if (rows.length < 1) return;
                  state().patchData(single.id, { rows });
                  state().patchObject(single.id, { height: rows.length * 38 });
                }}
              >
                − Row
              </button>
              <button
                type="button"
                onClick={() => {
                  const rows = (single.data.rows ?? []).map((r) => [...r, ""]);
                  state().patchData(single.id, { rows });
                  state().patchObject(single.id, { width: single.width + 150 });
                }}
              >
                + Col
              </button>
              <button
                type="button"
                onClick={() => {
                  const rows = (single.data.rows ?? []).map((r) => r.slice(0, -1));
                  if (!rows[0]?.length) return;
                  state().patchData(single.id, { rows });
                  state().patchObject(single.id, { width: Math.max(160, single.width - 150) });
                }}
              >
                − Col
              </button>
            </div>
          </Row>
          <p className="ins-note">
            Double-click the table to edit it as text: one row per line, tab between cells.
          </p>
        </Section>
      )}

      {has("card") && single && (
        <Section title="Flashcard">
          <Row label="Front">
            <input
              className="ins-input"
              value={single.data.front ?? ""}
              onChange={(e) => state().patchData(single.id, { front: e.target.value })}
            />
          </Row>
          <Row label="Back">
            <input
              className="ins-input"
              value={single.data.back ?? ""}
              onChange={(e) => state().patchData(single.id, { back: e.target.value })}
            />
          </Row>
          <Row>
            <Toggle
              label="Show the back"
              checked={!!single.data.flipped}
              onChange={(v) => state().patchData(single.id, { flipped: v })}
            />
          </Row>
        </Section>
      )}

      {has("polygon") && single && (
        <Section title="Polygon">
          <Row label="Sides">
            <Slider
              value={single.data.sides ?? 6}
              min={3}
              max={16}
              onChange={(v) => {
                for (const o of objects) state().patchData(o.id, { sides: v });
                state().setDefaults({ polygonSides: v });
              }}
            />
          </Row>
          <Row>
            <Toggle
              label="Star"
              checked={!!single.data.star}
              onChange={(v) => {
                for (const o of objects) state().patchData(o.id, { star: v });
              }}
            />
          </Row>
          {single.data.star && (
            <Row label="Depth">
              <Slider
                value={Math.round((single.data.innerRatio ?? 0.5) * 100)}
                min={10}
                max={90}
                onChange={(v) => {
                  for (const o of objects) state().patchData(o.id, { innerRatio: v / 100 });
                }}
                format={(v) => `${v}%`}
              />
            </Row>
          )}
        </Section>
      )}

      {boxy && (
        <Section title="Gradient & blend" icon={<span className="pc-sec-icon is-violet">◐</span>}>
          <Row>
            <Toggle
              label="Linear gradient"
              checked={!!gradient}
              onChange={(v) =>
                state().patchStyle(selection, {
                  gradient: v
                    ? {
                        from:
                          first.style.fill && first.style.fill !== "transparent"
                            ? first.style.fill
                            : "#ffffff",
                        to: first.style.stroke ?? "#17170f",
                        angle: 90,
                      }
                    : null,
                })
              }
            />
          </Row>
          {gradient && (
            <>
              <Row label="Colours">
                <div className="gradient-row">
                  <ColorField
                    value={gradient.from}
                    swatches={[...FILLS, ...INK]}
                    onChange={(hex) =>
                      state().patchStyle(selection, { gradient: { ...gradient, from: hex } })
                    }
                  />
                  <span
                    className="gradient-preview"
                    style={{
                      background: `linear-gradient(${gradient.angle + 90}deg, ${gradient.from}, ${gradient.to})`,
                    }}
                  />
                  <ColorField
                    value={gradient.to}
                    swatches={[...FILLS, ...INK]}
                    onChange={(hex) =>
                      state().patchStyle(selection, { gradient: { ...gradient, to: hex } })
                    }
                  />
                </div>
              </Row>
              <Row label="Angle">
                <Slider
                  value={gradient.angle}
                  min={0}
                  max={360}
                  onChange={(v) =>
                    state().patchStyle(selection, { gradient: { ...gradient, angle: v } })
                  }
                  format={(v) => `${v}°`}
                />
              </Row>
            </>
          )}
          <Row label="Blend Mode">
            <select
              className="pc-blend-select"
              value={first.style.blend ?? "source-over"}
              onChange={(e) => state().patchStyle(selection, { blend: e.target.value as any })}
            >
              <optgroup label="Normal">
                <option value="source-over">Normal</option>
                <option value="dissolve">Dissolve</option>
              </optgroup>
              <optgroup label="Darken">
                <option value="darken">Darken</option>
                <option value="multiply">Multiply</option>
                <option value="color-burn">Color Burn</option>
                <option value="linear-burn">Linear Burn</option>
                <option value="darker-color">Darker Color</option>
              </optgroup>
              <optgroup label="Lighten">
                <option value="lighten">Lighten</option>
                <option value="screen">Screen</option>
                <option value="color-dodge">Color Dodge</option>
                <option value="linear-dodge">Linear Dodge (Add)</option>
                <option value="lighter-color">Lighter Color</option>
              </optgroup>
              <optgroup label="Contrast">
                <option value="overlay">Overlay</option>
                <option value="soft-light">Soft Light</option>
                <option value="hard-light">Hard Light</option>
                <option value="vivid-light">Vivid Light</option>
                <option value="linear-light">Linear Light</option>
                <option value="pin-light">Pin Light</option>
                <option value="hard-mix">Hard Mix</option>
              </optgroup>
              <optgroup label="Inversion">
                <option value="difference">Difference</option>
                <option value="exclusion">Exclusion</option>
                <option value="subtract">Subtract</option>
                <option value="divide">Divide</option>
              </optgroup>
              <optgroup label="Component">
                <option value="hue">Hue</option>
                <option value="saturation">Saturation</option>
                <option value="color">Color</option>
                <option value="luminosity">Luminosity</option>
              </optgroup>
            </select>
          </Row>
        </Section>
      )}

      <Section title="Style Tools" icon={<span className="pc-sec-icon is-purple">🖌</span>}>
        <div className="pc-style-tools-row">
          <button type="button" className="pc-tool-btn-with-label" title="Copy object style" onClick={() => state().copyStyle()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 4v7h7V4H4zm1 1h5v5H5V5zm6-3H2v9h1V3h8V2z"/>
            </svg>
            <span>Copy</span>
          </button>
          <button type="button" className="pc-tool-btn-with-label" title="Paste copied style" onClick={() => state().pasteStyle()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H5zm0 1h6a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/>
            </svg>
            <span>Paste</span>
          </button>
          <button
            type="button"
            className="pc-tool-btn-with-label"
            title="Pick stroke color from canvas"
            onClick={() => {
              state().setUi({ eyedropper: "stroke" });
              state().flashHint("Click anywhere to pick stroke color");
            }}
          >
            <IconDropper width={14} height={14} />
            <span>Stroke</span>
          </button>
          <button
            type="button"
            className="pc-tool-btn-with-label is-primary-gradient"
            title="Pick fill color from canvas"
            onClick={() => {
              state().setUi({ eyedropper: "fill" });
              state().flashHint("Click anywhere to pick fill color");
            }}
          >
            <IconDropper width={14} height={14} />
            <span>Fill</span>
          </button>
        </div>
      </Section>

      <Section title="Step and Repeat">
        <div className="pc-repeat-panel-box">
          <div className="pc-repeat-inputs-grid">
            <NumberField
              label="Count"
              value={repeat.count}
              min={1}
              max={60}
              onChange={(v) => setRepeat((r) => ({ ...r, count: v }))}
            />
            <NumberField
              label="Angle"
              suffix="°"
              value={repeat.rotate}
              min={-180}
              max={180}
              onChange={(v) => setRepeat((r) => ({ ...r, rotate: v }))}
            />
            <NumberField
              label="X Gap"
              suffix="px"
              value={repeat.dx}
              min={-2000}
              max={2000}
              onChange={(v) => setRepeat((r) => ({ ...r, dx: v }))}
            />
            <NumberField
              label="Y Gap"
              suffix="px"
              value={repeat.dy}
              min={-2000}
              max={2000}
              onChange={(v) => setRepeat((r) => ({ ...r, dy: v }))}
            />
          </div>
          <div className="pc-repeat-actions-row">
            <NumberField
              label="Scale"
              suffix="%"
              value={Math.round(repeat.scale * 100)}
              min={10}
              max={300}
              onChange={(v) => setRepeat((r) => ({ ...r, scale: v / 100 }))}
            />
            <button type="button" className="pc-action-btn-primary" onClick={() => state().repeatSelection(repeat)}>
              Duplicate Steps
            </button>
          </div>
          <p className="ins-note">
            Each copy steps from the last — offset, turned and scaled by these amounts.
          </p>
        </div>
      </Section>

      {textish && (
        <Section title="Text">
          <CapsuleRow label="Font" divider>
            <FontPicker
              value={shared(objects, (o) => o.style.fontFamily ?? "sans") ?? "sans"}
              onChange={(f) =>
                state().patchStyle(
                  selection,
                  { fontFamily: f as FontKey },
                  { fontFamily: f as FontKey },
                )
              }
            />
          </CapsuleRow>
          <Row label="Size">
            <NumberField
              value={shared(objects, (o) => o.style.fontSize ?? 16)}
              min={6}
              max={280}
              onChange={(v) => state().patchStyle(selection, { fontSize: v })}
            />
            <Segmented
              compact
              value={String(shared(objects, (o) => o.style.fontWeight ?? 400) ?? "")}
              options={[
                { value: "400", label: "R", title: "Regular" },
                { value: "650", label: "B", title: "Bold" },
              ]}
              onChange={(v) => state().patchStyle(selection, { fontWeight: Number(v) })}
            />
            <Segmented
              compact
              value={shared(objects, (o) => o.style.fontStyle ?? "normal")}
              options={[
                { value: "normal", label: "A", title: "Normal" },
                { value: "italic", label: <em>A</em>, title: "Italic" },
              ]}
              onChange={(v) => state().patchStyle(selection, { fontStyle: v })}
            />
          </Row>
          <Row label="Align">
            <Segmented
              compact
              value={shared(objects, (o) => o.style.align ?? "left")}
              options={[
                { value: "left", label: "◧", title: "Left" },
                { value: "center", label: "◫", title: "Centre" },
                { value: "right", label: "◨", title: "Right" },
              ]}
              onChange={(v) => state().patchStyle(selection, { align: v })}
            />
            {has("rect", "ellipse", "triangle", "diamond") && (
              <Segmented
                compact
                value={shared(objects, (o) => o.style.verticalAlign ?? "middle")}
                options={[
                  { value: "top", label: "⌃", title: "Top" },
                  { value: "middle", label: "–", title: "Middle" },
                  { value: "bottom", label: "⌄", title: "Bottom" },
                ]}
                onChange={(v) => state().patchStyle(selection, { verticalAlign: v })}
              />
            )}
          </Row>
          <Row label="Colour">
            <ColorField
              value={shared(objects, (o) => o.style.color) ?? undefined}
              swatches={INK}
              onChange={(hex) => state().patchStyle(selection, { color: hex })}
            />
            <NumberField
              label="LH"
              value={shared(objects, (o) => o.style.lineHeight ?? 1.35)}
              min={0.8}
              max={3}
              step={0.05}
              precision={2}
              onChange={(v) => state().patchStyle(selection, { lineHeight: v })}
            />
            <NumberField
              label="LS"
              value={shared(objects, (o) => o.style.letterSpacing ?? 0)}
              min={-5}
              max={40}
              step={0.5}
              precision={1}
              onChange={(v) => state().patchStyle(selection, { letterSpacing: v })}
            />
          </Row>
          {has("text", "note", "rect", "ellipse", "triangle", "diamond", "polygon") && (
            <Row label="Case">
              <Segmented
                compact
                value={shared(objects, (o) => o.style.textTransform ?? "none")}
                options={[
                  { value: "none", label: "Aa" },
                  { value: "uppercase", label: "AA", title: "Big caps" },
                  { value: "capitalize", label: "Ab", title: "Capitalise words" },
                ]}
                onChange={(v) => state().patchStyle(selection, { textTransform: v })}
              />
              <Segmented
                compact
                value={shared(objects, (o) => o.style.textList ?? "none")}
                options={[
                  { value: "none", label: "¶", title: "Plain" },
                  { value: "bullet", label: "•", title: "Bullets" },
                  { value: "number", label: "1.", title: "Numbered" },
                  { value: "check", label: "☐", title: "Checklist" },
                ]}
                onChange={(v) => state().patchStyle(selection, { textList: v })}
              />
            </Row>
          )}
          {has("text") && (
            <Row label="Box">
              <Segmented
                compact
                value={shared(objects, (o) => (o.data.autoWidth ? "point" : "box"))}
                options={[
                  { value: "point", label: "Hug", title: "Point text — grows with what you type" },
                  { value: "box", label: "Wrap", title: "Paragraph — wraps at the box width" },
                ]}
                onChange={(v) => {
                  for (const id of selection) state().patchData(id, { autoWidth: v === "point" });
                  state().fitText(selection);
                }}
              />
            </Row>
          )}
          {has("text") && (
            <Row label="Preset">
              <Segmented
                compact
                value={shared(objects, (o) => o.data.textRole ?? "body")}
                options={(Object.keys(TEXT_ROLES) as TextRole[]).map((r) => ({
                  value: r,
                  label: TEXT_ROLES[r].label.slice(0, 2),
                  title: TEXT_ROLES[r].label,
                }))}
                onChange={(role) => {
                  const preset = TEXT_ROLES[role];
                  for (const o of objects) state().patchData(o.id, { textRole: role });
                  state().patchStyle(selection, {
                    fontSize: preset.fontSize,
                    fontWeight: preset.fontWeight,
                  });
                  state().setDefaults({ textRole: role });
                }}
              />
            </Row>
          )}
        </Section>
      )}

      {has("note") && (
        <Section title="Note">
          <Row>
            <div className="chip-row">
              {(Object.keys(NOTE_COLORS) as NoteKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={`note-chip${shared(objects, (o) => o.data.noteKind) === kind ? " is-active" : ""}`}
                  style={{ background: NOTE_COLORS[kind].bg, color: NOTE_COLORS[kind].ink }}
                  onClick={() => {
                    for (const o of objects) {
                      state().patchData(o.id, { noteKind: kind });
                      state().patchStyle([o.id], {
                        fill: NOTE_COLORS[kind].bg,
                        color: NOTE_COLORS[kind].ink,
                      });
                    }
                    state().setDefaults({ noteKind: kind });
                  }}
                >
                  {NOTE_COLORS[kind].label}
                </button>
              ))}
            </div>
          </Row>
        </Section>
      )}

      {has("arrow", "line") && (
        <Section title="Connector">
          <Row label="Shape">
            <Segmented
              compact
              value={
                shared(objects, (o) => (o.style.elbow ? "elbow" : o.style.curve ? "curved" : "straight")) ??
                "straight"
              }
              options={[
                { value: "straight", label: "╱", title: "Straight" },
                { value: "curved", label: "︵", title: "Curved" },
                { value: "elbow", label: "⌐", title: "Elbow" },
              ]}
              onChange={(v) =>
                state().patchStyle(
                  selection,
                  {
                    curve: v === "curved" ? 0.35 : 0,
                    elbow: v === "elbow",
                  },
                  { arrowStyle: v },
                )
              }
            />
          </Row>
          <Row label="Ends">
            <Toggle
              label="Start"
              checked={!!shared(objects, (o) => o.style.arrowStart)}
              onChange={(v) => state().patchStyle(selection, { arrowStart: v })}
            />
            <Toggle
              label="End"
              checked={shared(objects, (o) => o.style.arrowEnd) !== false}
              onChange={(v) => state().patchStyle(selection, { arrowEnd: v })}
            />
          </Row>
          {single && (
            <Row label="Label">
              <input
                className="ins-input"
                value={single.data.text ?? ""}
                placeholder="add a label"
                onChange={(e) => state().patchData(single.id, { text: e.target.value })}
              />
            </Row>
          )}
          {single && (single.data.from || single.data.to) && (
            <Row>
              <span className="ins-readout">
                Docked{single.data.from ? " ← start" : ""}
                {single.data.to ? " → end" : ""}
              </span>
              <button
                type="button"
                className="mini-btn"
                onClick={() => {
                  state().bindEndpoint(single.id, "from", undefined);
                  state().bindEndpoint(single.id, "to", undefined);
                }}
              >
                Detach
              </button>
            </Row>
          )}
        </Section>
      )}

      {has("measure") && single && (
        <Section title="Measurement">
          <Row label="Label">
            <input
              className="ins-input"
              value={single.data.label ?? ""}
              placeholder={formatMeasure(
                Math.hypot(single.width, single.height),
                doc.settings.unit,
                doc.settings.unitScale,
              )}
              onChange={(e) => state().patchData(single.id, { label: e.target.value })}
            />
          </Row>
          <p className="ins-note">Units follow the board setting in the Canvas tab.</p>
        </Section>
      )}

      {has("image") && single && (
        <Section title="Image">
          <Row>
            <div className="btn-row">
              <button type="button" onClick={() => state().setCropId(single.id)}>
                Crop
              </button>
              <button
                type="button"
                onClick={() => {
                  state().patchData(single.id, { crop: undefined });
                  const nw = single.data.naturalWidth ?? single.width;
                  const nh = single.data.naturalHeight ?? single.height;
                  state().patchObject(single.id, { height: (single.width * nh) / nw });
                }}
              >
                Reset crop
              </button>
            </div>
          </Row>
          <Row>
            <Toggle
              label="Trace mode"
              hint="Dim and lock the image so you can sketch over it"
              checked={!!single.data.trace}
              onChange={(v) => {
                state().patchData(single.id, { trace: v });
                state().patchObject(single.id, { locked: v });
              }}
            />
          </Row>
        </Section>
      )}

      {has("frame") && single && (
        <Section title="Frame">
          <Row label="Chrome">
            <Segmented
              compact
              value={(single.data.frameKind ?? "plain") as FrameKind}
              options={[
                { value: "plain", label: "Plain" },
                { value: "browser", label: "Browser" },
                { value: "phone", label: "Phone" },
                { value: "desktop", label: "Desktop" },
              ]}
              onChange={(v) => state().patchData(single.id, { frameKind: v })}
            />
          </Row>
          {single.data.frameKind === "browser" && (
            <Row label="URL">
              <input
                className="ins-input"
                value={single.data.url ?? ""}
                onChange={(e) => state().patchData(single.id, { url: e.target.value })}
              />
            </Row>
          )}
        </Section>
      )}

      {has("list") && single && (
        <Section title="Outline">
          <Row label="Marker">
            <Segmented
              compact
              value={single.data.listKind ?? "bullet"}
              options={[
                { value: "bullet", label: "Bullet" },
                { value: "number", label: "Number" },
                { value: "check", label: "Check" },
              ]}
              onChange={(v) => state().patchData(single.id, { listKind: v })}
            />
          </Row>
          <Row>
            <button
              type="button"
              className="mini-btn"
              onClick={() => state().patchObject(single.id, { height: listHeight(single) })}
            >
              Fit height
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                const items = (single.data.items ?? []).map((i) => ({ ...i, collapsed: true }));
                state().patchData(single.id, { items });
                state().patchObject(single.id, {
                  height: listHeight({ ...single, data: { ...single.data, items } }),
                });
              }}
            >
              Collapse all
            </button>
            <button
              type="button"
              className="mini-btn"
              onClick={() => {
                const items = (single.data.items ?? []).map((i) => ({ ...i, collapsed: false }));
                state().patchData(single.id, { items });
                state().patchObject(single.id, {
                  height: listHeight({ ...single, data: { ...single.data, items } }),
                });
              }}
            >
              Expand all
            </button>
          </Row>
          <p className="ins-note">
            Double-click to edit. Indent a line by two spaces to nest it; parents get a fold
            triangle you can click on the canvas.
          </p>
        </Section>
      )}

      {has("draw") && (
        <Section title="Stroke">
          <Row label="Smoothing">
            <Segmented
              compact
              value={String(shared(objects, (o) => o.style.smoothing ?? 1) ?? 1)}
              options={[
                { value: "0", label: "Raw" },
                { value: "1", label: "Smooth" },
                { value: "2", label: "Very" },
              ]}
              onChange={(v) =>
                state().patchStyle(selection, { smoothing: Number(v) }, { penSmoothing: Number(v) })
              }
            />
          </Row>
        </Section>
      )}

      {has("embed") && single && (
        <Section title="Link">
          <Row label="URL">
            <input
              className="ins-input"
              value={single.data.url ?? ""}
              onChange={(e) => state().patchData(single.id, { url: e.target.value })}
            />
          </Row>
          <Row label="Title">
            <input
              className="ins-input"
              value={single.data.title ?? ""}
              onChange={(e) => state().patchData(single.id, { title: e.target.value })}
            />
          </Row>
          <Row>
            <a className="mini-btn" href={single.data.url} target="_blank" rel="noreferrer">
              Open link
            </a>
          </Row>
        </Section>
      )}

      <p className="ins-note">
        Style changes stick: the next object you draw matches the last one you edited.
      </p>
    </>
  );
}

/** Shown with nothing selected: sets what the next object will look like. */
function Defaults() {
  const defaults = useStore((s) => s.defaults);
  const state = useStore.getState;
  const dashes = [
    { value: "solid", label: "—", title: "Solid line" },
    { value: "dashed", label: "╌", title: "Dashed line" },
    { value: "dotted", label: "···", title: "Dotted line" },
  ];

  return (
    <>
      <Section title="Defaults">
        <CapsuleColor
          label="Stroke"
          value={defaults.ink}
          swatches={INK}
          onChange={(hex) => state().setDefaults({ ink: hex })}
          extra={
            <Segmented
              compact
              value={(defaults.dash as any) ?? "solid"}
              options={dashes as any}
              onChange={(d) => state().setDefaults({ dash: d })}
            />
          }
        />
        <CapsuleSlider
          label="Width"
          value={defaults.strokeWidth}
          min={0.5}
          max={48}
          step={0.5}
          suffix="px"
          onChange={(w) => state().setDefaults({ strokeWidth: w })}
        />
        <CapsuleColor
          label="Fill"
          value={defaults.fill}
          swatches={FILLS}
          allowNone
          onChange={(hex) => state().setDefaults({ fill: hex })}
        />
        <CapsuleSlider
          label="Radius"
          value={defaults.radius}
          min={0}
          max={64}
          step={1}
          suffix="px"
          onChange={(v) => state().setDefaults({ radius: v })}
        />
        <CapsuleRow label="Font" divider>
          <FontPicker
            value={defaults.fontFamily}
            onChange={(f) => state().setDefaults({ fontFamily: f as FontKey })}
          />
        </CapsuleRow>
      </Section>

      <Section title="Pen">
        <CapsuleSlider
          label="Tip Size"
          value={defaults.penSize}
          min={1}
          max={48}
          step={1}
          suffix="px"
          onChange={(v) => state().setDefaults({ penSize: v })}
        />
        <CapsuleRow label="Smoothing">
          <Segmented
            compact
            value={String(defaults.penSmoothing)}
            options={[
              { value: "0", label: "Raw", title: "Raw input" },
              { value: "1", label: "Smooth", title: "Balanced smoothing" },
              { value: "2", label: "Very", title: "Fluid smoothing" },
            ]}
            onChange={(v) => state().setDefaults({ penSmoothing: Number(v) })}
          />
        </CapsuleRow>
      </Section>

      <Section title="Sticky Note">
        <p className="ins-note" style={{ margin: "0 0 10px" }}>
          Click any color to place a new note on the board:
        </p>
        <div className="pc-sticky-notes-grid">
          {(Object.keys(NOTE_COLORS) as NoteKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`pc-sticky-pill ${defaults.noteKind === kind ? "is-active" : ""}`}
              style={{
                "--note-bg": NOTE_COLORS[kind].bg,
                "--note-ink": NOTE_COLORS[kind].ink,
              } as any}
              title={`Click to place a ${NOTE_COLORS[kind].label} sticky note`}
              onClick={() => {
                const st = state();
                st.setDefaults({ noteKind: kind });
                const { viewport, camera } = st;
                const at = screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
                const note = createNote(at, kind, st.defaults);
                st.addObjects([note]);
                st.setSelection([note.id]);
                st.flashHint(`${NOTE_COLORS[kind].label} note added`);
              }}
            >
              <span className="pc-sticky-dot" style={{ background: NOTE_COLORS[kind].ink }} />
              <span className="pc-sticky-text">{NOTE_COLORS[kind].label}</span>
            </button>
          ))}
        </div>
      </Section>

      <p className="ins-note">Select something on the canvas to edit it here.</p>
    </>
  );
}

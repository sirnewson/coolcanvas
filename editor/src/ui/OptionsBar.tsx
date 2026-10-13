import { useMemo, useState } from "react";

import { useStore } from "../store/store";
import type { CanvasObject, TextRole, ToolId } from "../types";
import { FILLS, INK, TEXT_ROLES } from "../lib/theme";
import { BLEND_MODES, PRESETS, SHADOW_PRESETS, hasEffects } from "../lib/effects";
import { TRACE_PRESETS } from "../lib/imageTools";
import {
  RENDER_STYLES,
  flattenSelection,
  removeBackground,
  sketchToImage,
  sketchToSite,
  sketchToVideo,
  vectorise,
} from "../lib/studio";
import { ColorField, Segmented } from "./controls";
import { ARRANGEMENTS, arrangeSelection } from "../lib/arrange";
import { EXPLAIN_KINDS, explainVisually } from "../lib/explain";
import {
  IconAlignCenterH,
  IconAlignCenterV,
  IconAlignLeft,
  IconAlignRight,
  IconAlignTop,
  IconAlignBottom,
  IconFlipH,
  IconFlipV,
  IconToBack,
  IconToFront,
} from "./icons";

const TOOL_NAMES: Record<ToolId, string> = {
  select: "Select",
  hand: "Hand",
  pen: "Pen Tool",
  highlighter: "Highlighter",
  eraser: "Eraser",
  arrow: "Arrow",
  line: "Line",
  rect: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  polygon: "Polygon",
  frame: "Frame",
  text: "Text",
  note: "Sticky note",
  measure: "Measure",
  list: "Outline",
  table: "Table",
  card: "Flashcard",
  placeholder: "Image slot",
  image: "Image",
};

/** A small labelled dropdown that fires an action per option. */
function Pick({
  label,
  options,
  onPick,
  disabled,
  accent,
}: {
  label: string;
  options: { id: string; label: string }[];
  onPick(id: string): void;
  disabled?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ob-pick${open ? " is-open" : ""}`} onPointerLeave={() => setOpen(false)}>
      <button
        type="button"
        className={`ob-btn${accent ? " is-accent" : ""}`}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <span className="ob-caret">▾</span>
      </button>
      {open && (
        <div className="ob-menu">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setOpen(false);
                onPick(o.id);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Photoshop's options bar: one strip under the menus whose contents follow
 * the active tool, or the selection when the Select tool is live. It is the
 * always-visible complement to the floating context toolbar.
 */
export function OptionsBar({ onInsertImage }: { onInsertImage: () => void }) {
  const tool = useStore((s) => s.tool);
  const defaults = useStore((s) => s.defaults);
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const adjustPicture = useStore((s) => s.ui.adjustPicture);
  const state = useStore.getState;

  const objects = useMemo(
    () => selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
    [selection, doc],
  );
  const first = objects[0];
  const hasImage = objects.some((o) => o.type === "image");
  const has = objects.length > 0;
  const drawing = tool === "pen" || tool === "highlighter";
  const shapeTool = ["rect", "ellipse", "triangle", "diamond", "polygon", "arrow", "line", "frame", "measure"].includes(tool);
  const selecting = tool === "select" && has;

  const maskable = ["rect", "ellipse", "triangle", "diamond", "polygon"];
  const imageSel = objects.find((o) => o.type === "image");
  const shapeSel = objects.find((o) => maskable.includes(o.type));
  const canMask = objects.length === 2 && !!imageSel && !!shapeSel;
  const masked = objects.length === 1 && maskable.includes(first?.type ?? "") && !!first?.data.src;

  const opacity = first ? Math.round(first.opacity * 100) : 100;
  const blend = first?.style.blend ?? "source-over";
  const preset = first?.style.effects && hasEffects(first.style.effects) ? "custom" : "none";

  return (
    <div className="optionsbar" data-ui>
      <span className="ob-tool">{selecting ? `${objects.length} selected` : TOOL_NAMES[tool]}</span>
      <span className="ob-rule" />

      {/* ------------------------------------------------- tool options */}
      {drawing && (
        <>
          <span className="ob-label">Size</span>
          <input
            type="range"
            className="ob-range"
            min={1}
            max={40}
            value={defaults.penSize}
            onChange={(e) => state().setDefaults({ penSize: Number(e.target.value) })}
          />
          <em className="ob-value">{defaults.penSize}px</em>
          <Segmented
            compact
            value={String(defaults.penSmoothing)}
            options={[
              { value: "0", label: "Raw" },
              { value: "1", label: "Smooth" },
              { value: "2", label: "Very" },
            ]}
            onChange={(v) => state().setDefaults({ penSmoothing: Number(v) })}
          />
          <span className="ob-label">Ink</span>
          <ColorField value={defaults.ink} swatches={INK} onChange={(hex) => state().setDefaults({ ink: hex })} />
        </>
      )}

      {shapeTool && (
        <>
          <span className="ob-label">Stroke</span>
          <ColorField value={defaults.ink} swatches={INK} onChange={(hex) => state().setDefaults({ ink: hex })} />
          <input
            type="number"
            className="ob-num"
            min={0}
            max={40}
            value={defaults.strokeWidth}
            onChange={(e) => state().setDefaults({ strokeWidth: Number(e.target.value) })}
          />
          <span className="ob-label">Fill</span>
          <ColorField value={defaults.fill} swatches={FILLS} allowNone onChange={(hex) => state().setDefaults({ fill: hex })} />
          <Segmented
            compact
            value={defaults.dash ?? "solid"}
            options={[
              { value: "solid", label: "—" },
              { value: "dashed", label: "- -" },
              { value: "dotted", label: "· ·" },
            ]}
            onChange={(v) => state().setDefaults({ dash: v })}
          />
        </>
      )}

      {(tool === "text" || tool === "note" || tool === "list") && (
        <>
          <span className="ob-label">Ink</span>
          <ColorField value={defaults.ink} swatches={INK} onChange={(hex) => state().setDefaults({ ink: hex })} />
          {tool === "text" && (
            <Segmented
              compact
              value={defaults.textRole}
              options={(Object.keys(TEXT_ROLES) as TextRole[]).map((r) => ({ value: r, label: TEXT_ROLES[r].label }))}
              onChange={(v) => state().setDefaults({ textRole: v })}
            />
          )}
          <span className="ob-hint">{tool === "text" ? "Click to type · drag to draw a paragraph box" : "Click on the board to place, then type"}</span>
        </>
      )}

      {selecting && objects.every((o) => ["text", "note", "rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type)) && (
        <>
          <Segmented
            compact
            value={first.style.textTransform ?? "none"}
            options={[
              { value: "none", label: "Aa" },
              { value: "uppercase", label: "AA", title: "Big caps" },
              { value: "capitalize", label: "Ab", title: "Capitalise" },
            ]}
            onChange={(v) => state().patchStyle(selection, { textTransform: v })}
          />
          <Segmented
            compact
            value={first.style.textList ?? "none"}
            options={[
              { value: "none", label: "¶" },
              { value: "bullet", label: "•", title: "Bullets" },
              { value: "number", label: "1.", title: "Numbered" },
              { value: "check", label: "☐", title: "Checklist" },
            ]}
            onChange={(v) => state().patchStyle(selection, { textList: v })}
          />
          <input
            type="number"
            className="ob-num"
            min={6}
            max={400}
            value={first.style.fontSize ?? 18}
            onChange={(e) => {
              state().patchStyle(selection, { fontSize: Number(e.target.value) });
              state().fitText(selection.filter((id) => doc.objects[id]?.type === "text"));
            }}
            title="Font size"
          />
          <span className="ob-rule" />
        </>
      )}

      {tool === "select" && !has && (
        <span className="ob-hint">Click an object to edit it here · drag on empty space to marquee</span>
      )}

      {/* --------------------------------------------- selection options */}
      {selecting && (
        <>
          <span className="ob-label">Opacity</span>
          <input
            type="range"
            className="ob-range"
            min={0}
            max={100}
            value={opacity}
            onChange={(e) => state().patchObjects(selection, { opacity: Number(e.target.value) / 100 })}
          />
          <em className="ob-value">{opacity}%</em>

          <select
            className="ob-select"
            value={blend}
            onChange={(e) => state().patchStyle(selection, { blend: e.target.value })}
            title="Blend mode"
          >
            {BLEND_MODES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>

          <Pick
            label={preset === "custom" ? "Effects ●" : "Effects"}
            options={PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            onPick={(id) => {
              const p = PRESETS.find((x) => x.id === id);
              state().patchEffects(selection, null);
              if (p && id !== "none") state().patchEffects(selection, p.effects);
            }}
          />
          <Pick
            label="Shadow"
            options={SHADOW_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
            onPick={(id) => state().setShadow(selection, SHADOW_PRESETS.find((p) => p.id === id)?.spec ?? null)}
          />
          <button type="button" className="ob-btn" onClick={() => state().openDock("effects")} title="Fine-tune adjustments">
            Adjust…
          </button>

          <span className="ob-rule" />
          {canMask && (
            <button
              type="button"
              className="ob-btn is-accent"
              onClick={() => state().clipImageIntoShape(imageSel!.id, shapeSel!.id)}
              title="Mask the image inside the shape"
            >
              Clip into shape
            </button>
          )}
          {masked && (
            <>
              <button
                type="button"
                className={`ob-btn${adjustPicture ? " is-accent" : ""}`}
                onClick={() => state().setUi({ adjustPicture: !adjustPicture })}
                title={adjustPicture ? "Done adjusting — drag moves the shape again" : "Drag inside the shape to move the picture"}
              >
                {adjustPicture ? "✓ Adjusting picture" : "Adjust picture"}
              </button>
              <span className="ob-label">Zoom</span>
              <input
                type="range"
                className="ob-range"
                min={100}
                max={300}
                value={Math.round((first.data.imageScale ?? 1) * 100)}
                onChange={(e) => state().patchData(first.id, { imageScale: Number(e.target.value) / 100 })}
              />
              <button
                type="button"
                className="ob-btn"
                onClick={() => state().patchData(first.id, { imageOffset: { x: 0, y: 0 }, imageScale: 1 })}
                title="Centre the picture and reset zoom"
              >
                Reset
              </button>
              <button type="button" className="ob-btn" onClick={() => state().releaseImage(first.id)} title="Take the picture back out as its own image">
                Unclip
              </button>
            </>
          )}
          {hasImage && (
            <>
              <Pick
                label="Remove BG"
                options={[
                  { id: "ai", label: "Auto (AI cut-out)" },
                  { id: "key", label: "Flat colour (fast)" },
                ]}
                onPick={(id) => void removeBackground(id as "ai" | "key")}
              />
              <Pick
                label="Vectorize"
                options={TRACE_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
                onPick={(id) => void vectorise(id)}
              />
              {objects.length === 1 && (
                <button type="button" className="ob-btn" onClick={() => state().setCropId(first.id)}>
                  Crop
                </button>
              )}
              <span className="ob-rule" />
            </>
          )}

          <div className="ob-icons">
            <button type="button" title="Flip horizontal" onClick={() => state().flip("h")}>
              <IconFlipH />
            </button>
            <button type="button" title="Flip vertical" onClick={() => state().flip("v")}>
              <IconFlipV />
            </button>
            <button type="button" title="Bring to front" onClick={() => state().reorder(selection, "front")}>
              <IconToFront />
            </button>
            <button type="button" title="Send to back" onClick={() => state().reorder(selection, "back")}>
              <IconToBack />
            </button>
          </div>
          {objects.length > 1 && (
            <div className="ob-icons">
              <button type="button" title="Align left" onClick={() => state().align("left")}>
                <IconAlignLeft />
              </button>
              <button type="button" title="Align centre" onClick={() => state().align("hcenter")}>
                <IconAlignCenterH />
              </button>
              <button type="button" title="Align right" onClick={() => state().align("right")}>
                <IconAlignRight />
              </button>
              <button type="button" title="Align top" onClick={() => state().align("top")}>
                <IconAlignTop />
              </button>
              <button type="button" title="Align middle" onClick={() => state().align("vcenter")}>
                <IconAlignCenterV />
              </button>
              <button type="button" title="Align bottom" onClick={() => state().align("bottom")}>
                <IconAlignBottom />
              </button>
            </div>
          )}
          {objects.length > 1 && (
            <Pick
              label="Arrange"
              options={ARRANGEMENTS.map((a) => ({ id: a.id, label: `${a.label} — ${a.hint}` }))}
              onPick={(id) => arrangeSelection(id as (typeof ARRANGEMENTS)[number]["id"])}
            />
          )}
          {objects.some((o) => o.data.text?.trim() || o.data.items?.length || o.data.front) && (
            <Pick
              accent
              label="✦ Explain visually"
              options={EXPLAIN_KINDS.map((k) => ({ id: k.id, label: `${k.label} — ${k.hint}` }))}
              onPick={(id) => void explainVisually(id as (typeof EXPLAIN_KINDS)[number]["id"])}
            />
          )}
          <button type="button" className="ob-btn" onClick={() => void flattenSelection()} title="Bake effects into one image">
            Flatten
          </button>
        </>
      )}

      {tool === "image" && (
        <button type="button" className="ob-btn" onClick={onInsertImage}>
          Choose a file…
        </button>
      )}

      <span className="ob-spacer" />

      {/* ------------------------------------------------------- AI lane */}
      <Pick
        accent
        label="✦ Sketch → Image"
        options={RENDER_STYLES.map((r) => ({ id: r.id, label: r.label }))}
        onPick={(id) => void sketchToImage(id as (typeof RENDER_STYLES)[number]["id"])}
      />
      <button type="button" className="ob-btn is-accent" onClick={() => void sketchToSite()} title="Turn the sketch into a working web page">
        ✦ Website
      </button>
      <button type="button" className="ob-btn is-accent" onClick={() => void sketchToVideo()} title="Animate the sketch with Veo">
        ✦ Video
      </button>
    </div>
  );
}

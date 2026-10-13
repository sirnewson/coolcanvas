import { useMemo } from "react";

import { useStore } from "../store/store";
import type { CanvasObject, Effects } from "../types";
import { INK } from "../lib/theme";
import {
  BLEND_MODES,
  DEFAULT_SHADOW,
  PRESETS,
  SHADOW_PRESETS,
  hasEffects,
  normaliseEffects,
} from "../lib/effects";
import { flattenSelection } from "../lib/studio";
import { ColorField, Row, Section, Slider, Toggle } from "./controls";

/** Live thumbnail of an effect preset drawn with CSS filters — close enough to read at a glance. */
function presetFilter(e: Effects): string {
  const n = normaliseEffects(e);
  const parts: string[] = [];
  if (n.brightness) parts.push(`brightness(${1 + n.brightness})`);
  if (n.contrast) parts.push(`contrast(${1 + n.contrast / 100})`);
  if (n.saturation) parts.push(`saturate(${Math.max(0, 1 + n.saturation)})`);
  if (n.hue) parts.push(`hue-rotate(${n.hue * 180}deg)`);
  if (n.grayscale) parts.push("grayscale(1)");
  if (n.sepia) parts.push("sepia(1)");
  if (n.invert) parts.push("invert(1)");
  if (n.blur) parts.push(`blur(${Math.min(2, n.blur / 3)}px)`);
  if (n.threshold) parts.push("contrast(8) grayscale(1)");
  if (n.posterize) parts.push("contrast(1.4) saturate(1.6)");
  return parts.join(" ") || "none";
}

/**
 * Effects tab: Canva's one-tap looks on top, Photoshop's adjustment sliders
 * underneath, then shadow and blending. Everything edits the selection live
 * and lands in undo history like any other change.
 */
export function EffectsPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const state = useStore.getState;

  const objects = useMemo(
    () => selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o && o.type !== "group"),
    [selection, doc],
  );
  const first = objects[0];

  if (!first) {
    return (
      <div className="ins">
        <Section title="Effects">
          <p className="ins-note">
            Select an image, shape, text or drawing to add a look, adjust its tone, or give it a shadow.
          </p>
        </Section>
        <Section title="Looks">
          <div className="fx-presets is-disabled">
            {PRESETS.map((p) => (
              <div key={p.id} className="fx-preset">
                <span className="fx-swatch" style={{ filter: presetFilter(p.effects) }} />
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    );
  }

  const fx = normaliseEffects(first.style.effects);
  const shadow = first.style.shadowSpec ?? null;
  const set = (patch: Partial<Effects>) => state().patchEffects(selection, patch);
  const setShadow = (patch: Partial<NonNullable<typeof shadow>>) =>
    state().setShadow(selection, { ...(shadow ?? DEFAULT_SHADOW), ...patch });

  const activePreset =
    PRESETS.find((p) => JSON.stringify(normaliseEffects(p.effects)) === JSON.stringify(fx))?.id ??
    (hasEffects(first.style.effects) ? "custom" : "none");

  return (
    <div className="ins">
      <Section
        title="Looks"
        aside={
          hasEffects(first.style.effects) ? (
            <button type="button" className="link" onClick={() => state().patchEffects(selection, null)}>
              Reset
            </button>
          ) : undefined
        }
      >
        <div className="fx-presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`fx-preset${activePreset === p.id ? " is-active" : ""}`}
              onClick={() => {
                state().patchEffects(selection, null);
                if (p.id !== "none") state().patchEffects(selection, p.effects);
              }}
            >
              <span className="fx-swatch" style={{ filter: presetFilter(p.effects) }} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Adjust">
        <Slider label="Brightness" value={Math.round(fx.brightness * 100)} min={-100} max={100} onChange={(v) => set({ brightness: v / 100 })} />
        <Slider label="Contrast" value={Math.round(fx.contrast)} min={-100} max={100} onChange={(v) => set({ contrast: v })} />
        <Slider label="Saturation" value={Math.round(fx.saturation * 100)} min={-100} max={300} onChange={(v) => set({ saturation: v / 100 })} />
        <Slider label="Hue" value={Math.round(fx.hue * 180)} min={-180} max={180} format={(v) => `${v}°`} onChange={(v) => set({ hue: v / 180 })} />
        <Slider label="Auto levels" value={Math.round(fx.enhance * 100)} min={0} max={100} onChange={(v) => set({ enhance: v / 100 })} />
        <div className="fx-toggles">
          <Toggle label="Black & white" checked={fx.grayscale} onChange={(v) => set({ grayscale: v })} />
          <Toggle label="Sepia" checked={fx.sepia} onChange={(v) => set({ sepia: v })} />
          <Toggle label="Invert" checked={fx.invert} onChange={(v) => set({ invert: v })} />
          <Toggle label="Solarize" checked={fx.solarize} onChange={(v) => set({ solarize: v })} />
        </div>
      </Section>

      <Section title="Texture">
        <Slider label="Blur" value={fx.blur} min={0} max={40} format={(v) => `${v}px`} onChange={(v) => set({ blur: v })} />
        <Slider label="Pixelate" value={fx.pixelate} min={1} max={64} format={(v) => (v <= 1 ? "off" : `${v}px`)} onChange={(v) => set({ pixelate: v })} />
        <Slider label="Grain" value={Math.round(fx.noise * 100)} min={0} max={100} onChange={(v) => set({ noise: v / 100 })} />
        <Slider label="Posterize" value={fx.posterize} min={0} max={32} format={(v) => (v ? `${v} levels` : "off")} onChange={(v) => set({ posterize: v })} />
        <Slider label="Threshold" value={Math.round(fx.threshold * 100)} min={0} max={100} format={(v) => (v ? `${v}%` : "off")} onChange={(v) => set({ threshold: v / 100 })} />
        <Slider label="Emboss" value={Math.round(fx.emboss * 100)} min={0} max={100} format={(v) => (v ? `${v}%` : "off")} onChange={(v) => set({ emboss: v / 100 })} />
      </Section>

      <Section
        title="Shadow"
        aside={
          shadow ? (
            <button type="button" className="link" onClick={() => state().setShadow(selection, null)}>
              Remove
            </button>
          ) : undefined
        }
      >
        <div className="chips">
          {SHADOW_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip${(p.spec === null && !shadow) || (shadow && p.spec && JSON.stringify(p.spec) === JSON.stringify(shadow)) ? " is-active" : ""}`}
              onClick={() => state().setShadow(selection, p.spec)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {shadow && (
          <>
            <Row label="Colour">
              <ColorField value={shadow.color} swatches={INK} onChange={(hex) => setShadow({ color: hex })} />
            </Row>
            <Slider label="Blur" value={shadow.blur} min={0} max={80} onChange={(v) => setShadow({ blur: v })} />
            <Slider label="Offset X" value={shadow.offsetX} min={-60} max={60} onChange={(v) => setShadow({ offsetX: v })} />
            <Slider label="Offset Y" value={shadow.offsetY} min={-60} max={60} onChange={(v) => setShadow({ offsetY: v })} />
            <Slider label="Opacity" value={Math.round(shadow.opacity * 100)} min={0} max={100} onChange={(v) => setShadow({ opacity: v / 100 })} />
          </>
        )}
      </Section>

      <Section title="Blending">
        <Row label="Mode">
          <select
            className="select"
            value={first.style.blend ?? "source-over"}
            onChange={(e) => state().patchStyle(selection, { blend: e.target.value })}
          >
            {BLEND_MODES.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
        </Row>
        <Slider
          label="Opacity"
          value={Math.round(first.opacity * 100)}
          min={0}
          max={100}
          onChange={(v) => state().patchObjects(selection, { opacity: v / 100 })}
        />
      </Section>

      <Section title="Bake">
        <p className="ins-note">Flatten renders the selection with every effect applied into one plain image.</p>
        <button type="button" className="btn-wide" onClick={() => void flattenSelection()}>
          Flatten to image
        </button>
      </Section>
    </div>
  );
}

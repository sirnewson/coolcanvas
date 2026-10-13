import { useStore } from "../store/store";
import { BACKGROUNDS, BACKGROUND_LABELS } from "../lib/theme";
import type { BackgroundKind, RenderMode, Unit } from "../types";
import { NumberField, Row, Section, Segmented, Slider, Toggle } from "./controls";
import { TimelapseSettings } from "./Timelapse";

const ORDER: BackgroundKind[] = ["blank", "dots", "grid", "blueprint", "paper", "slate", "transparent"];
const UNITS: Unit[] = ["px", "mm", "cm", "in"];
const MODES: { value: RenderMode; label: string; title: string }[] = [
  { value: "sketch", label: "Sketch", title: "Loose hand-drawn rendering" },
  { value: "normal", label: "Normal", title: "Clean geometry" },
  { value: "precision", label: "Precision", title: "Clean geometry with grid snapping" },
];

export function CanvasSettings() {
  const settings = useStore((s) => s.doc.settings);
  const boardName = useStore((s) => s.doc.name);
  const state = useStore.getState;

  return (
    <>
      <Section title="Surface">
        <div className="bg-grid">
          {ORDER.map((kind) => (
            <button
              key={kind}
              type="button"
              className={`bg-swatch${settings.background === kind ? " is-active" : ""}`}
              onClick={() => state().setBackground(kind)}
              title={BACKGROUND_LABELS[kind]}
            >
              <span
                className={`bg-preview is-${kind}`}
                style={kind === "transparent" ? undefined : { background: BACKGROUNDS[kind].surface }}
              />
              <em>{BACKGROUND_LABELS[kind]}</em>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Grid">
        <Row label="Size">
          <Slider
            value={settings.gridSize}
            min={4}
            max={120}
            step={2}
            onChange={(v) => state().setGridSize(v)}
            format={(v) => `${v}px`}
          />
        </Row>
        <Row label="Contrast">
          <Slider
            value={Math.round(settings.gridOpacity * 100)}
            min={5}
            max={100}
            onChange={(v) => state().setGridOpacity(v / 100)}
            format={(v) => `${v}%`}
          />
        </Row>
      </Section>

      <Section title="Snapping">
        <Row>
          <Toggle
            label="Objects & guides"
            checked={settings.snapToObjects}
            onChange={(v) => state().setSnap({ objects: v })}
          />
        </Row>
        <Row>
          <Toggle
            label="Grid"
            checked={settings.snapToGrid}
            onChange={(v) => state().setSnap({ grid: v })}
          />
        </Row>
        <p className="ins-note">Hold Ctrl while dragging to suspend snapping.</p>
      </Section>

      <Section title="Rendering">
        <Row>
          <Segmented
            value={settings.renderMode}
            options={MODES}
            onChange={(v) => state().setRenderMode(v)}
          />
        </Row>
      </Section>

      <Section title="Measurement">
        <Row label="Unit">
          <Segmented
            compact
            value={settings.unit}
            options={UNITS.map((u) => ({ value: u, label: u }))}
            onChange={(v) => state().setUnit(v)}
          />
        </Row>
        <Row label="Scale">
          <NumberField
            value={settings.unitScale}
            min={0.01}
            max={1000}
            step={0.1}
            precision={2}
            onChange={(v) => state().setUnit(settings.unit, v)}
          />
          <span className="ins-readout">board px per {settings.unit}</span>
        </Row>
        <p className="ins-note">
          Set the scale once — for example 4 px per mm — and every measurement, guide gap and
          size readout switches to real-world units.
        </p>
      </Section>

      <TimelapseSettings />

      <Section title="Board">
        <Row label="Name">
          <input
            className="ins-input"
            value={boardName}
            onChange={(e) => state().setBoardName(e.target.value)}
          />
        </Row>
        <Row>
          <button type="button" className="mini-btn" onClick={() => state().setUi({ boardsOpen: true })}>
            All boards…
          </button>
        </Row>
      </Section>
    </>
  );
}

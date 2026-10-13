import { useStore } from "../store/store";
import { setMaxFrames } from "../lib/timelapse";
import { NumberField, Row, Section, Segmented, Slider, Toggle } from "./controls";

/** App-level behaviour, kept in this browser rather than in the board. */
export function Preferences() {
  const prefs = useStore((s) => s.prefs);
  const theme = useStore((s) => s.theme);
  const toolLocked = useStore((s) => s.toolLocked);
  const minimapOpen = useStore((s) => s.ui.minimapOpen);
  const state = useStore.getState;

  return (
    <>
      <Section title="Appearance">
        <Row label="Theme">
          <Segmented
            value={theme}
            options={[
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={(v) => state().setTheme(v)}
          />
        </Row>
        <Row>
          <Toggle
            label="Shortcut letters on tools"
            checked={prefs.showToolKeys}
            onChange={(v) => state().setPrefs({ showToolKeys: v })}
          />
        </Row>
        <Row>
          <Toggle
            label="Outline objects on hover"
            checked={prefs.hoverOutline}
            onChange={(v) => state().setPrefs({ hoverOutline: v })}
          />
        </Row>
        <Row>
          <Toggle
            label="Reduce motion"
            hint="Camera moves jump instead of gliding"
            checked={prefs.reduceMotion}
            onChange={(v) => state().setPrefs({ reduceMotion: v })}
          />
        </Row>
        <Row>
          <Toggle
            label="Show the minimap"
            checked={minimapOpen}
            onChange={(v) => state().setUi({ minimapOpen: v })}
          />
        </Row>
      </Section>

      <Section title="Behaviour">
        <Row label="Snap">
          <Slider
            value={prefs.snapDistance}
            min={0}
            max={24}
            onChange={(v) => state().setPrefs({ snapDistance: v })}
            format={(v) => (v ? `${v}px` : "off")}
          />
        </Row>
        <Row label="Nudge">
          <NumberField
            value={prefs.nudgeStep}
            min={1}
            max={64}
            suffix="px"
            onChange={(v) => state().setPrefs({ nudgeStep: v })}
          />
          <span className="ins-readout">shift × 10</span>
        </Row>
        <Row>
          <Toggle
            label="Keep the tool after each use"
            checked={toolLocked}
            onChange={(v) => state().setToolLocked(v)}
          />
        </Row>
      </Section>

      <Section title="Recording">
        <Row label="Capture">
          <Slider
            value={prefs.captureDelay}
            min={300}
            max={4000}
            step={100}
            onChange={(v) => state().setPrefs({ captureDelay: v })}
            format={(v) => `${(v / 1000).toFixed(1)}s`}
          />
        </Row>
        <Row label="Frames">
          <NumberField
            value={prefs.maxFrames}
            min={30}
            max={2000}
            step={10}
            onChange={(v) => {
              state().setPrefs({ maxFrames: v });
              setMaxFrames(v);
            }}
          />
        </Row>
        <p className="ins-note">
          How long the board must sit still before a time-lapse frame is taken, and how many
          frames to keep before the older half is thinned.
        </p>
      </Section>

      <Section title="Export defaults">
        <Row label="Size">
          <Segmented
            compact
            value={String(prefs.exportScale)}
            options={[1, 2, 3, 4].map((s) => ({ value: String(s), label: `${s}x` }))}
            onChange={(v) => state().setPrefs({ exportScale: Number(v) })}
          />
        </Row>
        <Row label="Padding">
          <Slider
            value={prefs.exportPadding}
            min={0}
            max={160}
            step={4}
            onChange={(v) => state().setPrefs({ exportPadding: v })}
            format={(v) => `${v}px`}
          />
        </Row>
      </Section>

      <Section title="Reset">
        <Row>
          <button type="button" className="mini-btn" onClick={() => state().resetPrefs()}>
            Restore defaults
          </button>
        </Row>
        <p className="ins-note">
          Preferences live in this browser. Boards, their settings and their reels are stored
          separately and are not touched by a reset.
        </p>
      </Section>
    </>
  );
}

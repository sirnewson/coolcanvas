import { useEffect, useRef, useState } from "react";

import { useStore } from "../store/store";
import {
  MAX_FRAMES,
  clearTimelapse,
  framesToCanvases,
  onTimelapseChange,
  timelapseBytes,
  timelapseFrames,
} from "../lib/timelapse";
import { canRecordVideo, downloadBlob, recordVideo, safeFilename } from "../lib/export";
import { deleteReel } from "../persist/idb";
import { Row, Section, Toggle } from "./controls";

function useFrameCount() {
  const [count, setCount] = useState(timelapseFrames().length);
  useEffect(() => onTimelapseChange(() => setCount(timelapseFrames().length)), []);
  return count;
}

/** Full-screen player. Opens straight into a loop, like flicking through the reel. */
export function TimelapsePlayer() {
  const open = useStore((s) => s.ui.timelapseOpen);
  const name = useStore((s) => s.doc.name);
  const state = useStore.getState;
  const count = useFrameCount();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(24);
  const [busy, setBusy] = useState(false);
  const frames = timelapseFrames();
  const startedAt = useRef(0);

  useEffect(() => {
    if (open) {
      setIndex(0);
      setPlaying(true);
      startedAt.current = Date.now();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !playing || count < 2) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, 1000 / Math.max(1, fps));
    return () => window.clearInterval(timer);
  }, [open, playing, count, fps]);

  if (!open) return null;

  const close = () => state().setUi({ timelapseOpen: false });

  const exportVideo = async () => {
    setBusy(true);
    try {
      const canvases = await framesToCanvases(frames);
      const blob = await recordVideo(canvases, fps, 1);
      if (blob) downloadBlob(blob, `${safeFilename(name)}-timelapse.webm`);
      else state().flashHint("This browser cannot record video");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lapse-player" data-ui onPointerDown={close}>
      <div className="lapse-stage" onPointerDown={(e) => e.stopPropagation()}>
        {count ? (
          <img src={frames[Math.min(index, count - 1)]} alt={`Step ${index + 1} of ${count}`} />
        ) : (
          <p className="ins-note">Nothing recorded on this board yet.</p>
        )}

        <div className="lapse-bar">
          <button type="button" className="play" onClick={() => setPlaying((p) => !p)}>
            {playing ? "❚❚" : "▶"}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, count - 1)}
            value={Math.min(index, Math.max(0, count - 1))}
            onChange={(e) => {
              setPlaying(false);
              setIndex(Number(e.target.value));
            }}
          />
          <span className="lapse-count">
            {count ? index + 1 : 0} / {count}
          </span>
          <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className="ins-select">
            {[8, 12, 24, 30, 60].map((f) => (
              <option key={f} value={f}>
                {f} fps
              </option>
            ))}
          </select>
          <button
            type="button"
            className="ghost-btn"
            disabled={busy || !count || !canRecordVideo()}
            onClick={() => void exportVideo()}
          >
            {busy ? "Recording…" : "Save video"}
          </button>
          <button type="button" className="ghost-btn" onClick={close}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/** Controls that live in the Canvas tab. */
export function TimelapseSettings() {
  const recording = useStore((s) => s.recording);
  const boardId = useStore((s) => s.doc.id);
  const state = useStore.getState;
  const count = useFrameCount();
  const mb = (timelapseBytes() / (1024 * 1024)).toFixed(1);

  return (
    <Section title="Time-lapse">
      <Row>
        <Toggle
          label="Record every step"
          checked={recording}
          onChange={(v) => state().setRecording(v)}
        />
      </Row>
      <Row>
        <button
          type="button"
          className="mini-btn"
          disabled={count < 2}
          onClick={() => state().setUi({ timelapseOpen: true })}
        >
          Play the reel
        </button>
        <button
          type="button"
          className="mini-btn"
          disabled={!count}
          onClick={async () => {
            clearTimelapse();
            await deleteReel(boardId);
            state().flashHint("Reel cleared");
          }}
        >
          Clear
        </button>
      </Row>
      <p className="ins-note">
        {count
          ? `${count} frames · about ${mb}MB. `
          : "Nothing recorded yet — the reel starts as soon as you draw. "}
        The board is captured after each change. Past {MAX_FRAMES} frames the older half is
        thinned rather than stopping, so a long session just plays faster.
      </p>
    </Section>
  );
}

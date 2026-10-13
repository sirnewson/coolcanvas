import { useState } from "react";

import { useStore } from "../store/store";
import { boardFromIdea } from "../lib/aiBoard";
import { loadAiSettings } from "../lib/ai";

/** Progress pill for the long jobs — cut-outs, traces, AI renders. */
export function JobPill() {
  const job = useStore((s) => s.ui.job);
  if (!job) return null;
  return (
    <div className="job-pill" role="status" data-ui>
      <span className="job-spin" aria-hidden />
      <span>{job.label}</span>
      {job.progress !== undefined && (
        <span className="job-bar">
          <i style={{ width: `${Math.round(job.progress * 100)}%` }} />
        </span>
      )}
    </div>
  );
}

const STARTERS = [
  "A booking app for a small yoga studio",
  "Onboarding flow for a budgeting app",
  "Landing page for a coffee subscription",
  "A dashboard for tracking solar panels",
];

/**
 * "What do you want to sketch?" — the conversation opener. One line of intent
 * becomes a structured board: brief, wireframes, flow, notes, next steps.
 */
export function SketchStarter({
  onStart,
  onDone,
  compact,
}: {
  onStart?: () => Promise<void> | void;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const state = useStore.getState;
  const hasKey = !!loadAiSettings().apiKey;

  const go = async (text = idea) => {
    const t = text.trim();
    if (!t || busy) return;
    if (!hasKey) {
      state().openDock("assist");
      state().flashHint("Add your API key in the AI tab first");
      return;
    }
    setBusy(true);
    try {
      await onStart?.();
      const title = await boardFromIdea(t);
      if (state().doc.name === "Untitled board") state().setBoardName(title);
      onDone?.();
    } catch {
      /* the hint already reported it */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`starter${compact ? " is-compact" : ""}`} data-ui>
      <label className="starter-field">
        <span className="starter-spark" aria-hidden>
          ✦
        </span>
        <input
          value={idea}
          placeholder="What do you want to sketch?"
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void go();
          }}
          disabled={busy}
        />
        <button type="button" className="primary" disabled={busy || !idea.trim()} onClick={() => void go()}>
          {busy ? "Sketching…" : "Sketch it"}
        </button>
      </label>
      {!compact && (
        <div className="starter-chips">
          {STARTERS.map((s) => (
            <button key={s} type="button" className="chip" disabled={busy} onClick={() => void go(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {!compact && (
        <p className="starter-note">
          Say the idea in a sentence. You get a brief, wireframes, a flow and next steps — every piece editable.
        </p>
      )}
    </div>
  );
}

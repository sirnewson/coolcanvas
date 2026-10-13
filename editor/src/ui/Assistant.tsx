import { useState } from "react";

import { useStore } from "../store/store";
import {
  DEFAULT_AI,
  PROMPTS,
  clearAiSettings,
  generateText,
  listModels,
  loadAiSettings,
  saveAiSettings,
  toLines,
  type AiSettings,
} from "../lib/ai";
import { createImage, createList, createNote } from "../store/factory";
import { screenToWorld } from "../lib/geom";
import { uid } from "../lib/id";
import { measureImage } from "../lib/images";
import type { CanvasObject } from "../types";
import { Row, Section, Toggle } from "./controls";
import { Connectors } from "./Connectors";
import { RENDER_STYLES, describeSketch, sketchToImage, sketchToSite, sketchToVideo, type RenderStyle } from "../lib/studio";
import { DEFAULT_PROVIDERS, PROVIDER_LABELS, generateWithProvider, loadProviders, saveProviders, type ImageProvider, type ImageProviderSettings } from "../lib/imageProviders";

type Mode = "ideate" | "outline" | "critique" | "sketch" | "image";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "ideate", label: "Ideas", blurb: "Six sticky notes to react to" },
  { id: "outline", label: "Outline", blurb: "A collapsible outline object" },
  { id: "sketch", label: "Diagram", blurb: "Connected nodes in a row" },
  { id: "critique", label: "Critique", blurb: "What is unclear, as notes" },
  { id: "image", label: "Image", blurb: "A picture placed on the board" },
];

export function Assistant() {
  const state = useStore.getState;
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [showKey, setShowKey] = useState(!loadAiSettings().apiKey);
  const [mode, setMode] = useState<Mode>("ideate");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [models, setModels] = useState<{ text: string[]; image: string[] } | null>(null);
  const [providers, setProviders] = useState<ImageProviderSettings>(loadProviders);
  const updateProviders = (patch: Partial<ImageProviderSettings>) => {
    const next = { ...providers, ...patch };
    setProviders(next);
    saveProviders(next);
  };
  const [style, setStyle] = useState<RenderStyle>("illustration");
  const [direction, setDirection] = useState("");
  const [seconds, setSeconds] = useState<4 | 6 | 8>(6);
  const [seen, setSeen] = useState<string | null>(null);
  const job = useStore((s) => s.ui.job);
  const selectionCount = useStore((s) => s.selection.length);

  const update = (patch: Partial<AiSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveAiSettings(next);
  };

  const centre = () => {
    const { viewport, camera } = useStore.getState();
    return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
  };

  const place = (objects: CanvasObject[], hint: string) => {
    if (!objects.length) return;
    state().addObjects(objects, false);
    state().setSelection(objects.map((o) => o.id));
    state().flashHint(hint);
  };

  const run = async () => {
    const topic = prompt.trim();
    if (!topic) return;
    setBusy(true);
    setError(null);
    setReply(null);
    const at = centre();
    const defaults = useStore.getState().defaults;

    try {
      if (mode === "image") {
        const { dataUrl, provider } = await generateWithProvider({ prompt: topic, onProgress: (m) => state().setUi({ job: { label: m } }) });
        state().setUi({ job: null });
        const note = `via ${PROVIDER_LABELS[provider]}`;
        const size = await measureImage(dataUrl);
        const image = createImage(at, dataUrl, size.width, size.height);
        image.name = topic.slice(0, 40);
        place([image], "Image placed on the board");
        if (note) setReply(note);
        return;
      }

      const text = await generateText(settings, PROMPTS[mode](topic));
      setReply(text);

      if (mode === "outline") {
        const items = text.split("\n").filter((l) => l.trim()).slice(0, 16).map((line) => ({
          id: uid("li"),
          text: line.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s*/, ""),
          level: Math.min(3, Math.floor((/^(\s*)/.exec(line)?.[1].length ?? 0) / 2)),
        }));
        const list = createList(at, defaults, items);
        list.width = 420;
        place([list], "Outline added");
        return;
      }

      if (mode === "sketch") {
        const labels = toLines(text, 6);
        const nodes = labels.map((label, i) => {
          const node: CanvasObject = {
            id: uid("rect"),
            type: "rect",
            x: at.x + i * 210,
            y: at.y,
            width: 170,
            height: 82,
            rotation: 0,
            opacity: 1,
            locked: false,
            hidden: false,
            style: {
              stroke: defaults.ink,
              fill: "#ffffff",
              strokeWidth: 1.5,
              radius: 6,
              fontSize: 14,
              align: "center",
              verticalAlign: "middle",
              color: defaults.ink,
              fontFamily: defaults.fontFamily,
            },
            data: { text: label },
          };
          return node;
        });
        const links = nodes.slice(0, -1).map((node, i) => ({
          id: uid("arrow"),
          type: "arrow" as const,
          x: at.x + i * 210 + 170,
          y: at.y + 41,
          width: 40,
          height: 0,
          rotation: 0,
          opacity: 1,
          locked: false,
          hidden: false,
          style: { stroke: defaults.ink, strokeWidth: 1.5, arrowEnd: true },
          data: {
            points: [0, 0, 40, 0],
            from: { id: node.id },
            to: { id: nodes[i + 1].id },
          },
        }));
        place([...nodes, ...links], "Diagram added — move a node and the arrows follow");
        return;
      }

      // ideate and critique both land as sticky notes
      const lines = toLines(text, 6);
      const notes = lines.map((line, i) => {
        const note = createNote(
          { x: at.x + (i % 3) * 230 - 230, y: at.y + Math.floor(i / 3) * 200 },
          mode === "critique" ? "question" : "idea",
          defaults,
        );
        note.width = 210;
        note.height = 180;
        note.data.text = line;
        return note;
      });
      place(notes, `${notes.length} notes added`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Section title="From your sketch">
        <p className="ins-note">
          {selectionCount
            ? `Works from the ${selectionCount} selected object${selectionCount > 1 ? "s" : ""}.`
            : "Works from the whole board — select part of it to focus."}
        </p>
        <Row>
          <textarea
            className="assist-input"
            value={direction}
            placeholder="Optional direction — “dark mode”, “make it a bakery”, “dusk lighting”…"
            onChange={(e) => setDirection(e.target.value)}
            rows={2}
          />
        </Row>
        <Row label="Style">
          <select className="ins-select" value={style} onChange={(e) => setStyle(e.target.value as RenderStyle)}>
            {RENDER_STYLES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </Row>
        <div className="ai-grid">
          <button type="button" className="ai-action" disabled={!!job} onClick={() => void sketchToImage(style, direction)}>
            <b>✦ Image</b>
            <span>Render the sketch as a finished picture</span>
          </button>
          <button type="button" className="ai-action" disabled={!!job} onClick={() => void sketchToSite(direction)}>
            <b>✦ Website</b>
            <span>Build the wireframe as a real HTML page</span>
          </button>
          <button type="button" className="ai-action" disabled={!!job} onClick={() => void sketchToVideo(direction, seconds)}>
            <b>✦ Video</b>
            <span>Animate it with Veo · {seconds}s</span>
          </button>
          <button
            type="button"
            className="ai-action"
            disabled={!!job}
            onClick={() => void describeSketch().then((t) => t && setSeen(t))}
          >
            <b>Read it</b>
            <span>What the model sees on the board</span>
          </button>
        </div>
        <Row label="Clip">
          <div className="segmented is-compact">
            {([4, 6, 8] as const).map((n) => (
              <button key={n} type="button" className={seconds === n ? "is-active" : ""} onClick={() => setSeconds(n)}>
                {n}s
              </button>
            ))}
          </div>
        </Row>
        {job && <p className="ins-note is-live">{job.label}</p>}
        {seen && <pre className="assist-reply">{seen}</pre>}
      </Section>

      <Section title="Assistant">
        <Row>
          <div className="assist-modes">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? "is-active" : ""}
                onClick={() => setMode(m.id)}
                title={m.blurb}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Row>
        <Row>
          <textarea
            className="assist-input"
            value={prompt}
            placeholder={
              mode === "image"
                ? "A worn brass compass on a drafting table, soft window light"
                : "What are you trying to work out?"
            }
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
            }}
            rows={3}
          />
        </Row>
        <Row>
          <button
            type="button"
            className="primary"
            disabled={busy || !prompt.trim()}
            onClick={() => void run()}
          >
            {busy ? "Thinking…" : MODES.find((m) => m.id === mode)?.blurb}
          </button>
        </Row>
        {error && <p className="assist-error">{error}</p>}
        {reply && !error && <pre className="assist-reply">{reply}</pre>}
      </Section>

      <Connectors />

      <Section
        title="Image providers"
        aside={
          providers.imageProvider !== DEFAULT_PROVIDERS.imageProvider ? (
            <button type="button" className="link" onClick={() => updateProviders({ imageProvider: "auto" })}>
              Auto
            </button>
          ) : undefined
        }
      >
        <Row label="Engine">
          <select className="ins-select" value={providers.imageProvider} onChange={(e) => updateProviders({ imageProvider: e.target.value as ImageProvider })}>
            {(Object.keys(PROVIDER_LABELS) as ImageProvider[]).map((id) => (
              <option key={id} value={id}>
                {PROVIDER_LABELS[id]}
              </option>
            ))}
          </select>
        </Row>
        {(providers.imageProvider === "pollinations" || providers.imageProvider === "auto") && (
          <Row label="Model">
            <select className="ins-select" value={providers.pollinationsModel} onChange={(e) => updateProviders({ pollinationsModel: e.target.value })}>
              <option value="flux">flux (default)</option>
              <option value="turbo">turbo (fast)</option>
              <option value="kontext">kontext</option>
            </select>
          </Row>
        )}
        {providers.imageProvider === "huggingface" && (
          <>
            <Row label="Token">
              <input className="ins-input" type="password" value={providers.hfToken} placeholder="hf_…" spellCheck={false} onChange={(e) => updateProviders({ hfToken: e.target.value.trim() })} />
            </Row>
            <Row label="Model">
              <input className="ins-input" value={providers.hfModel} spellCheck={false} onChange={(e) => updateProviders({ hfModel: e.target.value.trim() })} />
            </Row>
          </>
        )}
        {providers.imageProvider === "local" && (
          <Row label="Server">
            <input className="ins-input" value={providers.localSdUrl} spellCheck={false} onChange={(e) => updateProviders({ localSdUrl: e.target.value.trim() })} />
          </Row>
        )}
        <p className="ins-note">
          {providers.imageProvider === "local"
            ? "Any AUTOMATIC1111 / Forge / SD.Next install started with --api --cors-allow-origins=* — the only engine that draws over your sketch directly (img2img)."
            : providers.imageProvider === "huggingface"
              ? "Open-weight FLUX.1-schnell or any text-to-image model id on the Hub, with a free token from huggingface.co/settings/tokens."
              : "Pollinations runs open-weight FLUX for free with no key; sketches are described by the text model first, then rendered. Auto uses Gemini when your key has image quota and falls back here."}
        </p>
      </Section>

      <Section
        title="Connection"
        aside={
          <button type="button" className="mini-btn" onClick={() => setShowKey((v) => !v)}>
            {showKey ? "Hide" : "Edit"}
          </button>
        }
      >
        {showKey ? (
          <>
            <Row label="API key">
              <input
                className="ins-input"
                type="password"
                value={settings.apiKey}
                placeholder="paste your key"
                onChange={(e) => update({ apiKey: e.target.value.trim() })}
                spellCheck={false}
              />
            </Row>
            <Row label="Text">
              {models ? (
                <select
                  className="ins-select"
                  value={settings.textModel}
                  onChange={(e) => update({ textModel: e.target.value })}
                >
                  {[...new Set([settings.textModel, ...models.text])].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="ins-input"
                  value={settings.textModel}
                  onChange={(e) => update({ textModel: e.target.value })}
                  spellCheck={false}
                />
              )}
            </Row>
            <Row label="Image">
              {models ? (
                <select
                  className="ins-select"
                  value={settings.imageModel}
                  onChange={(e) => update({ imageModel: e.target.value })}
                >
                  {[...new Set([settings.imageModel, ...models.image])].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="ins-input"
                  value={settings.imageModel}
                  onChange={(e) => update({ imageModel: e.target.value })}
                  spellCheck={false}
                />
              )}
            </Row>
            <Row label="Video">
              <input
                className="ins-input"
                value={settings.videoModel}
                onChange={(e) => update({ videoModel: e.target.value })}
                spellCheck={false}
              />
            </Row>
            <Row>
              <button
                type="button"
                className="mini-btn"
                onClick={async () => {
                  setError(null);
                  try {
                    setModels(await listModels(settings));
                  } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                Load available models
              </button>
            </Row>
            <Row label="Endpoint">
              <input
                className="ins-input"
                value={settings.endpoint}
                onChange={(e) => update({ endpoint: e.target.value.trim() })}
                spellCheck={false}
              />
            </Row>
            <Row>
              <button
                type="button"
                className="mini-btn"
                onClick={() => {
                  clearAiSettings();
                  setSettings({ ...DEFAULT_AI });
                }}
              >
                Forget the key
              </button>
            </Row>
          </>
        ) : (
          <Row>
            <Toggle label="Key saved in this browser" checked onChange={() => setShowKey(true)} />
          </Row>
        )}
        <p className="ins-note">
          The key is stored in this browser only and is sent straight to the provider — it never
          touches the project files or any server of ours.
        </p>
      </Section>
    </>
  );
}

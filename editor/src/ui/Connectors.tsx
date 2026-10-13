import { useState } from "react";

import { useStore } from "../store/store";
import { createImage, createText } from "../store/factory";
import { measureImage } from "../lib/images";
import { screenToWorld } from "../lib/geom";
import { uid } from "../lib/id";
import { stockToDataUrl } from "../lib/stock";
import { rasteriseObjects } from "../lib/imageTools";
import {
  PRESETS,
  callTool,
  connect,
  imagesFrom,
  loadServers,
  saveServers,
  textFrom,
  type McpProp,
  type McpServer,
  type McpTool,
} from "../lib/mcp";
import { Row, Section, Toggle } from "./controls";

/**
 * Connectors: any MCP server you hold an account with — Freepik / Magnific,
 * Replicate, fal, your own. Connect, pick a tool, fill its inputs (or feed it
 * the selection as a picture), run; images land on the board, text shows here.
 */
export function Connectors() {
  const state = useStore.getState;
  const [servers, setServers] = useState<McpServer[]>(loadServers);
  const [active, setActive] = useState<string | null>(servers[0]?.id ?? null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [tool, setTool] = useState<McpTool | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(servers.length === 0);
  const [draft, setDraft] = useState<McpServer>({ id: uid("mcp"), name: "", url: "", auth: "", viaProxy: true });
  const [filter, setFilter] = useState("");

  const server = servers.find((s) => s.id === active) ?? null;

  const persist = (list: McpServer[]) => {
    setServers(list);
    saveServers(list);
  };

  const doConnect = async (s: McpServer) => {
    setBusy(true);
    setError(null);
    setTools([]);
    setTool(null);
    try {
      const list = await connect(s);
      setTools(list);
      state().flashHint(`${list.length} tools on ${s.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const centre = () => {
    const { viewport, camera } = state();
    return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
  };

  /** Rasterise the selection to a data URL and drop it into a field. */
  const useSelection = (key: string) => {
    const { doc, selection } = state();
    const objects = selection.map((id) => doc.objects[id]).filter((o) => !!o);
    if (!objects.length) return state().flashHint("Select something on the board first");
    const img = objects.find((o) => o.type === "image" && o.data.src?.startsWith("data:"));
    const src = img?.data.src ?? rasteriseObjects(objects, doc, 2, 0, true)?.toDataURL("image/png");
    if (!src) return;
    setArgs((a) => ({ ...a, [key]: src }));
    state().flashHint("Selection attached as a picture");
  };

  const run = async () => {
    if (!server || !tool) return;
    setBusy(true);
    setError(null);
    setReply(null);
    state().setUi({ job: { label: `${server.name} · ${tool.name}…` } });
    try {
      const props = tool.inputSchema?.properties ?? {};
      const payload: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(args)) {
        if (raw === "" || raw === undefined) continue;
        const t = Array.isArray(props[k]?.type) ? (props[k]?.type as string[])[0] : props[k]?.type;
        if (t === "number" || t === "integer") payload[k] = Number(raw);
        else if (t === "boolean") payload[k] = raw === "true";
        else if (t === "array" || t === "object") {
          try {
            payload[k] = JSON.parse(raw);
          } catch {
            payload[k] = raw.split(",").map((x) => x.trim());
          }
        } else payload[k] = raw;
      }
      const content = await callTool(server, tool.name, payload);
      const images = imagesFrom(content);
      const text = textFrom(content);
      const at = centre();
      let placed = 0;
      for (const src of images.slice(0, 6)) {
        const durable = src.startsWith("data:") ? src : await stockToDataUrl(src);
        const size = await measureImage(durable);
        const o = createImage({ x: at.x + placed * 40, y: at.y + placed * 40 }, durable, size.width, size.height);
        o.name = `${server.name} · ${tool.name}`;
        state().addObjects([o]);
        placed += 1;
      }
      if (!placed && text) {
        const t = createText(at, state().defaults);
        t.width = 420;
        t.data.text = text.slice(0, 2000);
        t.height = Math.ceil(text.length / 50 + 1) * 24;
        state().addObjects([t]);
      }
      setReply(text ? text.slice(0, 1200) : `${placed} picture${placed === 1 ? "" : "s"} placed on the board`);
      state().setUi({ job: null });
      state().flashHint(placed ? `${placed} picture${placed === 1 ? "" : "s"} from ${server.name}` : "Result placed on the board");
    } catch (e) {
      state().setUi({ job: null });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fieldFor = (key: string, prop: McpProp, required: boolean) => {
    const t = Array.isArray(prop.type) ? prop.type[0] : prop.type;
    const looksLikeImage = /image|photo|picture|file|url|input/i.test(key) && (t === "string" || !t);
    const common = { value: args[key] ?? (prop.default !== undefined ? String(prop.default) : ""), onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setArgs((a) => ({ ...a, [key]: e.target.value })) };
    return (
      <label key={key} className="mcp-field">
        <span>
          {key}
          {required && <em> *</em>}
          {prop.description && <small>{prop.description}</small>}
        </span>
        {prop.enum ? (
          <select className="ins-select" {...common}>
            <option value="">—</option>
            {prop.enum.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : t === "boolean" ? (
          <select className="ins-select" {...common}>
            <option value="">—</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : t === "array" || t === "object" ? (
          <textarea className="assist-input" rows={2} placeholder={t === "array" ? "a, b, c or JSON" : "JSON"} {...common} />
        ) : /prompt|text|description|message/i.test(key) ? (
          <textarea className="assist-input" rows={3} {...common} />
        ) : (
          <div className="mcp-inline">
            <input className="ins-input" type={t === "number" || t === "integer" ? "number" : "text"} {...common} />
            {looksLikeImage && (
              <button type="button" className="mini-btn" onClick={() => useSelection(key)} title="Attach the selected picture or a snapshot of the selection">
                Use selection
              </button>
            )}
          </div>
        )}
      </label>
    );
  };

  const shownTools = tools.filter((t) => !filter || `${t.name} ${t.description ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Section
      title="Connectors (MCP)"
      aside={
        <button type="button" className="link" onClick={() => setAdding((v) => !v)}>
          {adding ? "Close" : "+ Add"}
        </button>
      }
    >
      <p className="ins-note">
        Use the services you already pay for — Freepik / Magnific, Replicate, fal or your own MCP server. Keys stay in this browser and go only to that server.
      </p>

      {adding && (
        <div className="mcp-add">
          <Row label="Preset">
            <select
              className="ins-select"
              value=""
              onChange={(e) => {
                const p = PRESETS.find((x) => x.name === e.target.value);
                if (p) setDraft((d) => ({ ...d, name: p.name, auth: p.auth }));
              }}
            >
              <option value="">Choose…</option>
              {PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Name">
            <input className="ins-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </Row>
          <Row label="URL">
            <input className="ins-input" value={draft.url} placeholder="https://…/mcp" spellCheck={false} onChange={(e) => setDraft({ ...draft, url: e.target.value.trim() })} />
          </Row>
          <Row label="Auth">
            <input className="ins-input" type="password" value={draft.auth} placeholder="Bearer … or x-api-key: …" spellCheck={false} onChange={(e) => setDraft({ ...draft, auth: e.target.value })} />
          </Row>
          <Row>
            <Toggle label="Route through proxy (no CORS needed)" checked={draft.viaProxy} onChange={(v) => setDraft({ ...draft, viaProxy: v })} />
          </Row>
          <Row>
            <button
              type="button"
              className="primary"
              disabled={!draft.name.trim() || !/^https:\/\//.test(draft.url)}
              onClick={() => {
                const next = [...servers.filter((s) => s.id !== draft.id), draft];
                persist(next);
                setActive(draft.id);
                setAdding(false);
                setDraft({ id: uid("mcp"), name: "", url: "", auth: "", viaProxy: true });
                void doConnect(draft);
              }}
            >
              Save & connect
            </button>
          </Row>
          <p className="ins-note">Find the MCP URL in the provider's developer docs (look for “MCP server” or “Streamable HTTP”).</p>
        </div>
      )}

      {servers.length > 0 && (
        <Row label="Server">
          <select
            className="ins-select"
            value={active ?? ""}
            onChange={(e) => {
              setActive(e.target.value);
              setTools([]);
              setTool(null);
            }}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {server && (
            <>
              <button type="button" className="mini-btn" disabled={busy} onClick={() => void doConnect(server)}>
                {busy && !tool ? "…" : tools.length ? "Refresh" : "Connect"}
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => {
                  const next = servers.filter((s) => s.id !== server.id);
                  persist(next);
                  setActive(next[0]?.id ?? null);
                  setTools([]);
                  setTool(null);
                }}
                title="Forget this server"
              >
                ×
              </button>
            </>
          )}
        </Row>
      )}

      {tools.length > 0 && (
        <>
          <input className="ins-input" placeholder={`Filter ${tools.length} tools…`} value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="mcp-tools">
            {shownTools.slice(0, 40).map((t) => (
              <button
                key={t.name}
                type="button"
                className={`mcp-tool${tool?.name === t.name ? " is-active" : ""}`}
                onClick={() => {
                  setTool(t);
                  setArgs({});
                  setReply(null);
                }}
                title={t.description}
              >
                <b>{t.name}</b>
                {t.description && <span>{t.description.slice(0, 90)}</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {tool && (
        <div className="mcp-run">
          {Object.entries(tool.inputSchema?.properties ?? {}).map(([k, p]) => fieldFor(k, p, (tool.inputSchema?.required ?? []).includes(k)))}
          <button type="button" className="primary" disabled={busy} onClick={() => void run()}>
            {busy ? "Running…" : `Run ${tool.name}`}
          </button>
        </div>
      )}

      {error && <p className="assist-error">{error}</p>}
      {reply && !error && <pre className="assist-reply">{reply}</pre>}
    </Section>
  );
}

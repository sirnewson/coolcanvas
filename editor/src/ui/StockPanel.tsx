import { useEffect, useRef, useState } from "react";

import { useStore } from "../store/store";
import { createImage } from "../store/factory";
import { measureImage } from "../lib/images";
import { screenToWorld } from "../lib/geom";
import {
  SOURCE_LABELS,
  STOCK_MIME,
  availableSources,
  loadStockKeys,
  saveStockKeys,
  searchStock,
  stockToDataUrl,
  type StockImage,
  type StockKeys,
  type StockSource,
} from "../lib/stock";

const SUGGESTIONS = ["workspace", "architecture", "portrait", "nature", "product", "abstract texture", "city night", "food"];

/**
 * Free stock pictures, searched live. Click places one at the centre of the
 * view; drag it onto a shape to clip it, or onto a site section to use it
 * there. Each result carries its author and source link for attribution.
 */
export function StockPanel({ onPick }: { onPick?: (img: StockImage) => void }) {
  const state = useStore.getState;
  const [keys, setKeys] = useState<StockKeys>(loadStockKeys);
  const [source, setSource] = useState<StockSource>("openverse");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockImage[]>([]);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const last = useRef("");

  const run = async (q: string, p = 1, append = false) => {
    const t = q.trim();
    if (!t) return;
    setBusy(true);
    setError(null);
    last.current = t;
    try {
      const list = await searchStock(t, source, p);
      setResults((prev) => (append ? [...prev, ...list] : list));
      setPage(p);
      if (!list.length && !append) setError("No pictures for that — try another word or source.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (last.current) void run(last.current, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const place = async (img: StockImage) => {
    if (onPick) return onPick(img);
    const { viewport, camera } = state();
    const at = screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
    state().setUi({ job: { label: "Fetching picture…" } });
    const src = await stockToDataUrl(img.full);
    const size = await measureImage(src);
    const o = createImage(at, src, size.width, size.height);
    o.name = `${img.alt.slice(0, 30)} · ${img.author} (${img.source})`;
    state().addObjects([o]);
    state().setUi({ job: null });
  };

  const updateKeys = (patch: Partial<StockKeys>) => {
    const next = { ...keys, ...patch };
    setKeys(next);
    saveStockKeys(next);
  };

  return (
    <div className="stock">
      <div className="stock-search">
        <input
          placeholder="Search free photos…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void run(query, 1);
          }}
        />
        <button type="button" className="primary" disabled={busy || !query.trim()} onClick={() => void run(query, 1)}>
          {busy ? "…" : "Search"}
        </button>
      </div>
      <div className="stock-sources">
        {availableSources(keys).map((s) => (
          <button key={s} type="button" className={source === s ? "is-active" : ""} onClick={() => setSource(s)}>
            {SOURCE_LABELS[s].split(" ·")[0]}
          </button>
        ))}
        <button type="button" className="stock-keys-btn" onClick={() => setKeysOpen((v) => !v)} title="Add Unsplash, Pixabay or Pexels keys">
          {keysOpen ? "Done" : "+ keys"}
        </button>
      </div>
      {keysOpen && (
        <div className="stock-keys">
          <p>Free keys unlock more sources. Kept in this browser only.</p>
          <label>
            Unsplash access key
            <input type="password" value={keys.unsplash} onChange={(e) => updateKeys({ unsplash: e.target.value.trim() })} spellCheck={false} />
          </label>
          <label>
            Pixabay key
            <input type="password" value={keys.pixabay} onChange={(e) => updateKeys({ pixabay: e.target.value.trim() })} spellCheck={false} />
          </label>
          <label>
            Pexels key
            <input type="password" value={keys.pexels} onChange={(e) => updateKeys({ pexels: e.target.value.trim() })} spellCheck={false} />
          </label>
        </div>
      )}
      {!results.length && !busy && !error && (
        <div className="stock-suggest">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => {
                setQuery(s);
                void run(s, 1);
              }}
            >
              {s}
            </button>
          ))}
          <p className="ins-note">Click a picture to place it. Drag it onto a shape to clip it inside.</p>
        </div>
      )}
      {error && <p className="assist-error">{error}</p>}
      <div className="stock-grid">
        {results.map((img) => (
          <button
            key={img.id}
            type="button"
            className="stock-tile"
            title={`${img.alt} — ${img.author} · ${img.source}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "copy";
              e.dataTransfer.setData(STOCK_MIME, JSON.stringify(img));
              e.dataTransfer.setData("text/uri-list", img.full);
            }}
            onClick={() => void place(img)}
          >
            <img src={img.thumb} alt={img.alt} loading="lazy" draggable={false} />
            <span>{img.author}</span>
          </button>
        ))}
      </div>
      {results.length > 0 && (
        <button type="button" className="btn-wide" disabled={busy} onClick={() => void run(last.current, page + 1, true)}>
          {busy ? "Loading…" : "More"}
        </button>
      )}
    </div>
  );
}

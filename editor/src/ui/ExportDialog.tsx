import { useState } from "react";

import { useStore } from "../store/store";
import { boundsOfObjects } from "../lib/geom";
import {
  boundsOfScope,
  canRecordVideo,
  canvasToBlob,
  celMembers,
  copyCanvasToClipboard,
  downloadBlob,
  recordVideo,
  renderCels,
  renderToCanvas,
  safeFilename,
  spriteSheet,
} from "../lib/export";
import { exportSvg } from "../lib/svg";
import { exportBoardFile } from "../lib/file";
import type { CanvasObject } from "../types";
import { Row, Segmented, Slider, Toggle } from "./controls";

type Format = "png" | "jpg" | "svg" | "animation" | "file";
type Scope = "selection" | "page" | "board";
type Motion = "video" | "sheet" | "frames";

export function ExportDialog() {
  const open = useStore((s) => s.ui.exportOpen);
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const state = useStore.getState;

  const [format, setFormat] = useState<Format>("png");
  const [scope, setScope] = useState<Scope>("board");
  const [motion, setMotion] = useState<Motion>("video");
  const prefs = useStore((s) => s.prefs);
  const [scale, setScale] = useState(prefs.exportScale);
  const [padding, setPadding] = useState(prefs.exportPadding);
  const [transparent, setTransparent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (!open) return null;

  const close = () => state().setUi({ exportOpen: false });
  const cels = doc.animation.cels;
  const hasPage = !!doc.settings.page;
  const effectiveScope: Scope =
    scope === "selection" && !selection.length ? "board" : scope === "page" && !hasPage ? "board" : scope;

  const scopeBounds = () => {
    if (effectiveScope === "page" && doc.settings.page) {
      return { x: 0, y: 0, width: doc.settings.page.width, height: doc.settings.page.height };
    }
    if (effectiveScope === "selection" && selection.length) return boundsOfScope(doc, selection);
    const objects = doc.order
      .map((id) => doc.objects[id])
      .filter((o): o is CanvasObject => !!o && !o.hidden && o.type !== "group");
    return boundsOfObjects(objects);
  };

  const scopeObjects = (): CanvasObject[] => {
    if (effectiveScope === "selection" && selection.length) {
      const wanted = new Set<string>();
      for (const id of selection) for (const m of celMembers(doc, id)) wanted.add(m);
      return doc.order.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o && wanted.has(o.id));
    }
    return doc.order.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o);
  };

  const raster = () => {
    const bounds = scopeBounds();
    if (!bounds) return null;
    return renderToCanvas({ bounds, scale, transparent, doc, padding });
  };

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const name = safeFilename(doc.name);

  const doDownload = () =>
    run("Rendering", async () => {
      if (format === "file") {
        exportBoardFile(doc);
        close();
        return;
      }
      if (format === "svg") {
        const bounds = scopeBounds();
        if (!bounds) return;
        const svg = exportSvg({ doc, objects: scopeObjects(), bounds, transparent, padding });
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), `${name}.svg`);
        close();
        return;
      }
      if (format === "animation") {
        const frames = renderCels({ doc, celIds: cels, scale, transparent: transparent && motion !== "video" });
        if (!frames.length) return;
        if (motion === "video") {
          setBusy(`Recording ${(cels.length / doc.animation.fps).toFixed(1)}s ×2`);
          const blob = await recordVideo(frames, doc.animation.fps, 2);
          if (blob) downloadBlob(blob, `${name}.webm`);
          else state().flashHint("This browser cannot record video — try the sprite sheet");
        } else if (motion === "sheet") {
          const sheet = spriteSheet(frames);
          const blob = sheet && (await canvasToBlob(sheet));
          if (blob) downloadBlob(blob, `${name}-sheet.png`);
        } else {
          for (let i = 0; i < frames.length; i += 1) {
            const blob = await canvasToBlob(frames[i]);
            if (blob) downloadBlob(blob, `${name}-${String(i + 1).padStart(3, "0")}.png`);
            await new Promise((r) => setTimeout(r, 120));
          }
        }
        close();
        return;
      }
      const canvas = raster();
      if (!canvas) return;
      const jpg = format === "jpg";
      const blob = await canvasToBlob(canvas, jpg ? "image/jpeg" : "image/png", 0.92);
      if (blob) downloadBlob(blob, `${name}@${scale}x.${jpg ? "jpg" : "png"}`);
      close();
    });

  const doCopy = () =>
    run("Copying", async () => {
      const canvas = raster();
      if (!canvas) return;
      const ok = await copyCanvasToClipboard(canvas);
      state().flashHint(ok ? "Image copied to clipboard" : "Clipboard blocked — download instead");
      if (ok) close();
    });

  const isAnimation = format === "animation";
  const isFile = format === "file";

  return (
    <div className="modal-backdrop" data-ui onPointerDown={close}>
      <div className="modal" onPointerDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>Export</h2>
          <button type="button" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="modal-body">
          <Row label="Format">
            <Segmented
              compact
              value={format}
              options={[
                { value: "png", label: "PNG" },
                { value: "jpg", label: "JPG" },
                { value: "svg", label: "SVG" },
                { value: "animation", label: "Motion", title: "Animated cels" },
                { value: "file", label: ".yxm", title: "Editable board file" },
              ]}
              onChange={(v) => setFormat(v)}
            />
          </Row>

          {!isAnimation && !isFile && (
            <Row label="What">
              <Segmented
                compact
                value={effectiveScope}
                options={[
                  { value: "selection", label: "Selection" },
                  ...(hasPage ? [{ value: "page" as Scope, label: "Page" }] : []),
                  { value: "board", label: "Whole board" },
                ]}
                onChange={(v) => setScope(v)}
              />
            </Row>
          )}

          {isAnimation && (
            <>
              <Row label="Output">
                <Segmented
                  compact
                  value={motion}
                  options={[
                    { value: "video", label: "Video", title: "WebM at the board's frame rate" },
                    { value: "sheet", label: "Sheet", title: "One PNG sprite sheet" },
                    { value: "frames", label: "Frames", title: "One PNG per cel" },
                  ]}
                  onChange={(v) => setMotion(v)}
                />
              </Row>
              <p className="ins-note">
                {cels.length
                  ? `${cels.length} cels at ${doc.animation.fps}fps · ${(cels.length / doc.animation.fps).toFixed(1)}s per loop`
                  : "No cels yet — open the timeline and add one."}
                {motion === "video" && !canRecordVideo() && " · video recording is unavailable here"}
              </p>
            </>
          )}

          {!isFile && (
            <>
              {format !== "svg" && (
                <Row label="Size">
                  <Segmented
                    compact
                    value={String(scale)}
                    options={[1, 2, 3, 4].map((s) => ({ value: String(s), label: `${s}x` }))}
                    onChange={(v) => setScale(Number(v))}
                  />
                </Row>
              )}
              {!isAnimation && (
                <Row label="Padding">
                  <Slider
                    value={padding}
                    min={0}
                    max={160}
                    step={4}
                    onChange={setPadding}
                    format={(v) => `${v}px`}
                  />
                </Row>
              )}
              <Row>
                <Toggle
                  label="Transparent background"
                  checked={transparent}
                  onChange={setTransparent}
                />
              </Row>
            </>
          )}

          {isFile && (
            <p className="ins-note">
              Saves the whole board — objects, cels and settings — as a file you can reopen from
              the home screen on any machine.
            </p>
          )}
        </div>

        <footer className="modal-foot">
          {!isAnimation && !isFile && (
            <button type="button" className="ghost-btn" disabled={!!busy} onClick={doCopy}>
              Copy as image
            </button>
          )}
          <button
            type="button"
            className="primary"
            disabled={!!busy || (isAnimation && !cels.length)}
            onClick={doDownload}
          >
            {busy ?? (isFile ? "Save file" : "Download")}
          </button>
        </footer>
      </div>
    </div>
  );
}

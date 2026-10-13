import { useCallback, useEffect, useRef, useState } from "react";

import { useStore } from "../store/store";
import { createImage } from "../store/factory";
import { measureImage } from "../lib/images";
import { rasteriseObjects } from "../lib/imageTools";
import { screenToWorld, objectBounds } from "../lib/geom";
import { desktop, isDesktop } from "../desktop";
import { parsePsd, psdToCanvasObjects } from "../lib/psd/psdReader";
import { STUDIOS, studioUrl, sendToStudio, type StudioId, type StudioMessage } from "./studios";
import { IconChevron, IconClose } from "../ui/icons";

/**
 * A studio, hosted inside the app window.
 *
 * The engine is ours (engines/, Rust → WebAssembly) and runs entirely on this
 * device. The strip above it belongs to CoolCanvas: it carries the selection in,
 * brings the result back to the board, and offers the native window when one is
 * installed. Everything inside the frame is the engine's own interface.
 */
export function StudioWorkspace({ id, onClose }: { id: StudioId; onClose: () => void }) {
  const studio = STUDIOS[id];
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState<string | null>(null);
  const [backend, setBackend] = useState<"auto" | "webgl">("auto");
  const [returned, setReturned] = useState<{ name: string; type: string; bytes: ArrayBuffer } | null>(null);
  const store = useStore.getState;

  /* The studio speaks through postMessage; nothing else crosses the boundary. */
  useEffect(() => {
    const onMessage = (e: MessageEvent<StudioMessage>) => {
      const d = e.data;
      if (!d || d.source !== "coolcanvas-studio") return;
      if (d.kind === "ready") setState("ready");
      if (d.kind === "error") {
        setState("error");
        setDetail(d.message ?? null);
      }
      if (d.kind === "saved" && d.bytes) {
        setReturned({ name: d.name ?? "studio-export", type: d.type ?? "image/png", bytes: d.bytes });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // A studio that never reports in is usually a missing build; say so rather than hang.
  useEffect(() => {
    const timer = window.setTimeout(() => setState((s) => (s === "loading" ? "error" : s)), 25000);
    return () => window.clearTimeout(timer);
  }, [backend]);

  const sendSelection = useCallback(async () => {
    const { doc, selection } = store();
    const objects = (selection.length ? selection : doc.order)
      .map((oid) => doc.objects[oid])
      .filter((o) => !!o && !o.hidden);
    if (!objects.length) return store().flashHint("Draw or select something first");
    const canvas = rasteriseObjects(objects, doc, 2, 0, false);
    if (!canvas) return;
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    sendToStudio(frame.current, `${doc.name || "canvas"}.png`, await blob.arrayBuffer(), "image/png");
    store().flashHint(`Sent to ${studio.name}`);
  }, [store, studio.name]);

  /** Put what the studio produced back on the board, beside what it came from. */
  const bringBack = useCallback(async () => {
    if (!returned) return;
    const bytes = returned.bytes;

    // A PSD comes back as layers, not as one flat picture: the board can read it.
    if (/\.psd$/i.test(returned.name)) {
      try {
        const { objects, order } = psdToCanvasObjects(parsePsd(bytes));
        const list = order.map((oid) => objects[oid]).filter(Boolean);
        if (list.length) {
          store().addObjects(list, false);
          store().setSelection(list.map((o) => o.id));
          setReturned(null);
          onClose();
          window.setTimeout(() => store().fitSelection(), 40);
          store().flashHint(`${returned.name} added as ${list.length} layer${list.length === 1 ? "" : "s"}`);
          return;
        }
      } catch (e) {
        store().flashHint(`That PSD could not be read: ${e instanceof Error ? e.message : String(e)}`);
        return;
      }
    }

    const blob = new Blob([bytes], { type: returned.type || "image/png" });
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const { viewport, camera, doc, selection } = store();
    const at = screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
    const size = await measureImage(url);
    const image = createImage(at, url, size.width, size.height, 720);
    image.name = returned.name;
    // Land beside the objects it was made from, not on top of them.
    const source = selection.map((sid) => doc.objects[sid]).filter(Boolean);
    if (source.length) {
      const right = Math.max(...source.map((o) => objectBounds(o!).x + objectBounds(o!).width));
      const top = Math.min(...source.map((o) => objectBounds(o!).y));
      image.x = right + 48;
      image.y = top;
    }
    store().addObjects([image]);
    setReturned(null);
    onClose();
    window.setTimeout(() => store().fitSelection(), 40);
    store().flashHint(`${returned.name} added to the board`);
  }, [returned, store, onClose]);

  const openNative = useCallback(async () => {
    const bridge = desktop();
    if (!bridge?.openStudio) return;
    const { doc, selection } = store();
    const objects = (selection.length ? selection : doc.order).map((oid) => doc.objects[oid]).filter((o) => !!o && !o.hidden);
    let png: ArrayBuffer | undefined;
    if (objects.length) {
      const canvas = rasteriseObjects(objects, doc, 2, 0, false);
      const blob: Blob | null = canvas ? await new Promise((r) => canvas.toBlob(r, "image/png")) : null;
      if (blob) png = await blob.arrayBuffer();
    }
    const result = await bridge.openStudio(id, png);
    store().flashHint(result ? `${studio.name} opened in its own window` : `${studio.name} is not installed yet`);
  }, [id, store, studio.name]);

  return (
    <div className="studio" data-ui style={{ ["--studio-accent" as string]: studio.accent }}>
      <header className="studio-bar">
        <button type="button" className="studio-back" onClick={onClose} title="Back to the canvas">
          <IconChevron style={{ transform: "rotate(180deg)" }} />
          Canvas
        </button>
        <span className="studio-name">
          CoolCanvas <em>{studio.name}</em>
        </span>
        <span className="studio-blurb">{studio.blurb}</span>
        <span className="studio-spacer" />

        <button type="button" className="studio-btn" onClick={() => void sendSelection()} disabled={state !== "ready"}>
          Send selection
        </button>
        {returned && (
          <button type="button" className="studio-btn is-accent" onClick={() => void bringBack()}>
            Bring “{returned.name}” onto the board
          </button>
        )}
        {isDesktop() && (
          <button type="button" className="studio-btn" onClick={() => void openNative()} title="Open the installed native studio in its own window">
            Native window
          </button>
        )}
        <button type="button" className="studio-close" onClick={onClose} title="Close">
          <IconClose />
        </button>
      </header>

      <div className="studio-stage">
        <iframe
          ref={frame}
          key={backend}
          className="studio-frame"
          title={`CoolCanvas ${studio.name}`}
          src={studioUrl(id, backend === "webgl" ? "webgl" : undefined)}
          allow="cross-origin-isolated"
        />
        {state !== "ready" && (
          <div className={`studio-veil${state === "error" ? " is-error" : ""}`}>
            {state === "loading" ? (
              <>
                <span className="studio-spin" aria-hidden />
                <p>Starting {studio.name}…</p>
                <p className="studio-note">The engine is a local file; the first start compiles its shaders.</p>
              </>
            ) : (
              <>
                <h2>{studio.name} could not start</h2>
                <p className="studio-note">
                  {detail ?? "The engine build was not found."} Build it once with{" "}
                  <code>npm run engines:web</code>, or install the desktop studios.
                </p>
                <div className="studio-actions">
                  <button type="button" className="studio-btn" onClick={() => setBackend(backend === "auto" ? "webgl" : "auto")}>
                    {backend === "auto" ? "Try the WebGL/CPU path" : "Try WebGPU again"}
                  </button>
                  {isDesktop() && (
                    <button type="button" className="studio-btn" onClick={() => void openNative()}>
                      Open the native studio
                    </button>
                  )}
                  <button type="button" className="studio-btn" onClick={onClose}>
                    Back to the canvas
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

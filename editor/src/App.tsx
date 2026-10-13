import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Canvas } from "./canvas/Canvas";
import { SpatialCanvas } from "./spatial/SpatialCanvas";
import { StudioWorkspace } from "./studios/StudioWorkspace";
import type { StudioId } from "./studios/studios";
import { HintToast, PresentBar, StatusBar, Topbar, ZoomBar } from "./ui/Chrome";
import { CommandMenu } from "./ui/CommandMenu";
import { ContextToolbar } from "./ui/ContextToolbar";
import { DockSheet } from "./ui/Dock";
import { DockGroups } from "./ui/DockGroups";
import { OptionsBar } from "./ui/OptionsBar";
import { JobPill, SketchStarter } from "./ui/Studio";
import { SiteBuilder } from "./builder/SiteBuilder";
import { Home } from "./ui/Home";
import { Splash } from "./ui/Splash";
import { Timeline } from "./ui/Timeline";
import { BoardsDialog, ShortcutsDialog } from "./ui/Dialogs";
import { ExportDialog } from "./ui/ExportDialog";
import { MobileBar } from "./ui/MobileBar";
import { InsertPanel, Minimap, ObjectMenu } from "./ui/Overlays";
import { RadialMenu } from "./ui/RadialMenu";
import { Toolbar } from "./ui/Toolbar";
import { useKeyboard } from "./hooks/useKeyboard";
import {
  imageFromUrl,
  measureImage,
  objectsFromFiles,
  objectsFromMediaFiles,
  oversizedMedia,
  pickImageFiles,
  readFileAsDataUrl,
} from "./lib/images";
import { objectBounds, pointInBounds } from "./lib/geom";
import type { CanvasObject, Point } from "./types";
import { createEmbed, createImage, createText } from "./store/factory";
import { loadLastBoard, loadReel, saveBoard, saveReel } from "./persist/idb";
import { pushFrame, setMaxFrames, setTimelapse, timelapseFrames } from "./lib/timelapse";
import { TimelapsePlayer } from "./ui/Timelapse";
import { screenToWorld } from "./lib/geom";
import { useStore } from "./store/store";
import { BACKGROUNDS } from "./lib/theme";
import { STOCK_MIME, stockToDataUrl, type StockImage } from "./lib/stock";

/** Topmost empty image slot under a point, if there is one. */
function placeholderAt(point: Point): CanvasObject | null {
  const doc = useStore.getState().doc;
  for (let i = doc.order.length - 1; i >= 0; i -= 1) {
    const o = doc.objects[doc.order[i]];
    if (o?.type === "placeholder" && !o.hidden && pointInBounds(point, objectBounds(o))) return o;
  }
  return null;
}

/** A selected, maskable shape under a point — the drop target for "image into shape". */
function selectedShapeAt(point: Point): CanvasObject | null {
  const { doc, selection } = useStore.getState();
  for (const id of selection) {
    const o = doc.objects[id];
    if (o && ["rect", "ellipse", "triangle", "diamond", "polygon"].includes(o.type) && pointInBounds(point, objectBounds(o))) return o;
  }
  return null;
}

type Layout = "phone" | "tablet" | "desktop";

/**
 * Three tiers. Phones get the bottom bar; tablets (and any coarse-pointer
 * screen under 1200px) keep the rail and options strip but move the dock into
 * a bottom sheet; everything else is the desktop studio.
 */
function layoutFor(): Layout {
  const w = window.innerWidth;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (w < 700) return "phone";
  if (w < 1100 || (coarse && w < 1300)) return "tablet";
  return "desktop";
}

function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(layoutFor);
  useEffect(() => {
    const onResize = () => setLayout(layoutFor());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return layout;
}

/**
 * Time-lapse capture: a frame after each settled change, persisted per board
 * so the reel survives a reload.
 */
function useTimelapse() {
  const timer = useRef<number | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    setMaxFrames(useStore.getState().prefs.maxFrames);
    let lastBoard = "";
    const unsub = useStore.subscribe((state, prev) => {
      if (state.doc === prev.doc) return;
      if (state.doc.id !== lastBoard) {
        lastBoard = state.doc.id;
        loadReel(state.doc.id).then((frames) => setTimelapse(state.doc.id, frames));
        return;
      }
      if (!state.recording || state.ui.home) return;
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const current = useStore.getState();
        if (!pushFrame(current.doc)) return;
        if (saveTimer.current) window.clearTimeout(saveTimer.current);
        saveTimer.current = window.setTimeout(() => {
          void saveReel(current.doc.id, timelapseFrames());
        }, 2500);
      }, useStore.getState().prefs.captureDelay);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);
}

/** Debounced local autosave — the board is always on disk (blueprint §61). */
function useAutosave() {
  const timer = useRef<number | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadLastBoard()
      .then((doc) => {
        const started = useStore.getState().doc.order.length > 0;
        if (!cancelled && !started && doc?.order?.length) useStore.getState().loadDoc(doc);
      })
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = useStore.subscribe((state, prev) => {
      if (state.doc === prev.doc || !loaded.current) return;
      useStore.getState().setSaveStatus("saving");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => {
        try {
          await saveBoard(useStore.getState().doc);
          useStore.getState().setSaveStatus(navigator.onLine ? "saved" : "offline");
        } catch {
          useStore.getState().setSaveStatus("offline");
        }
      }, 500);
    });
    return () => {
      unsub();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);
}

export default function App() {
  const layout = useLayout();
  const mobile = layout === "phone";
  const tablet = layout === "tablet";
  const [dropping, setDropping] = useState(false);
  const [spatialOpen, setSpatialOpen] = useState(false);
  const [studio, setStudio] = useState<StudioId | null>(null);
  const [booting, setBooting] = useState(true);
  const presenting = useStore((s) => s.ui.presenting);
  const home = useStore((s) => s.ui.home);
  const background = useStore((s) => s.doc.settings.background);
  const isEmpty = useStore((s) => s.doc.order.length === 0);
  useAutosave();
  useTimelapse();

  const centreWorld = useCallback(() => {
    const { viewport, camera } = useStore.getState();
    return screenToWorld({ x: viewport.width / 2, y: viewport.height / 2 }, camera);
  }, []);

  const insertImage = useCallback(async () => {
    const files = await pickImageFiles();
    if (!files.length) return;
    const objects = await objectsFromFiles(files, centreWorld());
    if (objects.length) useStore.getState().addObjects(objects);
  }, [centreWorld]);

  const exportBoard = useCallback(() => useStore.getState().setUi({ exportOpen: true }), []);
  const actions = useMemo(() => ({ insertImage, exportBoard }), [insertImage, exportBoard]);
  useKeyboard(actions);

  /* Drop and paste are the fastest ways to get a reference onto the board. */
  useEffect(() => {
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      const at = screenToWorld({ x: e.clientX, y: e.clientY }, useStore.getState().camera);
      setDropping(false);
      if (e.dataTransfer.files?.length) {
        e.preventDefault();
        // A picture dropped on a moodboard slot fills that slot exactly, and
        // one dropped on a *selected* shape is masked inside it.
        const slot = placeholderAt(at);
        const file = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
        const shape = selectedShapeAt(at);
        if (shape && file) {
          const src = await readFileAsDataUrl(file);
          const size = await measureImage(src);
          useStore.getState().patchObject(shape.id, {
            data: { ...shape.data, src, naturalWidth: size.width, naturalHeight: size.height },
          });
          useStore.getState().flashHint("Image clipped into the shape");
          return;
        }
        if (slot && file) {
          const src = await readFileAsDataUrl(file);
          const size = await measureImage(src);
          useStore.getState().fillPlaceholder(slot.id, src, size.width, size.height);
          return;
        }
        const dropped = [...e.dataTransfer.files];
        const objects = [
          ...(await objectsFromFiles(dropped, at)),
          ...(await objectsFromMediaFiles(dropped, at)),
        ];
        if (objects.length) {
          useStore.getState().addObjects(objects);
          useStore.getState().flashHint(`${objects.length} item${objects.length > 1 ? "s" : ""} added`);
        } else if (oversizedMedia(dropped)) {
          useStore.getState().flashHint("That clip is over 30MB — trim it first");
        }
        return;
      }
      // A picture dragged out of the Images tab.
      const stockRaw = e.dataTransfer.getData(STOCK_MIME);
      if (stockRaw) {
        e.preventDefault();
        const img = JSON.parse(stockRaw) as StockImage;
        useStore.getState().setUi({ job: { label: "Fetching picture…" } });
        const src = await stockToDataUrl(img.full);
        const size = await measureImage(src);
        const shapeTarget = selectedShapeAt(at);
        const slotTarget = placeholderAt(at);
        if (shapeTarget) {
          useStore.getState().patchObject(shapeTarget.id, { data: { ...shapeTarget.data, src, naturalWidth: size.width, naturalHeight: size.height } });
          useStore.getState().flashHint("Picture clipped into the shape");
        } else if (slotTarget) {
          useStore.getState().fillPlaceholder(slotTarget.id, src, size.width, size.height);
        } else {
          const o = createImage(at, src, size.width, size.height);
          o.name = `${img.alt.slice(0, 30)} · ${img.author} (${img.source})`;
          useStore.getState().addObjects([o]);
        }
        useStore.getState().setUi({ job: null });
        return;
      }
      const url = (
        e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain")
      ).trim();
      const html = e.dataTransfer.getData("text/html");
      const imgSrc = /<img[^>]+src="([^"]+)"/i.exec(html)?.[1];
      const candidate = imgSrc || url;
      if (!candidate.startsWith("http")) return;
      e.preventDefault();
      // An image dragged from another page arrives as a URL, not a file.
      const object = await imageFromUrl(candidate, at);
      useStore.getState().addObjects([object ?? createEmbed(at, url)]);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types?.includes("Files") || e.dataTransfer?.types?.includes(STOCK_MIME)) setDropping(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDropping(false);
    };

    const onPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const state = useStore.getState();
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        const at = centreWorld();
        const objects = [
          ...(await objectsFromFiles(files, at)),
          ...(await objectsFromMediaFiles(files, at)),
        ];
        if (objects.length) {
          state.addObjects(objects);
          state.flashHint("Screenshot added — hold A and drag to point at it");
        }
        return;
      }
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (!text) return;
      e.preventDefault();
      if (/^https?:\/\/\S+$/i.test(text)) {
        state.addObjects([createEmbed(centreWorld(), text)]);
        return;
      }
      const obj = createText(centreWorld(), state.defaults);
      obj.data.text = text;
      obj.width = 340;
      obj.height = Math.ceil(text.length / 42 + 1) * 26;
      state.addObjects([obj]);
    };

    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("paste", onPaste);
    };
  }, [centreWorld]);

  useEffect(() => {
    const online = () => useStore.getState().setSaveStatus("saved");
    const offline = () => useStore.getState().setSaveStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const dark = BACKGROUNDS[background].dark;

  if (booting) return <Splash onDone={() => setBooting(false)} />;

  if (spatialOpen) {
    return <SpatialCanvas onBackTo2D={() => setSpatialOpen(false)} />;
  }


  return (
    <div
      className={`app is-${layout}${presenting ? " is-presenting" : ""}${dark ? " is-dark-surface" : ""}`}
    >
      {!presenting && (
        <Topbar
          onInsertImage={insertImage}
          compact={mobile}
          onToggleSpatial={() => setSpatialOpen(true)}
          onOpenStudio={(id) => setStudio(id)}
          isSpatial={false}
        />
      )}
      {!presenting && !mobile && <OptionsBar onInsertImage={insertImage} />}
      <Canvas />
      {!presenting && !mobile && <Toolbar onInsertImage={insertImage} />}
      {!presenting && mobile && <MobileBar onInsertImage={insertImage} />}
      {!presenting && layout === "desktop" && <DockGroups />}
      {!presenting && tablet && <DockSheet />}
      {!presenting && <ContextToolbar />}
      {!presenting && layout === "desktop" && <StatusBar />}
      <SiteBuilder />
      <JobPill />
      {!presenting && !mobile && <Timeline />}
      {!presenting && !mobile && <InsertPanel />}
      <Minimap />
      <ZoomBar />
      <PresentBar />
      <ObjectMenu />
      <ExportDialog />
      <BoardsDialog />
      <ShortcutsDialog />
      <CommandMenu onInsertImage={insertImage} />
      <RadialMenu onInsertImage={insertImage} />
      <TimelapsePlayer />
      <Home onOpenSpatial={() => setSpatialOpen(true)} />
      {studio && <StudioWorkspace id={studio} onClose={() => setStudio(null)} />}
      <HintToast />
      {dropping && (
        <div className="drop-veil">
          <div>Drop to add to the board</div>
        </div>
      )}
      {isEmpty && !presenting && !home && (
        <div className="empty-state">
          <p className="empty-kicker">01 — START</p>
          <h1>Explain it visually.</h1>
          <SketchStarter />
          <ol className="empty-steps">
            <li>
              <b>Drop</b> a screenshot anywhere, or press <kbd>I</kbd>
            </li>
            <li>
              Hold <kbd>A</kbd> and drag to <b>point</b> at something
            </li>
            <li>
              Press <kbd>T</kbd> to <b>say</b> what you mean
            </li>
            <li>
              <kbd>Ctrl</kbd>+<kbd>E</kbd> to <b>send</b> it
            </li>
          </ol>
          <p className="empty-sub">
            <kbd>Ctrl</kbd>+<kbd>K</kbd> for every command · right click for the quick menu ·{" "}
            <kbd>?</kbd> for keys
          </p>
        </div>
      )}
    </div>
  );
}

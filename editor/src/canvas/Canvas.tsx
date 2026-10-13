import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type Konva from "konva";

import { useStore, descendantIds, topAncestor } from "../store/store";
import { openSite } from "../lib/studio";
import {
  createDraw,
  createFrame,
  createLine,
  createMeasure,
  createList,
  createNote,
  createShape,
  createText,
  type ShapeType,
} from "../store/factory";
import type { Bounds, CanvasObject, Point } from "../types";
import {
  boundsOfObjects,
  boundsOfPoints,
  constrainAngle,
  intersects,
  objectBounds,
  pointInBounds,
  screenToWorld,
} from "../lib/geom";
import { distanceToSegment } from "../lib/geom";
import { computeSnap, type Guide } from "../lib/snapping";
import { INDENT, LIST_PAD, rowHeight, visibleRows } from "../lib/outline";
import { pressureFor } from "../lib/freehand";
import {
  MEDIA_BAR,
  anyPlaying,
  onMediaTick,
  playButtonAt,
  seekFraction,
  togglePlay,
} from "../lib/media";
import { measureImage, pickImageFiles, readFileAsDataUrl } from "../lib/images";
import { BACKGROUNDS, formatMeasure, withAlpha } from "../lib/theme";
import { canvasRefs, celMembers } from "../lib/export";
import { ShapeNode, linePoints } from "./Shapes";
import { TextEditor } from "./TextEditor";
import { dupState } from "../lib/duplicate";

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; last: Point }
  | { kind: "marquee"; origin: Point; current: Point; additive: boolean }
  | { kind: "move"; origin: Point; last: Point; ids: string[]; moved: boolean; total: Point }
  | { kind: "create"; origin: Point }
  | { kind: "text"; start: Point; id: string; placed: boolean }
  | { kind: "picture"; id: string; last: Point }
  | { kind: "draw"; last: Point; lastTime: number }
  | { kind: "erase" }
  | { kind: "endpoint"; id: string; end: "a" | "b" }
  | { kind: "curve"; id: string }
  | { kind: "connect"; sourceId: string; from: Point; to: Point }
  | { kind: "crop"; id: string; origin: Point; box: Bounds };

/** Object kinds an arrow can dock to, and that therefore show joints. */
const CONNECTABLE = new Set([
  "rect", "ellipse", "triangle", "diamond", "polygon", "note", "image", "embed",
  "icon", "list", "table", "card", "placeholder", "frame", "text",
]);

const SHAPE_TOOLS: ShapeType[] = ["rect", "ellipse", "triangle", "diamond", "polygon"];
const DRAG_TOOLS = new Set([...SHAPE_TOOLS, "line", "arrow", "frame", "measure"]);

export function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const overlayRef = useRef<Konva.Layer | null>(null);
  const nodes = useRef(new Map<string, Konva.Group>());
  const interaction = useRef<Interaction>({ kind: "none" });
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; center: Point } | null>(null);
  const spaceDown = useRef(false);

  const [draft, setDraft] = useState<CanvasObject | null>(null);
  const [marquee, setMarquee] = useState<Bounds | null>(null);
  const [cropBox, setCropBox] = useState<Bounds | null>(null);
  const [bindTarget, setBindTarget] = useState<string | null>(null);
  const [connectDraft, setConnectDraft] = useState<{ from: Point; to: Point } | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const doc = useStore((s) => s.doc);
  const camera = useStore((s) => s.camera);
  const viewport = useStore((s) => s.viewport);
  const tool = useStore((s) => s.tool);
  const selection = useStore((s) => s.selection);
  const hoverId = useStore((s) => s.hoverId);
  const editingId = useStore((s) => s.editingId);
  const cropId = useStore((s) => s.cropId);
  const guides = useStore((s) => s.guides);
  const presenting = useStore((s) => s.ui.presenting);
  const playback = useStore((s) => s.playback);
  const eyedropper = useStore((s) => s.ui.eyedropper);
  const prefs = useStore((s) => s.prefs);

  const theme = BACKGROUNDS[doc.settings.background];
  const page = doc.settings.page;

  /**
   * Animation cels stack in one place, so only the active one is solid; the
   * neighbours ghost behind it as onion skins and everything else drops out.
   */
  const celOpacity = useMemo(() => {
    const map = new Map<string, number>();
    const cels = doc.animation.cels;
    if (!cels.length) return map;
    cels.forEach((celId, i) => {
      const distance = i - playback.index;
      let opacity = 0;
      if (distance === 0) opacity = 1;
      else if (!playback.playing && Math.abs(distance) <= doc.animation.onion) {
        opacity = 0.34 / Math.abs(distance);
      }
      for (const member of celMembers(doc, celId)) map.set(member, opacity);
    });
    return map;
  }, [doc, playback.index, playback.playing]);
  const objects = useMemo(
    () => doc.order.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
    [doc.order, doc.objects],
  );

  /* ---------------------------------------------------------------- sizing */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      // A zero measurement happens while the element is being re-attached;
      // writing it through would give Konva a 0x0 stage and crash its buffer.
      if (r.width > 0 && r.height > 0) useStore.getState().setViewport(r.width, r.height);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const state = useStore.getState();
    if (state.camera.x === 0 && state.camera.y === 0) state.resetView();
  }, [viewport.width, viewport.height]);

  /* Video needs its own repaint pulse while it plays. */
  useEffect(() => {
    let timer: number | null = null;
    const draw = () => stageRef.current?.getLayers()[0]?.draw();
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = null;
    };
    const unsubscribe = onMediaTick(() => {
      if (anyPlaying()) {
        if (!timer) timer = window.setInterval(draw, 33);
      } else {
        stop();
        draw();
      }
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  useEffect(() => {
    canvasRefs.stage = stageRef.current;
    canvasRefs.transformer = trRef.current;
    canvasRefs.overlay = overlayRef.current;
  });

  /* -------------------------------------------------------------- helpers */
  const toLocal = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  }, []);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point =>
      screenToWorld(toLocal(clientX, clientY), useStore.getState().camera),
    [toLocal],
  );

  /** True when the pointer landed on a Transformer anchor or the rotater. */
  const hitTransformer = useCallback((clientX: number, clientY: number): boolean => {
    const stage = stageRef.current;
    if (!stage) return false;
    const shape = stage.getIntersection(toLocal(clientX, clientY));
    if (!shape) return false;
    let node: Konva.Node | null = shape;
    while (node) {
      if (node.getClassName?.() === "Transformer") return true;
      node = node.getParent();
    }
    return false;
  }, [toLocal]);

  const hitObjectId = useCallback(
    (clientX: number, clientY: number): string | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const shape = stage.getIntersection(toLocal(clientX, clientY));
      if (!shape) return null;
      let node: Konva.Node | null = shape;
      while (node && node.name() !== "object") node = node.getParent();
      return node?.id() ?? null;
    },
    [toLocal],
  );

  /** Geometric hit test — used where Konva's own hit graph is in the way. */
  const objectAtPoint = useCallback(
    (world: Point, exclude: string[] = [], linear = false): CanvasObject | null => {
      const d = useStore.getState().doc;
      for (let i = d.order.length - 1; i >= 0; i -= 1) {
        const o = d.objects[d.order[i]];
        if (!o || o.hidden || o.type === "group" || exclude.includes(o.id)) continue;
        const isLinear = o.type === "line" || o.type === "arrow" || o.type === "measure";
        if (isLinear) {
          // Docking targets ignore connectors; the eraser has to reach them.
          if (!linear) continue;
          const [ax, ay, bx, by] = linePoints(o);
          const dist = distanceToSegment(
            world,
            { x: o.x + ax, y: o.y + ay },
            { x: o.x + bx, y: o.y + by },
          );
          if (dist <= 10 / useStore.getState().camera.zoom) return o;
          continue;
        }
        if (pointInBounds(world, objectBounds(o))) return o;
      }
      return null;
    },
    [],
  );

  /**
   * Konva refreshes its hit canvas on its own draw loop, so a shape or a
   * transformer handle can be on screen a frame before it is clickable.
   * Redrawing it right before we hit test makes every grab exact.
   */
  const refreshHit = useCallback(() => {
    stageRef.current?.getLayers().forEach((layer) => layer.drawHit());
  }, []);

  /** Read one pixel back off the rendered stage — the eyedropper. */
  const samplePixel = useCallback(
    (clientX: number, clientY: number): string | null => {
      const stage = stageRef.current;
      if (!stage) return null;
      const local = toLocal(clientX, clientY);
      const ratio = window.devicePixelRatio || 1;
      for (const layer of [...stage.getLayers()].reverse()) {
        const ctx = layer.getCanvas()._canvas.getContext("2d");
        if (!ctx) continue;
        const data = ctx.getImageData(local.x * ratio, local.y * ratio, 1, 1).data;
        if (data[3] > 12) {
          const hex = (n: number) => n.toString(16).padStart(2, "0");
          return `#${hex(data[0])}${hex(data[1])}${hex(data[2])}`;
        }
      }
      const surface = BACKGROUNDS[useStore.getState().doc.settings.background].surface;
      return surface;
    },
    [toLocal],
  );

  /** The four dock points shown on a connectable object. */
  const jointsOf = useCallback((o: CanvasObject): Point[] => {
    const b = objectBounds(o);
    return [
      { x: b.x + b.width / 2, y: b.y },
      { x: b.x + b.width, y: b.y + b.height / 2 },
      { x: b.x + b.width / 2, y: b.y + b.height },
      { x: b.x, y: b.y + b.height / 2 },
    ];
  }, []);

  const fillPlaceholder = useCallback(async (o: CanvasObject) => {
    const files = await pickImageFiles();
    const file = files[0];
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    const size = await measureImage(src);
    useStore.getState().fillPlaceholder(o.id, src, size.width, size.height);
    useStore.getState().flashHint("Image dropped into the slot");
  }, []);

  const registerNode = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  /* ------------------------------------------------------------ transformer */
  const selectedLeafIds = useMemo(() => {
    const out: string[] = [];
    for (const id of selection) {
      const o = doc.objects[id];
      if (!o) continue;
      if (o.type === "group") {
        out.push(...descendantIds(doc, id).filter((d) => doc.objects[d]?.type !== "group"));
      } else out.push(id);
    }
    return out;
  }, [selection, doc]);

  const selectedObjects = useMemo(
    () => selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o),
    [selection, doc],
  );

  const connectableHost = useMemo(() => {
    if (presenting || tool !== "select" || editingId || cropId) return null;
    const id = selection.length === 1 ? selection[0] : hoverId;
    const o = id ? doc.objects[id] : undefined;
    if (!o || o.locked || o.hidden || !CONNECTABLE.has(o.type)) return null;
    return o;
  }, [doc, selection, hoverId, tool, presenting, editingId, cropId]);

  const singleLinear =
    selectedObjects.length === 1 &&
    ["line", "arrow", "measure"].includes(selectedObjects[0].type) &&
    !selectedObjects[0].locked
      ? selectedObjects[0]
      : null;

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    // Konva only refreshes the hit canvas on its own draw loop, so anchors can
    // stay invisible to hit testing after the transformer moves — which makes
    // the resize handles unclickable. Redraw it ourselves whenever we attach.
    const redraw = () => {
      const layer = tr.getLayer();
      layer?.batchDraw();
      layer?.drawHit();
    };
    if (presenting || editingId || cropId || singleLinear) {
      tr.nodes([]);
      redraw();
      return;
    }
    const list = selectedLeafIds
      .map((id) => nodes.current.get(id))
      .filter((n): n is Konva.Group => !!n);
    tr.enabledAnchors([
      "top-left",
      "top-center",
      "top-right",
      "middle-left",
      "middle-right",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ]);
    tr.rotateEnabled(true);
    tr.nodes(list);
    tr.forceUpdate();
    redraw();
  }, [selectedLeafIds, selectedObjects, presenting, editingId, cropId, singleLinear, doc]);

  const commitTransform = useCallback(() => {
    const state = useStore.getState();
    for (const id of selectedLeafIds) {
      const node = nodes.current.get(id);
      const o = state.doc.objects[id];
      if (!node || !o) continue;
      const sx = node.scaleX();
      const sy = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);

      if (o.type === "text") {
        // Side handles reflow the column; corner handles scale the type.
        const scalesType = Math.abs(sy - 1) > 0.001;
        const width = Math.max(24, o.width * sx);
        if (!scalesType && Math.abs(sx - 1) > 0.001 && o.data.autoWidth) state.patchData(id, { autoWidth: false });
        const fontSize = scalesType
          ? Math.max(6, Math.round((o.style.fontSize ?? 18) * sy * 10) / 10)
          : (o.style.fontSize ?? 18);
        if (scalesType) state.patchStyle([id], { fontSize });
        state.patchObject(id, {
          x: node.x(),
          y: node.y(),
          rotation: Math.round(node.rotation() * 100) / 100,
          width,
        });
        state.fitText([id]);
        continue;
      }

      state.patchObject(id, {
        x: node.x(),
        y: node.y(),
        rotation: Math.round(node.rotation() * 100) / 100,
        width: Math.max(1, o.width * sx),
        height: Math.max(1, o.height * sy),
      });
      if ((o.type === "line" || o.type === "arrow" || o.type === "measure") && o.data.points) {
        const [ax, ay, bx, by] = o.data.points;
        state.patchData(id, { points: [ax * sx, ay * sy, bx * sx, by * sy] });
      }
    }
    state.endGesture();
  }, [selectedLeafIds]);

  /* ---------------------------------------------------------------- wheel */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const state = useStore.getState();
      const local = toLocal(e.clientX, e.clientY);
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as a stream of small deltas and is already
        // smooth; a mouse wheel arrives in big notches, so ease those.
        const discrete = Math.abs(e.deltaY) >= 40;
        if (discrete) state.glideZoom(local, Math.exp(-e.deltaY * 0.0022));
        else state.zoomAt(local, Math.exp(-e.deltaY * 0.011));
        return;
      }
      if (e.shiftKey && !e.deltaX) state.panBy(-e.deltaY, 0);
      else state.panBy(-e.deltaX, -e.deltaY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [toLocal]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /* ------------------------------------------------------------- gestures */
  const snapTargets = useCallback((movingIds: string[]): Bounds[] => {
    const state = useStore.getState();
    const skip = new Set(movingIds);
    const targets = state.doc.order
      .map((id) => state.doc.objects[id])
      .filter((o): o is CanvasObject => !!o && !skip.has(o.id) && !o.hidden && o.type !== "group")
      .map(objectBounds);
    // The page itself is a target: edges and centre, so you can feel when a
    // thing is square on the canvas.
    const page = state.doc.settings.page;
    if (page) targets.push({ x: 0, y: 0, width: page.width, height: page.height });
    return targets;
  }, []);

  /**
   * Clicks on a row's disclosure triangle fold it, and on a checkbox tick it.
   * Returns true when the click was consumed by the outline.
   */
  const toggleOutlineRow = useCallback((o: CanvasObject, world: Point): boolean => {
    const items = o.data.items ?? [];
    if (!items.length) return false;
    const rh = rowHeight(o);
    const local = { x: world.x - o.x, y: world.y - o.y };
    const index = Math.floor((local.y - LIST_PAD) / rh);
    const rows = visibleRows(items);
    const row = rows[index];
    if (!row || index < 0) return false;
    const x = LIST_PAD + row.item.level * INDENT;
    const size = o.style.fontSize ?? 15;
    const state = useStore.getState();

    if (row.hasChildren && local.x >= x - 18 && local.x <= x + 2) {
      const next = items.map((it, i) =>
        i === row.index ? { ...it, collapsed: !it.collapsed } : it,
      );
      state.patchData(o.id, { items: next });
      state.patchObject(o.id, {
        height: LIST_PAD * 2 + visibleRows(next).length * rh,
      });
      return true;
    }
    if (o.data.listKind === "check" && local.x >= x - 3 && local.x <= x + size) {
      const next = items.map((it, i) => (i === row.index ? { ...it, checked: !it.checked } : it));
      state.patchData(o.id, { items: next });
      return true;
    }
    return false;
  }, []);

  const beginMove = useCallback((world: Point, ids: string[]) => {
    useStore.getState().beginGesture();
    interaction.current = {
      kind: "move",
      origin: world,
      last: world,
      ids,
      moved: false,
      total: { x: 0, y: 0 },
    };
  }, []);

  const finishTool = useCallback(() => {
    const state = useStore.getState();
    if (state.toolLocked) return;
    if (state.tool === "pen" || state.tool === "highlighter" || state.tool === "eraser") return;
    state.setTool("select");
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const container = containerRef.current;
      const state = useStore.getState();
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
        if (interaction.current.kind === "move" || interaction.current.kind === "draw") {
          state.endGesture();
        }
        interaction.current = { kind: "none" };
        setDraft(null);
        return;
      }
      if (pointers.current.size > 2) return;

      refreshHit();
      // Let Konva's Transformer own its handles.
      if (hitTransformer(e.clientX, e.clientY)) return;
      container?.setPointerCapture(e.pointerId);

      const world = toWorld(e.clientX, e.clientY);

      // Armed colour picker: sample the pixel under the cursor and stop there.
      if (state.ui.eyedropper) {
        const hex = samplePixel(e.clientX, e.clientY);
        if (hex) {
          state.patchStyle(
            state.selection,
            state.ui.eyedropper === "fill" ? { fill: hex, gradient: null } : { stroke: hex },
            state.ui.eyedropper === "fill" ? { fill: hex } : { ink: hex },
          );
          state.flashHint(`Picked ${hex}`);
        }
        state.setUi({ eyedropper: null });
        return;
      }
      state.setUi({ radial: null, menu: null });

      if (presenting) {
        interaction.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
        return;
      }

      if (state.tool === "hand" || spaceDown.current || e.button === 1) {
        interaction.current = { kind: "pan", last: { x: e.clientX, y: e.clientY } };
        return;
      }
      if (e.button === 2) return;

      // Cropping takes over the pointer while active.
      if (state.cropId) {
        const target = state.doc.objects[state.cropId];
        if (target) {
          interaction.current = {
            kind: "crop",
            id: state.cropId,
            origin: world,
            box: objectBounds(target),
          };
          setCropBox({ x: world.x, y: world.y, width: 0, height: 0 });
          return;
        }
      }

      // Endpoint / curve handles for a selected connector.
      if (singleLinear) {
        const [ax, ay, bx, by] = linePoints(singleLinear);
        const r = 11 / camera.zoom;
        const a = { x: singleLinear.x + ax, y: singleLinear.y + ay };
        const b = { x: singleLinear.x + bx, y: singleLinear.y + by };
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (Math.hypot(world.x - a.x, world.y - a.y) < r) {
          state.beginGesture();
          interaction.current = { kind: "endpoint", id: singleLinear.id, end: "a" };
          return;
        }
        if (Math.hypot(world.x - b.x, world.y - b.y) < r) {
          state.beginGesture();
          interaction.current = { kind: "endpoint", id: singleLinear.id, end: "b" };
          return;
        }
        if (singleLinear.type !== "measure" && Math.hypot(world.x - mid.x, world.y - mid.y) < r) {
          state.beginGesture();
          interaction.current = { kind: "curve", id: singleLinear.id };
          return;
        }
      }

      if (state.tool === "eraser") {
        state.beginGesture();
        interaction.current = { kind: "erase" };
        const hit = objectAtPoint(world, [], true);
        if (hit) state.removeObjects([hit.id]);
        return;
      }

      if (state.tool === "pen" || state.tool === "highlighter") {
        const highlighter = state.tool === "highlighter";
        const size = highlighter ? state.defaults.penSize * 4 : state.defaults.penSize;
        const obj = createDraw(world, state.defaults, size, highlighter);
        obj.data.points = [0, 0, pressureFor(e, 0)];
        setDraft(obj);
        interaction.current = { kind: "draw", last: world, lastTime: performance.now() };
        return;
      }

      if (state.tool === "text") {
        // Click = point text that hugs what you type. Drag = a paragraph box.
        const obj = createText(world, state.defaults);
        obj.data.autoWidth = true;
        obj.width = Math.max(24, (obj.style.fontSize ?? 18) * 4);
        interaction.current = { kind: "text", start: world, id: obj.id, placed: false };
        state.addObjects([obj]);
        return;
      }

      if (state.tool === "list") {
        const obj = createList(world, state.defaults);
        state.addObjects([obj]);
        state.setEditing(obj.id);
        finishTool();
        return;
      }

      if (state.tool === "note") {
        const obj = createNote(world, state.defaults.noteKind, state.defaults);
        obj.x = world.x - obj.width / 2;
        obj.y = world.y - obj.height / 2;
        state.addObjects([obj]);
        state.setEditing(obj.id);
        finishTool();
        return;
      }

      if (DRAG_TOOLS.has(state.tool)) {
        let obj: CanvasObject;
        if (SHAPE_TOOLS.includes(state.tool as ShapeType)) {
          obj = createShape(state.tool as ShapeType, world, state.defaults);
        } else if (state.tool === "frame") {
          obj = createFrame(world, `Frame ${doc.order.length + 1}`);
        } else if (state.tool === "measure") {
          obj = createMeasure(world, state.defaults);
        } else {
          obj = createLine(state.tool as "line" | "arrow", world, state.defaults);
          const source = objectAtPoint(world);
          if (source && state.tool === "arrow") obj.data.from = { id: source.id };
        }
        setDraft(obj);
        interaction.current = { kind: "create", origin: world };
        return;
      }

      // Media transport: the play button and the scrub bar are live.
      const mediaHit = hitObjectId(e.clientX, e.clientY);
      const mediaObj = mediaHit ? state.doc.objects[mediaHit] : undefined;
      if (mediaObj?.type === "media" && !mediaObj.locked) {
        const local = { x: world.x - mediaObj.x, y: world.y - mediaObj.y };
        const btn = playButtonAt(mediaObj);
        if (Math.hypot(local.x - btn.x, local.y - btn.y) <= btn.r + 4) {
          togglePlay(mediaObj);
          state.setSelection([mediaObj.id]);
          return;
        }
        const audio = mediaObj.data.mediaKind === "audio";
        const barTop = audio ? mediaObj.height - 30 : mediaObj.height - MEDIA_BAR;
        const trackX = audio ? 62 : 12;
        const trackW = audio ? mediaObj.width - 140 : mediaObj.width - 96;
        if (local.y >= barTop && local.x >= trackX - 6 && local.x <= trackX + trackW + 6) {
          seekFraction(mediaObj, (local.x - trackX) / Math.max(1, trackW));
          state.setSelection([mediaObj.id]);
          return;
        }
      }

      // Connection joints on the hovered or selected object.
      const jointHost = connectableHost;
      if (jointHost) {
        const r = 9 / camera.zoom;
        const joint = jointsOf(jointHost).find(
          (j) => Math.hypot(world.x - j.x, world.y - j.y) < r,
        );
        if (joint) {
          state.beginGesture();
          interaction.current = { kind: "connect", sourceId: jointHost.id, from: joint, to: world };
          setConnectDraft({ from: joint, to: world });
          return;
        }
      }

      // Select tool.
      let hitId = hitObjectId(e.clientX, e.clientY);
      if (!hitId) {
        // Fallback 1: check if pointer is inside any currently selected object's bounds
        const selected = state.selection
          .map((id) => state.doc.objects[id])
          .filter((o): o is CanvasObject => !!o && !o.hidden);
        const insideSel = selected.find((o) => pointInBounds(world, objectBounds(o)));
        if (insideSel) {
          hitId = insideSel.id;
        } else {
          // Fallback 2: check any non-hidden canvas object geometrically
          const geoHit = objectAtPoint(world, [], true);
          if (geoHit) hitId = geoHit.id;
        }
      }
      if (hitId) {
        const hitObj = state.doc.objects[hitId];
        if (hitObj?.type === "list" && !hitObj.locked && toggleOutlineRow(hitObj, world)) return;
      }
      if (!hitId) {
        if (!e.shiftKey) state.clearSelection();
        interaction.current = {
          kind: "marquee",
          origin: world,
          current: world,
          additive: e.shiftKey,
        };
        setMarquee({ x: world.x, y: world.y, width: 0, height: 0 });
        return;
      }

      const targetId = topAncestor(state.doc, hitId);
      let ids = state.selection;
      if (e.shiftKey) {
        state.toggleSelection(targetId);
        ids = useStore.getState().selection;
      } else if (!ids.includes(targetId)) {
        state.setSelection([targetId]);
        ids = [targetId];
      }
      // Adjust-picture mode: a drag inside the masked shape pans its photo.
      const maskedHit = state.doc.objects[targetId];
      if (state.ui.adjustPicture && ids.length === 1 && maskedHit?.data.src && maskedHit.type !== "image") {
        state.beginGesture();
        interaction.current = { kind: "picture", id: targetId, last: world };
        return;
      }
      if (e.altKey) beginMove(world, state.duplicateSelection(0, 0));
      else beginMove(world, ids);
    },
    [
      beginMove,
      camera.zoom,
      connectableHost,
      doc.order.length,
      fillPlaceholder,
      finishTool,
      jointsOf,
      hitObjectId,
      hitTransformer,
      objectAtPoint,
      presenting,
      refreshHit,
      samplePixel,
      singleLinear,
      toggleOutlineRow,
      toWorld,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId)) {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      const state = useStore.getState();

      if (pinch.current && pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pinch.current.dist > 0) state.zoomAt(toLocal(center.x, center.y), dist / pinch.current.dist);
        state.panBy(center.x - pinch.current.center.x, center.y - pinch.current.center.y);
        pinch.current = { dist, center };
        return;
      }

      const it = interaction.current;
      const world = toWorld(e.clientX, e.clientY);

      if (it.kind === "none") {
        if (!presenting && state.tool === "select") {
          let id = hitObjectId(e.clientX, e.clientY);
          if (!id) {
            const geo = objectAtPoint(world, [], true);
            if (geo) id = geo.id;
          }
          const top = id ? topAncestor(state.doc, id) : null;
          if (top !== state.hoverId) state.setHover(top);
        } else if (state.hoverId) state.setHover(null);
        return;
      }

      if (it.kind === "pan") {
        state.panBy(e.clientX - it.last.x, e.clientY - it.last.y);
        it.last = { x: e.clientX, y: e.clientY };
        return;
      }

      if (it.kind === "erase") {
        const hit = objectAtPoint(world, [], true);
        if (hit) state.removeObjects([hit.id]);
        return;
      }

      if (it.kind === "crop") {
        setCropBox(boundsOfPoints([it.origin, world]));
        return;
      }

      if (it.kind === "endpoint" || it.kind === "curve") {
        const o = state.doc.objects[it.id];
        if (!o) return;
        const pts = [...(o.data.points ?? [0, 0, o.width, o.height])];
        const a = { x: o.x + pts[0], y: o.y + pts[1] };
        const b = { x: o.x + pts[2], y: o.y + pts[3] };

        if (it.kind === "curve") {
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const bow = ((world.x - mid.x) * -dy + (world.y - mid.y) * dx) / (len * len * 0.3);
          state.patchStyle([o.id], { curve: Math.max(-1.5, Math.min(1.5, bow)), elbow: false });
          return;
        }

        let next = world;
        if (e.shiftKey) {
          const anchor = it.end === "a" ? b : a;
          const c = constrainAngle(world.x - anchor.x, world.y - anchor.y);
          next = { x: anchor.x + c.x, y: anchor.y + c.y };
        }
        const target = objectAtPoint(next, [o.id]);
        setBindTarget(target?.id ?? null);
        const A = it.end === "a" ? next : a;
        const B = it.end === "b" ? next : b;
        const x = Math.min(A.x, B.x);
        const y = Math.min(A.y, B.y);
        state.patchObject(o.id, {
          x,
          y,
          width: Math.abs(B.x - A.x),
          height: Math.abs(B.y - A.y),
        });
        state.patchData(o.id, { points: [A.x - x, A.y - y, B.x - x, B.y - y] });
        return;
      }

      if (it.kind === "connect") {
        it.to = world;
        setConnectDraft({ from: it.from, to: world });
        setBindTarget(objectAtPoint(world, [it.sourceId])?.id ?? null);
        return;
      }

      if (it.kind === "marquee") {
        it.current = world;
        setMarquee(boundsOfPoints([it.origin, world]));
        return;
      }

      if (it.kind === "draw") {
        setDraft((prev) => {
          if (!prev) return prev;
          const now = performance.now();
          const dt = Math.max(1, now - it.lastTime);
          const speed = (Math.hypot(world.x - it.last.x, world.y - it.last.y) / dt) * 16;
          return {
            ...prev,
            data: {
              ...prev.data,
              points: [
                ...(prev.data.points ?? []),
                world.x - prev.x,
                world.y - prev.y,
                pressureFor(e, speed),
              ],
            },
          };
        });
        it.last = world;
        it.lastTime = performance.now();
        return;
      }

      if (it.kind === "picture") {
        const o = state.doc.objects[it.id];
        if (!o) return;
        // Convert the screen delta into the shape's local axes so rotated shapes pan sanely.
        const rad = (-(o.rotation ?? 0) * Math.PI) / 180;
        const dx = world.x - it.last.x;
        const dy = world.y - it.last.y;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
        const prev = o.data.imageOffset ?? { x: 0, y: 0 };
        state.patchData(it.id, { imageOffset: { x: prev.x + lx, y: prev.y + ly } });
        it.last = world;
        return;
      }

      if (it.kind === "text") {
        const dx = world.x - it.start.x;
        const dy = world.y - it.start.y;
        if (!it.placed && Math.hypot(dx, dy) < 6) return;
        if (!it.placed) state.beginGesture();
        it.placed = true;
        const o = state.doc.objects[it.id];
        if (!o) return;
        const w = Math.max(40, Math.abs(dx));
        const h = Math.max(o.style.fontSize ?? 18, Math.abs(dy));
        state.patchObject(it.id, { x: Math.min(it.start.x, world.x), y: Math.min(it.start.y, world.y), width: w, height: h });
        if (o.data.autoWidth) state.patchData(it.id, { autoWidth: false });
        return;
      }

      if (it.kind === "create") {
        const gridSnap = state.doc.settings.snapToGrid && !(e.ctrlKey || e.metaKey);
        const g = state.doc.settings.gridSize;
        const snapValue = (v: number) => (gridSnap ? Math.round(v / g) * g : v);
        setDraft((prev) => {
          if (!prev) return prev;
          const linear = prev.type === "line" || prev.type === "arrow" || prev.type === "measure";
          let dx = snapValue(world.x) - it.origin.x;
          let dy = snapValue(world.y) - it.origin.y;
          if (linear) {
            if (e.shiftKey) {
              const c = constrainAngle(dx, dy);
              dx = c.x;
              dy = c.y;
            }
            const x = Math.min(it.origin.x, it.origin.x + dx);
            const y = Math.min(it.origin.y, it.origin.y + dy);
            return {
              ...prev,
              x,
              y,
              width: Math.abs(dx),
              height: Math.abs(dy),
              data: {
                ...prev.data,
                points: [
                  it.origin.x - x,
                  it.origin.y - y,
                  it.origin.x + dx - x,
                  it.origin.y + dy - y,
                ],
              },
            };
          }
          if (e.shiftKey) {
            const size = Math.max(Math.abs(dx), Math.abs(dy));
            dx = Math.sign(dx || 1) * size;
            dy = Math.sign(dy || 1) * size;
          }
          return {
            ...prev,
            x: Math.min(it.origin.x, it.origin.x + dx),
            y: Math.min(it.origin.y, it.origin.y + dy),
            width: Math.abs(dx),
            height: Math.abs(dy),
          };
        });
        if (draft && (draft.type === "arrow" || draft.type === "line")) {
          setBindTarget(objectAtPoint(world)?.id ?? null);
        }
        return;
      }

      if (it.kind === "move") {
        let dx = world.x - it.last.x;
        let dy = world.y - it.last.y;
        if (!it.moved && Math.hypot(world.x - it.origin.x, world.y - it.origin.y) < 2 / camera.zoom) {
          return;
        }
        if (!it.moved) setIsMoving(true);
        it.moved = true;

        const snapping =
          !(e.ctrlKey || e.metaKey) &&
          (state.doc.settings.snapToObjects || state.doc.settings.snapToGrid);
        let nextGuides: Guide[] = [];
        if (snapping) {
          const moved = it.ids
            .map((id) => state.doc.objects[id])
            .filter((o): o is CanvasObject => !!o);
          const box = boundsOfObjects(moved);
          if (box) {
            const candidate = { ...box, x: box.x + dx, y: box.y + dy };
            const result = computeSnap(candidate, snapTargets(it.ids), {
              threshold: state.prefs.snapDistance / camera.zoom,
              gridSize: state.doc.settings.snapToGrid ? state.doc.settings.gridSize : undefined,
              objects: state.doc.settings.snapToObjects,
            });
            dx += result.dx;
            dy += result.dy;
            nextGuides = result.guides;
          }
        }
        state.setGuides(nextGuides);
        state.translateObjects(it.ids, dx, dy);
        it.total = { x: it.total.x + dx, y: it.total.y + dy };
        it.last = { x: it.last.x + dx, y: it.last.y + dy };
      }
    },
    [camera.zoom, draft, hitObjectId, objectAtPoint, presenting, snapTargets, toLocal, toWorld],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      containerRef.current?.releasePointerCapture?.(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;

      const state = useStore.getState();
      const it = interaction.current;
      interaction.current = { kind: "none" };
      setIsMoving(false);
      const target = bindTarget;
      setBindTarget(null);

      if (it.kind === "erase" || it.kind === "curve") {
        state.endGesture();
        return;
      }

      if (it.kind === "connect") {
        setConnectDraft(null);
        state.endGesture();
        const a = it.from;
        const b = it.to;
        if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return;
        const arrow = createLine("arrow", a, state.defaults);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        arrow.x = x;
        arrow.y = y;
        arrow.width = Math.abs(b.x - a.x);
        arrow.height = Math.abs(b.y - a.y);
        arrow.data = {
          points: [a.x - x, a.y - y, b.x - x, b.y - y],
          from: { id: it.sourceId },
          to: target ? { id: target } : undefined,
        };
        state.addObjects([arrow]);
        return;
      }

      if (it.kind === "endpoint") {
        const o = state.doc.objects[it.id];
        if (o && (o.type === "arrow" || o.type === "line")) {
          state.bindEndpoint(o.id, it.end === "a" ? "from" : "to", target ? { id: target } : undefined);
        }
        state.endGesture();
        return;
      }

      if (it.kind === "crop" && cropBox) {
        const image = state.doc.objects[it.id];
        setCropBox(null);
        state.setCropId(null);
        if (image && cropBox.width > 6 && cropBox.height > 6) {
          const b = objectBounds(image);
          // Clamp the crop rectangle to the picture itself.
          const x0 = Math.max(b.x, cropBox.x);
          const y0 = Math.max(b.y, cropBox.y);
          const x1 = Math.min(b.x + b.width, cropBox.x + cropBox.width);
          const y1 = Math.min(b.y + b.height, cropBox.y + cropBox.height);
          if (x1 - x0 > 6 && y1 - y0 > 6) {
            const prev = image.data.crop ?? { x: 0, y: 0, width: 1, height: 1 };
            state.beginGesture();
            state.patchData(image.id, {
              crop: {
                x: prev.x + ((x0 - b.x) / b.width) * prev.width,
                y: prev.y + ((y0 - b.y) / b.height) * prev.height,
                width: ((x1 - x0) / b.width) * prev.width,
                height: ((y1 - y0) / b.height) * prev.height,
              },
            });
            state.patchObject(image.id, {
              x: x0,
              y: y0,
              width: x1 - x0,
              height: y1 - y0,
            });
            state.endGesture();
            state.flashHint("Cropped");
          }
        }
        return;
      }

      if (it.kind === "marquee") {
        const box = boundsOfPoints([it.origin, it.current]);
        setMarquee(null);
        if (box.width > 2 || box.height > 2) {
          const hits = state.doc.order
            .map((id) => state.doc.objects[id])
            .filter(
              (o): o is CanvasObject =>
                !!o && !o.hidden && !o.locked && o.type !== "group" && intersects(box, objectBounds(o)),
            )
            .map((o) => topAncestor(state.doc, o.id));
          const unique = [...new Set(hits)];
          state.setSelection(it.additive ? [...new Set([...state.selection, ...unique])] : unique);
        }
        return;
      }

      if (it.kind === "move") {
        if (it.moved) {
          dupState.set(it.total.x, it.total.y);
          state.captureIntoFrames(it.ids);
        }
        state.endGesture();
        return;
      }

      if (it.kind === "draw" && draft) {
        const points = draft.data.points ?? [];
        setDraft(null);
        if (points.length < 6) return;
        const pts: Point[] = [];
        for (let i = 0; i < points.length; i += 3) pts.push({ x: points[i], y: points[i + 1] });
        const box = boundsOfPoints(pts);
        const shifted = [...points];
        for (let i = 0; i < shifted.length; i += 3) {
          shifted[i] -= box.x;
          shifted[i + 1] -= box.y;
        }
        const width = Math.max(box.width, 1);
        const height = Math.max(box.height, 1);
        state.addObjects(
          [
            {
              ...draft,
              x: draft.x + box.x,
              y: draft.y + box.y,
              width,
              height,
              data: { points: shifted, naturalWidth: width, naturalHeight: height },
            },
          ],
          false,
        );
        return;
      }

      if (it.kind === "picture") {
        state.endGesture();
        return;
      }

      if (it.kind === "text") {
        if (it.placed) state.endGesture();
        state.setEditing(it.id);
        finishTool();
        return;
      }

      if (it.kind === "create" && draft) {
        setDraft(null);
        const tiny = draft.width < 4 && draft.height < 4;
        let obj = draft;
        if (tiny) {
          if (draft.type === "line" || draft.type === "arrow" || draft.type === "measure") return;
          const w = draft.type === "frame" ? 480 : 180;
          const h = draft.type === "frame" ? 320 : 130;
          obj = { ...draft, width: w, height: h, x: draft.x - w / 2, y: draft.y - h / 2 };
        }
        if (obj.type === "arrow" && target && target !== obj.data.from?.id) {
          obj = { ...obj, data: { ...obj.data, to: { id: target } } };
        }
        state.addObjects([obj]);
        state.captureIntoFrames([obj.id]);
        finishTool();
      }
    },
    [bindTarget, cropBox, draft, finishTool],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const state = useStore.getState();
      refreshHit();
      const hitId = hitObjectId(e.clientX, e.clientY);
      if (!hitId) return;
      const o = state.doc.objects[hitId];
      if (!o) return;
      if (o.type === "placeholder") {
        void fillPlaceholder(o);
        return;
      }
      if (o.type === "card" && state.ui.presenting) {
        state.patchData(o.id, { flipped: !o.data.flipped });
        return;
      }
      if (o.type === "image") {
        state.setCropId(o.id);
        state.flashHint("Drag to crop · Esc to cancel");
        return;
      }
      if (o.type === "embed" && o.data.embedKind === "site") {
        openSite(o);
        return;
      }
      if (o.type === "vector") return;
      if (o.parentId && state.doc.objects[o.parentId]?.type === "group") {
        state.setSelection([hitId]);
        return;
      }
      if (o.type !== "draw" && o.type !== "embed" && o.type !== "frame" && o.type !== "icon") {
        state.setEditing(hitId);
      }
    },
    [fillPlaceholder, hitObjectId, refreshHit],
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const state = useStore.getState();
      const hitId = hitObjectId(e.clientX, e.clientY);
      const at = toLocal(e.clientX, e.clientY);
      if (hitId) {
        const target = topAncestor(state.doc, hitId);
        if (!state.selection.includes(target)) state.setSelection([target]);
        state.setUi({ menu: at, radial: null });
      } else {
        state.setUi({ radial: at, menu: null });
      }
    },
    [hitObjectId, toLocal],
  );

  /* ------------------------------------------------------------ rendering */
  const backgroundStyle = useMemo(() => {
    const { background, gridSize, gridOpacity } = doc.settings;
    const size = gridSize * camera.zoom;
    const base: React.CSSProperties = {
      backgroundColor: background === "transparent" ? "transparent" : theme.surface,
    };
    if (background === "blank" || background === "transparent" || size < 4) return base;

    // Alpha lives in the pattern colour: a CSS filter here would wash out the
    // Konva canvas stacked on top of it.
    const color = withAlpha(theme.pattern, gridOpacity);
    const offsetX = ((camera.x % size) + size) % size;
    const offsetY = ((camera.y % size) + size) % size;
    const dot = Math.max(1, Math.min(2.2, camera.zoom));

    if (background === "dots") {
      return {
        ...base,
        backgroundImage: `radial-gradient(${color} ${dot}px, transparent ${dot}px)`,
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
      };
    }
    const major = size * 5;
    const strong = withAlpha(theme.pattern, Math.min(1, gridOpacity * 1.7));
    return {
      ...base,
      backgroundImage: [
        `linear-gradient(to right, ${strong} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${strong} 1px, transparent 1px)`,
        `linear-gradient(to right, ${color} 1px, transparent 1px)`,
        `linear-gradient(to bottom, ${color} 1px, transparent 1px)`,
      ].join(", "),
      backgroundSize: `${major}px ${major}px, ${major}px ${major}px, ${size}px ${size}px, ${size}px ${size}px`,
      backgroundPosition: `${((camera.x % major) + major) % major}px ${((camera.y % major) + major) % major}px, ${((camera.x % major) + major) % major}px ${((camera.y % major) + major) % major}px, ${offsetX}px ${offsetY}px, ${offsetX}px ${offsetY}px`,
    };
  }, [camera.x, camera.y, camera.zoom, doc.settings, theme]);

  const editingObject = editingId ? doc.objects[editingId] : undefined;
  const hoverObject =
    hoverId && !selection.includes(hoverId) && !presenting && prefs.hoverOutline
      ? doc.objects[hoverId]
      : undefined;
  const selectionBox = useMemo(
    () => (selectedObjects.length > 1 ? boundsOfObjects(selectedObjects) : null),
    [selectedObjects],
  );
  const px = 1 / camera.zoom;

  return (
    <div
      ref={containerRef}
      className={`canvas-host ${hoverId && tool === "select" ? "is-hovering-object" : ""} ${
        isMoving ? "is-moving" : ""
      }`}
      style={backgroundStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      data-tool={eyedropper ? "eyedropper" : cropId ? "crop" : tool}
    >
      <Stage
        ref={stageRef}
        width={Math.max(1, viewport.width)}
        height={Math.max(1, viewport.height)}
        listening
        style={{ position: "absolute", inset: 0 }}
      >
        <Layer x={camera.x} y={camera.y} scaleX={camera.zoom} scaleY={camera.zoom}>
          {page && (
            <Rect
              x={0}
              y={0}
              width={page.width}
              height={page.height}
              fill="#ffffff"
              stroke="#b9b7ab"
              strokeWidth={px}
              shadowColor="#000000"
              shadowOpacity={0.12}
              shadowBlur={18 * px}
              listening={false}
            />
          )}
          {objects.map((o) => {
            if (o.type === "group") return null;
            const cel = celOpacity.get(o.id);
            if (cel === 0) return null;
            return (
              <ShapeNode
                key={o.id}
                object={o}
                mode={doc.settings.renderMode}
                unit={doc.settings.unit}
                unitScale={doc.settings.unitScale}
                editing={editingId === o.id}
                celOpacity={cel ?? 1}
                onRef={registerNode}
              />
            );
          })}
          {draft && (
            <ShapeNode
              object={draft}
              mode={doc.settings.renderMode}
              unit={doc.settings.unit}
              unitScale={doc.settings.unitScale}
              editing={false}
              onRef={() => undefined}
            />
          )}
          <Transformer
            ref={trRef}
            keepRatio={false}
            padding={3}
            anchorSize={9}
            anchorStroke="#2f6bd8"
            anchorFill="#ffffff"
            anchorCornerRadius={1}
            borderStroke="#2f6bd8"
            borderStrokeWidth={1}
            rotateAnchorOffset={24}
            ignoreStroke
            shouldOverdrawWholeArea={false}
            flipEnabled={false}
            onTransformStart={() => useStore.getState().beginGesture()}
            onTransformEnd={commitTransform}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          />
        </Layer>

        <Layer
          ref={overlayRef}
          x={camera.x}
          y={camera.y}
          scaleX={camera.zoom}
          scaleY={camera.zoom}
          listening={false}
        >
          {page && (
            <Text
              x={0}
              y={-22 * px}
              text={`${page.label}  ${page.width} × ${page.height}`}
              fontSize={12 * px}
              fill="#8f8e86"
            />
          )}

          {connectableHost && !connectDraft && (
            <Group listening={false}>
              {jointsOf(connectableHost).map((j, i) => (
                <Circle
                  key={i}
                  x={j.x}
                  y={j.y}
                  radius={4 * px}
                  fill="#ffffff"
                  stroke="#1f5fd0"
                  strokeWidth={1.4 * px}
                />
              ))}
            </Group>
          )}

          {connectDraft && (
            <Line
              points={[connectDraft.from.x, connectDraft.from.y, connectDraft.to.x, connectDraft.to.y]}
              stroke="#1f5fd0"
              strokeWidth={1.6 * px}
              dash={[6 * px, 4 * px]}
            />
          )}

          {hoverObject && (
            <Rect
              x={objectBounds(hoverObject).x - 2 * px}
              y={objectBounds(hoverObject).y - 2 * px}
              width={objectBounds(hoverObject).width + 4 * px}
              height={objectBounds(hoverObject).height + 4 * px}
              stroke="#2f6bd8"
              strokeWidth={px}
              opacity={0.6}
            />
          )}

          {bindTarget && doc.objects[bindTarget] && (
            <Rect
              x={objectBounds(doc.objects[bindTarget]).x - 3 * px}
              y={objectBounds(doc.objects[bindTarget]).y - 3 * px}
              width={objectBounds(doc.objects[bindTarget]).width + 6 * px}
              height={objectBounds(doc.objects[bindTarget]).height + 6 * px}
              stroke="#0f8a6a"
              strokeWidth={2 * px}
              dash={[5 * px, 4 * px]}
            />
          )}

          {selectionBox && (
            <Rect
              x={selectionBox.x - 5 * px}
              y={selectionBox.y - 5 * px}
              width={selectionBox.width + 10 * px}
              height={selectionBox.height + 10 * px}
              stroke="#2f6bd8"
              strokeWidth={px}
              dash={[4 * px, 4 * px]}
              opacity={0.7}
            />
          )}

          {singleLinear && (() => {
            const [ax, ay, bx, by] = linePoints(singleLinear);
            const a = { x: singleLinear.x + ax, y: singleLinear.y + ay };
            const b = { x: singleLinear.x + bx, y: singleLinear.y + by };
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            const r = 5 * px;
            return (
              <Group>
                <Circle x={a.x} y={a.y} radius={r} fill="#ffffff" stroke="#2f6bd8" strokeWidth={1.4 * px} />
                <Circle x={b.x} y={b.y} radius={r} fill="#ffffff" stroke="#2f6bd8" strokeWidth={1.4 * px} />
                {singleLinear.type !== "measure" && (
                  <Circle
                    x={mid.x}
                    y={mid.y}
                    radius={r * 0.8}
                    fill="#2f6bd8"
                    opacity={0.5}
                  />
                )}
              </Group>
            );
          })()}

          {guides.map((g, i) => (
            <Group key={`guide-${i}`}>
              <Line
                points={
                  g.orientation === "v"
                    ? [g.position, g.start - 40, g.position, g.end + 40]
                    : [g.start - 40, g.position, g.end + 40, g.position]
                }
                stroke="#e0567a"
                strokeWidth={px}
                dash={g.kind === "center" ? [6 * px, 4 * px] : undefined}
              />
              {g.kind === "spacing" && g.gap !== undefined && (
                <Text
                  x={(g.orientation === "h" ? (g.start + g.end) / 2 : g.position) - 18 * px}
                  y={(g.orientation === "h" ? g.position : (g.start + g.end) / 2) - 16 * px}
                  text={formatMeasure(g.gap, doc.settings.unit, doc.settings.unitScale)}
                  fontSize={11 * px}
                  fill="#e0567a"
                />
              )}
            </Group>
          ))}

          {marquee && (
            <Rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.width}
              height={marquee.height}
              fill="rgba(47,107,216,0.09)"
              stroke="#2f6bd8"
              strokeWidth={px}
            />
          )}

          {cropId && cropBox && (
            <Rect
              x={cropBox.x}
              y={cropBox.y}
              width={cropBox.width}
              height={cropBox.height}
              stroke="#ffffff"
              strokeWidth={1.5 * px}
              dash={[6 * px, 4 * px]}
              fill="rgba(0,0,0,0.12)"
            />
          )}
        </Layer>
      </Stage>

      {editingObject && <TextEditor object={editingObject} camera={camera} />}
    </div>
  );
}

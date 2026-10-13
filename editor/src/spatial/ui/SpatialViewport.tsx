import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { Engine } from "../engine/Engine";
import { rayToPlane, snapToGrid, worldToPlane, planeToWorld, type Basis } from "../engine/plane";
import { fitShape } from "../engine/shapefit";
import { useStore, uid, DEFAULT_CAMERA } from "../store/store";
import { Controls, type PointerSample } from "../input/Controls";
import type { CameraObj, CameraState, Stroke } from "../types";

/**
 * The drawing surface. Owns the engine, turns pointer events into world space,
 * and is the only place that decides what a gesture means.
 */

/* The engine and the live camera are module state on purpose: panels and menus
   need to reach them without threading refs through every component. */
let engine: Engine | null = null;
let cam: CameraState = { ...DEFAULT_CAMERA };

export const getEngine = () => engine;

export function nudgeCamera(patch: Partial<CameraState>) {
  Object.assign(cam, patch);
  engine?.applyCamera(cam);
}

export function commitCamera() {
  useStore.getState().setCamera({ ...cam });
}

export function frameAll(padding = 1.6) {
  if (!engine) return;
  const box = engine.contentBounds();
  if (box.isEmpty()) {
    Object.assign(cam, DEFAULT_CAMERA);
  } else {
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.3);
    cam.target = [c.x, c.y, c.z];
    cam.dist = (r / Math.tan((cam.fov * Math.PI) / 360)) * padding;
  }
  engine.applyCamera(cam);
  commitCamera();
}

export type ViewName = "front" | "back" | "left" | "right" | "top" | "bottom" | "iso";

const VIEWS: Record<ViewName, [number, number]> = {
  front: [Math.PI / 2, Math.PI / 2],
  back: [-Math.PI / 2, Math.PI / 2],
  right: [0, Math.PI / 2],
  left: [Math.PI, Math.PI / 2],
  top: [Math.PI / 2, 0.06],
  bottom: [Math.PI / 2, Math.PI - 0.06],
  iso: [Math.PI * 0.25, Math.PI * 0.32],
};

export function setView(name: ViewName) {
  const [theta, phi] = VIEWS[name];
  cam.theta = theta;
  cam.phi = phi;
  engine?.applyCamera(cam);
  commitCamera();
}

/** Current camera angles, for the orientation widget. */
export function cameraAngles() {
  return { theta: cam.theta, phi: cam.phi, dist: cam.dist };
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function SpatialViewport({ toast }: { toast: (m: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [ready, setReady] = useState(false);

  const sketch = useStore((s) => s.sketch);
  const selection = useStore((s) => s.selection);
  const tool = useStore((s) => s.tool);
  const prefs = useStore((s) => s.prefs);
  const gizmoMode = useStore((s) => s.gizmoMode);
  const gizmoSpace = useStore((s) => s.gizmoSpace);
  const posing = useStore((s) => s.posing);
  const poseBone = useStore((s) => s.poseBone);
  const activeCameraId = useStore((s) => s.activeCameraId);
  const setActiveCameraId = useStore((s) => s.setActiveCameraId);

  const live = useRef<{ stroke: Stroke; basis: Basis; last: THREE.Vector3 } | null>(null);
  const drag = useRef<
    | { kind: "move" | "pull" | "plane" | "marquee" | "erase"; basis?: Basis; last?: THREE.Vector3; ids?: string[]; startY?: number; startOffset?: number }
    | null
  >(null);
  const rebuild = useRef(0);
  const sketchRef = useRef(sketch);
  sketchRef.current = sketch;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const controlsRef = useRef<Controls | null>(null);
  const marqueeRef = useRef<Marquee | null>(null);
  marqueeRef.current = marquee;

  const visibleLayers = () =>
    new Set(sketchRef.current.layers.filter((l) => l.visible && !l.locked).map((l) => l.id));

  const drawBasis = (x: number, y: number): Basis => {
    const st = useStore.getState();
    if (st.space === "plane" || st.sketch.plane.lock) return engine!.basisFor(st.sketch.plane);
    let depth = st.depth;
    if (st.prefs.snapDepth) {
      const d = engine!.surfaceDepth(x, y, visibleLayers());
      if (d != null && d > 0.15) depth = d;
    }
    return engine!.spaceBasis(depth);
  };

  const pointOn = (basis: Basis, x: number, y: number): THREE.Vector3 | null => {
    const p = rayToPlane(engine!.ray(x, y), basis);
    if (!p) return null;
    const st = useStore.getState();
    if (st.sketch.plane.snap && st.space === "plane") {
      return snapToGrid(basis, p, Math.max(0.01, st.sketch.plane.grid));
    }
    return p;
  };

  const eraseRadiusPx = () => {
    const st = useStore.getState();
    return Math.max(9, engine!.worldToPixels(st.size * 0.75, new THREE.Vector3(...cam.target)));
  };

  /* ----------------------------------------------------------- lifecycle */

  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = hostRef.current!;
    const e = new Engine(canvas);
    engine = e;
    cam = { ...useStore.getState().sketch.camera };
    e.applyCamera(cam);
    e.setBrushes(useStore.getState().brushes());

    // The gizmo writes straight through to the document, coalesced into one step.
    e.onGizmoChange = (id, pos, rot, scale) => {
      const st = useStore.getState();
      if (!st.gizmoDragging) {
        st.beginGesture();
        useStore.setState({ gizmoDragging: true });
      }
      st.placeObject(id, pos as [number, number, number], rot as [number, number, number], scale as [number, number, number]);
    };
    e.onGizmoDone = () => {
      const st = useStore.getState();
      if (st.gizmoDragging) {
        st.endGesture();
        useStore.setState({ gizmoDragging: false });
      }
    };
    e.onModelError = () => toast("That model could not be read");

    // Turning a joint is one continuous edit, not one per frame.
    e.onBonePosed = (modelId, bone, euler) => {
      const st = useStore.getState();
      if (!st.gizmoDragging) {
        st.beginGesture();
        useStore.setState({ gizmoDragging: true });
      }
      st.setBoneRotation(modelId, bone, euler);
    };
    if (import.meta.env.DEV) {
      (window as unknown as { __spatial: unknown }).__spatial = { engine: e, store: useStore };
    }
    (window as unknown as { __spatialEngine: unknown }).__spatialEngine = e;

    setReady(true);

    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) e.resize(r.width, r.height);
    });
    ro.observe(host);
    const r0 = host.getBoundingClientRect();
    e.resize(Math.max(1, r0.width), Math.max(1, r0.height));

    return () => {
      ro.disconnect();
      e.dispose();
      engine = null;
      (window as unknown as { __spatialEngine: unknown }).__spatialEngine = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !engine) return;
    engine.setBrushes(useStore.getState().brushes());
    engine.sync(sketch.objects, sketch.layers);
  }, [ready, sketch.objects, sketch.layers, sketch.brushes]);

  useEffect(() => {
    if (ready && engine) engine.setEnv(sketch.env);
  }, [ready, sketch.env]);

  useEffect(() => {
    if (ready && engine) engine.setPlane(sketch.plane);
  }, [ready, sketch.plane]);

  useEffect(() => {
    if (ready && engine) engine.setSelection(selection);
  }, [ready, selection, sketch.objects]);

  useEffect(() => {
    if (ready && engine) engine.setActiveCameraId(activeCameraId);
  }, [ready, activeCameraId]);

  /* Handles appear only for things that can actually be transformed, and a
     rig being posed takes them over from the object as a whole. */
  useEffect(() => {
    if (!ready || !engine) return;
    const one = selection.length === 1 ? selection[0] : null;
    const obj = one ? sketch.objects.find((o) => o.id === one) : null;

    const poseTarget = posing && obj?.kind === "model" ? one : null;
    engine.setPoseTarget(poseTarget);
    if (poseTarget) {
      engine.attachBone(poseBone);
      return;
    }
    const placeable = obj && (
      obj.kind === "prim" || obj.kind === "model" || obj.kind === "flat" ||
      obj.kind === "camera" || obj.kind === "light" || obj.kind === "guide"
    );
    engine.setGizmo(placeable && tool === "select" ? one : null, gizmoMode, gizmoSpace);
  }, [ready, selection, sketch.objects, tool, gizmoMode, gizmoSpace, posing, poseBone]);

  useEffect(() => {
    if (ready && engine) engine.setQuality(prefs.quality);
  }, [ready, prefs.quality]);

  useEffect(() => {
    if (ready && engine) engine.setTurntable(sketch.env.turntable);
  }, [ready, sketch.env.turntable]);

  useEffect(() => {
    if (!ready || !engine) return;
    cam = { ...sketchRef.current.camera };
    engine.applyCamera(cam);
  }, [ready, sketch.id]);

  /* ------------------------------------------------------------- drawing */

  const pushPoint = (p: THREE.Vector3, pressure: number) => {
    const l = live.current;
    if (!l) return;
    if (l.stroke.pts.length && p.distanceTo(l.last) < l.stroke.size * 0.08) return;
    l.stroke.pts.push(p.x, p.y, p.z, pressure);
    l.last.copy(p);
    if (!rebuild.current) {
      rebuild.current = requestAnimationFrame(() => {
        rebuild.current = 0;
        if (live.current) engine?.setLive(live.current.stroke);
      });
    }
  };

  const finishStroke = (held: number) => {
    const l = live.current;
    live.current = null;
    cancelAnimationFrame(rebuild.current);
    rebuild.current = 0;
    engine?.setLive(null);
    if (!l || l.stroke.pts.length < 8) return;

    // QuickShape: holding still at the end means "make this the shape I meant".
    if (held > 420) {
      const flat: number[] = [];
      const v = new THREE.Vector3();
      const n = l.stroke.pts.length / 4;
      for (let i = 0; i < n; i++) {
        v.set(l.stroke.pts[i * 4], l.stroke.pts[i * 4 + 1], l.stroke.pts[i * 4 + 2]);
        const [u, w] = worldToPlane(l.basis, v);
        flat.push(u, w);
      }
      const fit = fitShape(flat, l.stroke.size);
      if (fit.kind !== "none") {
        const pts: number[] = [];
        const out = new THREE.Vector3();
        for (let i = 0; i < fit.pts.length / 2; i++) {
          planeToWorld(l.basis, fit.pts[i * 2], fit.pts[i * 2 + 1], out);
          pts.push(out.x, out.y, out.z, 1);
        }
        l.stroke.pts = pts;
        toast(fit.kind === "ellipse" ? "Snapped to ellipse" : fit.kind === "line" ? "Snapped to line" : "Snapped to shape");
      }
    }
    useStore.getState().addStroke(l.stroke);
  };

  /* ------------------------------------------------------------ handlers */

  useEffect(() => {
    if (!ready) return;
    const st = () => useStore.getState();

    const controls = new Controls({
      begin(p: PointerSample) {
        // The transform handles own the pointer whenever one is under it.
        if (engine?.gizmoBusy) return;
        const s = st();
        const t = toolRef.current;

        if (s.posing) {
          const bone = engine!.pickBone(p.x, p.y);
          if (bone) {
            s.setPoseBone(bone);
            engine!.attachBone(bone);
            return;
          }
        }

        if (t === "draw") {
          if (s.activeLayerLocked()) {
            toast("The active layer is locked");
            return;
          }
          const basis = drawBasis(p.x, p.y);
          const at = pointOn(basis, p.x, p.y);
          if (!at) return;
          const stroke: Stroke = {
            id: uid("st"),
            kind: "stroke",
            layer: s.sketch.activeLayer,
            brush: s.brushId,
            color: s.color,
            size: s.size,
            opacity: s.opacity,
            seed: Math.floor(Math.random() * 1e9),
            normal: [basis.n.x, basis.n.y, basis.n.z],
            pts: [],
            planeId: s.space === "plane" ? s.sketch.plane.preset : null,
          };
          live.current = { stroke, basis, last: at.clone() };
          stroke.pts.push(at.x, at.y, at.z, p.pressure);
          engine?.setLive(stroke);
          return;
        }

        if (t === "erase") {
          s.beginGesture();
          const hits = engine!.pickMany(p.x, p.y, eraseRadiusPx(), visibleLayers());
          if (hits.length) s.removeObjects([hits[0].id]);
          drag.current = { kind: "erase" };
          return;
        }

        if (t === "plane") {
          s.beginGesture();
          drag.current = { kind: "plane", startY: p.y, startOffset: s.sketch.plane.offset };
          return;
        }

        if (t === "pull") {
          let ids = s.selection.filter((id) => s.sketch.objects.some((o) => o.id === id && o.kind === "stroke"));
          if (!ids.length) {
            const hit = engine!.pick(p.x, p.y, 16, visibleLayers());
            if (hit && s.sketch.objects.some((o) => o.id === hit.id && o.kind === "stroke")) {
              ids = [hit.id];
              s.select(ids);
            }
          }
          if (!ids.length) {
            toast("Tap an outline drawn on the plane, then drag up");
            return;
          }
          s.beginGesture();
          drag.current = { kind: "pull", ids: s.pull(ids, 0.02, s.pullMode), startY: p.y };
          return;
        }

        // select / move
        const hit = engine!.pick(p.x, p.y, 16, visibleLayers());
        if (hit) {
          if (!s.selection.includes(hit.id)) s.select([hit.id]);
          const basis = drawBasis(p.x, p.y);
          s.beginGesture();
          drag.current = { kind: "move", basis, last: pointOn(basis, p.x, p.y)?.clone() };
        } else {
          drag.current = { kind: "marquee" };
          setMarquee({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }
      },

      move(p: PointerSample) {
        if (engine?.gizmoBusy) return;
        const s = st();
        if (live.current) {
          const at = pointOn(live.current.basis, p.x, p.y);
          if (at) pushPoint(at, p.pressure);
          return;
        }
        const d = drag.current;
        if (!d) return;

        switch (d.kind) {
          case "erase": {
            const hits = engine!.pickMany(p.x, p.y, eraseRadiusPx(), visibleLayers());
            if (hits.length) s.removeObjects(hits.map((h) => h.id));
            break;
          }
          case "plane": {
            const dy = (d.startY ?? 0) - p.y;
            s.setPlane({ offset: (d.startOffset ?? 0) + dy * 0.006 * Math.max(1, cam.dist / 6) });
            break;
          }
          case "pull": {
            const dy = (d.startY ?? 0) - p.y;
            const h = Math.max(0.01, dy * 0.004 * Math.max(1, cam.dist / 6));
            d.ids?.forEach((id) => s.updateObject(id, { height: h }));
            break;
          }
          case "marquee":
            setMarquee((m) => (m ? { ...m, x1: p.x, y1: p.y } : m));
            break;
          case "move": {
            if (!d.basis || !d.last) break;
            const at = pointOn(d.basis, p.x, p.y);
            if (!at) break;
            const delta = at.clone().sub(d.last);
            if (delta.lengthSq() < 1e-12) break;
            s.transformObjects(s.selection, new THREE.Matrix4().makeTranslation(delta.x, delta.y, delta.z));
            d.last.copy(at);
            break;
          }
          default:
            break;
        }
      },

      end(_p: PointerSample, held: number) {
        const s = st();
        if (live.current) {
          finishStroke(held);
          return;
        }
        const d = drag.current;
        drag.current = null;
        if (d?.kind === "marquee") {
          const m = marqueeRef.current;
          setMarquee(null);
          if (m && Math.abs(m.x1 - m.x0) > 6 && Math.abs(m.y1 - m.y0) > 6) {
            const ids = engine!.pickInRect(
              Math.min(m.x0, m.x1), Math.min(m.y0, m.y1),
              Math.max(m.x0, m.x1), Math.max(m.y0, m.y1),
              visibleLayers()
            );
            s.select(ids);
            if (ids.length) toast(`${ids.length} selected`);
          } else {
            s.clearSelection();
          }
          return;
        }
        if (d) s.endGesture();
      },

      cancel() {
        live.current = null;
        cancelAnimationFrame(rebuild.current);
        rebuild.current = 0;
        engine?.setLive(null);
        if (drag.current) st().endGesture();
        drag.current = null;
        setMarquee(null);
      },

      orbit(dx, dy) {
        if (engine?.gizmoBusy) return;
        cam.theta -= dx * 0.006;
        cam.phi = Math.max(0.03, Math.min(Math.PI - 0.03, cam.phi - dy * 0.006));
        engine?.applyCamera(cam);
      },

      pan(dx, dy) {
        const e = engine;
        if (!e || e.gizmoBusy) return;
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(e.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(e.camera.quaternion);
        const k = cam.dist * 0.0016;
        const t = new THREE.Vector3(...cam.target).addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
        cam.target = [t.x, t.y, t.z];
        e.applyCamera(cam);
      },

      dolly(factor) {
        if (engine?.gizmoBusy) return;
        cam.dist = Math.max(0.3, Math.min(160, cam.dist * factor));
        engine?.applyCamera(cam);
      },

      tap(fingers) {
        const s = st();
        if (fingers === 2) s.undo();
        else if (fingers === 3) s.redo();
        else if (fingers >= 4) document.body.classList.toggle("spatial-focus");
      },

      hover(x, y) {
        const el = cursorRef.current;
        if (!el) return;
        if (x < 0) {
          el.style.opacity = "0";
          return;
        }
        const s = st();
        const r = Math.max(3, engine!.worldToPixels(s.size, new THREE.Vector3(...cam.target)));
        el.style.opacity = s.tool === "draw" || s.tool === "erase" ? "1" : "0";
        el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        el.style.width = `${r}px`;
        el.style.height = `${r}px`;
      },

      adjustSize(d) {
        const s = st();
        s.setSize(s.size * (1 + d * 6));
      },

      adjustDepth(d) {
        const s = st();
        if (s.space === "space") s.setDepth(s.depth * (1 + d));
      },
    });

    controls.attach(hostRef.current!);
    controlsRef.current = controls;
    return () => controls.detach();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    c.opts = {
      stabilizer: prefs.stabilizer,
      pressureCurve: prefs.pressureCurve,
      gestureUndo: prefs.gestureUndo,
      invertScroll: prefs.invertScroll,
      drawEnabled: true,
    };
  }, [prefs]);

  useEffect(() => {
    const t = window.setInterval(() => {
      const c = useStore.getState().sketch.camera;
      if (c.dist !== cam.dist || c.theta !== cam.theta || c.phi !== cam.phi) commitCamera();
    }, 2500);
    return () => window.clearInterval(t);
  }, []);

  const activeCam = activeCameraId ? (sketch.objects.find((o) => o.id === activeCameraId && o.kind === "camera") as CameraObj | undefined) : null;
  const selectedCam = selection.length === 1 ? (sketch.objects.find((o) => o.id === selection[0] && o.kind === "camera") as CameraObj | undefined) : null;
  const currentCam = activeCam || selectedCam;

  return (
    <div ref={hostRef} className={`sp-viewport sp-tool-${tool}`}>
      <canvas ref={canvasRef} />
      <div ref={cursorRef} className="sp-cursor" />
      {currentCam?.guides && (
        <svg
          className="sp-camera-guides"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 10,
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {currentCam.guides.ruleOfThirds && (
            <>
              <line x1="33.333" y1="0" x2="33.333" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="0.3" strokeDasharray="1 1" />
              <line x1="66.666" y1="0" x2="66.666" y2="100" stroke="rgba(255,255,255,0.22)" strokeWidth="0.3" strokeDasharray="1 1" />
              <line x1="0" y1="33.333" x2="100" y2="33.333" stroke="rgba(255,255,255,0.22)" strokeWidth="0.3" strokeDasharray="1 1" />
              <line x1="0" y1="66.666" x2="100" y2="66.666" stroke="rgba(255,255,255,0.22)" strokeWidth="0.3" strokeDasharray="1 1" />
            </>
          )}
          {currentCam.guides.centerCross && (
            <>
              <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" />
              <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" />
            </>
          )}
          {currentCam.guides.safeArea && (
            <>
              <rect x="5" y="5" width="90" height="90" fill="none" stroke="rgba(56,189,248,0.3)" strokeWidth="0.3" strokeDasharray="1 1" />
              <rect x="10" y="10" width="80" height="80" fill="none" stroke="rgba(245,158,11,0.3)" strokeWidth="0.3" strokeDasharray="1 1" />
            </>
          )}
          {currentCam.guides.horizon && (
            <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(239,68,68,0.45)" strokeWidth="0.35" strokeDasharray="2 1" />
          )}
          {currentCam.guides.goldenRatio && (
            <>
              <line x1="38.2" y1="0" x2="38.2" y2="100" stroke="rgba(234,179,8,0.25)" strokeWidth="0.3" />
              <line x1="61.8" y1="0" x2="61.8" y2="100" stroke="rgba(234,179,8,0.25)" strokeWidth="0.3" />
              <line x1="0" y1="38.2" x2="100" y2="38.2" stroke="rgba(234,179,8,0.25)" strokeWidth="0.3" />
              <line x1="0" y1="61.8" x2="100" y2="61.8" stroke="rgba(234,179,8,0.25)" strokeWidth="0.3" />
            </>
          )}
        </svg>
      )}
      {activeCam && (
        <div
          style={{
            position: "absolute",
            top: 56,
            left: 20,
            zIndex: 30,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 12px",
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            borderRadius: 8,
            backdropFilter: "blur(12px)",
            color: "#E2E8F0",
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#38BDF8" }} />
          <span>Through {activeCam.name}</span>
          <button
            onClick={() => setActiveCameraId(null)}
            style={{
              padding: "3px 8px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              borderRadius: 4,
              color: "#FFF",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            Exit Camera View
          </button>
        </div>
      )}
      {marquee && (
        <div
          className="sp-marquee"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
    </div>
  );
}

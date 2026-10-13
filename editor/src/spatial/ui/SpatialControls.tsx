import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { useStore } from "../store/store";
import { cameraAngles, frameAll, getEngine, nudgeCamera, setView, type ViewName } from "./SpatialViewport";

/**
 * The two wheels.
 *
 * The upper one is the world: drag it to orbit, tap a labelled node to drop
 * onto that view. The lower one is the selection: drag an arrow to slide along
 * an axis, drag an arc to spin around it. Together they mean you can place
 * something precisely without ever letting go of the pen.
 */

const AXES: { key: "x" | "y" | "z"; v: [number, number, number]; label: string; view: ViewName }[] = [
  { key: "x", v: [1, 0, 0], label: "Right", view: "right" },
  { key: "y", v: [0, 1, 0], label: "Top", view: "top" },
  { key: "z", v: [0, 0, 1], label: "Front", view: "front" },
];
const NEG: { key: "x" | "y" | "z"; v: [number, number, number]; label: string; view: ViewName }[] = [
  { key: "x", v: [-1, 0, 0], label: "Left", view: "left" },
  { key: "y", v: [0, -1, 0], label: "Bottom", view: "bottom" },
  { key: "z", v: [0, 0, -1], label: "Back", view: "back" },
];

/** World direction to widget coordinates, using the live camera basis. */
function useProjector() {
  return (v: [number, number, number], R: number) => {
    const e = getEngine();
    const dir = new THREE.Vector3(v[0], v[1], v[2]);
    if (e) {
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(e.camera.quaternion);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(e.camera.quaternion);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(e.camera.quaternion);
      return { x: dir.dot(right) * R, y: -dir.dot(up) * R, depth: dir.dot(fwd) };
    }
    return { x: 0, y: 0, depth: 0 };
  };
}

/* -------------------------------------------------------------- view ball */

function ViewBall() {
  const [, force] = useState(0);
  const project = useProjector();
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 90);
    return () => window.clearInterval(t);
  }, []);

  const R = 27;
  const nodes = [...AXES.map((a) => ({ ...a, main: true })), ...NEG.map((a) => ({ ...a, main: false }))]
    .map((a) => ({ ...a, p: project(a.v, R) }))
    .sort((a, b) => a.p.depth - b.p.depth);

  const down = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: 0 };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.moved += Math.abs(dx) + Math.abs(dy);
    d.x = e.clientX;
    d.y = e.clientY;
    const c = cameraAngles();
    nudgeCamera({
      theta: c.theta - dx * 0.012,
      phi: Math.max(0.04, Math.min(Math.PI - 0.04, c.phi - dy * 0.012)),
    });
  };
  const up = (e: React.PointerEvent) => {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    drag.current = null;
  };

  return (
    <div className="sp-wheel">
      <svg
        ref={ref}
        viewBox="-44 -44 88 88"
        width="96"
        height="96"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <circle className="sp-wheel-face" cx="0" cy="0" r="41" />
        {nodes.map((n, i) => (
          <g
            key={i}
            className={`sp-node ${n.key}${n.main ? "" : " is-back"}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setView(n.view)}
          >
            <line x1="0" y1="0" x2={n.p.x} y2={n.p.y} />
            <circle cx={n.p.x} cy={n.p.y} r={n.main ? 10.5 : 6} />
            {n.main && (
              <text x={n.p.x} y={n.p.y}>
                {n.label.slice(0, 1)}
              </text>
            )}
            <title>{n.label} view</title>
          </g>
        ))}
        <circle className="sp-wheel-hub" cx="0" cy="0" r="2.6" />
      </svg>
    </div>
  );
}

/* --------------------------------------------------------- transform wheel */

const AXIS_COLOR: Record<string, string> = { x: "#d4483b", y: "#2f8f5b", z: "#2f6bf0" };

function TransformWheel() {
  const [, force] = useState(0);
  const project = useProjector();
  const selection = useStore((s) => s.selection);
  const objects = useStore((s) => s.sketch.objects);
  const transformObjects = useStore((s) => s.transformObjects);
  const beginGesture = useStore((s) => s.beginGesture);
  const endGesture = useStore((s) => s.endGesture);
  const drag = useRef<{ axis: "x" | "y" | "z"; mode: "move" | "spin"; x: number; y: number } | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => force((n) => n + 1), 90);
    return () => window.clearInterval(t);
  }, []);

  const active = selection.length > 0;
  const R = 28;

  /** Centre of the selection, so a spin turns about the thing itself. */
  const pivot = () => {
    const e = getEngine();
    const box = new THREE.Box3();
    if (!e) return new THREE.Vector3();
    const chosen = new Set(selection);
    for (const o of objects) if (chosen.has(o.id)) box.union(e.boundsOf(o));
    return box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  };

  const down = (axis: "x" | "y" | "z", mode: "move" | "spin") => (e: React.PointerEvent) => {
    if (!active) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { axis, mode, x: e.clientX, y: e.clientY };
    beginGesture();
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;

    const v: [number, number, number] = d.axis === "x" ? [1, 0, 0] : d.axis === "y" ? [0, 1, 0] : [0, 0, 1];
    const cam = cameraAngles();

    if (d.mode === "move") {
      // Project the drag onto the axis as it appears on screen, so pulling the
      // arrow the way it points always moves the object that way.
      const p = project(v, 1);
      const len = Math.hypot(p.x, p.y) || 1e-3;
      const along = (dx * p.x + dy * p.y) / len;
      const step = along * cam.dist * 0.0022;
      transformObjects(selection, new THREE.Matrix4().makeTranslation(v[0] * step, v[1] * step, v[2] * step));
    } else {
      const angle = (dx + dy) * 0.012;
      const c = pivot();
      const m = new THREE.Matrix4()
        .makeTranslation(c.x, c.y, c.z)
        .multiply(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(...v), angle))
        .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      transformObjects(selection, m);
    }
  };

  const up = (e: React.PointerEvent) => {
    if (!drag.current) return;
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    drag.current = null;
    endGesture();
  };

  const arrows = AXES.map((a) => ({ ...a, p: project(a.v, R) }));

  return (
    <div className={`sp-wheel${active ? "" : " is-idle"}`}>
      <svg viewBox="-44 -44 88 88" width="96" height="96" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <circle className="sp-wheel-face" cx="0" cy="0" r="41" />

        {/* rotation arcs, one per axis, just inside the rim */}
        {AXES.map((a, i) => {
          const r = 34 - i * 4.5;
          return (
            <path
              key={`arc-${a.key}`}
              className="sp-arc"
              stroke={AXIS_COLOR[a.key]}
              d={`M ${-r} 0 A ${r} ${r} 0 0 1 ${r * Math.cos(Math.PI / 3)} ${-r * Math.sin(Math.PI / 3)}`}
              onPointerDown={down(a.key, "spin")}
            >
              <title>Spin around {a.label.toLowerCase()}</title>
            </path>
          );
        })}

        {/* axis arrows */}
        {arrows.map((a) => {
          const len = Math.hypot(a.p.x, a.p.y) || 1e-3;
          const ux = a.p.x / len;
          const uy = a.p.y / len;
          const tipX = a.p.x;
          const tipY = a.p.y;
          const headL = 7;
          const headW = 4.2;
          return (
            <g key={`ax-${a.key}`} className="sp-arrow" onPointerDown={down(a.key, "move")}>
              <line x1="0" y1="0" x2={tipX - ux * headL * 0.6} y2={tipY - uy * headL * 0.6} stroke={AXIS_COLOR[a.key]} />
              <polygon
                fill={AXIS_COLOR[a.key]}
                points={`${tipX},${tipY} ${tipX - ux * headL + -uy * headW},${tipY - uy * headL + ux * headW} ${tipX - ux * headL - -uy * headW},${tipY - uy * headL - ux * headW}`}
              />
              <line className="sp-arrow-hit" x1="0" y1="0" x2={tipX} y2={tipY} />
              <title>Slide along {a.label.toLowerCase()}</title>
            </g>
          );
        })}

        <circle className="sp-wheel-hub" cx="0" cy="0" r="3" />
      </svg>
    </div>
  );
}

/* ----------------------------------------------------------------- rails */

function Rail({ items }: { items: { icon: React.ReactNode; label: string; on?: boolean; run: () => void }[] }) {
  return (
    <div className="sp-rail">
      {items.map((it, i) => (
        <button key={i} type="button" className={it.on ? "is-active" : ""} title={it.label} aria-label={it.label} onClick={it.run}>
          {it.icon}
        </button>
      ))}
    </div>
  );
}

const Ico = (d: string) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

export function SpatialControls() {
  const s = useStore();
  const hasSel = s.selection.length > 0;

  return (
    <div className="sp-controls">
      <div className="sp-control-row">
        <ViewBall />
        <Rail
          items={[
            { icon: Ico("M12 2.8 20.5 7.4v9.2L12 21.2 3.5 16.6V7.4M3.5 7.4 12 12l8.5-4.6M12 12v9.2"), label: "Isometric view", run: () => setView("iso") },
            { icon: Ico("M7.5 3.5v17M16.5 3.5v17M3.5 7.5h17M3.5 16.5h17"), label: "Frame everything (F)", run: () => frameAll() },
            { icon: Ico("M12 4.5v15M4.5 12h15M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"), label: "Frame selection", run: () => frameAll(2.2) },
            {
              icon: Ico("M3.5 8.5v-3a2 2 0 0 1 2-2h3M20.5 8.5v-3a2 2 0 0 0-2-2h-3M3.5 15.5v3a2 2 0 0 0 2 2h3M20.5 15.5v3a2 2 0 0 1-2 2h-3"),
              label: "Hide the interface (Tab)",
              run: () => document.body.classList.toggle("spatial-focus"),
            },
          ]}
        />
      </div>

      <div className="sp-control-row">
        <TransformWheel />
        <Rail
          items={[
            { icon: Ico("M5.5 3.5 18 11.2l-5.3 1.4-2.3 5.1z"), label: "Select", on: s.tool === "select", run: () => s.setTool("select") },
            { icon: Ico("M9 9V5.5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H15M5.5 9h7.5a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z"), label: "Duplicate (Ctrl+D)", run: () => s.duplicateSelection() },
            { icon: Ico("M4.5 4.5h15v15h-15z"), label: "Move", on: s.gizmoMode === "translate", run: () => s.setGizmoMode("translate") },
            { icon: Ico("M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.5 2.3 2.5 14.2 0 17M12 3.5c-2.5 2.3-2.5 14.2 0 17"), label: "Turn", on: s.gizmoMode === "rotate", run: () => s.setGizmoMode("rotate") },
            { icon: Ico("M5.5 18.5h13v-13M5.5 18.5 18.5 5.5M5.5 18.5v-6M5.5 18.5h6"), label: "Size", on: s.gizmoMode === "scale", run: () => s.setGizmoMode("scale") },
            { icon: Ico("M12 8.5v7M8.5 12h7M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17z"), label: hasSel ? "Local axes" : "World axes", on: s.gizmoSpace === "local", run: () => s.setGizmoSpace(s.gizmoSpace === "local" ? "world" : "local") },
          ]}
        />
      </div>
    </div>
  );
}

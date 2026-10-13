import { useMemo, useRef, useState } from "react";
import { useStore } from "../store/store";
import { BRUSH_SETS } from "../engine/brushes";
import { brushPreview } from "../engine/textures";
import { PRIMS } from "../engine/prims";
import { FLAT_KINDS, NOTE_STYLES } from "../engine/flats";
import { BUILTIN_MODELS, MODEL_EXTENSIONS, POSE_BONES, POSE_PRESETS } from "../engine/models";
import { ENV_PRESETS } from "../engine/env";
import { PNG_SIZES, download, exportGLB, recordCanvas, safeName, sketchToFile } from "../engine/exporters";
import { saveAsset, getAssetBlobUrl } from "../persist/idb";
import type {
  Brush, CameraObj, EnvPreset, GrainKind, LightObj,
  ModelObj, PlanePreset, Prim, SolidShade, TipKind, Vec3,
} from "../types";
import { getEngine, nudgeCamera } from "./SpatialViewport";
import { formatLength } from "./units";

/* ------------------------------------------------------------- primitives */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ins-row">
      <span className="ins-label">{label}</span>
      <div className="ins-controls">{children}</div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="ins-section">
      <div className="ins-head">
        <h3>{title}</h3>
        {right}
      </div>
      <div className="ins-body">{children}</div>
    </section>
  );
}

function Range({
  value, min, max, step = 0.001, curve = 1, onChange, format,
}: {
  value: number; min: number; max: number; step?: number; curve?: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const toT = (v: number) => Math.pow((v - min) / (max - min || 1), 1 / curve);
  const fromT = (t: number) => min + Math.pow(Math.max(0, Math.min(1, t)), curve) * (max - min);
  const fill = `${Math.max(0, Math.min(1, toT(value))) * 100}%`;
  return (
    <div className="sp-range">
      <input
        type="range"
        min={0}
        max={1}
        step={0.0005}
        style={{ ["--fill" as string]: fill }}
        value={toT(value)}
        onChange={(e) => {
          const v = fromT(parseFloat(e.target.value));
          onChange(step ? Math.round(v / step) * step : v);
        }}
      />
      <span className="sp-range-value">{format ? format(value) : value.toFixed(2)}</span>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented is-compact">
      {options.map((o) => (
        <button key={o.id} className={o.id === value ? "is-active" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="sp-check" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className={on ? "sp-box is-on" : "sp-box"}>{on ? "✓" : ""}</span>
      {label}
    </button>
  );
}

function NumXYZ({
  label,
  value,
  step = 0.05,
  onChange,
  toDisplay = (n) => String(Number(n.toFixed(2))),
  fromDisplay = (s) => parseFloat(s) || 0,
}: {
  label: string;
  value: [number, number, number];
  step?: number;
  onChange: (v: [number, number, number]) => void;
  toDisplay?: (n: number) => string;
  fromDisplay?: (s: string) => number;
}) {
  return (
    <div className="ins-row">
      <span className="ins-label">{label}</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, width: "100%" }}>
        {(["X", "Y", "Z"] as const).map((axis, i) => {
          const colors = ["#EF4444", "#10B981", "#3B82F6"];
          return (
            <div
              key={axis}
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.04)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 6,
                padding: "2px 6px",
                fontSize: 11,
              }}
            >
              <span style={{ color: colors[i], fontWeight: 700, marginRight: 4 }}>{axis}</span>
              <input
                type="number"
                step={step}
                value={toDisplay(value[i])}
                onChange={(e) => {
                  const val = fromDisplay(e.target.value);
                  const next: [number, number, number] = [...value];
                  next[i] = val;
                  onChange(next);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  color: "#E2E8F0",
                  fontSize: 11,
                  outline: "none",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const SHADES: { id: SolidShade; label: string }[] = [
  { id: "matte", label: "Matte" },
  { id: "glossy", label: "Gloss" },
  { id: "metal", label: "Metal" },
  { id: "glass", label: "Glass" },
  { id: "flat", label: "Flat" },
];

const STUDIO_PROPS: { id: string; name: string; blurb: string; prim: Prim["prim"]; scale: Vec3; color: string }[] = [
  { id: "plinth", name: "Display Plinth", blurb: "Product pedestal", prim: "cylinder", scale: [0.6, 0.45, 0.6], color: "#2B3245" },
  { id: "stage", name: "Stage Turntable", blurb: "Low circular stage", prim: "cylinder", scale: [1.8, 0.08, 1.8], color: "#1E2433" },
  { id: "cube_stage", name: "Posing Cube", blurb: "Character pose block", prim: "cube", scale: [0.8, 0.5, 0.8], color: "#3B455E" },
  { id: "cyclorama", name: "Cyc Sweep", blurb: "Curved background sweep", prim: "torus", scale: [2.8, 0.2, 2.8], color: "#E2E8F0" },
  { id: "tripod", name: "Tripod Mock", blurb: "Equipment stand", prim: "cone", scale: [0.35, 1.3, 0.35], color: "#161922" },
  { id: "pillar", name: "Architectural Pillar", blurb: "Classical column", prim: "cylinder", scale: [0.4, 2.4, 0.4], color: "#CBD5E1" },
];

/* ============================================================ 1. OUTLINER */

export function OutlinerPanel() {
  const s = useStore();
  const objects = s.sketch.objects;
  const sel = new Set(s.selection);

  return (
    <Section
      title={`Scene Outliner (${objects.length})`}
      right={
        <div style={{ display: "flex", gap: 4 }}>
          {s.selection.length > 0 && (
            <button className="sp-mini" onClick={() => s.removeObjects(s.selection)}>Delete</button>
          )}
        </div>
      }
    >
      <p className="ins-note">Scene hierarchy, visibility, parent-child relations and selection.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 520, overflowY: "auto" }}>
        {objects.map((o) => {
          const isSelected = sel.has(o.id);
          const name = ("name" in o && o.name) || o.kind.toUpperCase();
          const visible = "visible" in o ? o.visible !== false : true;
          const locked = "locked" in o ? o.locked === true : false;

          const typeIcon =
            o.kind === "camera" ? "📹" :
            o.kind === "light" ? "💡" :
            o.kind === "guide" ? "📏" :
            o.kind === "model" ? "🧍" :
            o.kind === "prim" ? "🧊" :
            o.kind === "flat" ? "📄" : "✏️";

          return (
            <div
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                background: isSelected ? "rgba(56, 189, 248, 0.12)" : "rgba(255, 255, 255, 0.02)",
                border: isSelected ? "1px solid rgba(56, 189, 248, 0.35)" : "1px solid rgba(255, 255, 255, 0.05)",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => s.select([o.id])}
            >
              <span style={{ fontSize: 13 }} aria-hidden="true">{typeIcon}</span>
              <input
                value={name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => s.renameObject(o.id, e.target.value)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  color: isSelected ? "#38BDF8" : "#E2E8F0",
                  fontWeight: isSelected ? 600 : 400,
                  fontSize: 12,
                  outline: "none",
                }}
              />
              <button
                className="sp-mini"
                title="Toggle visibility"
                onClick={(e) => {
                  e.stopPropagation();
                  s.setObjectVisibility(o.id, !visible);
                }}
              >
                {visible ? "👁" : "🕶"}
              </button>
              <button
                className="sp-mini"
                title="Toggle lock"
                onClick={(e) => {
                  e.stopPropagation();
                  s.setObjectLocked(o.id, !locked);
                }}
              >
                {locked ? "🔒" : "🔓"}
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ============================================================ 2. CREATE */

export function CreatePanel({ toast }: { toast: (m: string) => void }) {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const [preserveScale, setPreserveScale] = useState(true);

  return (
    <>
      <Section title="3D Primitives">
        <p className="ins-note">Parametric geometry placed on the construction plane.</p>
        <div className="sp-grid">
          {PRIMS.map((p) => (
            <button key={p.id} className="sp-tile" onClick={() => { s.addPrim(p.id); toast(`${p.name} added`); }}>
              <span className={`sp-tile-art art-${p.id}`} aria-hidden="true" />
              {p.name}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Studio Asset Library">
        <p className="ins-note">Scale reference figures and director stage props.</p>
        <div className="sp-models">
          {BUILTIN_MODELS.map((m) => (
            <button key={m.id} className="sp-model" onClick={() => { s.addModel(m.id, m.name); toast(`${m.name} added at 1.8 m`); }}>
              <span className="sp-model-art" aria-hidden="true" />
              <span>
                <strong>{m.name}</strong>
                <em>{m.blurb}</em>
              </span>
            </button>
          ))}
          {STUDIO_PROPS.map((p) => (
            <button
              key={p.id}
              className="sp-model"
              onClick={() => {
                const id = s.addPrim(p.prim);
                s.updateObject(id, { name: p.name, scale: p.scale, color: p.color });
                toast(`${p.name} added`);
              }}
            >
              <span className="sp-model-art" aria-hidden="true" />
              <span>
                <strong>{p.name}</strong>
                <em>{p.blurb}</em>
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Import 3D Asset">
        <div style={{ marginBottom: 8 }}>
          <Check label="Preserve original file scale" on={preserveScale} onChange={setPreserveScale} />
        </div>
        <div className="btn-row">
          <button onClick={() => fileRef.current?.click()}>Import 3D File (GLB, GLTF, FBX, OBJ)…</button>
        </div>
        <p className="ins-note">Model files are stored permanently in IndexedDB so they reopen reliably across reloads.</p>
        <input ref={fileRef} type="file" accept={MODEL_EXTENSIONS} hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            try {
              const assetId = `model_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const buffer = await f.arrayBuffer();
              await saveAsset(assetId, f.name, buffer, f.type || "model/gltf-binary");
              const url = await getAssetBlobUrl(assetId);
              s.addModel(url || `asset:${assetId}`, f.name.replace(/\.[^.]+$/, ""), undefined, preserveScale, assetId);
              toast(`${f.name} imported and saved`);
            } catch {
              toast("Failed to import model");
            }
          }
          e.target.value = "";
        }} />
      </Section>

      <Section title="Cameras & Lighting">
        <div className="btn-row">
          <button onClick={() => { s.addCamera(); toast("Scene camera created"); }}>+ Add Camera</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          <button className="sp-mini" onClick={() => { s.addLight("directional"); toast("Directional Light added"); }}>+ Directional</button>
          <button className="sp-mini" onClick={() => { s.addLight("spot"); toast("Spot Light added"); }}>+ Spotlight</button>
          <button className="sp-mini" onClick={() => { s.addLight("point"); toast("Point Light added"); }}>+ Point Light</button>
          <button className="sp-mini" onClick={() => { s.addLight("hemisphere"); toast("Hemisphere Light added"); }}>+ Hemisphere</button>
        </div>
      </Section>

      <Section title="3D Guides & Annotations">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <button className="sp-mini" onClick={() => { s.addGuide("measure"); toast("3D Measure added"); }}>+ Measurement</button>
          <button className="sp-mini" onClick={() => { s.addGuide("label"); toast("3D Label added"); }}>+ 3D Label</button>
          <button className="sp-mini" onClick={() => { s.addGuide("arrow"); toast("3D Arrow added"); }}>+ 3D Arrow</button>
          <button className="sp-mini" onClick={() => { s.addGuide("box"); toast("3D Box added"); }}>+ 3D Bounds</button>
        </div>
      </Section>

      <Section title="2D Elements in Space">
        <div className="sp-grid is-wide">
          {FLAT_KINDS.map((f) => (
            <button key={f.id} className="sp-tile" onClick={() => {
              if (f.id === "image") imgRef.current?.click();
              else { s.addFlat(f.id); toast(`${f.name} added`); }
            }}>
              <span className={`sp-tile-art art-flat-${f.id}`} aria-hidden="true" />
              {f.name}
            </button>
          ))}
        </div>
        <Row label="Sticky">
          <div className="swatches">
            {NOTE_STYLES.map((n) => (
              <button key={n.id} className="swatch" style={{ background: n.fill, borderColor: n.stroke }} title={n.name}
                onClick={() => { s.addFlat("note", { fill: n.fill, stroke: n.stroke, textColor: n.ink, text: n.name }); toast(`${n.name} note added`); }} />
            ))}
          </div>
        </Row>
        <input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            const url = URL.createObjectURL(f);
            const img = new Image();
            img.onload = () => {
              const ar = img.naturalWidth / img.naturalHeight;
              s.addFlat("image", { src: url, w: 0.9, h: 0.9 / (ar || 1) });
              toast("Image placed");
            };
            img.src = url;
          }
          e.target.value = "";
        }} />
      </Section>
    </>
  );
}

/* ============================================================ 3. OBJECT */

export function ObjectPanel() {
  const s = useStore();
  const units = s.sketch.units;
  const one = s.selection.length === 1 ? s.sketch.objects.find((o) => o.id === s.selection[0]) : null;

  if (!one) {
    return (
      <Section title="Object">
        <p className="ins-note">Select an object on the canvas or in the Outliner to inspect its transforms and properties.</p>
        {s.selection.length > 1 && (
          <div className="btn-row">
            <button onClick={() => s.duplicateSelection()}>Duplicate {s.selection.length}</button>
            <button onClick={() => s.removeObjects(s.selection)}>Delete {s.selection.length}</button>
          </div>
        )}
      </Section>
    );
  }

  const isPlaced = "pos" in one;
  const radToDeg = (r: number) => (r * 180) / Math.PI;
  const degToRad = (d: number) => (d * Math.PI) / 180;

  return (
    <>
      <Section title={"name" in one && one.name ? one.name : one.kind.toUpperCase()}>
        <Row label="Transform">
          <Seg value={s.gizmoMode} options={[
            { id: "translate", label: "Move" }, { id: "rotate", label: "Turn" }, { id: "scale", label: "Size" },
          ]} onChange={s.setGizmoMode} />
        </Row>
        <Row label="Axes">
          <Seg value={s.gizmoSpace} options={[{ id: "world", label: "World" }, { id: "local", label: "Local" }]} onChange={s.setGizmoSpace} />
        </Row>

        {isPlaced && (
          <>
            <NumXYZ
              label="Position"
              value={one.pos as [number, number, number]}
              step={0.1}
              onChange={(next) => s.updateObject(one.id, { pos: next })}
            />
            {"rot" in one && one.rot && (
              <NumXYZ
                label="Rotation (°)"
                value={[radToDeg(one.rot[0]), radToDeg(one.rot[1]), radToDeg(one.rot[2])]}
                step={5}
                onChange={(next) => s.updateObject(one.id, { rot: [degToRad(next[0]), degToRad(next[1]), degToRad(next[2])] })}
              />
            )}
            {"scale" in one && one.scale && (
              <NumXYZ
                label="Scale"
                value={one.scale as [number, number, number]}
                step={0.1}
                onChange={(next) => s.updateObject(one.id, { scale: next })}
              />
            )}
            <div className="btn-row" style={{ marginTop: 6 }}>
              <button onClick={() => s.snapToGround(one.id)}>Drop to Ground</button>
              {"rot" in one && (
                <button onClick={() => s.updateObject(one.id, { rot: [0, 0, 0] })}>Reset Rotation</button>
              )}
            </div>
          </>
        )}

        <div className="btn-row" style={{ marginTop: 8 }}>
          <button onClick={() => s.duplicateSelection()}>Duplicate</button>
          <button onClick={() => s.removeObjects([one.id])}>Delete</button>
        </div>
      </Section>

      {(one.kind === "prim" || one.kind === "model" || one.kind === "solid") && (
        <Section title="Material & Surface">
          <Row label="Colour">
            <span className="swatch is-active" style={{ background: one.kind === "model" ? one.color ?? "#cccccc" : one.color }} />
            <button className="sp-mini" onClick={() => s.updateObject(one.id, { color: s.color })}>Use ink</button>
            {one.kind === "model" && (
              <button className="sp-mini" onClick={() => s.updateObject(one.id, { color: null as never })}>Original</button>
            )}
          </Row>
          <Row label="Finish">
            <Seg value={one.shade} options={SHADES} onChange={(v) => s.updateObject(one.id, { shade: v })} />
          </Row>
          <Row label="Opacity">
            <Range value={one.opacity} min={0.05} max={1} onChange={(v) => s.updateObject(one.id, { opacity: v })} format={pct} />
          </Row>
          <Check label="Wireframe" on={one.wire} onChange={(v) => s.updateObject(one.id, { wire: v })} />
        </Section>
      )}

      {one.kind === "prim" && (
        <Section title="Geometry Detail">
          <Row label="Detail">
            <Range value={one.detail} min={1} max={64} step={1} onChange={(v) => s.updateObject(one.id, { detail: Math.round(v) })} format={(v) => String(Math.round(v))} />
          </Row>
          <Check label="Faceted" on={one.faceted} onChange={(v) => s.updateObject(one.id, { faceted: v })} />
          <Row label="Extent">
            <span className="ins-note">
              {formatLength(one.scale[0] * 2, units)} × {formatLength(one.scale[1] * 2, units)} × {formatLength(one.scale[2] * 2, units)}
            </span>
          </Row>
        </Section>
      )}
    </>
  );
}

/* ============================================================ 4. RIG & POSING */

export function RigPanel() {
  const s = useStore();
  const one = s.selection.length === 1 ? s.sketch.objects.find((o) => o.id === s.selection[0]) : null;
  const isModel = one?.kind === "model";
  const isRigged = isModel && getEngine()?.isRiggedModel(one.id);

  if (!isModel || !isRigged) {
    return (
      <Section title="Character Rigging & Posing">
        <p className="ins-note">Select an imported rigged 3D character or the Mannequin to pose its joints and limbs.</p>
        <div className="btn-row">
          <button onClick={() => s.addModel("builtin:mannequin", "Mannequin")}>Add Mannequin Figure</button>
        </div>
      </Section>
    );
  }

  const model = one as ModelObj;
  const radToDeg = (r: number) => Math.round((r * 180) / Math.PI);
  const degToRad = (d: number) => (d * Math.PI) / 180;
  const currentBoneRot = s.poseBone && model.pose?.[s.poseBone] ? model.pose[s.poseBone] : [0, 0, 0];

  return (
    <>
      <Section title="Rig Mode">
        <p className="ins-note">Direct joint posing with visual bone armature and local rotation gizmos.</p>
        <Check label="Rig Mode: Interactive joint handles" on={s.posing} onChange={s.setPosing} />
      </Section>

      <Section title="Pose Library Presets">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {POSE_PRESETS.map((p) => (
            <button
              key={p.id}
              className="sp-mini"
              onClick={() => s.applyPosePreset(model.id, p.id)}
              title={p.blurb}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button onClick={() => s.mirrorPoseOnModel(model.id)}>Mirror Pose (L ↔ R)</button>
          <button onClick={() => s.clearPose(model.id)}>Reset to T-Pose</button>
        </div>
        <div className="btn-row" style={{ marginTop: 6 }}>
          <button onClick={() => s.copyPose(model.id)}>Copy Pose</button>
          <button disabled={!s.copiedPose} onClick={() => s.pastePose(model.id)}>Paste Pose</button>
        </div>
      </Section>

      <Section title="Interactive Joint Armature">
        {["Body", "Arms", "Legs"].map((group) => (
          <Row key={group} label={group}>
            <div className="chip-row">
              {POSE_BONES.filter((b) => b.group === group).map((b) => (
                <button
                  key={b.id}
                  className={s.poseBone === b.id ? "sp-chip is-active" : "sp-chip"}
                  onClick={() => {
                    s.setPosing(true);
                    s.setPoseBone(b.id);
                    getEngine()?.attachBone(b.id);
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </Row>
        ))}

        {s.poseBone && (
          <div style={{ marginTop: 12, padding: 8, background: "rgba(255,255,255,0.03)", borderRadius: 6 }}>
            <strong style={{ fontSize: 12, color: "#38BDF8" }}>Joint: {s.poseBone}</strong>
            <NumXYZ
              label="Rotation (°)"
              value={[radToDeg(currentBoneRot[0]), radToDeg(currentBoneRot[1]), radToDeg(currentBoneRot[2])]}
              step={5}
              onChange={(next) => {
                const radEuler: Vec3 = [degToRad(next[0]), degToRad(next[1]), degToRad(next[2])];
                s.setBoneRotation(model.id, s.poseBone!, radEuler);
                getEngine()?.attachBone(s.poseBone);
              }}
            />
            <div className="btn-row" style={{ marginTop: 6 }}>
              <button className="sp-mini" onClick={() => s.setBoneRotation(model.id, s.poseBone!, [0, 0, 0])}>Reset Joint</button>
            </div>
          </div>
        )}
      </Section>
    </>
  );
}

/* ============================================================ 5. CAMERA DIRECTOR */

export function CameraPanel() {
  const s = useStore();
  const cameras = s.sketch.objects.filter((o) => o.kind === "camera") as CameraObj[];
  const activeCameraId = s.activeCameraId;
  const selOne = s.selection.length === 1 ? s.sketch.objects.find((o) => o.id === s.selection[0]) : null;
  const selectedCam = selOne?.kind === "camera" ? (selOne as CameraObj) : cameras[0];

  return (
    <>
      <Section
        title={`Scene Cameras (${cameras.length})`}
        right={<button className="ins-more" onClick={() => s.addCamera()}>+ Add Camera</button>}
      >
        <p className="ins-note">Director cameras positioned in 3D space with cinematic framing guides.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {cameras.map((c) => {
            const isLookingThrough = activeCameraId === c.id;
            return (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 8px",
                  background: isLookingThrough ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.03)",
                  border: isLookingThrough ? "1px solid rgba(56, 189, 248, 0.4)" : "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 6,
                }}
              >
                <span><strong>{c.name}</strong> · {c.fov}°</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    className={isLookingThrough ? "sp-mini is-active" : "sp-mini"}
                    onClick={() => s.setActiveCameraId(isLookingThrough ? null : c.id)}
                  >
                    {isLookingThrough ? "Exit View" : "Look Through"}
                  </button>
                  <button className="sp-mini" onClick={() => s.select([c.id])}>Select</button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {selectedCam && (
        <>
          <Section title={`Director Settings: ${selectedCam.name}`}>
            <Row label="Projection">
              <Seg
                value={selectedCam.ortho ? "ortho" : "persp"}
                options={[{ id: "persp", label: "Perspective" }, { id: "ortho", label: "Orthographic" }]}
                onChange={(v) => s.updateObject(selectedCam.id, { ortho: v === "ortho" })}
              />
            </Row>
            <Row label="FOV (Field of View)">
              <Range
                value={selectedCam.fov}
                min={15}
                max={120}
                step={1}
                onChange={(v) => s.updateObject(selectedCam.id, { fov: v })}
                format={(v) => `${Math.round(v)}°`}
              />
            </Row>
            <Row label="Lenses">
              <div className="chip-row">
                {[
                  { mm: 18, fov: 90, label: "18mm" },
                  { mm: 24, fov: 74, label: "24mm" },
                  { mm: 35, fov: 54, label: "35mm" },
                  { mm: 50, fov: 40, label: "50mm" },
                  { mm: 85, fov: 24, label: "85mm" },
                  { mm: 135, fov: 15, label: "135mm" },
                ].map((l) => (
                  <button
                    key={l.label}
                    className="sp-chip"
                    onClick={() => s.updateObject(selectedCam.id, { fov: l.fov, focalLength: l.mm })}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </Row>
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button onClick={() => {
                const engine = getEngine();
                if (!engine) return;
                const dataUrl = engine.renderFromCamera(selectedCam, 1920, 1080);
                if (dataUrl) download(`${safeName(selectedCam.name)}.png`, dataUrl);
              }}>
                Capture High-Res Camera Still (PNG)
              </button>
            </div>
          </Section>

          <Section title="Cinematic Framing Guides">
            <Check
              label="Rule of Thirds"
              on={selectedCam.guides.ruleOfThirds}
              onChange={(v) => s.updateObject(selectedCam.id, { guides: { ...selectedCam.guides, ruleOfThirds: v } })}
            />
            <Check
              label="Center Crosshair"
              on={selectedCam.guides.centerCross}
              onChange={(v) => s.updateObject(selectedCam.id, { guides: { ...selectedCam.guides, centerCross: v } })}
            />
            <Check
              label="Action & Title Safe Area"
              on={selectedCam.guides.safeArea}
              onChange={(v) => s.updateObject(selectedCam.id, { guides: { ...selectedCam.guides, safeArea: v } })}
            />
            <Check
              label="Horizon Guide Line"
              on={selectedCam.guides.horizon}
              onChange={(v) => s.updateObject(selectedCam.id, { guides: { ...selectedCam.guides, horizon: v } })}
            />
            <Check
              label="Golden Ratio Grid"
              on={selectedCam.guides.goldenRatio}
              onChange={(v) => s.updateObject(selectedCam.id, { guides: { ...selectedCam.guides, goldenRatio: v } })}
            />
          </Section>
        </>
      )}
    </>
  );
}

/* ============================================================ 6. LIGHTING */

export function LightPanel() {
  const s = useStore();
  const lights = s.sketch.objects.filter((o) => o.kind === "light") as LightObj[];
  const selOne = s.selection.length === 1 ? s.sketch.objects.find((o) => o.id === s.selection[0]) : null;
  const selectedLight = selOne?.kind === "light" ? (selOne as LightObj) : lights[0];

  return (
    <>
      <Section
        title={`Scene Lights (${lights.length})`}
        right={<button className="ins-more" onClick={() => s.addLight("directional")}>+ Add Light</button>}
      >
        <p className="ins-note">Directional, point, spot, and ambient illumination sources.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lights.map((l) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 8px",
                background: selectedLight?.id === l.id ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.03)",
                borderRadius: 6,
                cursor: "pointer",
              }}
              onClick={() => s.select([l.id])}
            >
              <span>💡 <strong>{l.name}</strong> · {l.lightKind}</span>
              <span className="swatch" style={{ background: l.color }} />
            </div>
          ))}
        </div>
      </Section>

      {selectedLight && (
        <Section title={`Light Settings: ${selectedLight.name}`}>
          <Row label="Type">
            <Seg
              value={selectedLight.lightKind}
              options={[
                { id: "directional", label: "Dir" },
                { id: "spot", label: "Spot" },
                { id: "point", label: "Point" },
                { id: "ambient", label: "Amb" },
                { id: "hemisphere", label: "Hemi" },
              ]}
              onChange={(v) => s.updateObject(selectedLight.id, { lightKind: v })}
            />
          </Row>
          <Row label="Intensity">
            <Range
              value={selectedLight.intensity}
              min={0}
              max={10}
              step={0.1}
              onChange={(v) => s.updateObject(selectedLight.id, { intensity: v })}
              format={(v) => v.toFixed(1)}
            />
          </Row>
          <Row label="Colour">
            <span className="swatch is-active" style={{ background: selectedLight.color }} />
            <input
              className="sp-hex"
              value={selectedLight.color}
              onChange={(e) => s.updateObject(selectedLight.id, { color: e.target.value })}
            />
          </Row>
          <Check
            label="Cast Contact Shadows"
            on={selectedLight.castShadow}
            onChange={(v) => s.updateObject(selectedLight.id, { castShadow: v })}
          />
          {selectedLight.lightKind === "spot" && (
            <>
              <Row label="Cone Angle">
                <Range
                  value={selectedLight.angle || Math.PI / 4}
                  min={0.1}
                  max={Math.PI / 2}
                  onChange={(v) => s.updateObject(selectedLight.id, { angle: v })}
                  format={(v) => `${Math.round((v * 180) / Math.PI)}°`}
                />
              </Row>
              <Row label="Penumbra Softness">
                <Range
                  value={selectedLight.penumbra || 0.2}
                  min={0}
                  max={1}
                  onChange={(v) => s.updateObject(selectedLight.id, { penumbra: v })}
                  format={pct}
                />
              </Row>
            </>
          )}
        </Section>
      )}
    </>
  );
}

/* ============================================================ 7. DESIGN */

const TIPS: TipKind[] = ["round", "hard", "ink", "chisel", "square", "bristle", "chalk", "spray"];
const GRAINS: GrainKind[] = ["none", "paper", "canvas", "noise", "chalk", "crosshatch", "metal"];

export function DesignPanel() {
  const s = useStore();
  const brushes = s.brushes();
  const current = brushes.find((b) => b.id === s.brushId) ?? brushes[0];
  const [set, setSet] = useState(current?.set ?? BRUSH_SETS[0]);
  const [studio, setStudio] = useState(false);
  const sets = useMemo(() => Array.from(new Set(brushes.map((b) => b.set))), [brushes]);
  const units = s.sketch.units;

  const patch = (p: Partial<Brush>) => {
    if (current.builtin) {
      const copy: Brush = { ...current, ...p, id: `b${Date.now().toString(36)}`, name: `${current.name} ✳`, builtin: false, set: "My brushes" };
      s.saveBrush(copy);
      s.setBrush(copy.id);
      setSet("My brushes");
    } else {
      s.saveBrush({ ...current, ...p });
    }
  };

  return (
    <>
      <Section title="Ink">
        <Row label="Colour">
          <span className="swatch is-active" style={{ background: s.color }} />
          <input className="sp-hex" value={s.color} onChange={(e) => {
            const t = e.target.value.trim();
            if (/^#?[0-9a-fA-F]{6}$/.test(t)) s.setColor(t.startsWith("#") ? t.toUpperCase() : `#${t.toUpperCase()}`);
          }} />
        </Row>
        <div className="swatches">
          {s.recentColors.concat(["#1A1A18", "#1F5FD0", "#D4483B", "#E0A32E", "#2F8F5B", "#FFFFFF"])
            .filter((c, i, a) => a.indexOf(c) === i)
            .slice(0, 14)
            .map((c) => (
              <button key={c} className={c === s.color ? "swatch is-active" : "swatch"} style={{ background: c }} onClick={() => s.setColor(c)} aria-label={c} />
            ))}
        </div>
        {s.selection.length > 0 && (
          <div className="btn-row">
            <button onClick={() => s.recolorSelection(s.color)}>Apply to {s.selection.length} selected</button>
          </div>
        )}
      </Section>

      <Section title="Pen">
        <Row label="Size">
          <Range value={s.size} min={0.002} max={1.2} curve={2.6} onChange={s.setSize} format={(v) => formatLength(v, units)} />
        </Row>
        <Row label="Opacity">
          <Range value={s.opacity} min={0.02} max={1} onChange={s.setOpacity} format={pct} />
        </Row>
        <Row label="Steady">
          <Seg
            value={s.prefs.stabilizer < 0.2 ? "raw" : s.prefs.stabilizer > 0.6 ? "very" : "smooth"}
            options={[{ id: "raw", label: "Raw" }, { id: "smooth", label: "Smooth" }, { id: "very", label: "Very" }]}
            onChange={(v) => s.setPrefs({ stabilizer: v === "raw" ? 0.05 : v === "very" ? 0.8 : 0.4 })}
          />
        </Row>
      </Section>

      <Section title="Brush" right={<button className="ins-more" onClick={() => setStudio((t) => !t)}>{studio ? "Done" : "Tune"}</button>}>
        <div className="chip-row">
          {sets.map((x) => (
            <button key={x} className={x === set ? "sp-chip is-active" : "sp-chip"} onClick={() => setSet(x)}>{x}</button>
          ))}
        </div>
        <div className="sp-brushes">
          {brushes.filter((b) => b.set === set).map((b) => (
            <button key={b.id} className={b.id === s.brushId ? "sp-brush is-active" : "sp-brush"} onClick={() => s.setBrush(b.id)}>
              <img src={brushPreview(b.tip, b.streaks, b.grain, b.grainDepth, s.color)} alt="" draggable={false} />
              <span>{b.name}</span>
            </button>
          ))}
        </div>

        {studio && current && (
          <>
            <Row label="Tip">
              <div className="chip-row">
                {TIPS.map((t) => (
                  <button key={t} className={current.tip === t ? "sp-chip is-active" : "sp-chip"} onClick={() => patch({ tip: t })}>{t}</button>
                ))}
              </div>
            </Row>
            <Row label="Body">
              <Seg value={current.geom} options={[
                { id: "ribbon", label: "Ribbon" }, { id: "tube", label: "Tube" },
                { id: "spray", label: "Spray" }, { id: "hatch", label: "Hatch" },
              ]} onChange={(g) => patch({ geom: g })} />
            </Row>
            <Row label="Grain">
              <div className="chip-row">
                {GRAINS.map((g) => (
                  <button key={g} className={current.grain === g ? "sp-chip is-active" : "sp-chip"} onClick={() => patch({ grain: g })}>{g}</button>
                ))}
              </div>
            </Row>
            <Row label="Depth"><Range value={current.grainDepth} min={0} max={1} onChange={(v) => patch({ grainDepth: v })} format={pct} /></Row>
            <Row label="Taper"><Range value={current.taper} min={0} max={1} onChange={(v) => patch({ taper: v })} format={pct} /></Row>
            <Row label="Pressure"><Range value={current.pressureSize} min={0} max={1} onChange={(v) => patch({ pressureSize: v })} format={pct} /></Row>
            <Row label="Glow"><Range value={current.glow} min={0} max={2} onChange={(v) => patch({ glow: v })} format={(v) => v.toFixed(2)} /></Row>
            {!current.builtin && (
              <div className="btn-row"><button onClick={() => { s.deleteBrush(current.id); s.setBrush("studio-pen"); }}>Delete brush</button></div>
            )}
          </>
        )}
      </Section>
    </>
  );
}

/* ============================================================= 8. LAYERS */

export function LayersPanel() {
  const s = useStore();
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    s.sketch.objects.forEach((o) => m.set(o.layer, (m.get(o.layer) ?? 0) + 1));
    return m;
  }, [s.sketch.objects]);

  return (
    <Section title="Layers" right={<button className="ins-more" onClick={s.addLayer}>New</button>}>
      <div className="sp-layers">
        {[...s.sketch.layers].reverse().map((l) => (
          <div key={l.id} className={l.id === s.sketch.activeLayer ? "sp-layer is-active" : "sp-layer"}>
            <button className="sp-layer-main" onClick={() => s.setActiveLayer(l.id)}>
              <input value={l.name} onChange={(e) => s.setLayer(l.id, { name: e.target.value })} onClick={(e) => e.stopPropagation()} />
              <em>{counts.get(l.id) ?? 0} objects</em>
            </button>
            <button className="sp-layer-btn" onClick={() => s.setLayer(l.id, { visible: !l.visible })} title="Visibility">{l.visible ? "◉" : "○"}</button>
            <button className="sp-layer-btn" onClick={() => s.setLayer(l.id, { locked: !l.locked })} title="Lock">{l.locked ? "🔒" : "🔓"}</button>
            {l.id === s.sketch.activeLayer && (
              <div className="sp-layer-more">
                <Row label="Opacity"><Range value={l.opacity} min={0.05} max={1} onChange={(v) => s.setLayer(l.id, { opacity: v })} format={pct} /></Row>
                <div className="btn-row">
                  <button onClick={() => s.reorderLayer(l.id, 1)}>Up</button>
                  <button onClick={() => s.reorderLayer(l.id, -1)}>Down</button>
                  <button onClick={() => s.mergeDown(l.id)}>Merge down</button>
                  {s.selection.length > 0 && <button onClick={() => s.moveSelectionToLayer(l.id)}>Move {s.selection.length} here</button>}
                  <button disabled={s.sketch.layers.length <= 1} onClick={() => s.deleteLayer(l.id)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ============================================================== 9. SCENE */

const PLANE_PRESETS: { id: PlanePreset; label: string }[] = [
  { id: "ground", label: "Ground" }, { id: "front", label: "Front" }, { id: "side", label: "Side" }, { id: "custom", label: "Custom" },
];
const ENV_NAMES: { id: EnvPreset; label: string }[] = [
  { id: "paper", label: "Paper" }, { id: "studio", label: "Studio" }, { id: "cyclorama", label: "Cyc" },
  { id: "dusk", label: "Dusk" }, { id: "night", label: "Night" }, { id: "void", label: "Void" },
];

export function ScenePanel() {
  const s = useStore();
  const units = s.sketch.units;
  const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;

  return (
    <>
      <Section title="Construction plane">
        <p className="ins-note">A pointer gives two numbers; this plane supplies the third.</p>
        <Row label="Facing">
          <div className="chip-row">
            {PLANE_PRESETS.map((p) => (
              <button key={p.id} className={s.sketch.plane.preset === p.id ? "sp-chip is-active" : "sp-chip"} onClick={() => s.setPlanePreset(p.id)}>{p.label}</button>
            ))}
          </div>
        </Row>
        <Row label="Depth"><Range value={s.sketch.plane.offset} min={-8} max={8} onChange={(v) => s.setPlane({ offset: v })} format={(v) => formatLength(v, units)} /></Row>
        {s.sketch.plane.preset === "custom" && (
          <>
            <Row label="Tilt X"><Range value={s.sketch.plane.rot[0]} min={-Math.PI} max={Math.PI} onChange={(v) => s.setPlane({ rot: [v, s.sketch.plane.rot[1], s.sketch.plane.rot[2]] })} format={deg} /></Row>
            <Row label="Tilt Y"><Range value={s.sketch.plane.rot[1]} min={-Math.PI} max={Math.PI} onChange={(v) => s.setPlane({ rot: [s.sketch.plane.rot[0], v, s.sketch.plane.rot[2]] })} format={deg} /></Row>
            <Row label="Tilt Z"><Range value={s.sketch.plane.rot[2]} min={-Math.PI} max={Math.PI} onChange={(v) => s.setPlane({ rot: [s.sketch.plane.rot[0], s.sketch.plane.rot[1], v] })} format={deg} /></Row>
          </>
        )}
        <Row label="Extent"><Range value={s.sketch.plane.size} min={1} max={40} curve={1.5} onChange={(v) => s.setPlane({ size: v })} format={(v) => formatLength(v, units)} /></Row>
        <Row label="Grid"><Range value={s.sketch.plane.grid} min={0.02} max={2} curve={1.8} onChange={(v) => s.setPlane({ grid: v })} format={(v) => formatLength(v, units)} /></Row>
        <Check label="Show plane" on={s.sketch.plane.visible} onChange={(v) => s.setPlane({ visible: v })} />
        <Check label="Snap to grid" on={s.sketch.plane.snap} onChange={(v) => s.setPlane({ snap: v })} />
        <Check label="Always draw on the plane" on={s.sketch.plane.lock} onChange={(v) => s.setPlane({ lock: v })} />
      </Section>

      <Section title="Atmosphere & Rendering">
        <div className="chip-row">
          {ENV_NAMES.map((e) => (
            <button key={e.id} className={s.sketch.env.preset === e.id ? "sp-chip is-active" : "sp-chip"} onClick={() => s.setEnvPreset(e.id)}
              title={ENV_PRESETS[e.id].bgTop}>{e.label}</button>
          ))}
        </div>
        <Row label="Haze"><Range value={s.sketch.env.fog} min={0} max={1} onChange={(v) => s.setEnv({ fog: v })} format={pct} /></Row>
        <Row label="Key light"><Range value={s.sketch.env.keyIntensity} min={0} max={3} onChange={(v) => s.setEnv({ keyIntensity: v })} format={(v) => v.toFixed(2)} /></Row>
        <Row label="Ambient"><Range value={s.sketch.env.ambient} min={0} max={2} onChange={(v) => s.setEnv({ ambient: v })} format={(v) => v.toFixed(2)} /></Row>
        <Row label="Exposure"><Range value={s.sketch.env.exposure} min={0.3} max={2.2} onChange={(v) => s.setEnv({ exposure: v })} format={(v) => v.toFixed(2)} /></Row>
        <Row label="Bloom"><Range value={s.sketch.env.bloom} min={0} max={2} onChange={(v) => s.setEnv({ bloom: v })} format={(v) => v.toFixed(2)} /></Row>
        <Row label="Vignette"><Range value={s.sketch.env.vignette} min={0} max={1} onChange={(v) => s.setEnv({ vignette: v })} format={pct} /></Row>
        <Row label="Grain"><Range value={s.sketch.env.grain} min={0} max={0.4} onChange={(v) => s.setEnv({ grain: v })} format={(v) => v.toFixed(2)} /></Row>
        <Check label="Floor grid" on={s.sketch.env.grid} onChange={(v) => s.setEnv({ grid: v })} />
        <Check label="Contact shadows" on={s.sketch.env.shadows} onChange={(v) => s.setEnv({ shadows: v })} />
        <Row label="Turntable"><Range value={s.sketch.env.turntable} min={-1} max={1} onChange={(v) => s.setEnv({ turntable: Math.abs(v) < 0.03 ? 0 : v })} format={(v) => (v === 0 ? "off" : v.toFixed(2))} /></Row>
      </Section>
    </>
  );
}

/* ============================================================= 10. EXPORT */

export function ExportPanel({ toast }: { toast: (m: string) => void }) {
  const s = useStore();
  const [size, setSize] = useState(PNG_SIZES[1].id);
  const [transparent, setTransparent] = useState(false);
  const [seconds, setSeconds] = useState(6);
  const [busy, setBusy] = useState<string | null>(null);
  const base = safeName(s.sketch.name);

  return (
    <>
      {busy && <div className="sp-busy">{busy}</div>}
      <Section title="3D Scene Model (.GLB)">
        <div className="btn-row">
          <button disabled={!!busy} onClick={async () => {
            setBusy("Building complete assembled 3D scene…");
            try {
              const blob = await exportGLB(s.sketch.objects, s.brushes(), base, getEngine());
              download(`${base}.glb`, blob);
              toast("Complete scene GLB exported");
            } catch {
              toast("Model export failed");
            }
            setBusy(null);
          }}>
            Export Full Assembled Scene (GLB)
          </button>
        </div>
        <p className="ins-note">Exports all primitives, imported meshes, skinned characters, transforms, materials, strokes, and lights into a single standard GLTF/GLB.</p>
      </Section>

      <Section title="Render Still Snapshot">
        <div className="chip-row">
          {PNG_SIZES.map((p) => (
            <button key={p.id} className={size === p.id ? "sp-chip is-active" : "sp-chip"} onClick={() => setSize(p.id)}>{p.label}</button>
          ))}
        </div>
        <Check label="Transparent background" on={transparent} onChange={setTransparent} />
        <div className="btn-row">
          <button onClick={() => {
            const e = getEngine();
            const p = PNG_SIZES.find((x) => x.id === size)!;
            if (!e) return;
            try { download(`${base}.png`, e.snapshot(p.w, p.h, transparent)); toast("Image saved"); }
            catch { toast("Could not render at that size"); }
          }}>Save Viewport PNG</button>
        </div>
      </Section>

      <Section title="Turntable Video">
        <Row label="Length"><Range value={seconds} min={2} max={20} step={0.5} onChange={setSeconds} format={(v) => `${v.toFixed(1)}s`} /></Row>
        <div className="btn-row">
          <button disabled={!!busy} onClick={async () => {
            const e = getEngine();
            if (!e) return;
            setBusy("Recording one full revolution…");
            const start = s.sketch.camera.theta;
            try {
              const blob = await recordCanvas({
                canvas: e.renderer.domElement, seconds, fps: 60,
                onProgress: (t) => nudgeCamera({ theta: start + t * Math.PI * 2 }),
              });
              nudgeCamera({ theta: start });
              download(`${base}.webm`, blob);
              toast("Turntable saved");
            } catch { nudgeCamera({ theta: start }); toast("This browser would not record the canvas"); }
            setBusy(null);
          }}>Record a turntable</button>
        </div>
      </Section>

      <Section title="Sketch Project File">
        <div className="btn-row">
          <button onClick={() => { download(`${base}.spatial.json`, sketchToFile(s.sketch)); toast("Sketch file saved"); }}>Save sketch file</button>
        </div>
      </Section>
    </>
  );
}

/* ============================================================== 11. SETUP */

export function SetupPanel() {
  const s = useStore();
  return (
    <>
      <Section title="Drawing">
        <Row label="Steady"><Range value={s.prefs.stabilizer} min={0} max={1} onChange={(v) => s.setPrefs({ stabilizer: v })} format={pct} /></Row>
        <Row label="Pressure"><Range value={s.prefs.pressureCurve} min={0} max={1} onChange={(v) => s.setPrefs({ pressureCurve: v })} format={(v) => (v < 0.45 ? "soft" : v > 0.6 ? "firm" : "linear")} /></Row>
        <Check label="Snap depth to surfaces" on={s.prefs.snapDepth} onChange={(v) => s.setPrefs({ snapDepth: v })} />
        <Check label="Keep the outline after Pull" on={s.prefs.keepOutline} onChange={(v) => s.setPrefs({ keepOutline: v })} />
      </Section>
      <Section title="Input">
        <Check label="Two-finger tap undoes" on={s.prefs.gestureUndo} onChange={(v) => s.setPrefs({ gestureUndo: v })} />
        <Check label="Invert scroll" on={s.prefs.invertScroll} onChange={(v) => s.setPrefs({ invertScroll: v })} />
      </Section>
      <Section title="Performance">
        <Seg value={s.prefs.quality} options={[
          { id: "high", label: "High" }, { id: "balanced", label: "Balanced" }, { id: "battery", label: "Battery" },
        ]} onChange={(q) => s.setPrefs({ quality: q })} />
        <p className="ins-note">Battery lowers the pixel ratio and turns off bloom and grain.</p>
      </Section>
      <Section title="Shortcuts">
        <ul className="sp-keys">
          <li><kbd>B</kbd> draw</li>
          <li><kbd>E</kbd> erase</li>
          <li><kbd>V</kbd> select</li>
          <li><kbd>P</kbd> pull into form</li>
          <li><kbd>G</kbd> move plane</li>
          <li><kbd>X</kbd> plane ↔ free space</li>
          <li><kbd>F</kbd> frame everything</li>
          <li><kbd>1</kbd>–<kbd>4</kbd> views</li>
          <li><kbd>Tab</kbd> hide the interface</li>
        </ul>
      </Section>
    </>
  );
}

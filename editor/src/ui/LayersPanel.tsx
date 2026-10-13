import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/store";
import type { BoardDoc, CanvasObject, AdjustmentType } from "../types";
import { BLEND_CATEGORIES } from "../lib/effects";
import { rasteriseObject } from "../lib/imageTools";
import { ADJUSTMENT_LABELS, defaultParamsFor } from "../lib/adjustments";
import {
  IconChevron,
  IconEye,
  IconEyeOff,
  IconGroup,
  IconLock,
  IconTrash,
  IconPlus,
} from "./icons";

const TYPE_LABEL: Record<string, string> = {
  rect: "Rectangle",
  ellipse: "Ellipse",
  triangle: "Triangle",
  diamond: "Diamond",
  polygon: "Polygon",
  line: "Line",
  arrow: "Arrow",
  measure: "Measure",
  draw: "Sketch",
  text: "Type Layer",
  note: "Note",
  image: "Pixel Layer",
  embed: "Link",
  icon: "Illustration",
  list: "Outline",
  table: "Table",
  card: "Flashcard",
  media: "Media",
  placeholder: "Image slot",
  frame: "Frame",
  vector: "Vector Shape",
  adjustment: "Adjustment Layer",
  smart: "Smart Object",
  group: "Group",
};

function labelFor(o: CanvasObject) {
  if (o.name) return o.name;
  if (o.type === "adjustment" && o.data.adjustmentType) {
    return ADJUSTMENT_LABELS[o.data.adjustmentType as AdjustmentType] || "Adjustment";
  }
  const text = o.data.text?.trim() || o.data.title?.trim();
  if (text) return text.length > 26 ? `${text.slice(0, 26)}…` : text;
  return TYPE_LABEL[o.type] ?? o.type;
}

/* ------------------------------------------------------------ thumbnails */

const thumbCache = new Map<string, { object: CanvasObject; url: string }>();
const queue: (() => void)[] = [];
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const run = () => {
    const start = performance.now();
    while (queue.length && performance.now() - start < 8) queue.shift()?.();
    if (queue.length) requestAnimationFrame(run);
    else pumping = false;
  };
  requestAnimationFrame(run);
}

function Thumb({ object: o, doc }: { object: CanvasObject; doc: BoardDoc }) {
  const [url, setUrl] = useState<string | null>(() => {
    const hit = thumbCache.get(o.id);
    return hit && hit.object === o ? hit.url : null;
  });
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const hit = thumbCache.get(o.id);
    if (hit && hit.object === o) {
      setUrl(hit.url);
      return;
    }
    if (o.type === "group" || o.hidden) return;
    let cancelled = false;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      queue.push(() => {
        if (cancelled) return;
        const c = rasteriseObject(o, doc, Math.min(0.5, 56 / Math.max(o.width, o.height, 1)), 2);
        if (!c) return;
        const next = c.toDataURL("image/png");
        thumbCache.set(o.id, { object: o, url: next });
        setUrl(next);
      });
      pump();
    });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [o, doc]);

  return (
    <span ref={ref} className="pc-thumb">
      {o.type === "adjustment" ? (
        <span className="pc-thumb-badge" title="Adjustment Layer">◐</span>
      ) : o.type === "smart" ? (
        <span className="pc-thumb-badge" title="Smart Object">📦</span>
      ) : url ? (
        <img src={url} alt="" />
      ) : (
        <i className={`thumb-icon thumb-${o.type}`} />
      )}
    </span>
  );
}

/* ------------------------------------------------------------ layer row */

interface DragOverInfo {
  targetId: string;
  position: "above" | "below" | "into";
}

function LayerRow({
  object: o,
  depth,
  childrenOf,
  doc,
  collapsed,
  toggle,
  query,
  dragOverInfo,
  isDraggingId,
  onDragStartRow,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  onDragEndRow,
}: {
  object: CanvasObject;
  depth: number;
  childrenOf: Map<string, CanvasObject[]>;
  doc: BoardDoc;
  collapsed: Set<string>;
  toggle(id: string): void;
  query: string;
  dragOverInfo: DragOverInfo | null;
  isDraggingId: string | null;
  onDragStartRow: (e: React.DragEvent, id: string) => void;
  onDragOverRow: (e: React.DragEvent, targetId: string, isGroup: boolean) => void;
  onDragLeaveRow: (id: string) => void;
  onDropRow: (e: React.DragEvent, targetId: string) => void;
  onDragEndRow: () => void;
}) {
  const state = useStore.getState;
  const selection = useStore((s) => s.selection);
  const isSelected = selection.includes(o.id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(labelFor(o));
  const isGroup = o.type === "group";
  const kids = isGroup ? childrenOf.get(o.id) ?? [] : [];
  const isCollapsed = collapsed.has(o.id);

  const isBeingDragged = isDraggingId === o.id;
  const isTarget = dragOverInfo?.targetId === o.id;
  const dropPos = isTarget ? dragOverInfo.position : null;

  const onSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey) {
      state().setSelection(
        selection.includes(o.id) ? selection.filter((x) => x !== o.id) : [...selection, o.id]
      );
    } else {
      state().setSelection([o.id]);
    }
  };

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== labelFor(o)) {
      state().patchObject(o.id, { name: trimmed });
    }
  };

  const toggleClipping = (e: React.MouseEvent) => {
    e.stopPropagation();
    state().patchObject(o.id, { clippingMask: !o.clippingMask });
  };

  return (
    <>
      <div
        draggable={!editing}
        onDragStart={(e) => {
          if (editing) {
            e.preventDefault();
            return;
          }
          onDragStartRow(e, o.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDragOverRow(e, o.id, isGroup);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          onDragLeaveRow(o.id);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDropRow(e, o.id);
        }}
        onDragEnd={onDragEndRow}
        className={`pc-layer-row ${isSelected ? "is-selected" : ""} ${o.hidden ? "is-hidden" : ""} ${
          o.clippingMask ? "is-clipped" : ""
        } ${isBeingDragged ? "is-dragging" : ""} ${dropPos === "into" ? "is-drop-into" : ""}`}
        style={{ paddingLeft: `${6 + depth * 14}px` }}
        onClick={onSelect}
      >
        {/* Drop Insertion Indicators */}
        {dropPos === "above" && <div className="pc-drop-indicator is-above" />}
        {dropPos === "below" && <div className="pc-drop-indicator is-below" />}

        {/* Drag handle */}
        <span className="pc-drag-handle" title="Drag to move/reorder layer">
          ⠿
        </span>

        {/* Clipping mask indicator ↳ */}
        {o.clippingMask && (
          <span
            className="pc-clip-arrow"
            title="Clipping Mask (Click to unclip)"
            onClick={toggleClipping}
          >
            ↳
          </span>
        )}

        {/* Group chevron */}
        {isGroup ? (
          <button
            type="button"
            className="pc-chevron-btn"
            onClick={(e) => {
              e.stopPropagation();
              toggle(o.id);
            }}
          >
            <IconChevron style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }} />
          </button>
        ) : (
          <span className="pc-row-spacer" />
        )}

        {/* Visibility eye toggle */}
        <button
          type="button"
          className="pc-vis-btn"
          title={o.hidden ? "Show layer" : "Hide layer"}
          onClick={(e) => {
            e.stopPropagation();
            state().patchObject(o.id, { hidden: !o.hidden });
          }}
        >
          {o.hidden ? <IconEyeOff /> : <IconEye />}
        </button>

        {/* Layer Thumbnail */}
        <Thumb object={o} doc={doc} />

        {/* Mask Thumbnail if layer has a mask */}
        {o.mask && (
          <div
            className={`pc-mask-thumb ${o.mask.enabled ? "is-enabled" : "is-disabled"}`}
            title={`Layer Mask (${o.mask.inverted ? "Inverted" : "Normal"})`}
            onClick={(e) => {
              e.stopPropagation();
              state().patchObject(o.id, {
                mask: { ...o.mask!, inverted: !o.mask!.inverted },
              });
            }}
          >
            <span className="pc-mask-link-chain">🔗</span>
            <div className="pc-mask-inner" />
          </div>
        )}

        {/* Layer Title */}
        <div className="pc-layer-title-box">
          {editing ? (
            <input
              autoFocus
              className="pc-layer-edit-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="pc-layer-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setEditing(true);
              }}
              title="Double click to rename"
            >
              {labelFor(o)}
            </span>
          )}
          <span className="pc-layer-kind-pill">{o.type}</span>
        </div>

        {/* Lock indicator */}
        {o.locked && (
          <span className="pc-lock-icon" title="Locked">
            <IconLock />
          </span>
        )}

        {/* Quick reorder buttons on hover/selection */}
        <div className="pc-row-nudge-box">
          <button
            type="button"
            className="pc-row-nudge-btn"
            title="Bring Forward (Ctrl+])"
            onClick={(e) => {
              e.stopPropagation();
              state().reorder([o.id], "forward");
            }}
          >
            ▲
          </button>
          <button
            type="button"
            className="pc-row-nudge-btn"
            title="Send Backward (Ctrl+[)"
            onClick={(e) => {
              e.stopPropagation();
              state().reorder([o.id], "backward");
            }}
          >
            ▼
          </button>
        </div>
      </div>

      {/* Render children of group */}
      {isGroup &&
        !isCollapsed &&
        kids.map((child) => (
          <LayerRow
            key={child.id}
            object={child}
            depth={depth + 1}
            childrenOf={childrenOf}
            doc={doc}
            collapsed={collapsed}
            toggle={toggle}
            query={query}
            dragOverInfo={dragOverInfo}
            isDraggingId={isDraggingId}
            onDragStartRow={onDragStartRow}
            onDragOverRow={onDragOverRow}
            onDragLeaveRow={onDragLeaveRow}
            onDropRow={onDropRow}
            onDragEndRow={onDragEndRow}
          />
        ))}
    </>
  );
}

/* ------------------------------------------------------------ Layers Panel */

export function LayersPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const state = useStore.getState;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [showAdjMenu, setShowAdjMenu] = useState(false);
  const [dragOverInfo, setDragOverInfo] = useState<DragOverInfo | null>(null);
  const [isDraggingId, setIsDraggingId] = useState<string | null>(null);

  const handleDragStartRow = (e: React.DragEvent, id: string) => {
    setIsDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    if (!selection.includes(id)) {
      state().setSelection([id]);
    }
  };

  const handleDragOverRow = (
    e: React.DragEvent,
    targetId: string,
    isGroup: boolean,
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const rect = e.currentTarget.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const height = Math.max(1, rect.height);
    let pos: "above" | "below" | "into";
    if (isGroup && relY > height * 0.25 && relY < height * 0.75) {
      pos = "into";
    } else if (relY < height / 2) {
      pos = "above";
    } else {
      pos = "below";
    }
    setDragOverInfo({ targetId, position: pos });
  };

  const handleDragLeaveRow = (id: string) => {
    setDragOverInfo((curr) => (curr?.targetId === id ? null : curr));
  };

  const handleDropRow = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingId || isDraggingId === targetId) {
      setDragOverInfo(null);
      setIsDraggingId(null);
      return;
    }
    const movingIds = selection.includes(isDraggingId) ? selection : [isDraggingId];
    if (!movingIds.includes(targetId)) {
      const pos = dragOverInfo?.position ?? "above";
      state().moveLayer(movingIds, targetId, pos);
    }
    setDragOverInfo(null);
    setIsDraggingId(null);
  };

  const handleDragEndRow = () => {
    setDragOverInfo(null);
    setIsDraggingId(null);
  };

  const selectedObjects = useMemo(() => {
    return selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o);
  }, [selection, doc]);

  const first = selectedObjects[0];

  // Tree build
  const { roots, childrenOf } = useMemo(() => {
    const map = new Map<string, CanvasObject[]>();
    const top: CanvasObject[] = [];
    // Top-to-bottom list in Photoshop matches reversed paint order
    for (let i = doc.order.length - 1; i >= 0; i--) {
      const o = doc.objects[doc.order[i]];
      if (!o) continue;
      if (o.parentId && doc.objects[o.parentId]) {
        const list = map.get(o.parentId) ?? [];
        list.push(o);
        map.set(o.parentId, list);
      } else {
        top.push(o);
      }
    }
    return { roots: top, childrenOf: map };
  }, [doc]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addAdjustmentLayer = (type: AdjustmentType) => {
    setShowAdjMenu(false);
    const id = `adj_${Date.now()}`;
    const newAdj: CanvasObject = {
      id,
      type: "adjustment",
      name: ADJUSTMENT_LABELS[type],
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      clippingMask: false,
      style: { blend: "normal" },
      data: {
        adjustmentType: type,
        adjustmentParams: defaultParamsFor(type),
      },
    };
    state().addObjects([newAdj]);
    state().setSelection([id]);
  };

  const addLayerMask = () => {
    if (!first) return;
    selection.forEach((id) => {
      state().patchObject(id, {
        mask: {
          type: "pixel",
          density: 1.0,
          feather: 0,
          inverted: false,
          enabled: true,
        },
      });
    });
  };

  const convertToSmartObject = () => {
    if (!first) return;
    selection.forEach((id) => {
      const obj = doc.objects[id];
      if (obj && obj.type !== "smart") {
        state().patchObject(id, {
          type: "smart",
          name: `${obj.name || obj.type} (Smart Object)`,
          data: {
            ...obj.data,
            smartObject: {
              src: obj.data.src,
              width: obj.width,
              height: obj.height,
              smartFilters: [],
            },
          },
        });
      }
    });
  };

  return (
    <div className="pc-layers-panel">
      {/* 1. Photoshop & Photocraft Header: Blend Mode + Opacity + Fill */}
      <div className="pc-layers-header">
        <div className="pc-blend-row">
          <select
            className="pc-blend-select"
            value={first?.style.blend ?? "source-over"}
            disabled={!first}
            onChange={(e) => state().patchStyle(selection, { blend: e.target.value })}
            title="Blend Mode"
          >
            {BLEND_CATEGORIES.map((cat) => (
              <optgroup key={cat.category} label={cat.category}>
                {cat.modes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          <div className="pc-opacity-box" title="Opacity">
            <span>Opacity:</span>
            <input
              type="number"
              min="0"
              max="100"
              disabled={!first}
              value={first ? Math.round(first.opacity * 100) : 100}
              onChange={(e) =>
                state().patchObjects(selection, { opacity: Number(e.target.value) / 100 })
              }
            />
            <span>%</span>
          </div>
        </div>

        {/* Fill opacity row & Locks row */}
        <div className="pc-fill-locks-row">
          <div className="pc-fill-box" title="Fill Opacity">
            <span>Fill:</span>
            <input
              type="number"
              min="0"
              max="100"
              disabled={!first}
              value={first ? Math.round((first.fillOpacity ?? 1) * 100) : 100}
              onChange={(e) =>
                state().patchObjects(selection, { fillOpacity: Number(e.target.value) / 100 })
              }
            />
            <span>%</span>
          </div>

          <div className="pc-locks-box">
            <span className="pc-locks-label">Lock:</span>
            <button
              type="button"
              className={`pc-lock-btn ${first?.lockedPixels ? "active" : ""}`}
              disabled={!first}
              title="Lock transparent pixels"
              onClick={() => {
                selection.forEach((id) => {
                  const o = doc.objects[id];
                  if (o) state().patchObject(id, { lockedPixels: !o.lockedPixels });
                });
              }}
            >
              ◫
            </button>
            <button
              type="button"
              className={`pc-lock-btn ${first?.lockedPosition ? "active" : ""}`}
              disabled={!first}
              title="Lock position"
              onClick={() => {
                selection.forEach((id) => {
                  const o = doc.objects[id];
                  if (o) state().patchObject(id, { lockedPosition: !o.lockedPosition });
                });
              }}
            >
              ✥
            </button>
            <button
              type="button"
              className={`pc-lock-btn ${first?.locked ? "active" : ""}`}
              disabled={!first}
              title="Lock all"
              onClick={() => {
                selection.forEach((id) => {
                  const o = doc.objects[id];
                  if (o) state().patchObject(id, { locked: !o.locked });
                });
              }}
            >
              <IconLock />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Filter input */}
      <div className="pc-layers-search-box">
        <input
          className="pc-layers-search"
          placeholder="Search layers..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* 3. Layer Tree List */}
      <div
        className="pc-layers-tree"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (!isDraggingId || !roots.length) {
            setDragOverInfo(null);
            setIsDraggingId(null);
            return;
          }
          const movingIds = selection.includes(isDraggingId) ? selection : [isDraggingId];
          const bottomRoot = roots[roots.length - 1];
          if (bottomRoot && !movingIds.includes(bottomRoot.id)) {
            state().moveLayer(movingIds, bottomRoot.id, "below");
          }
          setDragOverInfo(null);
          setIsDraggingId(null);
        }}
      >
        {roots.length === 0 ? (
          <div className="pc-empty-hint">No layers in this document.</div>
        ) : (
          roots.map((o) => (
            <LayerRow
              key={o.id}
              object={o}
              depth={0}
              childrenOf={childrenOf}
              doc={doc}
              collapsed={collapsed}
              toggle={toggle}
              query={query.trim().toLowerCase()}
              dragOverInfo={dragOverInfo}
              isDraggingId={isDraggingId}
              onDragStartRow={handleDragStartRow}
              onDragOverRow={handleDragOverRow}
              onDragLeaveRow={handleDragLeaveRow}
              onDropRow={handleDropRow}
              onDragEndRow={handleDragEndRow}
            />
          ))
        )}
      </div>

      {/* 4. Photocraft & Photoshop Bottom Action Strip */}
      <div className="pc-layers-footer">
        {/* Send Backward / Down */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Send Backward (Ctrl+[)"
          disabled={!first}
          onClick={() => state().reorder(selection, "backward")}
        >
          ▼
        </button>

        {/* Bring Forward / Up */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Bring Forward (Ctrl+])"
          disabled={!first}
          onClick={() => state().reorder(selection, "forward")}
        >
          ▲
        </button>

        {/* Send to Back */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Send to Back (Shift+Ctrl+[)"
          disabled={!first}
          onClick={() => state().reorder(selection, "back")}
        >
          ⤓
        </button>

        {/* Bring to Front */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Bring to Front (Shift+Ctrl+])"
          disabled={!first}
          onClick={() => state().reorder(selection, "front")}
        >
          ⤒
        </button>

        {/* Delete layer */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Delete Layer"
          disabled={!first}
          onClick={() => state().deleteSelection()}
        >
          <IconTrash />
        </button>

        {/* New Group */}
        <button
          type="button"
          className="pc-foot-btn"
          title="New Group (Folder)"
          onClick={() => {
            if (selection.length > 0) state().group();
            else state().addObjects([
              {
                id: `grp_${Date.now()}`,
                type: "group",
                name: "Group",
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 0,
                opacity: 1,
                locked: false,
                hidden: false,
                style: {},
                data: { children: [] },
              },
            ]);
          }}
        >
          <IconGroup />
        </button>

        {/* New Adjustment Layer (+/- circle popup) */}
        <div className="pc-adj-popup-container">
          <button
            type="button"
            className="pc-foot-btn"
            title="Create new fill or adjustment layer"
            onClick={() => setShowAdjMenu(!showAdjMenu)}
          >
            ◐
          </button>
          {showAdjMenu && (
            <div className="pc-adj-popup-menu">
              <div className="pc-popup-title">New Adjustment Layer</div>
              {Object.entries(ADJUSTMENT_LABELS).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  className="pc-popup-item"
                  onClick={() => addAdjustmentLayer(type as AdjustmentType)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Layer Mask */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Add Layer Mask"
          disabled={!first}
          onClick={addLayerMask}
        >
          <span className="pc-mask-glyph">⊡</span>
        </button>

        {/* Convert to Smart Object */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Convert to Smart Object"
          disabled={!first}
          onClick={convertToSmartObject}
        >
          📦
        </button>

        {/* New Layer (+) */}
        <button
          type="button"
          className="pc-foot-btn"
          title="Create New Layer"
          onClick={() => {
            const id = `layer_${Date.now()}`;
            state().addObjects([
              {
                id,
                type: "rect",
                name: "Layer " + (roots.length + 1),
                x: 100,
                y: 100,
                width: 400,
                height: 300,
                rotation: 0,
                opacity: 1,
                locked: false,
                hidden: false,
                style: { fill: "#3b82f6" },
                data: {},
              },
            ]);
            state().setSelection([id]);
          }}
        >
          <IconPlus />
        </button>
      </div>
    </div>
  );
}

import { useStore } from "../store/store";
import type { ToolId } from "../types";
import { IconArrow, IconImage, IconMeasure, IconNote, IconPen, IconRect, IconText, IconFrame } from "./icons";

const RADIUS = 104;

const ITEMS: { tool: ToolId | "image"; label: string; Icon: typeof IconArrow }[] = [
  { tool: "text", label: "Text", Icon: IconText },
  { tool: "rect", label: "Shape", Icon: IconRect },
  { tool: "note", label: "Note", Icon: IconNote },
  { tool: "measure", label: "Measure", Icon: IconMeasure },
  { tool: "image", label: "Image", Icon: IconImage },
  { tool: "frame", label: "Frame", Icon: IconFrame },
  { tool: "pen", label: "Draw", Icon: IconPen },
  { tool: "arrow", label: "Arrow", Icon: IconArrow },
];

/**
 * Right click (or long press) opens tools around the pointer so the common
 * actions are always a flick away instead of a trip to the toolbar (§25).
 */
export function RadialMenu({ onInsertImage }: { onInsertImage: () => void }) {
  const radial = useStore((s) => s.ui.radial);
  const state = useStore.getState;
  if (!radial) return null;

  return (
    <div className="radial-layer" data-ui onPointerDown={() => state().setUi({ radial: null })}>
      <div className="radial" style={{ left: radial.x, top: radial.y }}>
        <span className="radial-core" />
        {ITEMS.map((item, i) => {
          const angle = (i / ITEMS.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          return (
            <button
              key={item.label}
              type="button"
              className="radial-item"
              style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                state().setUi({ radial: null });
                if (item.tool === "image") onInsertImage();
                else state().setTool(item.tool);
              }}
            >
              <item.Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

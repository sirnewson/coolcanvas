import { useStore } from "../store/store";
import type { ToolId } from "../types";
import {
  IconArrow,
  IconCircle,
  IconDiamond,
  IconEraser,
  IconFrame,
  IconHand,
  IconHexagon,
  IconHighlighter,
  IconImage,
  IconLine,
  IconList,
  IconLock,
  IconMeasure,
  IconNote,
  IconPen,
  IconRect,
  IconSelect,
  IconStamp,
  IconText,
  IconTriangle,
  IconUnlock,
} from "./icons";

type Entry = { id: ToolId; label: string; shortcut: string; Icon: typeof IconArrow };

const GROUPS: Entry[][] = [
  [
    { id: "select", label: "Select", shortcut: "V", Icon: IconSelect },
    { id: "hand", label: "Hand", shortcut: "H", Icon: IconHand },
  ],
  [
    { id: "pen", label: "Pen Tool", shortcut: "P", Icon: IconPen },
    { id: "highlighter", label: "Highlighter", shortcut: "⇧P", Icon: IconHighlighter },
    { id: "eraser", label: "Eraser", shortcut: "E", Icon: IconEraser },
  ],
  [
    { id: "arrow", label: "Arrow", shortcut: "A", Icon: IconArrow },
    { id: "line", label: "Line", shortcut: "L", Icon: IconLine },
    { id: "measure", label: "Measure", shortcut: "M", Icon: IconMeasure },
  ],
  [
    { id: "rect", label: "Rectangle", shortcut: "R", Icon: IconRect },
    { id: "ellipse", label: "Ellipse", shortcut: "O", Icon: IconCircle },
    { id: "triangle", label: "Triangle", shortcut: "⇧R", Icon: IconTriangle },
    { id: "diamond", label: "Diamond", shortcut: "⇧O", Icon: IconDiamond },
    { id: "polygon", label: "Polygon", shortcut: "G", Icon: IconHexagon },
  ],
  [
    { id: "text", label: "Text", shortcut: "T", Icon: IconText },
    { id: "note", label: "Sticky note", shortcut: "N", Icon: IconNote },
    { id: "list", label: "Outline", shortcut: "B", Icon: IconList },
    { id: "frame", label: "Frame", shortcut: "F", Icon: IconFrame },
  ],
];

export function Toolbar({ onInsertImage }: { onInsertImage: () => void }) {
  const tool = useStore((s) => s.tool);
  const locked = useStore((s) => s.toolLocked);
  const stampsOpen = useStore((s) => s.ui.stampsOpen);
  const showKeys = useStore((s) => s.prefs.showToolKeys);
  const state = useStore.getState;

  return (
    <div className={`toolbar${showKeys ? " show-keys" : ""}`} data-ui>
      {GROUPS.map((group, i) => (
        <div className="tool-group" key={i}>
          {group.map(({ id, label, shortcut, Icon }) => (
            <button
              key={id}
              type="button"
              className={`tool${tool === id ? " is-active" : ""}`}
              onClick={() => state().setTool(id)}
              onDoubleClick={() => state().setToolLocked(true)}
              title={`${label}  ·  ${shortcut}`}
              aria-label={label}
              aria-pressed={tool === id}
            >
              <Icon />
              <span className="tool-key">{shortcut}</span>
            </button>
          ))}
        </div>
      ))}

      <div className="tool-group">
        <button type="button" className="tool" onClick={onInsertImage} title="Image  ·  I" aria-label="Insert image">
          <IconImage />
          <span className="tool-key">I</span>
        </button>
        <button
          type="button"
          className={`tool${stampsOpen ? " is-active" : ""}`}
          onClick={() => state().setUi({ stampsOpen: !stampsOpen })}
          title="Stamps — ready-made blocks"
          aria-label="Stamps"
        >
          <IconStamp />
        </button>
      </div>

      <div className="tool-group">
        <button
          type="button"
          className={`tool is-toggle${locked ? " is-active" : ""}`}
          onClick={() => state().setToolLocked(!locked)}
          title={locked ? "Tool stays active after each use" : "Tool returns to Select after each use"}
          aria-label="Keep tool active"
        >
          {locked ? <IconLock /> : <IconUnlock />}
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";

import { useStore } from "../store/store";
import type { ToolId } from "../types";
import {
  IconArrow,
  IconFrame,
  IconImage,
  IconList,
  IconMeasure,
  IconNote,
  IconPen,
  IconPlus,
  IconRect,
  IconSelect,
  IconText,
} from "./icons";

const PRIMARY: { id: ToolId; label: string; Icon: typeof IconArrow }[] = [
  { id: "select", label: "Select", Icon: IconSelect },
  { id: "pen", label: "Draw", Icon: IconPen },
  { id: "arrow", label: "Arrow", Icon: IconArrow },
  { id: "rect", label: "Shape", Icon: IconRect },
  { id: "text", label: "Text", Icon: IconText },
];

/** Mobile simplifies rather than shrinks the desktop chrome (blueprint §28). */
export function MobileBar({ onInsertImage }: { onInsertImage: () => void }) {
  const tool = useStore((s) => s.tool);
  const setTool = useStore((s) => s.setTool);
  const [more, setMore] = useState(false);

  return (
    <div className="mobile-bar" data-ui>
      {more && (
        <div className="mobile-more">
          <button
            type="button"
            onClick={() => {
              setMore(false);
              onInsertImage();
            }}
          >
            <IconImage />
            Image
          </button>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              setTool("note");
            }}
          >
            <IconNote />
            Note
          </button>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              setTool("frame");
            }}
          >
            <IconFrame />
            Frame
          </button>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              setTool("measure");
            }}
          >
            <IconMeasure />
            Measure
          </button>
          <button
            type="button"
            onClick={() => {
              setMore(false);
              setTool("list");
            }}
          >
            <IconList />
            Outline
          </button>
        </div>
      )}
      <div className="mobile-row">
        {PRIMARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={tool === id ? "is-active" : ""}
            onClick={() => {
              setMore(false);
              setTool(id);
            }}
            aria-label={label}
          >
            <Icon />
          </button>
        ))}
        <button
          type="button"
          className={more ? "is-active" : ""}
          onClick={() => setMore((v) => !v)}
          aria-label="More tools"
        >
          <IconPlus />
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";

import { useStore } from "../store/store";
import type { BackgroundKind, RenderMode, ToolId } from "../types";

interface Command {
  id: string;
  label: string;
  group: string;
  hint?: string;
  run: () => void;
}

export function CommandMenu({ onInsertImage }: { onInsertImage: () => void }) {
  const open = useStore((s) => s.ui.commandOpen);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const s = useStore.getState;
    const tool = (id: ToolId, label: string, hint: string): Command => ({
      id: `tool-${id}`,
      label,
      group: "Tools",
      hint,
      run: () => s().setTool(id),
    });
    const bg = (id: BackgroundKind, label: string): Command => ({
      id: `bg-${id}`,
      label: `Background: ${label}`,
      group: "Canvas",
      run: () => s().setBackground(id),
    });
    const mode = (id: RenderMode, label: string): Command => ({
      id: `mode-${id}`,
      label: `${label} mode`,
      group: "Canvas",
      run: () => s().setRenderMode(id),
    });
    return [
      tool("select", "Select", "V"),
      tool("hand", "Hand", "H"),
      tool("pen", "Draw", "P"),
      tool("highlighter", "Highlighter", "Shift+P"),
      tool("eraser", "Eraser", "E"),
      tool("arrow", "Arrow", "A"),
      tool("line", "Line", "L"),
      tool("measure", "Measure", "M"),
      tool("rect", "Rectangle", "R"),
      tool("ellipse", "Circle", "O"),
      tool("triangle", "Triangle", "Shift+R"),
      tool("diamond", "Diamond", "Shift+O"),
      tool("polygon", "Polygon / hexagon", "G"),
      tool("frame", "Frame", "F"),
      tool("text", "Text", "T"),
      tool("note", "Sticky note", "N"),
      tool("list", "Outline list", "B"),
      { id: "image", label: "Image", group: "Tools", hint: "I", run: onInsertImage },
      {
        id: "export",
        label: "Export",
        group: "Board",
        hint: "Ctrl+E",
        run: () => s().setUi({ exportOpen: true }),
      },
      { id: "layers", label: "Layers", group: "Board", run: () => s().openDock("layers") },
      { id: "design", label: "Properties", group: "Board", run: () => s().openDock("design") },
      { id: "assist", label: "Assistant — ideas, outlines, images", group: "Board", run: () => s().openDock("assist") },
      { id: "settings", label: "Canvas settings", group: "Board", run: () => s().openDock("canvas") },
      { id: "prefs", label: "Preferences and setup", group: "Board", run: () => s().openDock("prefs") },
      { id: "stamps", label: "Insert blocks, art and templates", group: "Board", run: () => s().setUi({ stampsOpen: true }) },
      { id: "boards", label: "All boards", group: "Board", run: () => s().setUi({ boardsOpen: true }) },
      { id: "home", label: "Gallery / home", group: "Board", run: () => s().setUi({ home: true }) },
      {
        id: "timeline",
        label: "Animation timeline",
        group: "Board",
        run: () => s().setUi({ timelineOpen: true }),
      },
      {
        id: "addcel",
        label: "Add animation cel",
        group: "Board",
        run: () => {
          s().setUi({ timelineOpen: true });
          s().addCel(true);
        },
      },
      {
        id: "shortcuts",
        label: "Keyboard shortcuts",
        group: "Board",
        hint: "?",
        run: () => s().setUi({ shortcutsOpen: true }),
      },
      {
        id: "timelapse",
        label: "Play the time-lapse",
        group: "Board",
        run: () => s().setUi({ timelapseOpen: true }),
      },
      {
        id: "theme",
        label: "Toggle dark mode",
        group: "View",
        run: () => s().setTheme(s().theme === "dark" ? "light" : "dark"),
      },
      {
        id: "minimap",
        label: "Toggle minimap",
        group: "View",
        run: () => s().setUi({ minimapOpen: !s().ui.minimapOpen }),
      },
      { id: "present", label: "Present", group: "Board", run: () => s().setUi({ presenting: true }) },
      { id: "fit", label: "Fit board", group: "View", hint: "1", run: () => s().fitAll() },
      { id: "fitsel", label: "Fit selection", group: "View", hint: "2", run: () => s().fitSelection() },
      { id: "reset", label: "Reset view", group: "View", hint: "0", run: () => s().resetView() },
      { id: "group", label: "Group", group: "Edit", hint: "Ctrl+G", run: () => s().group() },
      { id: "ungroup", label: "Ungroup", group: "Edit", hint: "Ctrl+Shift+G", run: () => s().ungroup() },
      {
        id: "duplicate",
        label: "Duplicate",
        group: "Edit",
        hint: "Ctrl+D",
        run: () => s().duplicateSelection(),
      },
      { id: "delete", label: "Delete selection", group: "Edit", run: () => s().deleteSelection() },
      { id: "copy", label: "Copy", group: "Edit", hint: "Ctrl+C", run: () => s().copySelection() },
      { id: "paste", label: "Paste", group: "Edit", hint: "Ctrl+V", run: () => s().pasteClipboard() },
      { id: "same", label: "Select same type", group: "Edit", run: () => s().selectSame() },
      { id: "copystyle", label: "Copy style", group: "Edit", run: () => s().copyStyle() },
      { id: "pastestyle", label: "Paste style", group: "Edit", run: () => s().pasteStyle() },
      {
        id: "eyedropper",
        label: "Pick a colour from the canvas",
        group: "Edit",
        run: () => s().setUi({ eyedropper: "stroke" }),
      },
      { id: "undo", label: "Undo", group: "Edit", hint: "Ctrl+Z", run: () => s().undo() },
      { id: "redo", label: "Redo", group: "Edit", hint: "Ctrl+Shift+Z", run: () => s().redo() },
      bg("dots", "Dot grid"),
      bg("grid", "Graph grid"),
      bg("blueprint", "Blueprint"),
      bg("paper", "Paper"),
      bg("slate", "Slate"),
      bg("blank", "Blank"),
      mode("sketch", "Sketch"),
      mode("normal", "Normal"),
      mode("precision", "Precision"),
    ];
  }, [onInsertImage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  if (!open) return null;

  const close = () => useStore.getState().setUi({ commandOpen: false });
  const run = (cmd?: Command) => {
    if (!cmd) return;
    close();
    cmd.run();
  };

  return (
    <div className="modal-backdrop" data-ui onPointerDown={close}>
      <div className="command" onPointerDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Type a command — arrow, rectangle, export…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(filtered[index]);
            } else if (e.key === "Escape") {
              close();
            }
          }}
        />
        <div className="command-list">
          {filtered.map((c, i) => (
            <button
              key={c.id}
              type="button"
              className={`command-row${i === index ? " is-active" : ""}`}
              onPointerEnter={() => setIndex(i)}
              onClick={() => run(c)}
            >
              <span className="command-group">{c.group}</span>
              <span className="command-label">{c.label}</span>
              {c.hint && <kbd>{c.hint}</kbd>}
            </button>
          ))}
          {!filtered.length && <p className="panel-empty">No matching command.</p>}
        </div>
      </div>
    </div>
  );
}

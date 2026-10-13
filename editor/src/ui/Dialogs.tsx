import { useEffect, useState } from "react";

import { useStore } from "../store/store";
import { deleteBoard, listBoards, saveBoard } from "../persist/idb";
import type { BoardDoc } from "../types";
import { IconClose } from "./icons";

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose(): void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" data-ui onPointerDown={onClose}>
      <div className={`modal${wide ? " is-wide" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <IconClose width={16} height={16} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function BoardsDialog() {
  const open = useStore((s) => s.ui.boardsOpen);
  const currentId = useStore((s) => s.doc.id);
  const state = useStore.getState;
  const [boards, setBoards] = useState<BoardDoc[]>([]);

  useEffect(() => {
    if (!open) return;
    saveBoard(useStore.getState().doc).then(() => listBoards().then(setBoards));
  }, [open]);

  if (!open) return null;

  const close = () => state().setUi({ boardsOpen: false });

  const openBoard = async (board: BoardDoc) => {
    await saveBoard(useStore.getState().doc);
    state().loadDoc(board);
    state().fitAll();
    close();
  };

  return (
    <Modal title="Boards" onClose={close} wide>
      <div className="board-list">
        {boards
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map((b) => (
            <div key={b.id} className={`board-row${b.id === currentId ? " is-current" : ""}`}>
              <button type="button" className="board-open" onClick={() => openBoard(b)}>
                <strong>{b.name}</strong>
                <span>
                  {b.order.length} object{b.order.length === 1 ? "" : "s"} ·{" "}
                  {new Date(b.updatedAt).toLocaleString()}
                </span>
              </button>
              <button
                type="button"
                className="mini-btn"
                disabled={b.id === currentId}
                onClick={async () => {
                  await deleteBoard(b.id);
                  setBoards((list) => list.filter((x) => x.id !== b.id));
                }}
              >
                Delete
              </button>
            </div>
          ))}
        {!boards.length && <p className="ins-note">No saved boards yet.</p>}
      </div>
      <footer className="modal-foot">
        <button
          type="button"
          className="ghost-btn"
          onClick={async () => {
            await saveBoard(useStore.getState().doc);
            state().newBoard(`Board ${boards.length + 1}`);
            close();
          }}
        >
          New board
        </button>
        <button type="button" className="primary" onClick={close}>
          Done
        </button>
      </footer>
    </Modal>
  );
}

const SHORTCUTS: [string, string][][] = [
  [
    ["V", "Select"],
    ["H", "Hand / pan"],
    ["P", "Draw"],
    ["Shift+P", "Highlighter"],
    ["E", "Eraser"],
    ["A", "Arrow"],
    ["L", "Line"],
    ["R", "Rectangle"],
    ["O", "Ellipse"],
    ["M", "Measure"],
    ["F", "Frame"],
    ["T", "Text"],
    ["N", "Sticky note"],
    ["I", "Insert image"],
  ],
  [
    ["Space + drag", "Pan"],
    ["Ctrl + scroll", "Zoom"],
    ["Shift + scroll", "Pan sideways"],
    ["0", "Reset view"],
    ["1", "Fit board"],
    ["2", "Fit selection"],
    ["Ctrl + K", "Command menu"],
    ["Right click", "Quick menu"],
  ],
  [
    ["Ctrl + Z", "Undo"],
    ["Ctrl + Shift + Z", "Redo"],
    ["Ctrl + C / V / X", "Copy / paste / cut"],
    ["Ctrl + D", "Duplicate"],
    ["Ctrl + G", "Group"],
    ["Ctrl + Shift + G", "Ungroup"],
    ["Ctrl + A", "Select all"],
    ["Alt + drag", "Duplicate as you drag"],
    ["Ctrl (hold)", "Suspend snapping"],
    ["Shift (drawing)", "Constrain angle / ratio"],
    ["Delete", "Remove selection"],
  ],
];

export function ShortcutsDialog() {
  const open = useStore((s) => s.ui.shortcutsOpen);
  const state = useStore.getState;
  if (!open) return null;
  return (
    <Modal title="Keyboard" onClose={() => state().setUi({ shortcutsOpen: false })} wide>
      <div className="shortcut-cols">
        {SHORTCUTS.map((col, i) => (
          <dl key={i}>
            {col.map(([key, label]) => (
              <div key={key}>
                <dt>
                  <kbd>{key}</kbd>
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
      <p className="ins-note modal-note">
        Tool keys latch on a tap and spring back when you hold them: hold <kbd>A</kbd>, drag an
        arrow, let go, and you are back on the select tool.
      </p>
    </Modal>
  );
}

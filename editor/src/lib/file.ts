import { emptyDoc } from "../store/store";
import { uid } from "./id";
import type { BoardDoc, CanvasObject } from "../types";
import { downloadBlob, safeFilename } from "./export";

const FORMAT = "yxm-canvas";
const VERSION = 1;

interface Envelope {
  format: string;
  version: number;
  board: BoardDoc;
}

export function exportBoardFile(doc: BoardDoc) {
  const envelope: Envelope = { format: FORMAT, version: VERSION, board: doc };
  downloadBlob(
    new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }),
    `${safeFilename(doc.name)}.yxm`,
  );
}

/**
 * Imported files are untrusted: every field is re-derived from a fresh empty
 * board, and anything that does not look like an object is dropped.
 */
export function parseBoardFile(raw: string): BoardDoc | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const env = parsed as Partial<Envelope>;
  const board = (env?.format === FORMAT ? env.board : (parsed as BoardDoc)) as
    | Partial<BoardDoc>
    | undefined;
  if (!board || typeof board !== "object" || !Array.isArray(board.order)) return null;

  const base = emptyDoc(typeof board.name === "string" ? board.name.slice(0, 120) : "Imported board");
  const objects: Record<string, CanvasObject> = {};
  const order: string[] = [];

  for (const id of board.order) {
    if (typeof id !== "string") continue;
    const o = (board.objects ?? {})[id] as CanvasObject | undefined;
    if (!o || typeof o !== "object" || typeof o.type !== "string") continue;
    if (!Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
    objects[id] = {
      ...o,
      id,
      width: Number.isFinite(o.width) ? o.width : 0,
      height: Number.isFinite(o.height) ? o.height : 0,
      rotation: Number.isFinite(o.rotation) ? o.rotation : 0,
      opacity: Number.isFinite(o.opacity) ? o.opacity : 1,
      locked: !!o.locked,
      hidden: !!o.hidden,
      style: o.style && typeof o.style === "object" ? o.style : {},
      data: o.data && typeof o.data === "object" ? o.data : {},
    };
    order.push(id);
  }
  if (!order.length) return null;

  return {
    ...base,
    id: uid("board"),
    objects,
    order,
    settings: { ...base.settings, ...(board.settings ?? {}) },
    animation: {
      ...base.animation,
      ...(board.animation ?? {}),
      cels: (board.animation?.cels ?? []).filter((id) => typeof id === "string" && !!objects[id]),
    },
    updatedAt: Date.now(),
  };
}

export function pickBoardFile(): Promise<BoardDoc | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".yxm,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve(parseBoardFile(await file.text()));
    };
    input.click();
  });
}

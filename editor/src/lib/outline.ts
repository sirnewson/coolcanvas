import { uid } from "./id";
import type { CanvasObject, ListItem } from "../types";

export const LIST_PAD = 12;
export const INDENT = 18;

export function rowHeight(o: CanvasObject): number {
  return Math.round((o.style.fontSize ?? 15) * (o.style.lineHeight ?? 1.6));
}

export interface VisibleRow {
  item: ListItem;
  /** Index in the full item list. */
  index: number;
  hasChildren: boolean;
}

/**
 * Rows that should be drawn: an item is hidden when any shallower ancestor
 * above it is collapsed. That single rule gives the whole fold behaviour.
 */
export function visibleRows(items: ListItem[]): VisibleRow[] {
  const out: VisibleRow[] = [];
  let hideBelow: number | null = null;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (hideBelow !== null) {
      if (item.level > hideBelow) continue;
      hideBelow = null;
    }
    const next = items[i + 1];
    const hasChildren = !!next && next.level > item.level;
    out.push({ item, index: i, hasChildren });
    if (hasChildren && item.collapsed) hideBelow = item.level;
  }
  return out;
}

export function listHeight(o: CanvasObject): number {
  const items = o.data.items ?? [];
  return LIST_PAD * 2 + visibleRows(items).length * rowHeight(o);
}

export function parseOutline(text: string): ListItem[] {
  const lines = text.split("\n");
  const items: ListItem[] = [];
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const indent = /^(\s*)/.exec(raw)?.[1] ?? "";
    const level = Math.min(4, Math.floor(indent.replace(/\t/g, "  ").length / 2));
    const body = raw.trim().replace(/^([-*•]|\[[ x]\]|\d+\.)\s*/, "");
    const checked = /^\[x\]/i.test(raw.trim());
    items.push({ id: uid("li"), text: body, level, checked });
  }
  return items.length ? items : [{ id: uid("li"), text: "", level: 0 }];
}

export function serializeOutline(items: ListItem[]): string {
  return items.map((i) => `${"  ".repeat(i.level)}${i.text}`).join("\n");
}

/** Keep collapse and check state when text is re-parsed after editing. */
export function mergeOutline(previous: ListItem[], next: ListItem[]): ListItem[] {
  return next.map((item, i) => {
    const old = previous[i];
    if (!old) return item;
    return { ...item, collapsed: old.collapsed, checked: item.checked || old.checked };
  });
}

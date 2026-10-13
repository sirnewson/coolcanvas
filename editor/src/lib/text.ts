import type { CanvasObject } from "../types";
import { FONTS } from "./theme";

/**
 * Text height measurement.
 *
 * One hidden div, styled exactly like the object, gives the wrapped height —
 * the same box the editing textarea will use, so a text block never jumps
 * between editing and display.
 */
let probe: HTMLDivElement | null = null;

function getProbe(): HTMLDivElement {
  if (probe) return probe;
  probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  Object.assign(probe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: "0",
    margin: "0",
    border: "0",
    pointerEvents: "none",
  } as CSSStyleDeclaration);
  document.body.appendChild(probe);
  return probe;
}

export function measureTextHeight(o: CanvasObject, text = o.data.text ?? ""): number {
  const el = getProbe();
  const size = o.style.fontSize ?? 18;
  el.style.width = `${Math.max(8, o.width)}px`;
  el.style.fontFamily = FONTS[o.style.fontFamily ?? "sans"];
  el.style.fontSize = `${size}px`;
  el.style.fontWeight = String(o.style.fontWeight ?? 400);
  el.style.fontStyle = o.style.fontStyle === "italic" ? "italic" : "normal";
  el.style.lineHeight = String(o.style.lineHeight ?? 1.35);
  el.style.letterSpacing = `${o.style.letterSpacing ?? 0}px`;
  el.textContent = text.length ? displayText(o, text) : "M";
  return Math.max(size, Math.ceil(el.getBoundingClientRect().height));
}

/** Widest line of the text at the object's type settings, in board pixels. */
export function measureTextWidth(o: CanvasObject, text = o.data.text ?? ""): number {
  const el = getProbe();
  const size = o.style.fontSize ?? 18;
  el.style.width = "auto";
  el.style.whiteSpace = "pre";
  el.style.fontFamily = FONTS[o.style.fontFamily ?? "sans"];
  el.style.fontSize = `${size}px`;
  el.style.fontWeight = String(o.style.fontWeight ?? 400);
  el.style.fontStyle = o.style.fontStyle === "italic" ? "italic" : "normal";
  el.style.lineHeight = String(o.style.lineHeight ?? 1.35);
  el.style.letterSpacing = `${o.style.letterSpacing ?? 0}px`;
  el.textContent = displayText(o, text.length ? text : "Type…");
  const w = Math.ceil(el.getBoundingClientRect().width);
  el.style.whiteSpace = "pre-wrap";
  return Math.max(size, w + 4);
}

/** Text as drawn: case transform and list prefixes applied per line. */
export function displayText(o: CanvasObject, text = o.data.text ?? ""): string {
  let t = text;
  const list = o.style.textList ?? "none";
  if (list !== "none") {
    let n = 0;
    t = t
      .split("\n")
      .map((line) => {
        if (!line.trim()) return line;
        n += 1;
        const prefix = list === "bullet" ? "•  " : list === "check" ? "☐  " : `${n}.  `;
        return prefix + line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "");
      })
      .join("\n");
  }
  const tf = o.style.textTransform ?? "none";
  if (tf === "uppercase") t = t.toUpperCase();
  else if (tf === "capitalize") t = t.replace(/(^|\s)(\S)/g, (_m: string, sp: string, c: string) => sp + c.toUpperCase());
  return t;
}

/** Font sizes the stepper walks through — a real scale, not +1 at a time. */
export const TEXT_SIZES = [10, 12, 14, 16, 18, 21, 24, 28, 34, 40, 48, 60, 72, 96, 128];

export function stepFontSize(current: number, direction: 1 | -1): number {
  if (direction > 0) return TEXT_SIZES.find((s) => s > current) ?? Math.round(current * 1.2);
  return [...TEXT_SIZES].reverse().find((s) => s < current) ?? Math.max(6, Math.round(current / 1.2));
}

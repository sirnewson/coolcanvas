/**
 * Editable Typography (Character & Paragraph) Panel.
 * Mirrors the photo engine's `crates/ui-egui/src/type_panels_ui.rs`.
 */

import { useMemo } from "react";
import { useStore } from "../../store/store";
import type { CanvasObject } from "../../types";

const FONTS_LIST: { key: string; label: string; sample: string }[] = [
  { key: "Inter, sans-serif", label: "Inter (Modern Sans)", sample: "Aa" },
  { key: "Roboto, sans-serif", label: "Roboto (Clean Sans)", sample: "Aa" },
  { key: "Georgia, serif", label: "Georgia (Editorial Serif)", sample: "Aa" },
  { key: "'Playfair Display', serif", label: "Playfair Display (Display Serif)", sample: "Aa" },
  { key: "'JetBrains Mono', monospace", label: "JetBrains Mono (Code)", sample: "Aa" },
  { key: "Pacifico, cursive", label: "Pacifico (Retro Brush)", sample: "Aa" },
  { key: "Caveat, cursive", label: "Caveat (Handwritten)", sample: "Aa" },
  { key: "Impact, sans-serif", label: "Impact (Bold Headline)", sample: "Aa" },
  { key: "'Times New Roman', serif", label: "Times New Roman (Classic)", sample: "Aa" },
  { key: "Arial, sans-serif", label: "Arial (Standard Sans)", sample: "Aa" },
];

const WEIGHTS: { value: number; label: string }[] = [
  { value: 100, label: "Thin" },
  { value: 200, label: "Extra Light" },
  { value: 300, label: "Light" },
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semi Bold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Extra Bold" },
  { value: 900, label: "Black" },
];

export function TypographyPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const patchObject = useStore((s) => s.patchObject);

  const selectedObjects = useMemo(() => {
    return selection.map((id) => doc.objects[id]).filter((o): o is CanvasObject => !!o);
  }, [selection, doc]);

  const target = selectedObjects[0];

  const style = target?.style || {};

  const updateStyle = (patch: any) => {
    if (selection.length === 0) return;
    selection.forEach((id) => {
      const obj = doc.objects[id];
      if (obj) {
        patchObject(id, {
          style: {
            ...obj.style,
            ...patch,
          },
        });
      }
    });
  };

  return (
    <div className="pc-typography-panel">
      {/* 1. Character Section */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Character</span>
        </div>

        {/* Font Family */}
        <div className="pc-typo-row">
          <label>Font</label>
          <select
            className="pc-select"
            value={style.fontFamily || "Inter, sans-serif"}
            onChange={(e) => updateStyle({ fontFamily: e.target.value })}
          >
            {FONTS_LIST.map((f) => (
              <option key={f.key} value={f.key} style={{ fontFamily: f.key }}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Font Weight */}
        <div className="pc-typo-row">
          <label>Weight</label>
          <select
            className="pc-select"
            value={style.fontWeight || 400}
            onChange={(e) => updateStyle({ fontWeight: Number(e.target.value) })}
          >
            {WEIGHTS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label} ({w.value})
              </option>
            ))}
          </select>
        </div>

        {/* Dual numeric grid: Size & Leading */}
        <div className="pc-dual-grid">
          <div className="pc-dual-col">
            <span className="pc-glyph-label" title="Font Size">TT</span>
            <input
              type="number"
              min="6"
              max="288"
              value={style.fontSize || 24}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
            />
            <span className="pc-unit">px</span>
          </div>

          <div className="pc-dual-col">
            <span className="pc-glyph-label" title="Leading (Line Height)">A/A</span>
            <input
              type="number"
              min="0.5"
              max="3.0"
              step="0.1"
              value={style.lineHeight || 1.2}
              onChange={(e) => updateStyle({ lineHeight: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Dual numeric grid: Tracking & Kerning */}
        <div className="pc-dual-grid">
          <div className="pc-dual-col">
            <span className="pc-glyph-label" title="Tracking (Letter Spacing)">VA</span>
            <input
              type="number"
              min="-10"
              max="50"
              step="0.5"
              value={style.letterSpacing || 0}
              onChange={(e) => updateStyle({ letterSpacing: Number(e.target.value) })}
            />
            <span className="pc-unit">px</span>
          </div>

          <div className="pc-dual-col">
            <span className="pc-glyph-label" title="Kerning">V/A</span>
            <input
              type="number"
              min="-50"
              max="50"
              value={style.kerning || 0}
              onChange={(e) => updateStyle({ kerning: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Color row */}
        <div className="pc-typo-row">
          <label>Color</label>
          <div className="pc-color-picker-inline">
            <input
              type="color"
              value={style.color || "#ffffff"}
              onChange={(e) => updateStyle({ color: e.target.value })}
            />
            <input
              type="text"
              className="pc-hex-input"
              value={style.color || "#ffffff"}
              onChange={(e) => updateStyle({ color: e.target.value })}
            />
          </div>
        </div>

        {/* Character Formatting Buttons: Faux Bold, Faux Italic, All Caps, etc. */}
        <div className="pc-format-buttons">
          <button
            type="button"
            className={`pc-fmt-btn ${style.fauxBold ? "active" : ""}`}
            title="Faux Bold"
            onClick={() => updateStyle({ fauxBold: !style.fauxBold })}
          >
            <b>T</b>
          </button>
          <button
            type="button"
            className={`pc-fmt-btn ${style.fauxItalic ? "active" : ""}`}
            title="Faux Italic"
            onClick={() => updateStyle({ fauxItalic: !style.fauxItalic })}
          >
            <i>T</i>
          </button>
          <button
            type="button"
            className={`pc-fmt-btn ${style.allCaps ? "active" : ""}`}
            title="All Caps"
            onClick={() => updateStyle({ allCaps: !style.allCaps, smallCaps: false })}
          >
            TT
          </button>
          <button
            type="button"
            className={`pc-fmt-btn ${style.smallCaps ? "active" : ""}`}
            title="Small Caps"
            onClick={() => updateStyle({ smallCaps: !style.smallCaps, allCaps: false })}
          >
            Tᴛ
          </button>
          <button
            type="button"
            className={`pc-fmt-btn ${style.underline ? "active" : ""}`}
            title="Underline"
            onClick={() => updateStyle({ underline: !style.underline })}
          >
            <u>U</u>
          </button>
          <button
            type="button"
            className={`pc-fmt-btn ${style.strikethrough ? "active" : ""}`}
            title="Strikethrough"
            onClick={() => updateStyle({ strikethrough: !style.strikethrough })}
          >
            <s>S</s>
          </button>
        </div>
      </div>

      {/* 2. Paragraph Section */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Paragraph</span>
        </div>

        <div className="pc-align-buttons">
          <button
            type="button"
            className={`pc-align-btn ${(style.align || "left") === "left" ? "active" : ""}`}
            title="Align Left"
            onClick={() => updateStyle({ align: "left" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2zm0 3.5h8V8H2zm0 3.5h12v1.5H2zm0 3.5h8V15H2z" />
            </svg>
          </button>
          <button
            type="button"
            className={`pc-align-btn ${style.align === "center" ? "active" : ""}`}
            title="Align Center"
            onClick={() => updateStyle({ align: "center" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2zm2 3.5h8V8H4zm-2 3.5h12v1.5H2zm2 3.5h8V15H4z" />
            </svg>
          </button>
          <button
            type="button"
            className={`pc-align-btn ${style.align === "right" ? "active" : ""}`}
            title="Align Right"
            onClick={() => updateStyle({ align: "right" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2zm4 3.5h8V8H6zm-4 3.5h12v1.5H2zm4 3.5h8V15H6z" />
            </svg>
          </button>
          <button
            type="button"
            className={`pc-align-btn ${(style.align as any) === "justify" ? "active" : ""}`}
            title="Justify"
            onClick={() => updateStyle({ align: "left" })}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 3h12v1.5H2zm0 3.5h12V8H2zm0 3.5h12v1.5H2zm0 3.5h12V15H2z" />
            </svg>
          </button>
        </div>

        <div className="pc-typo-row">
          <label>Padding</label>
          <input
            type="number"
            min="0"
            max="100"
            value={style.padding || 8}
            onChange={(e) => updateStyle({ padding: Number(e.target.value) })}
          />
          <span className="pc-unit">px</span>
        </div>
      </div>
    </div>
  );
}

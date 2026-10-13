/**
 * Color and Swatches Panel matching Photocraft `crates/ui-egui/src/swatches_ui.rs`.
 * Dual foreground/background colors, swatches library and precision color readouts.
 */

import { useState } from "react";
import { useStore } from "../../store/store";
import { rgbToHsl } from "../../lib/adjustments";

const PRESET_SWATCHES = [
  "#000000", "#ffffff", "#e11d48", "#ea580c", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899",
  "#1c1917", "#44403c", "#78716c", "#a8a29e", "#d6d3d1", "#f5f5f4",
  "#fecdd3", "#fed7aa", "#fef08a", "#bbf7d0", "#a5f3fc", "#bfdbfe", "#c7d2fe", "#ddd6fe", "#fbcfe8",
  "#9f1239", "#9a3412", "#854d0e", "#065f46", "#155e75", "#1e40af", "#3730a3", "#5b21b6", "#831843",
];

export function ColorPanel() {
  const [fgColor, setFgColor] = useState("#3b82f6");
  const [bgColor, setBgColor] = useState("#ffffff");
  const selection = useStore((s) => s.selection);
  const doc = useStore((s) => s.doc);

  const swapColors = () => {
    const temp = fgColor;
    setFgColor(bgColor);
    setBgColor(temp);
  };

  const defaultColors = () => {
    setFgColor("#000000");
    setBgColor("#ffffff");
  };

  const applyColorToSelection = (color: string) => {
    setFgColor(color);
    if (selection.length > 0) {
      selection.forEach((id) => {
        const obj = doc.objects[id];
        if (obj) {
          if (obj.type === "text") {
            useStore.getState().patchObject(id, { style: { ...obj.style, color } });
          } else {
            useStore.getState().patchObject(id, { style: { ...obj.style, fill: color } });
          }
        }
      });
    }
  };

  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const c = parseInt(hex.replace("#", ""), 16) || 0;
    return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  };

  const [r, g, b] = hexToRgb(fgColor);
  const [h, s, l] = rgbToHsl(r, g, b);

  return (
    <div className="pc-color-panel">
      {/* 1. Dual Swatches Box */}
      <div className="pc-panel-section">
        <div className="pc-swatch-box-row">
          <div className="pc-dual-swatches">
            <div
              className="pc-bg-swatch"
              style={{ backgroundColor: bgColor }}
              title="Background Color"
              onClick={() => {
                const c = prompt("Background Hex:", bgColor);
                if (c) setBgColor(c);
              }}
            />
            <div
              className="pc-fg-swatch"
              style={{ backgroundColor: fgColor }}
              title="Foreground Color"
            >
              <input
                type="color"
                value={fgColor}
                onChange={(e) => applyColorToSelection(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="pc-swap-btn"
              title="Swap Colors (X)"
              onClick={swapColors}
            >
              ⇄
            </button>
            <button
              type="button"
              className="pc-default-colors-btn"
              title="Default Black & White (D)"
              onClick={defaultColors}
            >
              ◩
            </button>
          </div>

          <div className="pc-color-readouts">
            <div className="pc-readout-row">
              <span className="pc-label">HEX:</span>
              <input
                type="text"
                className="pc-hex-input"
                value={fgColor.toUpperCase()}
                onChange={(e) => applyColorToSelection(e.target.value)}
              />
            </div>
            <div className="pc-rgb-readout">
              <span>R: {r}</span>
              <span>G: {g}</span>
              <span>B: {b}</span>
            </div>
            <div className="pc-hsb-readout">
              <span>H: {Math.round(h)}°</span>
              <span>S: {Math.round(s * 100)}%</span>
              <span>B: {Math.round(l * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Swatches Grid */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Swatches</span>
        </div>
        <div className="pc-swatches-grid">
          {PRESET_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`pc-swatch-cell ${fgColor === hex ? "is-selected" : ""}`}
              style={{ backgroundColor: hex }}
              title={hex}
              onClick={() => applyColorToSelection(hex)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

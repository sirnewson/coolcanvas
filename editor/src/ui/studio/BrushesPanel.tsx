/**
 * Brushes and dynamics panel, following the photo engine's `crates/paint`.
 */

import { useState } from "react";
import { BRUSH_PRESETS, type BrushPreset } from "../../lib/brushEngine";

export function BrushesPanel() {
  const [activePreset, setActivePreset] = useState<BrushPreset>(BRUSH_PRESETS[0]);
  const [size, setSize] = useState(activePreset.size);
  const [hardness, setHardness] = useState(activePreset.hardness);
  const [flow, setFlow] = useState(activePreset.flow);
  const [opacity, setOpacity] = useState(activePreset.opacity);
  const [spacing, setSpacing] = useState(activePreset.spacing);
  const [smoothing, setSmoothing] = useState(activePreset.smoothing);
  const [sizeJitter, setSizeJitter] = useState(activePreset.sizeJitter);
  const [angleJitter, setAngleJitter] = useState(activePreset.angleJitter);
  const [scatter, setScatter] = useState(activePreset.scatter);

  const selectPreset = (p: BrushPreset) => {
    setActivePreset(p);
    setSize(p.size);
    setHardness(p.hardness);
    setFlow(p.flow);
    setOpacity(p.opacity);
    setSpacing(p.spacing);
    setSmoothing(p.smoothing);
    setSizeJitter(p.sizeJitter);
    setAngleJitter(p.angleJitter);
    setScatter(p.scatter);
  };

  return (
    <div className="pc-brushes-panel">
      {/* 1. Presets List */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Brush Presets</span>
        </div>
        <div className="pc-brush-presets-list">
          {BRUSH_PRESETS.map((p) => (
            <div
              key={p.id}
              className={`pc-brush-preset-item ${activePreset.id === p.id ? "is-active" : ""}`}
              onClick={() => selectPreset(p)}
            >
              <div className="pc-brush-tip-preview">
                <div
                  className="pc-tip-dot"
                  style={{
                    width: Math.min(28, p.size),
                    height: Math.min(28, p.size * p.roundness),
                    borderRadius: p.hardness > 0.8 ? "50%" : "50%",
                    filter: p.hardness < 0.5 ? "blur(2px)" : "none",
                  }}
                />
              </div>
              <div className="pc-brush-info">
                <span className="pc-brush-name">{p.name}</span>
                <span className="pc-brush-meta">{p.size} px</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Brush Settings */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Brush Settings</span>
        </div>

        <div className="pc-field-group">
          <div className="pc-slider-row">
            <label>Size</label>
            <input
              type="range"
              min="1"
              max="300"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
            <span>{size} px</span>
          </div>

          <div className="pc-slider-row">
            <label>Hardness</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={hardness}
              onChange={(e) => setHardness(Number(e.target.value))}
            />
            <span>{Math.round(hardness * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Flow</label>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.05"
              value={flow}
              onChange={(e) => setFlow(Number(e.target.value))}
            />
            <span>{Math.round(flow * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Opacity</label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
            <span>{Math.round(opacity * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Spacing</label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
            />
            <span>{Math.round(spacing * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Smoothing</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={smoothing}
              onChange={(e) => setSmoothing(Number(e.target.value))}
            />
            <span>{Math.round(smoothing * 100)}%</span>
          </div>
        </div>
      </div>

      {/* 3. Brush Dynamics */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Brush Dynamics</span>
        </div>

        <div className="pc-field-group">
          <div className="pc-slider-row">
            <label>Size Jitter</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sizeJitter}
              onChange={(e) => setSizeJitter(Number(e.target.value))}
            />
            <span>{Math.round(sizeJitter * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Angle Jitter</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={angleJitter}
              onChange={(e) => setAngleJitter(Number(e.target.value))}
            />
            <span>{Math.round(angleJitter * 100)}%</span>
          </div>

          <div className="pc-slider-row">
            <label>Scatter</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={scatter}
              onChange={(e) => setScatter(Number(e.target.value))}
            />
            <span>{Math.round(scatter * 100)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

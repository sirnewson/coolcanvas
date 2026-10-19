import { useMemo } from "react";
import { useStore } from "../../store/store";
import type { AdjustmentType, CanvasObject } from "../../types";
import {
  ADJUSTMENT_LABELS,
  defaultParamsFor,
  type CurvePoint,
} from "../../lib/adjustments";

const ADJUSTMENT_LIST: { type: AdjustmentType; label: string; icon: string }[] = [
  { type: "brightnessContrast", label: "Brightness / Contrast", icon: "☀️" },
  { type: "levels", label: "Levels", icon: "📊" },
  { type: "curves", label: "Curves", icon: "📈" },
  { type: "exposure", label: "Exposure", icon: "🔆" },
  { type: "vibrance", label: "Vibrance", icon: "🌈" },
  { type: "hueSaturation", label: "Hue / Saturation", icon: "🎨" },
  { type: "colorBalance", label: "Color Balance", icon: "⚖️" },
  { type: "blackAndWhite", label: "Black & White", icon: "◐" },
  { type: "photoFilter", label: "Photo Filter", icon: "📷" },
  { type: "channelMixer", label: "Channel Mixer", icon: "🎛️" },
  { type: "colorLookup", label: "Color Lookup", icon: "🎞️" },
  { type: "invert", label: "Invert", icon: "🔄" },
  { type: "posterize", label: "Posterize", icon: "🪜" },
  { type: "threshold", label: "Threshold", icon: "⬛" },
  { type: "gradientMap", label: "Gradient Map", icon: "🏁" },
  { type: "selectiveColor", label: "Selective Color", icon: "🎯" },
];

export function AdjustmentsPanel() {
  const doc = useStore((s) => s.doc);
  const selection = useStore((s) => s.selection);
  const patchObject = useStore((s) => s.patchObject);
  const addObjects = useStore((s) => s.addObjects);
  const setSelection = useStore((s) => s.setSelection);

  // Check if an adjustment layer is currently selected
  const activeAdjObj = useMemo(() => {
    if (selection.length !== 1) return null;
    const obj = doc.objects[selection[0]];
    return obj?.type === "adjustment" ? obj : null;
  }, [selection, doc]);

  const addAdjustment = (type: AdjustmentType) => {
    const id = `adj_${Date.now()}`;
    const newAdj: CanvasObject = {
      id,
      type: "adjustment",
      name: ADJUSTMENT_LABELS[type],
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
      clippingMask: false,
      style: {
        blend: "normal",
      },
      data: {
        adjustmentType: type,
        adjustmentParams: defaultParamsFor(type),
      },
    };
    addObjects([newAdj]);
    setSelection([id]);
  };

  const updateParams = (patch: any) => {
    if (!activeAdjObj) return;
    patchObject(activeAdjObj.id, {
      data: {
        ...activeAdjObj.data,
        adjustmentParams: {
          ...activeAdjObj.data.adjustmentParams,
          ...patch,
        },
      },
    });
  };

  return (
    <div className="pc-adjustments-panel">
      {/* 1. Header and the adjustments grid */}
      <div className="pc-panel-section">
        <div className="pc-section-header">
          <span className="pc-section-title">Add Adjustment Layer</span>
        </div>
        <div className="pc-adj-grid">
          {ADJUSTMENT_LIST.map((item) => (
            <button
              key={item.type}
              type="button"
              className="pc-adj-tile"
              title={`Add ${item.label}`}
              onClick={() => addAdjustment(item.type)}
            >
              <span className="pc-adj-icon">{item.icon}</span>
              <span className="pc-adj-label">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Active Adjustment Layer Live Editor */}
      {activeAdjObj ? (
        <div className="pc-panel-section pc-adj-editor">
          <div className="pc-section-header">
            <span className="pc-section-title">
              {ADJUSTMENT_LABELS[activeAdjObj.data.adjustmentType as AdjustmentType] || "Adjustment"} Controls
            </span>
            <span className="pc-badge">{activeAdjObj.name}</span>
          </div>

          <div className="pc-adj-controls">
            {activeAdjObj.data.adjustmentType === "curves" && (
              <CurvesEditor
                params={activeAdjObj.data.adjustmentParams}
                onChange={updateParams}
              />
            )}

            {activeAdjObj.data.adjustmentType === "levels" && (
              <LevelsEditor
                params={activeAdjObj.data.adjustmentParams}
                onChange={updateParams}
              />
            )}

            {activeAdjObj.data.adjustmentType === "brightnessContrast" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Brightness</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.brightness ?? 0}
                    onChange={(e) => updateParams({ brightness: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.brightness ?? 0}</span>
                </div>
                <div className="pc-slider-row">
                  <label>Contrast</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.contrast ?? 0}
                    onChange={(e) => updateParams({ contrast: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.contrast ?? 0}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "vibrance" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Vibrance</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.vibrance ?? 25}
                    onChange={(e) => updateParams({ vibrance: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.vibrance ?? 25}</span>
                </div>
                <div className="pc-slider-row">
                  <label>Saturation</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.saturation ?? 0}
                    onChange={(e) => updateParams({ saturation: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.saturation ?? 0}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "hueSaturation" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Hue</label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={activeAdjObj.data.adjustmentParams?.hue ?? 0}
                    onChange={(e) => updateParams({ hue: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.hue ?? 0}°</span>
                </div>
                <div className="pc-slider-row">
                  <label>Saturation</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.saturation ?? 0}
                    onChange={(e) => updateParams({ saturation: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.saturation ?? 0}</span>
                </div>
                <div className="pc-slider-row">
                  <label>Lightness</label>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={activeAdjObj.data.adjustmentParams?.lightness ?? 0}
                    onChange={(e) => updateParams({ lightness: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.lightness ?? 0}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "exposure" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Exposure</label>
                  <input
                    type="range"
                    min="-5"
                    max="5"
                    step="0.05"
                    value={activeAdjObj.data.adjustmentParams?.exposure ?? 0}
                    onChange={(e) => updateParams({ exposure: Number(e.target.value) })}
                  />
                  <span>{(activeAdjObj.data.adjustmentParams?.exposure ?? 0).toFixed(2)} EV</span>
                </div>
                <div className="pc-slider-row">
                  <label>Offset</label>
                  <input
                    type="range"
                    min="-0.5"
                    max="0.5"
                    step="0.01"
                    value={activeAdjObj.data.adjustmentParams?.offset ?? 0}
                    onChange={(e) => updateParams({ offset: Number(e.target.value) })}
                  />
                  <span>{(activeAdjObj.data.adjustmentParams?.offset ?? 0).toFixed(2)}</span>
                </div>
                <div className="pc-slider-row">
                  <label>Gamma</label>
                  <input
                    type="range"
                    min="0.2"
                    max="5.0"
                    step="0.05"
                    value={activeAdjObj.data.adjustmentParams?.gamma ?? 1.0}
                    onChange={(e) => updateParams({ gamma: Number(e.target.value) })}
                  />
                  <span>{(activeAdjObj.data.adjustmentParams?.gamma ?? 1.0).toFixed(2)}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "blackAndWhite" && (
              <div className="pc-field-group">
                {["reds", "yellows", "greens", "cyans", "blues", "magentas"].map((channel) => (
                  <div key={channel} className="pc-slider-row">
                    <label style={{ textTransform: "capitalize" }}>{channel}</label>
                    <input
                      type="range"
                      min="-200"
                      max="300"
                      value={activeAdjObj.data.adjustmentParams?.[channel] ?? 50}
                      onChange={(e) => updateParams({ [channel]: Number(e.target.value) })}
                    />
                    <span>{activeAdjObj.data.adjustmentParams?.[channel] ?? 50}</span>
                  </div>
                ))}
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "threshold" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Threshold</label>
                  <input
                    type="range"
                    min="1"
                    max="255"
                    value={activeAdjObj.data.adjustmentParams?.threshold ?? 128}
                    onChange={(e) => updateParams({ threshold: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.threshold ?? 128}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "posterize" && (
              <div className="pc-field-group">
                <div className="pc-slider-row">
                  <label>Levels</label>
                  <input
                    type="range"
                    min="2"
                    max="32"
                    value={activeAdjObj.data.adjustmentParams?.levels ?? 4}
                    onChange={(e) => updateParams({ levels: Number(e.target.value) })}
                  />
                  <span>{activeAdjObj.data.adjustmentParams?.levels ?? 4}</span>
                </div>
              </div>
            )}

            {activeAdjObj.data.adjustmentType === "invert" && (
              <div className="pc-info-text">
                Invert adjustment reverses all RGB pixel values.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pc-empty-hint">
          Select or add an adjustment layer to configure live non-destructive parameters.
        </div>
      )}
    </div>
  );
}

/** Interactive Curves Spline Editor */
function CurvesEditor({
  params,
  onChange,
}: {
  params: any;
  onChange: (patch: any) => void;
}) {
  const points: CurvePoint[] = params?.points || [{ x: 0, y: 0 }, { x: 1, y: 1 }];

  const setPreset = (preset: string) => {
    switch (preset) {
      case "linear":
        onChange({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] });
        break;
      case "contrast":
        onChange({ points: [{ x: 0, y: 0 }, { x: 0.25, y: 0.15 }, { x: 0.75, y: 0.85 }, { x: 1, y: 1 }] });
        break;
      case "darken":
        onChange({ points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.3 }, { x: 1, y: 1 }] });
        break;
      case "lighten":
        onChange({ points: [{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }] });
        break;
      case "negative":
        onChange({ points: [{ x: 0, y: 1 }, { x: 1, y: 0 }] });
        break;
    }
  };

  const svgPoints = points
    .map((p) => `${p.x * 200},${(1 - p.y) * 200}`)
    .join(" ");

  return (
    <div className="pc-curves-box">
      <div className="pc-curves-header">
        <label>Preset:</label>
        <select onChange={(e) => setPreset(e.target.value)}>
          <option value="linear">Default (Linear)</option>
          <option value="contrast">High Contrast (S-Curve)</option>
          <option value="darken">Darken</option>
          <option value="lighten">Lighten</option>
          <option value="negative">Negative</option>
        </select>
      </div>

      <div className="pc-curves-graph">
        <svg viewBox="0 0 200 200" className="pc-curves-svg">
          {/* Grid lines */}
          <line x1="50" y1="0" x2="50" y2="200" stroke="#333" strokeDasharray="2,2" />
          <line x1="100" y1="0" x2="100" y2="200" stroke="#444" strokeDasharray="2,2" />
          <line x1="150" y1="0" x2="150" y2="200" stroke="#333" strokeDasharray="2,2" />
          <line x1="0" y1="50" x2="200" y2="50" stroke="#333" strokeDasharray="2,2" />
          <line x1="0" y1="100" x2="200" y2="100" stroke="#444" strokeDasharray="2,2" />
          <line x1="0" y1="150" x2="200" y2="150" stroke="#333" strokeDasharray="2,2" />
          <line x1="0" y1="200" x2="200" y2="0" stroke="#2a2a2a" />

          {/* Polyline / Spline */}
          <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" points={svgPoints} />

          {/* Points */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x * 200}
              cy={(1 - p.y) * 200}
              r="5"
              fill="#ffffff"
              stroke="#2563eb"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>
      <div className="pc-curves-footer">
        <span>In: {(points[0]?.x * 255).toFixed(0)}</span>
        <span>Out: {(points[0]?.y * 255).toFixed(0)}</span>
      </div>
    </div>
  );
}

/** Interactive Levels Histogram & Sliders */
function LevelsEditor({
  params,
  onChange,
}: {
  params: any;
  onChange: (patch: any) => void;
}) {
  const inBlack = params?.inBlack ?? 0;
  const inWhite = params?.inWhite ?? 255;
  const gamma = params?.gamma ?? 1.0;
  const outBlack = params?.outBlack ?? 0;
  const outWhite = params?.outWhite ?? 255;

  return (
    <div className="pc-levels-box">
      {/* Histogram placeholder representation */}
      <div className="pc-histogram">
        <svg viewBox="0 0 255 60" preserveAspectRatio="none">
          <path
            d="M 0 60 Q 40 20 80 40 T 160 10 T 255 60 Z"
            fill="#3a3a42"
          />
        </svg>
      </div>

      <div className="pc-levels-inputs">
        <label>Input Levels:</label>
        <div className="pc-levels-row">
          <input
            type="number"
            min="0"
            max="255"
            value={inBlack}
            onChange={(e) => onChange({ inBlack: Number(e.target.value) })}
          />
          <input
            type="number"
            min="0.1"
            max="9.9"
            step="0.05"
            value={gamma}
            onChange={(e) => onChange({ gamma: Number(e.target.value) })}
          />
          <input
            type="number"
            min="0"
            max="255"
            value={inWhite}
            onChange={(e) => onChange({ inWhite: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="pc-levels-inputs">
        <label>Output Levels:</label>
        <div className="pc-levels-row">
          <input
            type="number"
            min="0"
            max="255"
            value={outBlack}
            onChange={(e) => onChange({ outBlack: Number(e.target.value) })}
          />
          <div style={{ flex: 1 }} />
          <input
            type="number"
            min="0"
            max="255"
            value={outWhite}
            onChange={(e) => onChange({ outWhite: Number(e.target.value) })}
          />
        </div>
      </div>
    </div>
  );
}

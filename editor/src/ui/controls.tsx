import { useEffect, useRef, useState, type ReactNode } from "react";

/* ------------------------------------------------------------------ helpers */

// Helper to convert hex to {r, g, b, a}
export function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) c = c.split("").map((x) => x + x).join("") + "ff";
  if (c.length === 6) c = c + "ff";
  if (c.length !== 8) return { r: 0, g: 0, b: 0, a: 1 };
  const num = parseInt(c, 16);
  return {
    r: (num >> 24) & 255,
    g: (num >> 16) & 255,
    b: (num >> 8) & 255,
    a: Math.round(((num & 255) / 255) * 100) / 100,
  };
}

// Convert rgba to hex (#rrggbbaa or #rrggbb)
export function rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a >= 0.999) return hex;
  return `${hex}${toHex(a * 255)}`;
}

// RGB to HSV
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

// HSV to RGB
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = (h % 360) / 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  v = Math.max(0, Math.min(100, v)) / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/* ------------------------------------------------------------------ layout */

export function Section({
  title,
  children,
  aside,
  icon,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  icon?: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`pc-ctrl-section ${open ? "is-open" : "is-collapsed"}`}>
      <header className="pc-ctrl-section-head" onClick={() => setOpen((v) => !v)}>
        <div className="pc-ctrl-section-title">
          {icon && <span className="pc-ctrl-section-icon">{icon}</span>}
          <h3>{title}</h3>
        </div>
        <div className="pc-ctrl-section-right">
          {aside && <div className="pc-ctrl-section-aside" onClick={(e) => e.stopPropagation()}>{aside}</div>}
          <svg
            className={`pc-ctrl-chevron ${open ? "is-open" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
          </svg>
        </div>
      </header>
      {open && <div className="pc-ctrl-section-body">{children}</div>}
    </section>
  );
}

export function Row({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="pc-ctrl-row">
      {label && <span className="pc-ctrl-label">{label}</span>}
      <div className="pc-ctrl-content">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ number */

export interface NumberFieldProps {
  value: number | null;
  onChange(value: number): void;
  onCommit?(): void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  precision?: number;
  title?: string;
  className?: string;
}

/**
 * Professional number field with drag-to-scrub label, arrow key increment,
 * Shift x10 multiplier, and Escape to cancel.
 */
export function NumberField({
  value,
  onChange,
  onCommit,
  label,
  min = -1e6,
  max = 1e6,
  step = 1,
  suffix,
  precision = 0,
  title,
  className = "",
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const scrub = useRef<{ startX: number; startValue: number } | null>(null);

  const display =
    draft ??
    (value === null
      ? "—"
      : String(precision ? Math.round(value * 10 ** precision) / 10 ** precision : Math.round(value)));

  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
    setDraft(null);
    onCommit?.();
  };

  useEffect(() => {
    if (!scrub.current) return;
    const move = (e: PointerEvent) => {
      const s = scrub.current;
      if (!s) return;
      const delta = (e.clientX - s.startX) * step * (e.shiftKey ? 10 : 1);
      onChange(Math.max(min, Math.min(max, s.startValue + delta)));
    };
    const up = () => {
      scrub.current = null;
      onCommit?.();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  });

  return (
    <label className={`pc-num-field ${className}`} title={title ?? label}>
      {label && (
        <span
          className="pc-num-tag"
          onPointerDown={(e) => {
            e.preventDefault();
            scrub.current = { startX: e.clientX, startValue: value ?? 0 };
          }}
        >
          {label}
        </span>
      )}
      <input
        className="pc-num-input"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const dir = e.key === "ArrowUp" ? 1 : -1;
            const amount = e.shiftKey ? 10 : 1;
            onChange(Math.max(min, Math.min(max, (value ?? 0) + dir * step * amount)));
            onCommit?.();
          }
        }}
        inputMode="decimal"
      />
      {suffix && <span className="pc-num-suffix">{suffix}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ slider */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  format,
  defaultValue,
}: {
  value: number;
  onChange(v: number): void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  format?(v: number): string;
  defaultValue?: number;
}) {
  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="pc-slider-container">
      {label && <span className="pc-slider-label">{label}</span>}
      <div className="pc-slider-track-wrap">
        <div className="pc-slider-track">
          <div className="pc-slider-fill" style={{ width: `${percentage}%` }} />
        </div>
        <input
          type="range"
          className="pc-slider-input"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
        />
      </div>
      <span
        className="pc-slider-val"
        onDoubleClick={() => defaultValue !== undefined && onChange(defaultValue)}
      >
        {format ? format(value) : value}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------- segmented */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  compact,
}: {
  value: T | null;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange(v: T): void;
  compact?: boolean;
}) {
  return (
    <div className={`pc-segmented ${compact ? "is-compact" : ""}`} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          className={`pc-seg-item ${value === o.value ? "is-active" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------- color */

const DEFAULT_RECENT_COLORS = [
  "#ffffff", "#000000", "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
  "#64748b", "#38bdf8", "#a855f7", "#e2e8f0"
];

/**
 * Professional Studio Color Picker with 2D Saturation/Brightness canvas,
 * Hue & Alpha sliders, Hex / RGB mode, Recent colours and preset swatches.
 */
export function ColorField({
  value,
  swatches,
  onChange,
  allowNone,
  label,
  compactDisc,
}: {
  value: string | undefined;
  swatches: { hex: string; name: string }[];
  onChange(hex: string): void;
  allowNone?: boolean;
  label?: string;
  compactDisc?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const satBoxRef = useRef<HTMLDivElement | null>(null);

  const isNone = !value || value === "transparent" || value === "none";
  const rgba = isNone ? { r: 59, g: 130, b: 246, a: 1 } : hexToRgba(value);
  const initialHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);

  const [hue, setHue] = useState(initialHsv.h);
  const [sat, setSat] = useState(initialHsv.s);
  const [val, setVal] = useState(initialHsv.v);
  const [alpha, setAlpha] = useState(rgba.a);
  const [hexInput, setHexInput] = useState(isNone ? "" : value.toUpperCase());
  const [mode, setMode] = useState<"HEX" | "RGB">("HEX");

  // Keep internal state updated when value prop changes externally
  useEffect(() => {
    if (!isNone && value) {
      const c = hexToRgba(value);
      const hsv = rgbToHsv(c.r, c.g, c.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      setAlpha(c.a);
      setHexInput(value.toUpperCase());
    }
  }, [value, isNone]);

  // Close popup on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Handle 2D Saturation/Value Dragging
  const handleSatBoxMove = (clientX: number, clientY: number) => {
    if (!satBoxRef.current) return;
    const rect = satBoxRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const newSat = Math.round((x / rect.width) * 100);
    const newVal = Math.round((1 - y / rect.height) * 100);

    setSat(newSat);
    setVal(newVal);

    const rgb = hsvToRgb(hue, newSat, newVal);
    const hex = rgbaToHex(rgb.r, rgb.g, rgb.b, alpha);
    setHexInput(hex.toUpperCase());
    onChange(hex);
  };

  const onSatBoxPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    handleSatBoxMove(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      handleSatBoxMove(ev.clientX, ev.clientY);
    };
    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleHueChange = (newHue: number) => {
    setHue(newHue);
    const rgb = hsvToRgb(newHue, sat, val);
    const hex = rgbaToHex(rgb.r, rgb.g, rgb.b, alpha);
    setHexInput(hex.toUpperCase());
    onChange(hex);
  };

  const handleAlphaChange = (newAlpha: number) => {
    setAlpha(newAlpha);
    const rgb = hsvToRgb(hue, sat, val);
    const hex = rgbaToHex(rgb.r, rgb.g, rgb.b, newAlpha);
    setHexInput(hex.toUpperCase());
    onChange(hex);
  };

  const handleHexCommit = (raw: string) => {
    let clean = raw.trim();
    if (!clean.startsWith("#")) clean = "#" + clean;
    if (/^#[0-9a-f]{3,8}$/i.test(clean)) {
      onChange(clean);
      setHexInput(clean.toUpperCase());
      const c = hexToRgba(clean);
      const hsv = rgbToHsv(c.r, c.g, c.b);
      setHue(hsv.h);
      setSat(hsv.s);
      setVal(hsv.v);
      setAlpha(c.a);
    }
  };

  // Pure hue colour for background of 2D picker
  const pureHueRgb = hsvToRgb(hue, 100, 100);
  const pureHueHex = rgbaToHex(pureHueRgb.r, pureHueRgb.g, pureHueRgb.b);

  return (
    <div className="pc-colorfield-wrapper" ref={ref}>
      <button
        type="button"
        className={`pc-color-trigger ${isNone ? "is-none" : ""} ${compactDisc ? "is-disc" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={label ?? (isNone ? "None" : value)}
      >
        <span
          className="pc-color-swatch-inner"
          style={isNone ? undefined : { backgroundColor: value }}
        />
        {!compactDisc && (
          <span className="pc-color-val-label">{isNone ? "None" : (value ?? "#000000").toUpperCase()}</span>
        )}
      </button>

      {open && (
        <div className="pc-color-popover" role="dialog">
          {/* 1. 2D Saturation / Value Area */}
          <div
            className="pc-sat-box"
            ref={satBoxRef}
            style={{ backgroundColor: pureHueHex }}
            onPointerDown={onSatBoxPointerDown}
          >
            <div className="pc-sat-white-grad" />
            <div className="pc-sat-black-grad" />
            <div
              className="pc-sat-handle"
              style={{
                left: `${sat}%`,
                top: `${100 - val}%`,
                backgroundColor: isNone ? "#ffffff" : value,
              }}
            />
          </div>

          {/* 2. Sliders and Preview */}
          <div className="pc-color-sliders-row">
            <div className="pc-color-preview-circle">
              <span
                className={`pc-color-preview-fill ${isNone ? "is-none" : ""}`}
                style={isNone ? undefined : { backgroundColor: value }}
              />
            </div>
            <div className="pc-color-sliders-col">
              {/* Hue Slider */}
              <div className="pc-hue-slider-track">
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={hue}
                  onChange={(e) => handleHueChange(Number(e.target.value))}
                  className="pc-hue-input"
                />
              </div>

              {/* Alpha Slider */}
              <div className="pc-alpha-slider-track">
                <div
                  className="pc-alpha-grad"
                  style={{
                    background: `linear-gradient(to right, transparent, ${pureHueHex})`,
                  }}
                />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={alpha}
                  onChange={(e) => handleAlphaChange(Number(e.target.value))}
                  className="pc-alpha-input"
                />
              </div>
            </div>
          </div>

          {/* 3. Numeric & Mode Inputs */}
          <div className="pc-color-inputs-bar">
            <button
              type="button"
              className="pc-mode-toggle-btn"
              onClick={() => setMode((m) => (m === "HEX" ? "RGB" : "HEX"))}
            >
              {mode}
            </button>
            {mode === "HEX" ? (
              <div className="pc-hex-input-group">
                <span className="pc-hex-prefix">#</span>
                <input
                  className="pc-hex-text-input"
                  value={hexInput.replace("#", "")}
                  onChange={(e) => setHexInput("#" + e.target.value)}
                  onBlur={(e) => handleHexCommit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleHexCommit((e.target as HTMLInputElement).value);
                  }}
                  spellCheck={false}
                />
                <span className="pc-alpha-percent">{Math.round(alpha * 100)}%</span>
              </div>
            ) : (
              <div className="pc-rgb-inputs-group">
                <input
                  className="pc-rgb-part"
                  type="number"
                  min={0}
                  max={255}
                  value={rgba.r}
                  onChange={(e) => {
                    const r = Math.max(0, Math.min(255, Number(e.target.value)));
                    const hex = rgbaToHex(r, rgba.g, rgba.b, alpha);
                    onChange(hex);
                  }}
                />
                <input
                  className="pc-rgb-part"
                  type="number"
                  min={0}
                  max={255}
                  value={rgba.g}
                  onChange={(e) => {
                    const g = Math.max(0, Math.min(255, Number(e.target.value)));
                    const hex = rgbaToHex(rgba.r, g, rgba.b, alpha);
                    onChange(hex);
                  }}
                />
                <input
                  className="pc-rgb-part"
                  type="number"
                  min={0}
                  max={255}
                  value={rgba.b}
                  onChange={(e) => {
                    const b = Math.max(0, Math.min(255, Number(e.target.value)));
                    const hex = rgbaToHex(rgba.r, rgba.g, b, alpha);
                    onChange(hex);
                  }}
                />
              </div>
            )}
          </div>

          {/* 4. Swatches and None Option */}
          <div className="pc-color-swatches-section">
            <div className="pc-swatches-grid-header">
              <span>Swatches</span>
              {allowNone && (
                <button
                  type="button"
                  className={`pc-none-swatch-btn ${isNone ? "is-active" : ""}`}
                  onClick={() => {
                    onChange("transparent");
                    setOpen(false);
                  }}
                >
                  None (transparent)
                </button>
              )}
            </div>
            <div className="pc-swatches-scroll-grid">
              {(swatches.length > 0 ? swatches.map((s) => s.hex) : DEFAULT_RECENT_COLORS)
                .filter((h) => h !== "transparent")
                .map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`pc-swatch-tile ${value?.toLowerCase() === hex.toLowerCase() ? "is-selected" : ""}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => {
                      onChange(hex);
                      setOpen(false);
                    }}
                    title={hex}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- stroke control */

export interface StrokeControlProps {
  color: string | undefined;
  width: number;
  dash: "solid" | "dashed" | "dotted";
  onColorChange(color: string): void;
  onWidthChange(width: number): void;
  onDashChange(dash: "solid" | "dashed" | "dotted"): void;
  swatches?: { hex: string; name: string }[];
}

/**
 * Dedicated professional StrokeControl component uniting stroke colour,
 * width input, and dash pattern selectors into an integrated compact row.
 */
export function StrokeControl({
  color,
  width,
  dash,
  onColorChange,
  onWidthChange,
  onDashChange,
  swatches = [],
}: StrokeControlProps) {
  const dashes: { value: "solid" | "dashed" | "dotted"; icon: string; title: string }[] = [
    { value: "solid", icon: "—", title: "Solid line" },
    { value: "dashed", icon: "╌", title: "Dashed line" },
    { value: "dotted", icon: "···", title: "Dotted line" },
  ];

  return (
    <div className="pc-stroke-control-box">
      <div className="pc-stroke-main-row">
        <ColorField
          value={color}
          swatches={swatches}
          allowNone
          onChange={onColorChange}
          label="Stroke color"
        />
        <NumberField
          value={width}
          min={0}
          max={64}
          step={0.5}
          precision={1}
          suffix="px"
          onChange={onWidthChange}
          className="pc-stroke-width-field"
        />
      </div>
      <div className="pc-stroke-dash-row">
        <Segmented
          compact
          value={dash}
          options={dashes.map((d) => ({
            value: d.value,
            label: <span className="pc-dash-sample">{d.icon}</span>,
            title: d.title,
          }))}
          onChange={onDashChange}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ toggle */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange(v: boolean): void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="pc-toggle-label" title={hint}>
      <input
        type="checkbox"
        className="pc-toggle-hidden-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="pc-toggle-switch" aria-hidden />
      <span className="pc-toggle-text">{label}</span>
    </label>
  );
}

export function IconButton({
  onClick,
  title,
  active,
  children,
  danger,
}: {
  onClick(): void;
  title: string;
  active?: boolean;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`pc-icon-btn ${active ? "is-active" : ""} ${danger ? "is-danger" : ""}`}
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export { FontPicker } from "./FontPicker";

/* ------------------------------------------------------------- capsule controls */

export function CapsuleRow({
  label,
  children,
  divider = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  divider?: boolean;
  className?: string;
}) {
  return (
    <div className={`pc-capsule-row ${className}`}>
      <span className="pc-capsule-label">
        {label}
        {divider && <span className="pc-capsule-divider" />}
      </span>
      <div className="pc-capsule-content">{children}</div>
    </div>
  );
}

export function CapsuleSlider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange(v: number): void;
}) {
  const percent = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  return (
    <div className="pc-capsule-row pc-capsule-slider-row">
      <span className="pc-capsule-label">
        {label}
        <span className="pc-capsule-divider" />
      </span>
      <div className="pc-capsule-slider-track-wrap">
        <div className="pc-capsule-slider-fill" style={{ width: `${percent}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pc-capsule-slider-input"
        />
      </div>
      <span className="pc-capsule-value-readout">
        {value}
        {suffix && <small>{suffix}</small>}
      </span>
    </div>
  );
}

export function CapsuleColor({
  label,
  value,
  onChange,
  swatches = [],
  allowNone = false,
  extra,
}: {
  label: string;
  value: string | undefined;
  onChange(c: string): void;
  swatches?: { hex: string; name: string }[];
  allowNone?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="pc-capsule-row">
      <span className="pc-capsule-label">{label}</span>
      <div className="pc-capsule-color-actions">
        {extra}
        <ColorField
          value={value}
          onChange={onChange}
          swatches={swatches}
          allowNone={allowNone}
          compactDisc
        />
      </div>
    </div>
  );
}


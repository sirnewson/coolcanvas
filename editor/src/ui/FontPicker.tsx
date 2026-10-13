import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FontDef,
  getSavedScannedFonts,
  queryLocalWindowsFonts,
  loadFontFromFile,
  getAllAvailableFonts,
} from "../lib/fonts";
import { resolveFontFamily, FONT_LABELS } from "../lib/theme";

export interface FontPickerProps {
  value: string;
  onChange(fontFamily: string): void;
  className?: string;
  label?: string;
}

export function FontPicker({ value, onChange, className = "" }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [scannedFonts, setScannedFonts] = useState<FontDef[]>([]);
  const [customFonts, setCustomFonts] = useState<FontDef[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Restore saved local fonts from previous sessions
  useEffect(() => {
    const saved = getSavedScannedFonts();
    if (saved.length > 0) {
      setScannedFonts(saved);
    }
  }, []);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  // Focus search input when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearch("");
      setStatusMsg(null);
    }
  }, [open]);

  // Build combined list
  const allFonts = useMemo(() => {
    return getAllAvailableFonts(scannedFonts, customFonts);
  }, [scannedFonts, customFonts]);

  // Filter fonts by search and category tab
  const filteredFonts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allFonts.filter((f) => {
      const matchSearch = !q || f.name.toLowerCase().includes(q) || f.family.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (category === "all") return true;
      if (category === "user") return f.category === "user" || f.badge?.includes("User");
      if (category === "windows") return f.category === "windows" || f.local;
      if (category === "web") return f.category === "web";
      if (category === "display") return f.category === "display";
      if (category === "serif") return f.category === "serif";
      if (category === "script") return f.category === "script";
      if (category === "mono") return f.category === "mono";
      return true;
    });
  }, [allFonts, search, category]);

  // Handle local Windows font scanning via Chrome / Edge Local Font Access API
  async function handleScanLocalFonts() {
    setIsScanning(true);
    setStatusMsg(null);
    try {
      const localList = await queryLocalWindowsFonts();
      setScannedFonts(localList);
      setStatusMsg({
        text: `Successfully indexed ${localList.length} local Windows fonts!`,
      });
      setCategory("windows");
    } catch (err: any) {
      setStatusMsg({
        text: err.message || "Failed to access local fonts.",
        error: true,
      });
    } finally {
      setIsScanning(false);
    }
  }

  // Handle manual font file picker
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const loaded = await loadFontFromFile(file);
      setCustomFonts((prev) => [loaded, ...prev]);
      onChange(loaded.family);
      setStatusMsg({ text: `Loaded font: ${loaded.name}` });
      setOpen(false);
    } catch (err: any) {
      setStatusMsg({ text: `Could not load font file: ${err.message}`, error: true });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Find human-readable label of current value
  const displayLabel = useMemo(() => {
    if ((FONT_LABELS as any)[value]) return (FONT_LABELS as any)[value];
    const match = allFonts.find((f) => f.family.toLowerCase() === value.toLowerCase() || f.id === value);
    if (match) return match.name;
    return value || "Sans";
  }, [value, allFonts]);

  const resolvedFamily = resolveFontFamily(value);

  return (
    <div className={`pc-font-picker-wrap ${className}`} ref={containerRef}>
      {/* Hidden file input for font files */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".ttf,.otf,.woff,.woff2"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Trigger Button */}
      <button
        type="button"
        className="pc-font-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title={`Selected font: ${displayLabel}`}
      >
        <span className="pc-font-trigger-preview" style={{ fontFamily: resolvedFamily }}>
          Aa
        </span>
        <span className="pc-font-trigger-label" style={{ fontFamily: resolvedFamily }}>
          {displayLabel}
        </span>
        <svg
          className={`pc-font-trigger-chevron ${open ? "is-open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {/* Advanced Font Dropdown Popover */}
      {open && (
        <div className="pc-font-popover">
          {/* Top Search & Actions Bar */}
          <div className="pc-font-search-bar">
            <div className="pc-font-search-input-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search fonts (e.g. Akira, Segoe, Arial)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pc-font-search-field"
              />
              {search && (
                <button
                  type="button"
                  className="pc-font-search-clear"
                  onClick={() => setSearch("")}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Quick System & File Access Action Buttons */}
          <div className="pc-font-action-pills">
            <button
              type="button"
              className={`pc-font-scan-btn ${isScanning ? "is-loading" : ""}`}
              onClick={handleScanLocalFonts}
              disabled={isScanning}
              title="Access all installed Windows fonts via the browser Local Font Access API"
            >
              <span className="pc-font-btn-icon">⚡</span>
              {isScanning
                ? "Scanning Windows..."
                : scannedFonts.length > 0
                ? `Update Windows Fonts (${scannedFonts.length})`
                : "Access Windows Fonts"}
            </button>
            <button
              type="button"
              className="pc-font-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Pick any .ttf, .otf, or .woff font file from your Windows font folder"
            >
              <span className="pc-font-btn-icon">📁</span>
              Load Font File
            </button>
          </div>

          {/* Status Message (if any) */}
          {statusMsg && (
            <div className={`pc-font-status-banner ${statusMsg.error ? "is-error" : "is-success"}`}>
              {statusMsg.text}
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="pc-font-category-tabs">
            {[
              { id: "all", label: "All" },
              { id: "user", label: "User Fonts" },
              { id: "windows", label: "Windows" },
              { id: "web", label: "Web / Sans" },
              { id: "serif", label: "Serif" },
              { id: "display", label: "Display" },
              { id: "script", label: "Script" },
              { id: "mono", label: "Mono" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`pc-font-cat-tab ${category === tab.id ? "is-active" : ""}`}
                onClick={() => setCategory(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable Font List */}
          <div className="pc-font-list-scroll">
            {filteredFonts.length === 0 ? (
              <div className="pc-font-empty">
                <p>No fonts found matching &ldquo;{search}&rdquo;</p>
                <button
                  type="button"
                  className="pc-font-link-btn"
                  onClick={() => {
                    setSearch("");
                    setCategory("all");
                  }}
                >
                  Show all fonts
                </button>
              </div>
            ) : (
              filteredFonts.map((f) => {
                const isSelected =
                  value.toLowerCase() === f.family.toLowerCase() ||
                  value.toLowerCase() === f.id.toLowerCase();
                const fontStack = resolveFontFamily(f.family);

                return (
                  <div
                    key={f.id}
                    className={`pc-font-row-item ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      onChange(f.family);
                      setOpen(false);
                    }}
                  >
                    <div className="pc-font-row-header">
                      <span className="pc-font-row-name">{f.name}</span>
                      {f.badge && <span className="pc-font-row-badge">{f.badge}</span>}
                    </div>
                    <div
                      className="pc-font-row-specimen"
                      style={{ fontFamily: fontStack }}
                    >
                      The quick brown fox jumps over the lazy dog
                    </div>
                    {isSelected && (
                      <span className="pc-font-row-check">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="pc-font-footer-note">
            <span>Tip: Click &quot;Load Font File&quot; to pick from your custom font folder.</span>
          </div>
        </div>
      )}
    </div>
  );
}

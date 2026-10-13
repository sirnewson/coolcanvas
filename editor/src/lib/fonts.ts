export interface FontDef {
  id: string;
  name: string;
  family: string;
  category: "all" | "user" | "windows" | "web" | "serif" | "display" | "script" | "mono";
  badge?: string;
  preview?: string;
  local?: boolean;
}

/** Pre-curated standout fonts copied from the user's personal font folder into public/fonts */
export const USER_STANDOUT_FONTS: FontDef[] = [
  { id: "akira", name: "Akira Expanded", family: "Akira Expanded", category: "display", badge: "User Font" },
  { id: "agatho", name: "Agatho", family: "Agatho", category: "serif", badge: "User Font" },
  { id: "8bit", name: "8-Bit Operator", family: "8bit Operator", category: "display", badge: "Retro Pixel" },
  { id: "american-sig", name: "American Signature", family: "American Signature", category: "script", badge: "Handmade" },
  { id: "bebas", name: "Bebas Neue", family: "Bebas Neue", category: "display", badge: "Condensed" },
  { id: "caveat", name: "Caveat", family: "Caveat", category: "script", badge: "Casual" },
  { id: "cinzel", name: "Cinzel", family: "Cinzel", category: "serif", badge: "Editorial" },
  { id: "lobster", name: "Lobster", family: "Lobster", category: "script", badge: "Bold Script" },
  { id: "montserrat", name: "Montserrat", family: "Montserrat", category: "web", badge: "Clean Sans" },
  { id: "playfair", name: "Playfair Display", family: "Playfair Display", category: "serif", badge: "Classic Serif" },
  { id: "alcubierre", name: "Alcubierre", family: "Alcubierre", category: "web", badge: "Minimal Sans" },
  { id: "aclonica", name: "Aclonica", family: "Aclonica", category: "display", badge: "Modern Tech" },
];

/** Standard Windows system typography installed on Windows machines */
export const WINDOWS_SYSTEM_FONTS: FontDef[] = [
  { id: "segoe-ui", name: "Segoe UI", family: "Segoe UI", category: "windows", badge: "Windows Default" },
  { id: "calibri", name: "Calibri", family: "Calibri", category: "windows", badge: "Modern Sans" },
  { id: "arial", name: "Arial", family: "Arial", category: "windows", badge: "Standard Sans" },
  { id: "bahnschrift", name: "Bahnschrift", family: "Bahnschrift", category: "windows", badge: "DIN Variable" },
  { id: "century-gothic", name: "Century Gothic", family: "Century Gothic", category: "windows", badge: "Geometric" },
  { id: "franklin-gothic", name: "Franklin Gothic Medium", family: "Franklin Gothic Medium", category: "windows", badge: "Grotesque" },
  { id: "trebuchet", name: "Trebuchet MS", family: "Trebuchet MS", category: "windows", badge: "Humanist" },
  { id: "verdana", name: "Verdana", family: "Verdana", category: "windows", badge: "Wide Sans" },
  { id: "georgia", name: "Georgia", family: "Georgia", category: "serif", badge: "Book Serif" },
  { id: "times", name: "Times New Roman", family: "Times New Roman", category: "serif", badge: "Classic Roman" },
  { id: "palatino", name: "Palatino Linotype", family: "Palatino Linotype", category: "serif", badge: "Literary" },
  { id: "impact", name: "Impact", family: "Impact", category: "display", badge: "Heavy Poster" },
  { id: "consolas", name: "Consolas", family: "Consolas", category: "mono", badge: "Windows Code" },
  { id: "courier-new", name: "Courier New", family: "Courier New", category: "mono", badge: "Typewriter" },
  { id: "comic-sans", name: "Comic Sans MS", family: "Comic Sans MS", category: "script", badge: "Informal" },
  { id: "gabriola", name: "Gabriola", family: "Gabriola", category: "script", badge: "Flourish" },
  { id: "ink-free", name: "Ink Free", family: "Ink Free", category: "script", badge: "Handwritten" },
  { id: "segoe-script", name: "Segoe Script", family: "Segoe Script", category: "script", badge: "Cursive" },
];

/** Popular web and creative typography */
export const WEB_FONTS: FontDef[] = [
  { id: "inter", name: "Inter", family: "Inter", category: "web", badge: "UI Standard" },
  { id: "roboto", name: "Roboto", family: "Roboto", category: "web", badge: "Modern Neo" },
  { id: "poppins", name: "Poppins", family: "Poppins", category: "web", badge: "Geometric" },
  { id: "oswald", name: "Oswald", family: "Oswald", category: "display", badge: "Tall Header" },
  { id: "space-grotesk", name: "Space Grotesk", family: "Space Grotesk", category: "web", badge: "Brutalist" },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: "JetBrains Mono", category: "mono", badge: "Developer" },
  { id: "syne", name: "Syne", family: "Syne", category: "display", badge: "Art Direction" },
];

/** Core canvas presets for legacy compatibility */
export const PRESET_FONTS: FontDef[] = [
  { id: "sans", name: "Sans (Inter / Segoe UI)", family: "sans", category: "web", badge: "Preset" },
  { id: "serif", name: "Serif (Georgia / Palatino)", family: "serif", category: "serif", badge: "Preset" },
  { id: "display", name: "Display (Bebas / Impact)", family: "display", category: "display", badge: "Preset" },
  { id: "mono", name: "Mono (JetBrains / Consolas)", family: "mono", category: "mono", badge: "Preset" },
  { id: "hand", name: "Hand (Segoe Print)", family: "hand", category: "script", badge: "Preset" },
  { id: "marker", name: "Marker (Ink Free)", family: "marker", category: "script", badge: "Preset" },
  { id: "script", name: "Script (Gabriola)", family: "script", category: "script", badge: "Preset" },
];

const LOCAL_STORAGE_SCANNED_KEY = "yxm_scanned_windows_fonts";
const LOCAL_STORAGE_CUSTOM_KEY = "yxm_custom_loaded_fonts";

/** Read stored local fonts from previous sessions */
export function getSavedScannedFonts(): FontDef[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SCANNED_KEY);
    if (!raw) return [];
    const families: string[] = JSON.parse(raw);
    return families.map((fam) => ({
      id: `local-${fam.toLowerCase().replace(/\s+/g, "-")}`,
      name: fam,
      family: fam,
      category: "windows",
      badge: "Local Font",
      local: true,
    }));
  } catch {
    return [];
  }
}

/** Check if the browser supports window.queryLocalFonts() */
export function isLocalFontAccessSupported(): boolean {
  return typeof window !== "undefined" && "queryLocalFonts" in window;
}

/**
 * Scan all installed local fonts on Windows using Chrome / Edge Local Font Access API
 */
export async function queryLocalWindowsFonts(): Promise<FontDef[]> {
  if (!isLocalFontAccessSupported()) {
    throw new Error(
      "Local Font Access API is not supported in this browser. Please use Chrome or Edge, or use 'Load Font File'."
    );
  }

  try {
    const queryLocalFonts = (window as any).queryLocalFonts as () => Promise<Array<{ family: string; fullName: string }>>;
    const fontData = await queryLocalFonts();
    const familyMap = new Map<string, string>();

    for (const item of fontData) {
      if (item.family && item.family.trim()) {
        const clean = item.family.trim();
        familyMap.set(clean.toLowerCase(), clean);
      }
    }

    const uniqueFamilies = Array.from(familyMap.values()).sort((a, b) => a.localeCompare(b));

    // Save to localStorage for quick restore
    try {
      localStorage.setItem(LOCAL_STORAGE_SCANNED_KEY, JSON.stringify(uniqueFamilies));
    } catch {
      // ignore storage quota error
    }

    return uniqueFamilies.map((fam) => ({
      id: `local-${fam.toLowerCase().replace(/\s+/g, "-")}`,
      name: fam,
      family: fam,
      category: "windows",
      badge: "Local Font",
      local: true,
    }));
  } catch (err: any) {
    if (err.name === "AbortError" || err.name === "NotAllowedError") {
      throw new Error("Permission to read local fonts was denied.");
    }
    throw err;
  }
}

/**
 * Load any font file (.ttf, .otf, .woff, .woff2) chosen from local disk
 */
export async function loadFontFromFile(file: File): Promise<FontDef> {
  const buffer = await file.arrayBuffer();
  // derive clean font name from filename
  const cleanName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const familyName = cleanName || "Custom Font";

  const fontFace = new FontFace(familyName, buffer);
  await fontFace.load();
  document.fonts.add(fontFace);

  const def: FontDef = {
    id: `custom-${Date.now()}`,
    name: familyName,
    family: familyName,
    category: "user",
    badge: "Loaded File",
    local: true,
  };

  // Record in memory / storage
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    if (!existing.includes(familyName)) {
      existing.push(familyName);
      localStorage.setItem(LOCAL_STORAGE_CUSTOM_KEY, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }

  return def;
}

/** Combine all available fonts into a unified searchable collection */
export function getAllAvailableFonts(scannedFonts: FontDef[] = [], customFonts: FontDef[] = []): FontDef[] {
  const map = new Map<string, FontDef>();

  // Add presets
  for (const f of PRESET_FONTS) map.set(f.family.toLowerCase(), f);
  // Add user standout fonts
  for (const f of USER_STANDOUT_FONTS) map.set(f.family.toLowerCase(), f);
  // Add windows standard fonts
  for (const f of WINDOWS_SYSTEM_FONTS) {
    if (!map.has(f.family.toLowerCase())) map.set(f.family.toLowerCase(), f);
  }
  // Add web fonts
  for (const f of WEB_FONTS) {
    if (!map.has(f.family.toLowerCase())) map.set(f.family.toLowerCase(), f);
  }
  // Add scanned local fonts
  for (const f of scannedFonts) {
    if (!map.has(f.family.toLowerCase())) map.set(f.family.toLowerCase(), f);
  }
  // Add custom loaded fonts
  for (const f of customFonts) {
    map.set(f.family.toLowerCase(), f);
  }

  return Array.from(map.values());
}

/** CoolSketch palette. Mirrors the CSS custom properties so canvas code can use it too. */
export const C = {
  ink: "#0A0D18",
  abyss: "#101425",
  slate: "#1A2038",
  haze: "#262E4A",
  mist: "#8A93B2",
  paper: "#EEF2FB",
  frost: "#4FE3DC",
  iris: "#7B6CFF",
  bloom: "#C25BFF",
  ember: "#FF8A5B",
  lime: "#9BE870",
} as const;

export interface PaletteSet {
  name: string;
  colors: string[];
}

/** Ink libraries in the colour drawer. Tuned to read well against a dark scene. */
export const PALETTES: PaletteSet[] = [
  {
    name: "Aurora",
    colors: [
      "#4FE3DC", "#5BC8FF", "#7B6CFF", "#A66BFF", "#C25BFF",
      "#FF6BD6", "#FF8A5B", "#FFC46B", "#9BE870", "#3FD1A0",
    ],
  },
  {
    name: "Graphite",
    colors: [
      "#FFFFFF", "#EEF2FB", "#C7CEE0", "#9AA3BC", "#6E7793",
      "#4A5169", "#2E3448", "#1A1F2E", "#0E1220", "#000000",
    ],
  },
  {
    name: "Studio",
    colors: [
      "#F5E6D3", "#E8C39E", "#D9A273", "#C17F55", "#8C5A3C",
      "#5E3B28", "#3D2719", "#A8B5A2", "#6F7F6B", "#43503F",
    ],
  },
  {
    name: "Neon",
    colors: [
      "#00FFD1", "#00E0FF", "#2E7BFF", "#8A2BFF", "#FF00E5",
      "#FF2D6F", "#FF5A1F", "#FFD400", "#B4FF00", "#26FF6A",
    ],
  },
  {
    name: "Ink & wash",
    colors: [
      "#12131A", "#2B3040", "#4A5878", "#6D82A8", "#9AB0CE",
      "#C6D5E6", "#8C6B5A", "#B79274", "#D9C2A6", "#F0E6D6",
    ],
  },
  {
    name: "Sunset",
    colors: [
      "#FFF0C4", "#FFD27A", "#FFB25C", "#FF7A59", "#F2545B",
      "#C42E5C", "#8B2160", "#54175C", "#2C1246", "#150B2B",
    ],
  },
];

/**
 * Line illustrations drawn in a 0–100 box and scaled to the object's bounds.
 * Deliberately simple: they explain a diagram, they are not clip art.
 */
export interface Illustration {
  id: string;
  label: string;
  group: string;
  path: string;
  /** Filled shapes read better for solid marks like the cursor. */
  filled?: boolean;
}

export const ILLUSTRATIONS: Illustration[] = [
  {
    id: "cursor",
    label: "Cursor",
    group: "Pointing",
    filled: true,
    path: "M22 8 L78 44 L50 50 L64 82 L52 88 L38 56 L22 74 Z",
  },
  {
    id: "hand",
    label: "Point",
    group: "Pointing",
    path:
      "M40 88 C26 80 20 66 20 54 L20 44 C20 38 30 38 30 44 L30 52 L30 20 C30 12 42 12 42 20 L42 46 L42 26 C42 18 54 18 54 26 L54 48 L54 32 C54 24 66 24 66 32 L66 60 C66 78 56 88 40 88 Z",
  },
  {
    id: "target",
    label: "Focus",
    group: "Pointing",
    path:
      "M50 14 A36 36 0 1 1 49.9 14 Z M50 32 A18 18 0 1 1 49.9 32 Z M50 46 A4 4 0 1 1 49.9 46 Z",
  },
  {
    id: "pin",
    label: "Pin",
    group: "Pointing",
    path: "M50 92 C50 92 76 60 76 40 A26 26 0 0 0 24 40 C24 60 50 92 50 92 Z M50 30 A10 10 0 1 1 49.9 30 Z",
  },
  {
    id: "star",
    label: "Star",
    group: "Marks",
    path: "M50 10 L62 38 L92 42 L70 62 L76 92 L50 77 L24 92 L30 62 L8 42 L38 38 Z",
  },
  {
    id: "check",
    label: "Check",
    group: "Marks",
    path: "M16 54 L38 76 L86 22",
  },
  {
    id: "cross",
    label: "Cross",
    group: "Marks",
    path: "M20 20 L80 80 M80 20 L20 80",
  },
  {
    id: "warning",
    label: "Warning",
    group: "Marks",
    path: "M50 12 L92 86 L8 86 Z M50 40 L50 62 M50 72 L50 74",
  },
  {
    id: "question",
    label: "Question",
    group: "Thinking",
    path:
      "M34 34 A16 16 0 1 1 50 54 L50 66 M50 80 L50 82",
  },
  {
    id: "bulb",
    label: "Idea",
    group: "Thinking",
    path:
      "M50 8 A28 28 0 0 1 68 58 L66 72 L34 72 L32 58 A28 28 0 0 1 50 8 Z M38 80 L62 80 M42 88 L58 88",
  },
  {
    id: "person",
    label: "Person",
    group: "People",
    path: "M50 14 A16 16 0 1 1 49.9 14 Z M18 90 C18 66 34 56 50 56 C66 56 82 66 82 90",
  },
  {
    id: "people",
    label: "Team",
    group: "People",
    path:
      "M36 20 A13 13 0 1 1 35.9 20 Z M8 84 C8 64 20 56 36 56 C52 56 64 64 64 84 M70 26 A11 11 0 1 1 69.9 26 Z M70 50 C84 50 94 58 94 76",
  },
  {
    id: "chat",
    label: "Comment",
    group: "People",
    path: "M12 20 H88 V70 H46 L26 88 V70 H12 Z",
  },
  {
    id: "camera",
    label: "Camera",
    group: "Content",
    path:
      "M10 30 H60 V74 H10 Z M60 46 L90 30 V74 L60 58 Z M20 22 H40 V30 H20 Z",
  },
  {
    id: "light",
    label: "Light",
    group: "Content",
    path:
      "M30 30 L30 74 L58 88 L58 16 Z M58 40 L92 26 M58 52 L94 52 M58 64 L92 78",
  },
  {
    id: "monitor",
    label: "Screen",
    group: "Devices",
    path: "M8 18 H92 V70 H8 Z M38 70 L34 88 H66 L62 70 M28 88 H72",
  },
  {
    id: "phone",
    label: "Phone",
    group: "Devices",
    path: "M28 8 H72 V92 H28 Z M42 16 H58 M44 84 H56",
  },
  {
    id: "folder",
    label: "Folder",
    group: "Content",
    path: "M8 24 H40 L48 36 H92 V82 H8 Z",
  },
  {
    id: "database",
    label: "Data",
    group: "Data",
    path:
      "M50 10 C72 10 86 16 86 24 C86 32 72 38 50 38 C28 38 14 32 14 24 C14 16 28 10 50 10 Z M14 24 V76 C14 84 28 90 50 90 C72 90 86 84 86 76 V24 M14 50 C14 58 28 64 50 64 C72 64 86 58 86 50",
  },
  {
    id: "cloud",
    label: "Cloud",
    group: "Data",
    path:
      "M28 76 A20 20 0 0 1 30 36 A26 26 0 0 1 78 44 A17 17 0 0 1 76 76 Z",
  },
  {
    id: "clock",
    label: "Time",
    group: "Marks",
    path: "M50 10 A40 40 0 1 1 49.9 10 Z M50 26 V52 L70 64",
  },
  {
    id: "lock",
    label: "Lock",
    group: "Marks",
    path: "M20 46 H80 V90 H20 Z M32 46 V30 A18 18 0 0 1 68 30 V46",
  },
  {
    id: "eye",
    label: "Look",
    group: "Pointing",
    path: "M6 50 C22 24 78 24 94 50 C78 76 22 76 6 50 Z M50 36 A14 14 0 1 1 49.9 36 Z",
  },
  {
    id: "search",
    label: "Search",
    group: "Pointing",
    path: "M44 12 A32 32 0 1 1 43.9 12 Z M68 68 L92 92",
  },
  {
    id: "flag",
    label: "Flag",
    group: "Marks",
    path: "M24 92 V10 M24 14 H82 L68 34 L82 54 H24",
  },
  /* ---- more marks & objects (studio update) ---- */
  { id: "heart", label: "Heart", group: "Marks", path: "M50 86 C22 66 12 52 12 36 A18 18 0 0 1 50 30 A18 18 0 0 1 88 36 C88 52 78 66 50 86 Z" },
  { id: "bolt", label: "Bolt", group: "Marks", filled: true, path: "M56 8 L22 56 H46 L40 92 L78 40 H54 Z" },
  { id: "spark", label: "Spark", group: "Thinking", path: "M50 10 L56 42 L88 50 L56 58 L50 90 L44 58 L12 50 L44 42 Z M78 14 L80 24 L90 26 L80 28 L78 38 L76 28 L66 26 L76 24 Z" },
  { id: "bell", label: "Bell", group: "Marks", path: "M50 12 C34 12 26 26 26 44 V60 L16 74 H84 L74 60 V44 C74 26 66 12 50 12 Z M40 82 A10 10 0 0 0 60 82" },
  { id: "gear", label: "Gear", group: "Data", path: "M50 30 A20 20 0 1 1 49.9 30 Z M46 8 H54 L57 18 L66 22 L76 16 L82 22 L76 32 L80 42 L90 46 V54 L80 58 L76 68 L82 78 L76 84 L66 78 L57 82 L54 92 H46 L43 82 L34 78 L24 84 L18 78 L24 68 L20 58 L10 54 V46 L20 42 L24 32 L18 22 L24 16 L34 22 L43 18 Z" },
  { id: "rocket", label: "Rocket", group: "Business", path: "M50 8 C66 22 72 44 66 66 H34 C28 44 34 22 50 8 Z M34 66 L22 82 L40 76 M66 66 L78 82 L60 76 M50 40 A6 6 0 1 1 49.9 40 Z M44 76 L50 92 L56 76" },
  { id: "mail", label: "Mail", group: "Content", path: "M12 26 H88 V76 H12 Z M12 26 L50 56 L88 26" },
  { id: "cart", label: "Cart", group: "Business", path: "M10 18 H24 L34 62 H78 L86 32 H30 M38 80 A5 5 0 1 1 37.9 80 Z M72 80 A5 5 0 1 1 71.9 80 Z" },
  { id: "tag", label: "Tag", group: "Business", path: "M12 12 H50 L88 50 L50 88 L12 50 Z M30 30 A5 5 0 1 1 29.9 30 Z" },
  { id: "calendar", label: "Calendar", group: "Business", path: "M14 24 H86 V86 H14 Z M14 40 H86 M30 14 V32 M70 14 V32 M28 56 H40 M46 56 H58 M64 56 H76 M28 70 H40 M46 70 H58" },
  { id: "chart", label: "Chart", group: "Data", path: "M12 88 H88 M22 80 V58 M40 80 V34 M58 80 V46 M76 80 V22" },
  { id: "globe", label: "Globe", group: "Places", path: "M50 14 A36 36 0 1 1 49.9 14 Z M14 50 H86 M50 14 C64 28 64 72 50 86 M50 14 C36 28 36 72 50 86" },
  { id: "shield", label: "Shield", group: "Marks", path: "M50 10 L84 22 V50 C84 70 70 84 50 92 C30 84 16 70 16 50 V22 Z M36 50 L46 60 L66 40" },
  { id: "book", label: "Book", group: "Content", path: "M14 18 H44 C50 18 50 24 50 24 V86 C50 86 50 80 44 80 H14 Z M86 18 H56 C50 18 50 24 50 24 V86 C50 86 50 80 56 80 H86 Z" },
  { id: "coffee", label: "Coffee", group: "Places", path: "M18 36 H70 V64 C70 78 60 86 44 86 C28 86 18 78 18 64 Z M70 44 H80 A10 10 0 0 1 80 64 H70 M30 14 C30 22 38 22 38 30 M46 14 C46 22 54 22 54 30" },
  { id: "music", label: "Music", group: "Content", path: "M36 78 A10 10 0 1 1 35.9 78 Z M76 70 A10 10 0 1 1 75.9 70 Z M46 78 V22 L86 12 V70" },
  { id: "chat", label: "Chat", group: "People", path: "M14 18 H86 V66 H44 L24 84 V66 H14 Z M30 34 H70 M30 48 H58" },
  { id: "handshake", label: "Handshake", group: "People", path: "M8 40 L28 24 L48 40 L64 26 L92 44 M8 40 L36 68 C42 74 50 72 54 66 M48 40 L60 52 C64 56 70 54 72 50 M92 44 L70 66" },
  { id: "trophy", label: "Trophy", group: "Business", path: "M30 14 H70 V40 C70 56 60 64 50 64 C40 64 30 56 30 40 Z M30 22 H16 C16 40 24 46 32 46 M70 22 H84 C84 40 76 46 68 46 M50 64 V78 M34 88 H66 M40 78 H60 V88" },
  { id: "compass", label: "Compass", group: "Flow", path: "M50 12 A38 38 0 1 1 49.9 12 Z M62 38 L56 56 L38 62 L44 44 Z" },
  { id: "map", label: "Route", group: "Places", path: "M14 30 L36 20 L64 32 L86 22 V72 L64 82 L36 70 L14 80 Z M36 20 V70 M64 32 V82" },
  { id: "arrows", label: "Cycle", group: "Flow", path: "M20 44 A32 32 0 0 1 76 30 M76 30 L76 14 M76 30 L60 30 M80 56 A32 32 0 0 1 24 70 M24 70 L24 86 M24 70 L40 70" },

  /* ================= Thinking ================= */
  { id: "brain", label: "Brain", group: "Thinking", path: "M46 14 C34 14 26 24 28 34 C18 38 18 54 26 58 C22 70 32 82 46 78 L46 14 Z M54 14 C66 14 74 24 72 34 C82 38 82 54 74 58 C78 70 68 82 54 78 L54 14 Z M46 30 C40 34 40 42 46 46 M54 40 C60 44 60 52 54 56" },
  { id: "puzzle", label: "Puzzle", group: "Thinking", path: "M20 30 H38 C36 20 52 20 50 30 H68 V48 C78 46 78 62 68 60 V80 H50 C52 90 36 90 38 80 H20 V60 C10 62 10 46 20 48 Z" },
  { id: "nodes", label: "Nodes", group: "Thinking", path: "M50 18 A8 8 0 1 1 49.9 18 Z M20 74 A8 8 0 1 1 19.9 74 Z M80 74 A8 8 0 1 1 79.9 74 Z M50 26 V50 M50 50 L24 68 M50 50 L76 68 M50 50 A5 5 0 1 1 49.9 50 Z" },
  { id: "network", label: "Network", group: "Thinking", path: "M50 50 A7 7 0 1 1 49.9 50 Z M20 24 A6 6 0 1 1 19.9 24 Z M80 24 A6 6 0 1 1 79.9 24 Z M20 76 A6 6 0 1 1 19.9 76 Z M80 76 A6 6 0 1 1 79.9 76 Z M25 28 L45 46 M75 28 L55 46 M25 72 L45 54 M75 72 L55 54" },
  { id: "compare", label: "Compare", group: "Thinking", path: "M14 20 H44 V80 H14 Z M56 20 H86 V80 H56 Z M22 36 H36 M22 48 H36 M22 60 H30 M64 36 H78 M64 48 H72 M64 60 H78" },
  { id: "filter", label: "Filter", group: "Thinking", path: "M12 18 H88 L58 52 V82 L42 90 V52 Z" },
  { id: "funnel", label: "Funnel", group: "Thinking", path: "M14 18 H86 M20 34 H80 M28 50 H72 M36 66 H64 M42 82 H58" },
  { id: "flask", label: "Experiment", group: "Thinking", path: "M38 12 H62 M42 12 V40 L18 80 C14 86 18 90 24 90 H76 C82 90 86 86 82 80 L58 40 V12 M30 66 H70" },
  { id: "wand", label: "Magic", group: "Thinking", path: "M14 86 L62 38 M70 30 L74 18 L78 30 L90 34 L78 38 L74 50 L70 38 L58 34 Z M30 22 L32 28 L38 30 L32 32 L30 38 L28 32 L22 30 L28 28 Z" },
  { id: "pattern", label: "Pattern", group: "Thinking", path: "M20 20 H36 V36 H20 Z M52 20 H68 V36 H52 Z M20 52 H36 V68 H20 Z M52 52 H68 V68 H52 Z M76 28 A6 6 0 1 1 75.9 28 Z M28 84 A6 6 0 1 1 27.9 84 Z M76 60 A6 6 0 1 1 75.9 60 Z M60 84 A6 6 0 1 1 59.9 84 Z" },
  { id: "layers", label: "Layers", group: "Thinking", path: "M50 14 L88 34 L50 54 L12 34 Z M12 52 L50 72 L88 52 M12 68 L50 88 L88 68" },

  /* ============ Visual Thinking (the thinking system itself) ============ */
  { id: "vt-problem", label: "Problem", group: "Visual Thinking", path: "M50 12 L90 84 H10 Z M50 36 V60 M50 68 A3 3 0 1 1 49.9 68 Z" },
  { id: "vt-idea", label: "Idea", group: "Visual Thinking", path: "M50 10 A26 26 0 0 1 64 58 L64 70 H36 L36 58 A26 26 0 0 1 50 10 Z M38 80 H62 M42 90 H58" },
  { id: "vt-decision", label: "Decision", group: "Visual Thinking", path: "M50 12 L88 50 L50 88 L12 50 Z M50 36 L38 50 L50 64 L62 50 Z" },
  { id: "vt-action", label: "Action", group: "Visual Thinking", path: "M14 50 H70 M54 30 L76 50 L54 70 M84 20 V80" },
  { id: "vt-result", label: "Result", group: "Visual Thinking", path: "M50 12 A38 38 0 1 1 49.9 12 Z M30 52 L44 66 L72 36" },
  { id: "vt-cause", label: "Cause", group: "Visual Thinking", path: "M20 50 A10 10 0 1 1 19.9 50 Z M30 50 H64 M56 40 L68 50 L56 60 M78 50 A10 10 0 1 1 77.9 50 Z" },
  { id: "vt-effect", label: "Effect", group: "Visual Thinking", path: "M50 50 A8 8 0 1 1 49.9 50 Z M50 30 V14 M50 70 V86 M30 50 H14 M70 50 H86 M36 36 L26 26 M64 36 L74 26 M36 64 L26 74 M64 64 L74 74" },
  { id: "vt-constraint", label: "Constraint", group: "Visual Thinking", path: "M14 20 V80 M86 20 V80 M30 50 H70 M40 40 L30 50 L40 60 M60 40 L70 50 L60 60" },
  { id: "vt-opportunity", label: "Opportunity", group: "Visual Thinking", path: "M14 80 L40 54 L56 66 L86 26 M70 26 H86 V42" },
  { id: "vt-risk", label: "Risk", group: "Visual Thinking", path: "M50 10 L90 82 H10 Z M50 34 V56 M50 66 A3 3 0 1 1 49.9 66 Z M28 82 L50 46 L72 82" },
  { id: "vt-assumption", label: "Assumption", group: "Visual Thinking", path: "M20 40 C20 22 80 22 80 40 C80 52 56 50 56 64 M56 78 A3 3 0 1 1 55.9 78 Z M14 88 H86" },
  { id: "vt-evidence", label: "Evidence", group: "Visual Thinking", path: "M20 12 H64 L80 28 V88 H20 Z M64 12 V28 H80 M32 44 H68 M32 58 H68 M32 72 H56 M62 74 L68 80 L80 66" },
  { id: "vt-goal", label: "Goal", group: "Visual Thinking", path: "M50 12 A36 36 0 1 1 49.9 12 Z M50 30 A18 18 0 1 1 49.9 30 Z M50 44 A4 4 0 1 1 49.9 44 Z M50 50 L86 14 M78 14 H86 V22" },
  { id: "vt-question", label: "Question", group: "Visual Thinking", path: "M14 18 H86 V66 H44 L24 84 V66 H14 Z M40 36 C40 26 60 26 60 36 C60 44 50 44 50 52 M50 58 A3 3 0 1 1 49.9 58 Z" },
  { id: "vt-insight", label: "Insight", group: "Visual Thinking", path: "M50 34 A16 16 0 1 1 49.9 34 Z M50 10 V22 M50 78 V90 M14 50 H26 M74 50 H86 M24 24 L32 32 M76 24 L68 32 M24 76 L32 68 M76 76 L68 68" },

  /* ================= Flow ================= */
  { id: "arrow-right", label: "Arrow", group: "Flow", path: "M12 50 H84 M62 28 L86 50 L62 72" },
  { id: "arrow-both", label: "Both ways", group: "Flow", path: "M14 50 H86 M32 32 L12 50 L32 68 M68 32 L88 50 L68 68" },
  { id: "arrow-curve", label: "Curved", group: "Flow", path: "M14 80 C14 30 60 20 84 30 M70 16 L86 30 L70 44" },
  { id: "connector", label: "Connector", group: "Flow", path: "M18 30 A8 8 0 1 1 17.9 30 Z M82 70 A8 8 0 1 1 81.9 70 Z M26 30 H50 V70 H74" },
  { id: "branch", label: "Branch", group: "Flow", path: "M14 50 H44 M44 50 C58 50 58 24 72 24 H88 M44 50 C58 50 58 76 72 76 H88 M78 16 L88 24 L78 32 M78 68 L88 76 L78 84" },
  { id: "merge", label: "Merge", group: "Flow", path: "M12 24 H28 C42 24 42 50 56 50 H88 M12 76 H28 C42 76 42 50 56 50 M78 40 L88 50 L78 60" },
  { id: "split", label: "Split", group: "Flow", path: "M50 12 V40 M50 40 L20 70 M50 40 L80 70 M20 70 A8 8 0 1 1 19.9 70 Z M80 70 A8 8 0 1 1 79.9 70 Z" },
  { id: "timeline", label: "Timeline", group: "Flow", path: "M10 50 H90 M24 50 A6 6 0 1 1 23.9 50 Z M50 50 A6 6 0 1 1 49.9 50 Z M76 50 A6 6 0 1 1 75.9 50 Z M24 44 V28 M50 56 V72 M76 44 V28" },
  { id: "steps", label: "Steps", group: "Flow", path: "M12 84 H34 V62 H56 V40 H78 V18 H90" },
  { id: "loop", label: "Loop", group: "Flow", path: "M28 32 H72 A18 18 0 0 1 72 68 H36 M46 56 L34 68 L46 80" },
  { id: "hierarchy", label: "Tree", group: "Flow", path: "M38 14 H62 V30 H38 Z M14 70 H38 V86 H14 Z M62 70 H86 V86 H62 Z M50 30 V50 M26 70 V50 H74 V70" },
  { id: "dependency", label: "Link", group: "Flow", path: "M40 60 L60 40 M30 50 L22 58 A14 14 0 0 0 42 78 L50 70 M70 50 L78 42 A14 14 0 0 0 58 22 L50 30" },
  { id: "unlink", label: "Unlink", group: "Flow", path: "M30 50 L22 58 A14 14 0 0 0 42 78 L50 70 M70 50 L78 42 A14 14 0 0 0 58 22 L50 30 M42 42 L58 58 M58 42 L42 58" },
  { id: "feedback-loop", label: "Feedback", group: "Flow", path: "M22 40 A30 30 0 0 1 78 40 M78 40 V24 M78 40 H62 M78 60 A30 30 0 0 1 22 60 M22 60 V76 M22 60 H38" },

  /* ================= UI ================= */
  { id: "browser", label: "Browser", group: "UI", path: "M10 18 H90 V82 H10 Z M10 34 H90 M20 26 A3 3 0 1 1 19.9 26 Z M30 26 A3 3 0 1 1 29.9 26 Z M40 26 A3 3 0 1 1 39.9 26 Z" },
  { id: "app-window", label: "App window", group: "UI", path: "M10 18 H90 V82 H10 Z M10 30 H90 M10 30 V82 M30 30 V82 M40 44 H76 M40 56 H68" },
  { id: "button", label: "Button", group: "UI", path: "M14 34 H86 A10 10 0 0 1 86 66 H14 A10 10 0 0 1 14 34 Z M34 50 H66" },
  { id: "toggle", label: "Toggle", group: "UI", path: "M30 30 H70 A20 20 0 0 1 70 70 H30 A20 20 0 0 1 30 30 Z M70 50 A11 11 0 1 1 69.9 50 Z" },
  { id: "checkbox", label: "Checkbox", group: "UI", path: "M18 18 H82 V82 H18 Z M34 52 L46 64 L68 38" },
  { id: "radio", label: "Radio", group: "UI", path: "M50 14 A36 36 0 1 1 49.9 14 Z M50 34 A16 16 0 1 1 49.9 34 Z" },
  { id: "input", label: "Input", group: "UI", path: "M10 34 H90 V66 H10 Z M22 44 V56" },
  { id: "dropdown", label: "Dropdown", group: "UI", path: "M10 30 H90 V54 H10 Z M70 38 L76 46 L82 38 M10 62 H90 V86 H10 Z M20 74 H50" },
  { id: "menu", label: "Menu", group: "UI", path: "M16 26 H84 M16 50 H84 M16 74 H84" },
  { id: "sidebar", label: "Sidebar", group: "UI", path: "M10 18 H90 V82 H10 Z M36 18 V82 M18 32 H28 M18 44 H28 M18 56 H28" },
  { id: "modal", label: "Modal", group: "UI", path: "M10 14 H90 V86 H10 Z M26 34 H74 V70 H26 Z M36 46 H64 M46 60 H64" },
  { id: "tabs", label: "Tabs", group: "UI", path: "M10 34 H36 V22 H60 V34 H90 V82 H10 Z M36 34 H60" },
  { id: "card", label: "Card", group: "UI", path: "M16 14 H84 V86 H16 Z M16 50 H84 M26 62 H60 M26 72 H48" },
  { id: "grid", label: "Grid", group: "UI", path: "M14 14 H42 V42 H14 Z M58 14 H86 V42 H58 Z M14 58 H42 V86 H14 Z M58 58 H86 V86 H58 Z" },
  { id: "navbar", label: "Nav bar", group: "UI", path: "M10 26 H90 V46 H10 Z M18 36 H34 M52 36 H60 M66 36 H74 M78 32 H86 V40 H78 Z" },
  { id: "click", label: "Click", group: "UI", path: "M40 40 L78 58 L60 62 L70 82 L62 86 L52 66 L40 78 Z M40 26 V14 M22 32 L14 24 M58 32 L66 24 M26 44 H14" },
  { id: "drag", label: "Drag", group: "UI", path: "M30 26 H70 V74 H30 Z M40 40 H60 M40 50 H60 M40 60 H60 M20 50 L12 50 M88 50 L80 50 M50 20 V12 M50 88 V80" },
  { id: "upload", label: "Upload", group: "UI", path: "M50 70 V22 M32 40 L50 22 L68 40 M18 80 H82" },
  { id: "download", label: "Download", group: "UI", path: "M50 18 V66 M32 48 L50 66 L68 48 M18 80 H82" },
  { id: "avatar", label: "Avatar", group: "UI", path: "M50 12 A38 38 0 1 1 49.9 12 Z M50 30 A12 12 0 1 1 49.9 30 Z M26 76 C30 60 70 60 74 76" },
  { id: "notification", label: "Notification", group: "UI", path: "M50 14 C36 14 28 26 28 42 V58 L18 70 H82 L72 58 V42 C72 26 64 14 50 14 Z M42 80 A8 8 0 0 0 58 80 M72 22 A8 8 0 1 1 71.9 22 Z" },

  /* ================= Devices ================= */
  { id: "laptop", label: "Laptop", group: "Devices", path: "M20 22 H80 V66 H20 Z M8 78 H92 L84 66 H16 Z" },
  { id: "tablet", label: "Tablet", group: "Devices", path: "M26 10 H74 V90 H26 Z M50 82 A3 3 0 1 1 49.9 82 Z" },
  { id: "watch", label: "Smartwatch", group: "Devices", path: "M34 28 H66 V72 H34 Z M40 28 L42 12 H58 L60 28 M40 72 L42 88 H58 L60 72 M50 40 V50 H58" },
  { id: "tv", label: "TV", group: "Devices", path: "M10 18 H90 V70 H10 Z M36 86 H64 M50 70 V86" },
  { id: "screens", label: "Screens", group: "Devices", path: "M8 26 H56 V62 H8 Z M64 34 H92 V78 H64 Z M24 76 H40 M32 62 V76" },

  /* ================= Content ================= */
  { id: "image", label: "Image", group: "Content", path: "M14 18 H86 V82 H14 Z M14 70 L36 46 L54 64 L66 52 L86 72 M68 32 A6 6 0 1 1 67.9 32 Z" },
  { id: "video", label: "Video", group: "Content", path: "M10 26 H66 V74 H10 Z M66 42 L90 30 V70 L66 58" },
  { id: "play", label: "Play", group: "Content", filled: true, path: "M30 16 L82 50 L30 84 Z" },
  { id: "pause", label: "Pause", group: "Content", path: "M30 16 H42 V84 H30 Z M58 16 H70 V84 H58 Z" },
  { id: "audio", label: "Audio", group: "Content", path: "M14 40 H30 L50 22 V78 L30 60 H14 Z M62 36 C70 44 70 56 62 64 M72 26 C86 38 86 62 72 74" },
  { id: "mic", label: "Microphone", group: "Content", path: "M38 12 H62 V52 A12 12 0 0 1 38 52 Z M24 46 A26 26 0 0 0 76 46 M50 72 V88 M36 88 H64" },
  { id: "document", label: "Document", group: "Content", path: "M22 10 H64 L78 24 V90 H22 Z M64 10 V24 H78 M32 44 H68 M32 58 H68 M32 72 H56" },
  { id: "text", label: "Text", group: "Content", path: "M18 22 H82 M50 22 V82 M36 82 H64" },
  { id: "quote", label: "Quote", group: "Content", path: "M18 62 A14 14 0 1 0 32 48 V34 C32 26 26 22 20 22 M56 62 A14 14 0 1 0 70 48 V34 C70 26 64 22 58 22" },
  { id: "link", label: "Link", group: "Content", path: "M42 58 L58 42 M34 50 L26 58 A12 12 0 0 0 42 76 L50 68 M66 50 L74 42 A12 12 0 0 0 58 24 L50 32" },
  { id: "attachment", label: "Attachment", group: "Content", path: "M60 30 L34 56 A10 10 0 0 0 48 70 L78 40 A18 18 0 0 0 52 14 L22 44 A26 26 0 0 0 58 80 L80 58" },
  { id: "bookmark", label: "Bookmark", group: "Content", path: "M26 12 H74 V88 L50 70 L26 88 Z" },

  /* ================= Data ================= */
  { id: "server", label: "Server", group: "Data", path: "M16 16 H84 V40 H16 Z M16 60 H84 V84 H16 Z M26 28 A3 3 0 1 1 25.9 28 Z M26 72 A3 3 0 1 1 25.9 72 Z M40 28 H72 M40 72 H72" },
  { id: "api", label: "API", group: "Data", path: "M22 40 H50 V60 H22 Z M50 50 H66 M66 36 V64 M66 42 H80 M66 58 H80 M10 44 H22 M10 56 H22" },
  { id: "code", label: "Code", group: "Data", path: "M34 30 L14 50 L34 70 M66 30 L86 50 L66 70 M58 22 L42 78" },
  { id: "terminal", label: "Terminal", group: "Data", path: "M10 18 H90 V82 H10 Z M24 38 L38 50 L24 62 M46 62 H70" },
  { id: "ai", label: "AI spark", group: "Data", path: "M50 12 L58 40 L86 50 L58 60 L50 88 L42 60 L14 50 L42 40 Z M76 14 L79 22 L87 25 L79 28 L76 36 L73 28 L65 25 L73 22 Z" },
  { id: "automation", label: "Automation", group: "Data", path: "M50 30 A20 20 0 1 1 49.9 30 Z M50 14 V22 M50 78 V86 M14 50 H22 M78 50 H86 M24 24 L30 30 M76 24 L70 30 M24 76 L30 70 M76 76 L70 70 M44 50 L48 56 L58 44" },
  { id: "workflow", label: "Workflow", group: "Data", path: "M12 24 H36 V44 H12 Z M64 24 H88 V44 H64 Z M38 56 H62 V76 H38 Z M36 34 H64 M24 44 V66 H38 M76 44 V66 H62" },
  { id: "sync", label: "Cloud sync", group: "Data", path: "M30 74 A16 16 0 0 1 30 42 A22 22 0 0 1 72 42 A14 14 0 0 1 72 74 Z M42 60 H58 M52 52 L60 60 L52 68" },
  { id: "pie", label: "Pie chart", group: "Data", path: "M50 14 A36 36 0 1 1 22 66 L50 50 Z M50 14 V50 M50 50 L22 66" },
  { id: "line-chart", label: "Line chart", group: "Data", path: "M12 86 H88 M12 86 V14 M20 70 L38 48 L54 60 L70 30 L84 40" },
  { id: "table", label: "Table", group: "Data", path: "M12 20 H88 V80 H12 Z M12 40 H88 M12 60 H88 M40 20 V80 M64 20 V80" },
  { id: "dashboard", label: "Dashboard", group: "Data", path: "M10 14 H48 V44 H10 Z M56 14 H90 V44 H56 Z M10 52 H90 V86 H10 Z M20 76 V66 M32 76 V60 M44 76 V70" },
  { id: "gauge", label: "Gauge", group: "Data", path: "M14 70 A36 36 0 0 1 86 70 M50 70 L68 40 M50 70 A5 5 0 1 1 49.9 70 Z M14 82 H86" },
  { id: "activity", label: "Activity", group: "Data", path: "M10 50 H26 L36 22 L50 78 L64 36 L72 50 H90" },

  /* ================= Business ================= */
  { id: "user", label: "Customer", group: "Business", path: "M50 40 A14 14 0 1 1 49.9 40 Z M20 86 C24 62 76 62 80 86" },
  { id: "building", label: "Business", group: "Business", path: "M20 88 V14 H64 V88 M64 40 H84 V88 M30 26 H40 M46 26 H54 M30 40 H40 M46 40 H54 M30 54 H40 M46 54 H54 M38 72 H48 V88 H38 Z" },
  { id: "store", label: "Store", group: "Business", path: "M14 40 L22 16 H78 L86 40 M14 40 C14 52 30 52 30 40 C30 52 46 52 46 40 C46 52 62 52 62 40 C62 52 78 52 78 40 C78 52 86 52 86 40 M20 48 V86 H80 V48 M40 86 V64 H60 V86" },
  { id: "money", label: "Money", group: "Business", path: "M8 26 H92 V74 H8 Z M50 38 A12 12 0 1 1 49.9 38 Z M18 34 H24 M76 66 H82" },
  { id: "wallet", label: "Wallet", group: "Business", path: "M12 30 H80 V78 H12 Z M12 30 V22 H68 V30 M60 48 H88 V62 H60 Z M70 55 A2 2 0 1 1 69.9 55 Z" },
  { id: "payment", label: "Payment", group: "Business", path: "M8 24 H92 V76 H8 Z M8 40 H92 M20 62 H40 M60 62 H80" },
  { id: "package", label: "Package", group: "Business", path: "M14 34 L50 16 L86 34 L50 52 Z M14 34 V66 L50 84 L86 66 V34 M50 52 V84 M32 25 L68 43" },
  { id: "delivery", label: "Delivery", group: "Business", path: "M8 30 H58 V66 H8 Z M58 42 H76 L88 56 V66 H58 M24 66 A8 8 0 1 0 24.1 66 M72 66 A8 8 0 1 0 72.1 66" },
  { id: "location", label: "Location", group: "Business", path: "M50 90 C50 90 78 58 78 40 A28 28 0 0 0 22 40 C22 58 50 90 50 90 Z M50 30 A10 10 0 1 1 49.9 30 Z" },
  { id: "growth", label: "Growth", group: "Business", path: "M12 84 L34 58 L52 70 L88 28 M70 28 H88 V46 M12 88 H88" },
  { id: "conversion", label: "Conversion", group: "Business", path: "M14 18 H86 L58 52 V78 L42 86 V52 Z M70 70 L80 80 L94 62" },
  { id: "megaphone", label: "Megaphone", group: "Business", path: "M14 42 H30 L70 20 V80 L30 58 H14 Z M30 58 L36 84 H48 L42 58 M76 40 C84 44 84 56 76 60" },
  { id: "briefcase", label: "Briefcase", group: "Business", path: "M10 34 H90 V82 H10 Z M36 34 V22 H64 V34 M10 54 H90 M44 50 H56 V60 H44 Z" },
  { id: "kanban", label: "Kanban", group: "Business", path: "M10 16 H32 V84 H10 Z M39 16 H61 V60 H39 Z M68 16 H90 V40 H68 Z" },

  /* ================= People (collaboration) ================= */
  { id: "user-add", label: "Add person", group: "People", path: "M40 40 A14 14 0 1 1 39.9 40 Z M12 86 C16 62 64 62 68 86 M78 40 V64 M66 52 H90" },
  { id: "user-remove", label: "Remove person", group: "People", path: "M40 40 A14 14 0 1 1 39.9 40 Z M12 86 C16 62 64 62 68 86 M66 52 H90" },
  { id: "share", label: "Share", group: "People", path: "M76 22 A8 8 0 1 1 75.9 22 Z M24 50 A8 8 0 1 1 23.9 50 Z M76 78 A8 8 0 1 1 75.9 78 Z M31 46 L69 26 M31 54 L69 74" },
  { id: "mention", label: "Mention", group: "People", path: "M50 34 A16 16 0 1 1 49.9 34 Z M66 50 V58 A8 8 0 0 0 82 58 V50 A32 32 0 1 0 70 76" },
  { id: "feedback", label: "Feedback", group: "People", path: "M14 18 H86 V66 H44 L24 84 V66 H14 Z M30 32 L38 40 L52 26 M60 42 H74 M60 54 H70" },
  { id: "review", label: "Review", group: "People", path: "M50 14 L60 36 L84 38 L66 54 L72 78 L50 66 L28 78 L34 54 L16 38 L40 36 Z" },
  { id: "approval", label: "Approval", group: "People", path: "M50 12 A38 38 0 1 1 49.9 12 Z M30 52 L44 66 L72 36" },
  { id: "reject", label: "Reject", group: "People", path: "M50 12 A38 38 0 1 1 49.9 12 Z M34 34 L66 66 M66 34 L34 66" },
  { id: "present", label: "Present", group: "People", path: "M10 18 H90 V66 H10 Z M50 66 V82 M36 90 L50 82 L64 90 M30 50 L44 36 L58 46 L72 30" },
  { id: "workshop", label: "Workshop", group: "People", path: "M12 16 H40 V44 H12 Z M46 20 H74 V48 H46 Z M18 54 H46 V82 H18 Z M56 58 H84 V86 H56 Z" },

  /* ================= Places ================= */
  { id: "house", label: "House", group: "Places", path: "M12 50 L50 16 L88 50 M22 42 V86 H78 V42 M42 86 V62 H58 V86" },
  { id: "office", label: "Office", group: "Places", path: "M16 88 V20 H60 V88 M60 46 H84 V88 M26 32 H36 M44 32 H52 M26 46 H36 M44 46 H52 M26 60 H36 M44 60 H52 M68 58 H76 M68 70 H76" },
  { id: "factory", label: "Factory", group: "Places", path: "M12 86 V40 L36 54 V40 L60 54 V40 L84 54 V86 Z M70 40 V14 H82 V40 M24 70 H32 M44 70 H52 M64 70 H72" },
  { id: "school", label: "School", group: "Places", path: "M10 42 L50 22 L90 42 M18 46 V86 H82 V46 M50 42 A6 6 0 1 1 49.9 42 Z M40 86 V64 H60 V86" },
  { id: "hospital", label: "Hospital", group: "Places", path: "M16 86 V22 H84 V86 Z M50 36 V66 M35 51 H65" },
  { id: "road", label: "Road", group: "Places", path: "M30 88 L42 12 M70 88 L58 12 M50 20 V30 M50 44 V56 M50 70 V82" },
  { id: "car", label: "Car", group: "Places", path: "M12 56 L22 34 H78 L88 56 V74 H12 Z M12 56 H88 M28 74 A8 8 0 1 0 28.1 74 M72 74 A8 8 0 1 0 72.1 74 M30 46 H70" },
  { id: "bus", label: "Bus", group: "Places", path: "M16 18 H84 V76 H16 Z M16 52 H84 M28 30 H72 V46 H28 Z M28 76 V86 M72 76 V86 M26 64 A3 3 0 1 1 25.9 64 Z M74 64 A3 3 0 1 1 73.9 64 Z" },
  { id: "plane", label: "Plane", group: "Places", path: "M50 10 L56 40 L90 56 L88 64 L56 54 L54 76 L66 86 L64 92 L50 86 L36 92 L34 86 L46 76 L44 54 L12 64 L10 56 L44 40 Z" },
  { id: "tree", label: "Tree", group: "Places", path: "M50 10 L74 42 H62 L82 68 H18 L38 42 H26 Z M50 68 V90" },
  { id: "mountain", label: "Mountain", group: "Places", path: "M6 84 L36 30 L52 56 L64 40 L94 84 Z M30 42 L36 30 L42 42" },
  { id: "door", label: "Door", group: "Places", path: "M26 90 V14 H74 V90 M26 90 H74 M62 50 A3 3 0 1 1 61.9 50 Z" },
  { id: "chair", label: "Chair", group: "Places", path: "M26 14 H74 V52 H26 Z M22 52 H78 V64 H22 Z M26 64 V88 M74 64 V88" },

  /* ================= Metaphors ================= */
  { id: "balance", label: "Balance", group: "Metaphors", path: "M50 14 V86 M20 30 H80 M14 62 A12 12 0 0 0 38 62 L26 30 Z M62 62 A12 12 0 0 0 86 62 L74 30 Z M34 86 H66" },
  { id: "infinity", label: "Infinity", group: "Metaphors", path: "M50 50 C34 30 10 34 10 50 C10 66 34 70 50 50 C66 30 90 34 90 50 C90 66 66 70 50 50" },
  { id: "key", label: "Key", group: "Metaphors", path: "M34 50 A18 18 0 1 1 33.9 50 Z M52 50 H90 M78 50 V64 M66 50 V60" },
  { id: "bridge", label: "Bridge", group: "Metaphors", path: "M6 62 H94 M14 62 C14 30 86 30 86 62 M30 40 V62 M50 34 V62 M70 40 V62 M14 62 V80 M86 62 V80" },
  { id: "magnet", label: "Magnet", group: "Metaphors", path: "M22 14 V50 A28 28 0 0 0 78 50 V14 M22 14 H38 V50 A12 12 0 0 0 62 50 V14 H78 M22 30 H38 M62 30 H78" },
  { id: "anchor", label: "Anchor", group: "Metaphors", path: "M50 24 A8 8 0 1 1 49.9 24 Z M50 32 V88 M30 50 H70 M16 60 A34 34 0 0 0 84 60 M22 54 L16 60 L24 66 M78 54 L84 60 L76 66" },
  { id: "telescope", label: "Telescope", group: "Metaphors", path: "M14 60 L70 20 L84 40 L28 80 Z M28 80 L20 90 M40 72 L60 90 M40 72 L36 90" },
  { id: "seed", label: "Seed", group: "Metaphors", path: "M50 90 V50 M50 50 C50 30 30 22 14 26 C16 42 32 52 50 50 M50 50 C50 30 70 22 86 26 C84 42 68 52 50 50 M30 90 H70" },
  { id: "maze", label: "Maze", group: "Metaphors", path: "M10 10 H90 V90 H10 Z M10 30 H50 M70 10 V50 H30 V70 M50 30 V50 M90 70 H50 V90 M30 50 V90" },
  { id: "chess", label: "Chess", group: "Metaphors", path: "M30 88 H70 M34 80 H66 L60 60 L70 46 L66 22 L58 30 L50 22 L42 30 L34 22 L30 46 L40 60 Z" },
  { id: "dominoes", label: "Dominoes", group: "Metaphors", path: "M12 40 L26 34 L44 80 L30 86 Z M40 26 L54 20 L72 66 L58 72 Z M70 14 L84 8 L94 38 L80 44 Z" },
  { id: "chain", label: "Chain", group: "Metaphors", path: "M20 50 A12 12 0 0 1 32 38 H44 A12 12 0 0 1 44 62 H32 A12 12 0 0 1 20 50 Z M56 50 A12 12 0 0 1 68 38 H80 A12 12 0 0 1 80 62 H68 A12 12 0 0 1 56 50 Z" },
  { id: "flywheel", label: "Flywheel", group: "Metaphors", path: "M50 16 A34 34 0 1 1 22 34 M18 20 L22 34 L36 30 M50 40 A10 10 0 1 1 49.9 40 Z" },
  { id: "iceberg", label: "Iceberg", group: "Metaphors", path: "M6 46 H94 M34 46 L44 22 L58 30 L66 46 M22 46 L14 76 L46 90 L70 68 L82 46" },
  { id: "ladder", label: "Ladder", group: "Metaphors", path: "M30 8 V92 M70 8 V92 M30 22 H70 M30 40 H70 M30 58 H70 M30 76 H70" },
  { id: "staircase", label: "Staircase", group: "Metaphors", path: "M10 90 H26 V72 H42 V54 H58 V36 H74 V18 H90" },
  {
    id: "swirl",
    label: "Loop arrow",
    group: "Flow",
    path: "M14 78 C14 34 86 34 86 62 C86 82 52 84 44 62 M44 62 L34 72 M44 62 L56 68",
  },
];

const GROUP_ORDER = [
  "Visual Thinking",
  "Pointing",
  "Flow",
  "Thinking",
  "UI",
  "People",
  "Data",
  "Content",
  "Business",
  "Devices",
  "Places",
  "Metaphors",
  "Marks",
];

export const ILLUSTRATION_GROUPS = [...new Set(ILLUSTRATIONS.map((i) => i.group))].sort(
  (a, b) => (GROUP_ORDER.indexOf(a) + 100) % 200 - ((GROUP_ORDER.indexOf(b) + 100) % 200),
);

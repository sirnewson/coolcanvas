# The CoolCanvas board

*(The canvas workspace. For the studios, see [ENGINES.md](ENGINES.md).)*

**The visual workspace between an idea and its execution.**

Photo → arrows → guides → circles → dimensions → notes → rough sketch → flow → share.
Not a meeting whiteboard, not a reference collector, not a design tool: CoolCanvas is for the
moment you have something in your head and need to visually explain it.

```bash
npm install
npm run dev      # http://127.0.0.1:5190
npm run build    # typecheck + production bundle
```

Board storage keeps the original IndexedDB name, so boards made before the rename still open.

## The loop it optimises for

1. **Drop** a screenshot (drag, paste, or <kbd>I</kbd>).
2. **Point** — hold <kbd>A</kbd>, drag, release. The arrow docks to whatever it lands on.
3. **Circle / measure / highlight** — <kbd>O</kbd>, <kbd>M</kbd>, <kbd>Shift</kbd>+<kbd>P</kbd>.
4. **Say it** — <kbd>T</kbd> for a label, <kbd>N</kbd> for a note.
5. **Send it** — Export → Copy as image, straight into Slack or a mail.

Selecting an image puts that whole row — Arrow, Circle, Highlight, Label, Measure, Crop, Trace —
in the floating toolbar above it.

## Studio layout

A menu bar (**File · Edit · View · Insert · Image · Effects · AI**) maps every command; under
it a Photoshop-style **options strip** follows the active tool — pen size and smoothing, shape
stroke/fill, text case and lists — and, with a selection, shows opacity, blend mode, effect and
shadow presets, image tools, align and the AI lane. The right dock has icon tabs: **Design ·
Effects · Layers · Canvas · AI · Setup**. Three layout tiers: desktop, **tablet** (bigger rail,
dock as a bottom sheet, compact top row) and phone (bottom bar).

## Start from a thought

"**What do you want to sketch?**" on the gallery and on an empty board. One sentence becomes a
structured board: brief, sticky notes, one wireframe frame per screen built from current web
patterns, a connected flow, next steps and risks — all ordinary editable objects.

## Effects

Per-object pixel effects: brightness, contrast, saturation, hue, auto levels, black & white,
sepia, invert, solarize, blur, pixelate, grain, posterize, threshold, emboss; sixteen one-tap
looks (Vivid, Noir, Vintage, Dreamy, Pop art, Stencil…); a parametric drop shadow with presets
(Soft, Lift, Hard, Glow, Neon); sixteen blend modes. Effects live in `style.effects`, apply to
any object type, export with the board, and **Flatten** bakes them into one image.

## Image tools

- **Remove background** — Auto uses an in-browser ISNet model (`@imgly/background-removal`, ~40MB
  fetched once and cached); *Flat colour* floods from the corners with a feathered edge, instant.
- **Vectorize** — photo → true vector paths (`imagetracerjs`) as a `vector` object with presets
  Logo, Poster, Photo, Cartoon, Ink. Stays crisp at any zoom; **File → Export vector as SVG**.
- **Clip into shape** — select an image and a shape (rect, ellipse, triangle, diamond, polygon)
  and clip it; the shape masks the picture and keeps its outline. Or drop an image file onto a
  selected shape. *Release image* takes it back out.
- Crop, flip, flatten.

## Text

Click with the text tool for **point text** that hugs what you type (Photoshop-style); drag to
draw a paragraph box; side handles switch a point text to wrapping. Big caps / capitalise, and
bullet, numbered or checklist prefixes, are styles applied at render time.

## Web kit

Insert → **Web**: navbar, sidebar, tabs, breadcrumbs, footer; hero, feature grid, pricing,
testimonial, CTA band; stat tiles, chart card, data table, form, modal, search, toast, kanban,
content card, pagination; button set, text field, select, toggle/checkbox, badges, avatar
group; login screen, dashboard layout and a full landing page. Each tile shows a preview and
lands as plain objects you can restyle or regroup.

## Site Builder

The **Site** button (or File → Site Builder) opens a full-screen page builder inside the board:

- **111 real sections** in ten categories (header, hero, features, proof, CTA, pricing, FAQ,
  forms, gallery, footer), each with a live preview, content fields, layout and component notes.
- **Six editable site templates** — SaaS landing, Portfolio, Hotel, E-commerce, Agency, Mobile
  app — with the copy already written, plus six palettes you can switch at any time.
- **Live page** with Desktop / Tablet / Mobile widths; hover a section to move, duplicate, edit or
  remove it; click to edit its fields; double-click any text you wrote to type over it; drop a
  picture (file, URL or a stock result) straight onto a section.
- **Outputs**: *Preview* in a tab, *Export HTML* (a standalone page rendered from the same
  components), *Prompt* (the full build brief for any model), *Generate with AI* (Gemini writes
  the site; it lands as a site card and opens in a tab), and **To canvas** — every section is
  rebuilt from its own copy as separate board objects (headline, buttons, cards, image slots…)
  so you can move, resize, restyle, connect and clip images into any element.

The site saves with the board (`doc.site`) and undoes like everything else.

## Visual thinking tools

- **Recipes** (Insert → Recipes): small structures that come in as docked, editable shapes —
  Problem → Cause → Solution, Before → Change → After, Input → Process → Output, Goal →
  Obstacles → Actions → Result, What? → So what? → Now what?, learning loops, journeys
  (Discover → Consider → Buy → Retain, checkout, onboarding), systems, a Kanban board, an
  Impact × Effort matrix, a customer journey map, a storyboard and a notes row.
- **Smart Insert**: type an idea in the Insert search — “checkout flow”, “how solar panels
  work” — and press Enter or ✦; the text model returns the steps and they land as a chain.
- **✦ Explain visually** (options strip, AI menu): select any text, note, outline or card and
  turn it into a **flow**, a **diagram** (mind map) or a **storyboard**.
- **Arrange** (options strip, Edit menu): lay any selection out as a horizontal or vertical
  stack, grid, flow (with arrows), timeline (line + markers) or cycle.
- **Art** is now a thinking vocabulary — 193 line illustrations in Visual Thinking (Problem,
  Idea, Decision, Action, Result, Cause, Effect, Constraint, Opportunity, Risk, Assumption,
  Evidence, Goal, Question, Insight), Pointing, Flow, Thinking, UI, People, Data, Content,
  Business, Devices, Places, Metaphors and Marks.

## Clipped images

A picture inside a shape has its own controls: **Adjust picture** (drag inside the shape to
pan), a **Zoom** slider, **Reset** and **Unclip** (the picture comes back out as an image).

## Connectors (MCP)

AI › **Connectors** talks to any MCP server over Streamable HTTP — Freepik / Magnific,
Replicate, fal or your own — using the account you already have. Add the server URL and its
auth header, connect, pick a tool, fill its inputs (“Use selection” attaches the selected
picture or a snapshot), run: images land on the board, text is shown. Servers without CORS are
reached through a same-origin relay (`/api/mcp-proxy`: a Vite middleware in dev, a Netlify
Function in production) that forwards the request and auth header verbatim and stores nothing.

## Images

Insert → **Images** searches free stock photos live: **Openverse** (CC, no key) out of the box,
and **Unsplash**, **Pixabay** and **Pexels** once you paste their free keys (kept in this
browser only). Click to place, drag onto a shape to clip, drag onto an image slot to fill it, or
drag onto a Site Builder section. Pictures are stored as data URLs so boards work offline and
export cleanly.

## Layers

Photoshop-style stack: live thumbnails, blend + opacity header, filter box, drag rows to
reorder or drop onto a group/frame to nest, `fx` badge, visibility and lock.

## Controls

**Objects** — rectangle, ellipse, triangle, diamond, line, arrow, freehand, highlighter, text,
sticky note, collapsible outline, polygon (any number of sides, or a star), image slot, data
table, flashcard, video and audio players, frame (plain / browser / phone / desktop chrome), image, link
and video cards, line illustrations, measurements, groups. One flat record backs all of them
(`src/types.ts`), so selection, transforms, layers and persistence stay generic.

**Insert panel** (the stamp icon on the rail) has a search box, a Grouped/Loose toggle and five
tabs — Blocks, Web, Images, Art, Templates:

- **Blocks** — rough UI parts: button, input, card, nav bar, sidebar, avatar, image box,
  three-step flow, 2×2 matrix, shot plan, light plan.
- **Art** — 48 line illustrations (cursor, point, focus, pin, loop arrow, star, check, cross,
  warning, question, idea, flag, person, team, comment, camera, light, screen, phone, folder,
  data, cloud, time, lock, look, search) that scale as real vector objects.
- **Templates** — Screenshot breakdown, Wireframe kit, Flow map, Moodboard grid, Shot plan and
  Idea brief. Each drops a whole working layout and zooms to it.

**Outlines** (<kbd>B</kbd>) — bullet, numbered or checkbox lists where any row with children gets
a fold triangle you click on the canvas. Double-click to edit as plain text; two leading spaces
per level of nesting. Collapse-all and expand-all live in the inspector.

**Inspector** (right dock, Design tab) — X / Y / W / H / rotation with drag-to-scrub numeric
fields, fill, stroke, weight, dash, corner radius, opacity, shadow, font family, size, weight,
italic, alignment, vertical alignment, line height, letter spacing, note kind, connector shape
and ends, connector label, image crop / trace / flip, frame chrome and URL, freehand smoothing,
align and distribute. With nothing selected it edits the style the *next* object will use.

**Layers tab** — full tree with groups, rename, show/hide, lock, reorder.

**Canvas tab** — seven surfaces (blank, dot grid, graph, blueprint, paper, slate, transparent),
grid size and contrast, snapping, Sketch / Normal / Precision rendering, and a **unit scale** so
measurements read in mm, cm or inches instead of pixels.

**Connectors** — arrows dock to objects. Move the object and the arrow re-routes to the nearest
edge. Drag an endpoint onto something else to re-dock it, or the mid handle to bow the curve.

**Selection** — click, shift-click, marquee, resize and rotate handles, <kbd>Alt</kbd>-drag to
duplicate, arrow-key nudge, hover outline, right-click menu, group/ungroup, lock, hide.

**Snapping** — edge, centre and equal-spacing guides while dragging, optional grid snap,
<kbd>Ctrl</kbd> to suspend.

**Getting images in** — drag files from the desktop, drag an image straight off another web page
(it arrives as a URL and is loaded as a real image, not a link card), paste a screenshot, or
press <kbd>I</kbd>. A drop veil confirms the target while you drag.

**Camera** — zoom steps, presets, fit and reset all glide with an eased tween instead of
jumping, and mouse-wheel notches are eased while trackpad pinch stays direct and continuous.

**Everything else** — command menu (<kbd>Ctrl</kbd>+<kbd>K</kbd>), radial quick menu on
right-click of empty canvas, stamps library (button, card, nav bar, sidebar, avatar, three-step
flow, 2×2 matrix, shot plan, light plan), minimap, board manager, keyboard reference
(<kbd>?</kbd>), status readout, presentation mode, PNG export at 1×/2×/4× of the selection or
whole board, copy-as-image, IndexedDB autosave.

## Home gallery

Launches to a gallery: an editorial hero, canvas presets (Freeform, Square, Portrait, Story,
Wide, Desktop, Phone, A4, Custom), the template row, and recent boards with live vector
thumbnails, duplicate / save-to-file / delete. A fixed-size canvas draws a real page you can
align to.

## Animation

The film icon opens a Procreate-style timeline. Cels stack in one place; **Add cel** copies the
current one so you draw the next pose on top of the last, with onion skins behind it. Play at any
frame rate, loop, ping-pong or once. Export as WebM video, a PNG sprite sheet, or a numbered PNG
sequence.

## Media

Drop or paste a video or audio file (up to 30MB) and it lands as a real player: a play button,
a scrub bar and a running time drawn into the scene. Video starts muted. Loop and sound are one
click away in the toolbar above the selection.

## AI

The **AI** tab (and the AI menu / options strip) sees your sketch:

- **Sketch → Image** — the board or selection is rasterised and sent to the image model with a
  style (Photo, Illustration, UI design, Product shot, 3D, Diagram); the result lands beside it.
- **Sketch → Website** — a wireframe becomes one self-contained HTML page, kept on the board as
  a site card (double-click to open; download from the AI menu).
- **Sketch → Video** — Veo animates a keyframe rendered from the sketch (4/6/8s) and the clip
  lands as a media object.
- **Read it** — what the model sees.

Plus the original prompt modes: **Ideas**, **Outline**, **Diagram**, **Critique**, **Image**.

**Image engines** (AI › Image providers): *Auto* uses Gemini when the key has image quota and
otherwise falls back to **Pollinations** (open-weight FLUX, free, no key). You can also pick
**Hugging Face Inference** (FLUX.1-schnell or any text-to-image model id, free token) or a
**local Stable Diffusion** server (AUTOMATIC1111 / Forge / SD.Next started with
`--api --cors-allow-origins=*`) — the local route does true img2img over your sketch. Text-only
engines get a prompt written from the sketch by the text model first.

Video generation needs a key with billing enabled on its Google AI Studio project — a free-tier
key runs the text models but returns a quota error for Veo, which the app explains inline.

Bring your own key. It is typed into the panel and kept in that browser's `localStorage` only —
never in these files, never through any server of ours — and the request goes straight to the
provider. A personal build can seed it from a git-ignored `.env.local`
(`VITE_GEMINI_API_KEY=…`); anything in `VITE_*` ends up in the bundle, so only do that for a
build you alone open. "Load available models" asks the provider what it actually offers, so a renamed model
never blocks you.

## Keyboard

```
V select     H hand       P draw      ⇧P highlighter   E eraser
A arrow      L line       M measure   R rect  ⇧R triangle
O ellipse    ⇧O diamond   F frame     T text  N note    B outline   I image

Space+drag pan     Ctrl+scroll zoom     Shift+scroll pan sideways
0 reset   1 fit board   2 fit selection   +/- zoom

Ctrl+Z / Ctrl+Shift+Z    undo / redo        Ctrl+C/V/X   copy / paste / cut
Ctrl+D duplicate         Ctrl+G / ⇧G        group / ungroup
Ctrl+A select all        Ctrl+] / [         front / back
Ctrl+L lock              Ctrl+K or /        command menu
?      shortcuts         Delete             remove selection
```

Tool keys work two ways: **tap** <kbd>A</kbd> to latch the arrow tool, or **hold** <kbd>A</kbd>,
drag, and release — the tool springs back to Select. Same for <kbd>L</kbd> <kbd>R</kbd>
<kbd>O</kbd> <kbd>P</kbd> <kbd>M</kbd>. The padlock at the bottom of the rail keeps any tool
active for repeated use.

## Architecture

```
src/
  types.ts            one object model for everything on the board
  store/
    store.ts          zustand + immer: document, camera, selection, history, clipboard, UI
    factory.ts        object constructors, style defaults, stamp library
  canvas/
    Canvas.tsx        pointer/wheel/touch gestures, tools, snapping, crop, endpoints
    Shapes.tsx        Konva renderers per object type (incl. sketch + device chrome)
    TextEditor.tsx    DOM textarea overlay for text editing
  lib/                geometry, snapping, freehand, theme + units, export, images,
                      effects (Konva filter stack), imageTools (cut-out, vectorise, rasterise),
                      studio (selection-driven AI + image commands), aiBoard (idea → board),
                      webkit (web UI blocks), imageProviders (Gemini / FLUX / HF / local SD),
                      stock (Openverse, Unsplash, Pixabay, Pexels)
  builder/            Site Builder: section database, live section components, templates,
                      HTML export + build prompt, section → canvas objects
  ui/                 tool rail, context toolbar, dock (inspector/layers/canvas), menus,
                      minimap, stamps, dialogs, mobile bar
  persist/idb.ts      IndexedDB board storage
```

Rendering is a Konva scene (`react-konva`): one layer for content and the transformer, one for
guides, marquee and endpoint handles. Undo/redo stores immutable document snapshots; immer's
structural sharing keeps them cheap. A drag snapshots once at gesture start, so a whole drag is
one undo step — and a gesture that changes nothing leaves no step at all. Connector re-routing
and group bounds recompute in a single pass after every edit.

In development, `window.flowcanvas` exposes the store and `window.flowcanvasRefs` the live Konva
handles.

**Frames own their contents.** Anything whose centre lands inside a frame — dropped there or
drawn there — becomes its child, so moving the frame later carries everything with it.

## Notes on the fixes worth knowing about

- **Hit testing.** Konva refreshes its hit canvas on its own draw loop, so a shape or a
  transformer handle could be on screen a frame before it was clickable: resize anchors fell
  through to "empty canvas" and cleared the selection, and the rotate handle moved the object
  instead of turning it. Every pointer-down, double-click and right-click now redraws the hit
  graph first, which makes each grab exact. Hover is left on the normal loop — it is allowed to
  be a frame stale and is not worth a redraw per mouse move.
- **Text focus.** The editor overlay focuses on the next task, not immediately: the browser
  still has a compatibility `mousedown` to dispatch for the click that opened it, which would
  otherwise pull focus straight back to the document.
- **StrictMode and empty objects.** The editor commits on unmount so nothing typed is ever lost.
  React's development StrictMode mounts, unmounts and remounts every component, which fired that
  commit on the throwaway pass and deleted the text or note that had just been created. The
  commit is now deferred one task and skipped if the same editor is still alive.

## Still out of scope

Real-time collaboration, comments, share links, cloud sync, version history, PDF export,
presentation ordering with spotlight and laser, and shape recognition.

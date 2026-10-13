# CoolCanvas

**Think in space. Explain it visually.**

One Windows application with four workspaces, all of them local and all of them yours:

| Workspace | What it is |
|---|---|
| **Canvas** | The infinite board: sketching, diagrams, wireframes, sticky notes, frames, the site builder, animation and the AI tools. |
| **Photo Studio** | A raster editor: layers, masks, adjustment layers, layer styles, type, brushes and real PSD files. |
| **Vector Studio** | A vector editor: Bézier paths, boolean shapes, strokes, type on a path, SVG, PDF and EPS. |
| **3D Spatial** | The canvas in three dimensions, for thinking about space rather than a page. |

Created by Sir Newson at [yxmdigital.com](https://yxmdigital.com).

## Get started

```bash
npm install
npm run dev          # the canvas in a browser, at http://127.0.0.1:5190
npm run desktop      # the Windows app
```

The studios need their engines built once. They are Rust, they build from source in this
repository, and everything they need is free:

```bash
rustup target add wasm32-unknown-unknown

npm run engines:native   # coolphoto.exe + coolvector.exe   — their own windows
npm run engines:web      # WebAssembly studios              — inside the app window
```

Then:

```bash
npm run desktop:dist     # CoolCanvas-Setup-1.0.0.exe in desktop/release
```

## How the pieces fit

```
editor/            the canvas — React, Konva, Zustand (first-party)
engines/photo/     Photo Studio engine   — Rust, from PhotoCraft (MIT OR Apache-2.0)
engines/vector/    Vector Studio engine  — Rust, from VectorCraft (MIT OR Apache-2.0)
integrations/      CoolCanvas's own host page around the engines
desktop/           the Windows shell — Electron, the app protocol, native studios
scripts/           engine builds and the app icons
docs/ENGINES.md    what the engines are, where they came from, and their limits
```

The two studio engines are modified copies of the ArtCraft team's open-source
[PhotoCraft](https://github.com/storytold/photocraft) and
[VectorCraft](https://github.com/storytold/vectorcraft), renamed into this project, with
their licences and attribution kept and their trademarked brand marks removed.
[docs/ENGINES.md](docs/ENGINES.md) sets out exactly what was changed and what was not.
CoolCanvas is not affiliated with, nor endorsed by, the ArtCraft team.

## Moving work between the workspaces

- **Send selection** in a studio's bar rasterises what is selected on the board and opens it
  in that studio.
- **Bring back** puts what the studio saved onto the board, beside what it came from.
- **Native window** opens the installed native studio on the same selection; anything it
  saves into the session folder returns to the board on its own.

## What it never does

No account, no sign-in, no server, no subscription, no paid API and no generation credits.
Boards live in this browser's storage or in `.yxm` files; studio documents are ordinary files
on disk. The only network calls the app makes are ones you ask for by name: your own AI key,
the free stock-photo search, and MCP connectors you add yourself.

## The canvas

Everything the board does — the tools, the site builder, the recipes, the effects, layers,
the AI sketch pipeline, stock images and MCP connectors — is documented in
[docs/CANVAS.md](docs/CANVAS.md).

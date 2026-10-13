# CoolCanvas and its studio engines

CoolCanvas is one application with three workspaces: the **Canvas** (visual thinking, the
board), **Photo Studio** (raster images) and **Vector Studio** (paths and illustration).
A fourth, **3D Spatial**, is the canvas in three dimensions.

The canvas is first-party TypeScript. The two studios are built from Rust source that lives
in this repository, in `engines/photo` and `engines/vector`.

## Where the engines came from

They are modified copies of two open-source projects by the ArtCraft team:

| Studio | Upstream | Version | Licence |
|---|---|---|---|
| Photo Studio | [PhotoCraft](https://github.com/storytold/photocraft) | 0.8.2 | MIT OR Apache-2.0 |
| Vector Studio | [VectorCraft](https://github.com/storytold/vectorcraft) | 0.8.x | MIT OR Apache-2.0 |

Both are clean-room reimplementations of Photoshop and Illustrator in pure Rust. Vendoring
them is what their licences allow and what this repository does, in the open:

- The crates, binaries, identifiers and environment variables were renamed to `coolphoto-*`
  and `coolvector-*`, so the two workspaces can live side by side and are unmistakably ours
  to change.
- The upstream's **trademarked brand marks and application icons were removed**
  (`docs/brand/`, `assets/app-icon/`). Their own terms require that of forks, and CoolCanvas
  draws its own icons instead (`scripts/make-icons.mjs`).
- `LICENSE-MIT`, `LICENSE-APACHE`, `NOTICE` and `ATTRIBUTION.md` stay with each engine and
  ship with the app. Each `NOTICE` names the upstream project, version and licence.
- Everything inside those engines — the imaging, PSD, colour management, GPU compositing,
  path geometry, text and automation code — is the upstream's work. CoolCanvas is not
  affiliated with, nor endorsed by, the ArtCraft team.

This is the same arrangement CoolMotion has with EffectCraft.

## How a studio runs

Each engine builds two ways from the same source:

**In the window (WebAssembly).** `npm run engines:web` builds `coolphoto-web` /
`coolvector-web` with Trunk into `out/studio-web/<id>`. The app loads it in a frame through
our own host page (`integrations/studios/host.html`), which picks the GPU backend, carries
files in and reports results back. This is the blended path: one window, one task bar entry.

**Its own window (native).** `npm run engines:native` builds `coolphoto.exe` and
`coolvector.exe` into `out/studios`. The installer includes them, and **Native window** in a
studio's bar opens one on the current selection. This path has the full GPU and the fewest
limits, and is the better choice for large documents.

Neither path uses a server, an account, a subscription or any paid API. The engines are
local files and every document stays on the device.

## What crosses between the canvas and a studio

Deliberately little, and always as a file:

- **Send selection** rasterises the selection (or the whole board) to a PNG and hands it to
  the studio exactly as if it had been dropped on its canvas, so the engine's own open path
  runs and every format it supports arrives intact.
- **Bring back** takes what the studio saved and places it on the board beside the objects it
  came from, as an ordinary image object with layers, effects and export behaving as usual.
- The native path uses a session folder in `%APPDATA%\CoolCanvas\studio-session`: CoolCanvas
  writes the PNG there and watches for anything the studio saves beside it.

The canvas document (`.yxm`) and the studios' own documents (`.pcraft`, PSD, SVG) stay
separate formats. This is two engines in one app, not one shared document model.

## Building

```bash
npm install                 # the editor
npm run engines:native      # the native studios        (Rust, ~10 min each the first time)
npm run engines:web         # the in-window studios     (Rust → WebAssembly, needs Trunk)
npm run dev                 # the canvas, in a browser
npm run desktop             # the Windows app
npm run desktop:dist        # the installer
```

Everything needed is free: [rustup](https://rustup.rs) for the Rust toolchain, the
`wasm32-unknown-unknown` target for the web build, and Trunk (a binary in `out/tools`, or
`cargo install trunk --locked`).

Build caches go to `out/cargo` and `../.cargo-cache` on this drive rather than the system
drive, because a full `C:` otherwise fails a long build at the link step.

## Known limits

- The studios are early alpha upstream. Their registered features do not imply full
  Photoshop or Illustrator fidelity.
- The WebAssembly path needs WebGPU; where that fails, the studio bar offers a WebGL/CPU
  path, which is slower. The native path has no such limit.
- Browser builds have memory, storage and font limits the native builds do not.
- The engines' optional model downloads are not preloaded and are never invoked by CoolCanvas.

/*
 * CoolCanvas — Windows desktop shell.
 * Created by Sir Newson at YXMDigital.com
 *
 * It owns the window, the coolcanvas:// app protocol (which also serves the studio
 * engines with the headers WebAssembly threads need), native file dialogs and board
 * files, and the two native studios in engines/.
 *
 * Everything runs on this device. No account, no server, no paid service.
 */
const { app, BrowserWindow, dialog, ipcMain, nativeTheme, protocol, screen, shell, Menu } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const APP_ID = "com.yxmdigital.coolcanvas";
const BOARD_EXT = "yxm";
const IS_DEV = !app.isPackaged;
const WEB_DIR = path.join(__dirname, "web");
const STUDIO_DIR = path.join(__dirname, "studios");
const DEV_SERVER = process.env.COOLCANVAS_DEV_SERVER; // e.g. http://127.0.0.1:5190

app.setAppUserModelId(APP_ID);
app.setName("CoolCanvas");

protocol.registerSchemesAsPrivileged([
  { scheme: "coolcanvas", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

/* ─── small JSON stores in %APPDATA%\CoolCanvas ─────────────────────────── */

const store = (name, fallback) => {
  const file = () => path.join(app.getPath("userData"), `${name}.json`);
  return {
    read() {
      try {
        return { ...fallback, ...JSON.parse(fs.readFileSync(file(), "utf8")) };
      } catch {
        return { ...fallback };
      }
    },
    write(value) {
      try {
        fs.mkdirSync(path.dirname(file()), { recursive: true });
        fs.writeFileSync(file(), JSON.stringify(value, null, 2));
      } catch (e) {
        console.error(`store ${name}:`, e);
      }
    },
  };
};

const windowStore = store("window-state", { width: 1480, height: 940, maximized: true });

/* ─── the window ────────────────────────────────────────────────────────── */

let win = null;

function createWindow() {
  const saved = windowStore.read();
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: Math.min(saved.width, area.width),
    height: Math.min(saved.height, area.height),
    minWidth: 980,
    minHeight: 640,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#141512" : "#f6f5f2",
    title: "CoolCanvas",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // The studio engines run their own worker threads.
      webSecurity: true,
    },
  });
  if (saved.maximized) win.maximize();
  Menu.setApplicationMenu(null);

  const url = DEV_SERVER ?? "coolcanvas://app/index.html";
  win.loadURL(url);
  win.once("ready-to-show", () => win.show());

  const remember = () => {
    if (!win || win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    windowStore.write({ width: bounds.width, height: bounds.height, maximized: win.isMaximized() });
  };
  win.on("resize", remember);
  win.on("move", remember);
  win.on("close", remember);
  win.on("closed", () => {
    win = null;
  });
  for (const event of ["maximize", "unmaximize"]) {
    win.on(event, () => win?.webContents.send("window:maximized", win.isMaximized()));
  }

  // Links to the wider web open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:/i.test(target)) shell.openExternal(target);
    return { action: "deny" };
  });
}

/* ─── coolcanvas:// — the app, and the studio engines beside it ─────────── */

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function serve(request) {
  const url = new URL(request.url);
  // coolcanvas://app/... — the editor, and the studios under /engine/<id>/, which the staging
  // script puts inside the editor's own tree so one path works in the browser and in the app.
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
  let file = path.join(WEB_DIR, rel);
  if (!file.startsWith(WEB_DIR)) return new Response("Forbidden", { status: 403 });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // A missing studio must say so rather than quietly serving the editor.
    if (rel.startsWith("engine/")) return new Response("Not found", { status: 404 });
    // The editor is a single page; unknown paths fall back to it.
    file = path.join(WEB_DIR, "index.html");
  }
  const headers = {
    "content-type": MIME[path.extname(file)] ?? "application/octet-stream",
    // SharedArrayBuffer for the engines' worker threads.
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-embedder-policy": "require-corp",
    "cross-origin-resource-policy": "cross-origin",
  };
  return new Response(fs.readFileSync(file), { headers });
}

/* ─── native studios ────────────────────────────────────────────────────── */

const STUDIO_BIN = { photo: "coolphoto.exe", vector: "coolvector.exe" };
const sessionDir = () => {
  const dir = path.join(app.getPath("userData"), "studio-session");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

function studioPath(studio) {
  const name = STUDIO_BIN[studio];
  if (!name) return null;
  const candidates = [
    path.join(STUDIO_DIR, name),
    path.join(process.resourcesPath ?? "", "studios", name),
    path.join(__dirname, "..", "..", "out", "studios", name), // developing from the repo
  ];
  return candidates.find((p) => p && fs.existsSync(p)) ?? null;
}

/**
 * Opens a native studio on a copy of the selection and watches the session folder.
 * Anything the studio saves there comes straight back to the board.
 */
function openNativeStudio(studio, png) {
  const exe = studioPath(studio);
  if (!exe) return false;
  const dir = sessionDir();
  const args = [];
  if (png) {
    const file = path.join(dir, `canvas-${Date.now()}.png`);
    fs.writeFileSync(file, Buffer.from(png));
    args.push(file);
  }
  const child = spawn(exe, args, { detached: true, stdio: "ignore" });
  child.unref();
  watchSession(studio, dir);
  return true;
}

const watched = new Set();
function watchSession(studio, dir) {
  if (watched.has(dir)) return;
  watched.add(dir);
  const seen = new Map(fs.readdirSync(dir).map((f) => [f, fs.statSync(path.join(dir, f)).mtimeMs]));
  fs.watch(dir, (_event, name) => {
    if (!name || !win || win.isDestroyed()) return;
    const file = path.join(dir, name);
    setTimeout(() => {
      if (!fs.existsSync(file)) return;
      const stat = fs.statSync(file);
      if (!stat.isFile() || seen.get(name) === stat.mtimeMs) return;
      seen.set(name, stat.mtimeMs);
      if (!/\.(png|jpe?g|webp|tiff?|svg|psd)$/i.test(name)) return;
      if (/^canvas-\d+\.png$/i.test(name)) return; // what we sent in
      win.webContents.send("studio:result", {
        studio,
        name,
        type: name.toLowerCase().endsWith(".svg") ? "image/svg+xml" : "image/png",
        bytes: fs.readFileSync(file).buffer,
      });
    }, 400); // let the studio finish writing
  });
}

/* ─── IPC ───────────────────────────────────────────────────────────────── */

ipcMain.handle("window:minimize", () => win?.minimize());
ipcMain.handle("window:maximize", () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.handle("window:close", () => win?.close());
ipcMain.handle("window:is-maximized", () => !!win?.isMaximized());

ipcMain.handle("file:open", async (_e, filters) => {
  const result = await dialog.showOpenDialog(win, { properties: ["openFile"], filters: filters?.length ? filters : undefined });
  if (result.canceled || !result.filePaths[0]) return null;
  const file = result.filePaths[0];
  return { name: path.basename(file), data: fs.readFileSync(file).buffer };
});

ipcMain.handle("file:save", async (_e, name, data) => {
  const result = await dialog.showSaveDialog(win, {
    defaultPath: path.join(app.getPath("documents"), name ?? `board.${BOARD_EXT}`),
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, Buffer.from(typeof data === "string" ? Buffer.from(data) : data));
  return result.filePath;
});

ipcMain.handle("studio:open", (_e, studio, png) => openNativeStudio(studio, png));
ipcMain.handle("studio:installed", () => ({ photo: !!studioPath("photo"), vector: !!studioPath("vector") }));
ipcMain.handle("app:info", () => ({ platform: process.platform, version: app.getVersion(), dev: IS_DEV, cpus: os.cpus().length }));

/* ─── lifecycle ─────────────────────────────────────────────────────────── */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    protocol.handle("coolcanvas", serve);
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

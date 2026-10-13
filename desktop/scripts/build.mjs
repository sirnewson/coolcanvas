/**
 * Assembles the CoolCanvas Windows app.
 *
 *   node desktop/scripts/build.mjs           build the editor and stage it
 *   node desktop/scripts/build.mjs --dir     …and an unpacked Windows build
 *   node desktop/scripts/build.mjs --dist    …and the installer
 *
 * The studio engines are included when they have been built:
 *   npm run engines:web      WebAssembly studios, inside the window
 *   npm run engines:native   native studios, their own windows
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DESKTOP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(DESKTOP, "..");
const APP = path.join(DESKTOP, "app");
const argv = process.argv.slice(2);
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

/* 1 — the editor */
console.log("CoolCanvas: building the editor…");
run(npx, ["vite", "build"], ROOT);
const web = path.join(APP, "web");
fs.rmSync(web, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "dist"), web, { recursive: true });

/* 2 — the studios, if they are built. They sit beside the editor so one path,
      /engine/<id>/host.html, works in the browser and in the app alike. */
const engines = path.join(web, "engine");
fs.rmSync(engines, { recursive: true, force: true });
let staged = [];
for (const id of ["photo", "vector"]) {
  const from = path.join(ROOT, "out", "studio-web", id);
  if (!fs.existsSync(from)) continue;
  fs.cpSync(from, path.join(engines, id), { recursive: true });
  staged.push(id);
}
const studios = path.join(APP, "studios");
fs.rmSync(studios, { recursive: true, force: true });
const native = path.join(ROOT, "out", "studios");
if (fs.existsSync(native)) {
  fs.cpSync(native, studios, { recursive: true });
}
console.log(
  staged.length ? `CoolCanvas: in-window studios staged (${staged.join(", ")}).` : "CoolCanvas: no WebAssembly studios yet — run npm run engines:web.",
);
if (fs.existsSync(studios)) {
  const exes = fs.readdirSync(studios).filter((f) => f.endsWith(".exe"));
  console.log(exes.length ? `CoolCanvas: native studios staged (${exes.join(", ")}).` : "CoolCanvas: no native studios yet — run npm run engines:native.");
}

/* 3 — the window's own icon */
const icon = path.join(DESKTOP, "build", "icon.png");
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(APP, "icon.png"));

/* 4 — package, if asked */
if (argv.includes("--dist") || argv.includes("--dir")) {
  if (!fs.existsSync(path.join(DESKTOP, "node_modules"))) {
    console.log("CoolCanvas: installing the packaging tools…");
    run(process.platform === "win32" ? "npm.cmd" : "npm", ["install"], DESKTOP);
  }
  run(npx, ["electron-builder", "--win", "--x64", ...(argv.includes("--dir") ? ["--dir"] : []), "--config", "electron-builder.yml"], DESKTOP);
}

console.log("CoolCanvas: desktop build staged in desktop/app.");

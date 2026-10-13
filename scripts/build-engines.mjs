/**
 * Builds the CoolCanvas studio engines from our own Rust source in engines/.
 *
 *   node scripts/build-engines.mjs            native release binaries (the desktop studios)
 *   node scripts/build-engines.mjs --web      WebAssembly builds for the in-app studios
 *   node scripts/build-engines.mjs --photo    just one engine (also --vector)
 *   node scripts/build-engines.mjs --check    cargo check only, much faster
 *
 * Everything it needs is free: the Rust toolchain from rustup.rs, and for --web the
 * wasm32-unknown-unknown target. Caches live on this drive so a full system disk cannot
 * stop a build.
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENGINES = [
  { id: "photo", name: "Photo Studio", bin: "coolphoto", web: "coolphoto-web" },
  { id: "vector", name: "Vector Studio", bin: "coolvector", web: "coolvector-web" },
];

const argv = process.argv.slice(2);
const want = ENGINES.filter((e) => argv.includes(`--${e.id}`));
const targets = want.length ? want : ENGINES;
const web = argv.includes("--web");
const check = argv.includes("--check");

/**
 * Build caches on this drive, next to the project. Windows system drives fill up, and
 * a failed link step halfway through a 30-minute build is the worst way to find out.
 */
const CACHE = path.join(path.dirname(ROOT), ".cargo-cache");
const env = { ...process.env, CARGO_HOME: fs.existsSync(CACHE) ? CACHE : process.env.CARGO_HOME ?? "" };
if (!env.CARGO_HOME) delete env.CARGO_HOME;
// Trunk maps NO_COLOR onto a true/false flag, so a bare NO_COLOR=1 in the environment
// stops it before it starts.
if (env.NO_COLOR !== undefined && env.NO_COLOR !== "true" && env.NO_COLOR !== "false") delete env.NO_COLOR;
const tmp = path.join(ROOT, "out", "tmp");
fs.mkdirSync(tmp, { recursive: true });
env.TMP = env.TEMP = tmp;

// Git for Windows puts a coreutils `link` on PATH that shadows the MSVC linker.
if (process.platform === "win32") {
  const key = Object.keys(env).find((k) => k.toLowerCase() === "path") ?? "PATH";
  env[key] = env[key]
    .split(path.delimiter)
    .filter((p) => !/[\\/]git[\\/]usr[\\/]bin/i.test(p) && !/^\/usr\/bin$/.test(p))
    .join(path.delimiter);
}

const LOCAL_TRUNK = path.join(ROOT, "out", "tools", process.platform === "win32" ? "trunk.exe" : "trunk");
const trunkBin = () => (fs.existsSync(LOCAL_TRUNK) ? LOCAL_TRUNK : "trunk");

function has(command) {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore", env, shell: process.platform === "win32" });
    return true;
  } catch {
    return false;
  }
}

if (!has("cargo")) {
  console.error("Rust is not installed. Get it free from https://rustup.rs, then run this again.");
  process.exit(1);
}

let failed = 0;
for (const engine of targets) {
  const cwd = path.join(ROOT, "engines", engine.id);
  const targetDir = path.join(ROOT, "out", "cargo", engine.id);
  const run = { cwd, stdio: "inherit", env: { ...env, CARGO_TARGET_DIR: targetDir }, shell: process.platform === "win32" };
  const label = `CoolCanvas ${engine.name}`;

  if (web) {
    console.log(`\n${label}: building for the browser (WebAssembly).`);
    if (!has(trunkBin())) {
      console.error(
        "Trunk is needed for the web build and is free:\n  cargo install trunk --locked\n" +
          "  rustup target add wasm32-unknown-unknown\n" +
          "Skipping the web build; the native studio still builds.",
      );
      failed += 1;
      continue;
    }
    const app = path.join(cwd, "apps", engine.web);
    const built = spawnSync(trunkBin(), ["build", "--release"], { ...run, cwd: app });
    if (built.status !== 0) {
      failed += 1;
      continue;
    }
    const out = path.join(ROOT, "out", "studio-web", engine.id);
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    fs.cpSync(path.join(cwd, "dist", "web"), out, { recursive: true });
    fs.copyFileSync(path.join(ROOT, "integrations", "studios", "host.html"), path.join(out, "host.html"));
    copyLicences(cwd, path.join(out, "licenses"));
    console.log(`${label} → ${path.relative(ROOT, out)}`);
    continue;
  }

  console.log(`\n${label}: ${check ? "checking" : "building"} the native studio — the first build takes a while.`);
  const args = check ? ["check", "--release", "-p", engine.bin] : ["build", "--release", "-p", engine.bin, "--bin", engine.bin];
  const built = spawnSync("cargo", args, run);
  if (built.status !== 0) {
    failed += 1;
    continue;
  }
  if (check) continue;
  const exe = path.join(targetDir, "release", process.platform === "win32" ? `${engine.bin}.exe` : engine.bin);
  const out = path.join(ROOT, "out", "studios");
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(exe, path.join(out, path.basename(exe)));
  copyLicences(cwd, path.join(out, "licenses", engine.id));
  console.log(`${label} → ${path.relative(ROOT, path.join(out, path.basename(exe)))} (${(fs.statSync(exe).size / 1e6).toFixed(1)} MB)`);
}

function copyLicences(engineDir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of ["LICENSE-MIT", "LICENSE-APACHE", "NOTICE", "ATTRIBUTION.md"]) {
    const from = path.join(engineDir, file);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, file));
  }
  const fonts = path.join(engineDir, "assets", "fonts");
  if (fs.existsSync(fonts)) {
    for (const file of fs.readdirSync(fonts).filter((f) => /^(OFL|LICENSE)/.test(f))) {
      fs.copyFileSync(path.join(fonts, file), path.join(dest, file));
    }
  }
}

process.exit(failed ? 1 : 0);

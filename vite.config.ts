import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

/**
 * Serves the Photo Studio engine in development.
 *
 * `npm run engine:build` puts the WebAssembly build in out/engine-web, and the
 * official unmodified upstream release lands in third-party/photocraft/web.
 * Both are served from disk so the dev server behaves like the packaged app.
 */
function engineStatic(): Plugin {
  const mounts: [string, string][] = [
    ["/engine/photo/", path.join(root, "out", "studio-web", "photo")],
    ["/engine/vector/", path.join(root, "out", "studio-web", "vector")],
  ];
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".wasm": "application/wasm",
    ".json": "application/json",
    ".css": "text/css",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".ttf": "font/ttf",
  };
  return {
    name: "coolcanvas-engine-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const mount = mounts.find(([prefix]) => url.startsWith(prefix));
        if (!mount) return next();
        const [prefix, dir] = mount;
        const rel = decodeURIComponent(url.slice(prefix.length)) || "index.html";
        const file = path.join(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.statusCode = 404;
          res.end(`That studio is not built yet (${prefix}). Build it once with: npm run engines:web`);
          return;
        }
        // The engine runs its own threads; these headers enable SharedArrayBuffer.
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("content-type", types[path.extname(file)] ?? "application/octet-stream");
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

/** Dev twin of the Netlify MCP relay, for servers that do not allow browser origins. */
function mcpProxy(): Plugin {
  return {
    name: "coolcanvas-mcp-proxy",
    configureServer(server) {
      server.middlewares.use("/api/mcp-proxy", async (req, res) => {
        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          res.end();
          return;
        }
        const target = String(req.headers["x-mcp-target"] ?? "");
        if (!/^https:\/\//i.test(target)) {
          res.statusCode = 400;
          res.end("x-mcp-target must be an https URL");
          return;
        }
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v !== "string") continue;
          if (["content-type", "accept", "authorization", "mcp-session-id", "mcp-protocol-version"].includes(k) || (k.startsWith("x-") && k !== "x-mcp-target")) headers[k] = v;
        }
        try {
          const upstream = await fetch(target, { method: "POST", headers, body: Buffer.concat(chunks) });
          res.statusCode = upstream.status;
          const ct = upstream.headers.get("content-type");
          if (ct) res.setHeader("content-type", ct);
          const sid = upstream.headers.get("mcp-session-id");
          if (sid) res.setHeader("mcp-session-id", sid);
          res.setHeader("access-control-expose-headers", "mcp-session-id");
          res.end(await upstream.text());
        } catch (e) {
          res.statusCode = 502;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  root: "editor",
  publicDir: path.join(root, "public"),
  plugins: [react(), engineStatic(), mcpProxy()],
  // Relative URLs so the same build runs from disk inside the desktop shell.
  base: "./",
  build: { outDir: path.join(root, "dist"), emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5190 },
});

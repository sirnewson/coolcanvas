/**
 * MCP connectors — talk to any Model Context Protocol server that speaks the
 * Streamable HTTP transport (JSON-RPC over POST), straight from the page.
 *
 * Servers that do not send CORS headers are reached through a same-origin
 * proxy (`/api/mcp-proxy`, a Vite middleware in dev and a Netlify function in
 * production) that forwards the request and the auth header verbatim. Keys are
 * kept in this browser only and are sent to nothing but the server you named.
 */

export interface McpServer {
  id: string;
  name: string;
  url: string;
  /** Sent as-is, e.g. "Bearer sk-…" or "x-api-key: …" (header: value). */
  auth: string;
  /** Route through the same-origin proxy (needed when the server has no CORS). */
  viaProxy: boolean;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: { type?: string; properties?: Record<string, McpProp>; required?: string[] };
}

export interface McpProp {
  type?: string | string[];
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: McpProp;
}

export interface McpContent {
  type: "text" | "image" | "audio" | "resource" | "resource_link";
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  resource?: { uri?: string; text?: string; blob?: string; mimeType?: string };
}

const STORE = "yxm-canvas:mcp-servers";

export function loadServers(): McpServer[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]") as McpServer[];
  } catch {
    return [];
  }
}

export function saveServers(list: McpServer[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list));
  } catch {
    /* storage can be disabled */
  }
}

/** Ready-made entries for services people commonly hold accounts with. Paste the MCP URL from the provider's docs. */
export const PRESETS: { name: string; hint: string; auth: string }[] = [
  { name: "Freepik · Magnific", hint: "Freepik's MCP endpoint (Mystic, Magnific upscaler, retouch, remove background)", auth: "x-freepik-api-key: " },
  { name: "Replicate", hint: "Replicate's hosted MCP", auth: "Bearer r8_…" },
  { name: "fal.ai", hint: "fal's MCP endpoint", auth: "Key …" },
  { name: "Custom", hint: "Any Streamable-HTTP MCP server", auth: "Bearer …" },
];

const sessions = new Map<string, string>();
let counter = 1;

function headersFor(server: McpServer): Record<string, string> {
  const h: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  const auth = server.auth.trim();
  if (auth) {
    const m = /^([\w-]+):\s*(.+)$/.exec(auth);
    if (m && !/^(bearer|basic|key|token)$/i.test(m[1])) h[m[1]] = m[2];
    else h.authorization = auth;
  }
  const sid = sessions.get(server.id);
  if (sid) h["mcp-session-id"] = sid;
  return h;
}

/** Parse a Streamable HTTP reply — either plain JSON or an SSE stream of JSON-RPC messages. */
async function readReply(res: Response, id: number): Promise<unknown> {
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    const text = await res.text();
    const messages = text
      .split(/\n\n+/)
      .map((chunk) =>
        chunk
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n"),
      )
      .filter(Boolean)
      .map((d) => {
        try {
          return JSON.parse(d) as { id?: number; result?: unknown; error?: { message?: string } };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { id?: number; result?: unknown; error?: { message?: string } }[];
    const mine = messages.find((m) => m.id === id) ?? messages[messages.length - 1];
    if (!mine) throw new Error("Empty reply from the server.");
    if (mine.error) throw new Error(mine.error.message ?? "MCP error");
    return mine.result;
  }
  const text = await res.text();
  if (!text.trim()) return null;
  const json = JSON.parse(text) as { result?: unknown; error?: { message?: string } };
  if (json.error) throw new Error(json.error.message ?? "MCP error");
  return json.result;
}

async function rpc(server: McpServer, method: string, params?: unknown, notify = false): Promise<unknown> {
  const id = counter++;
  const body = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params };
  const target = server.viaProxy ? "/api/mcp-proxy" : server.url;
  const headers = headersFor(server);
  if (server.viaProxy) headers["x-mcp-target"] = server.url;
  let res: Response;
  try {
    res = await fetch(target, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new Error(server.viaProxy ? "The proxy is not reachable — run the dev server or deploy with the function." : "The server refused a browser call — switch on “Route through proxy”.");
  }
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessions.set(server.id, sid);
  if (res.status === 401 || res.status === 403) throw new Error("The server rejected the key — check the Auth field.");
  if (!res.ok && res.status !== 202) throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  if (notify || res.status === 202) return null;
  return readReply(res, id);
}

/** Initialise a session and list the server's tools. */
export async function connect(server: McpServer): Promise<McpTool[]> {
  sessions.delete(server.id);
  await rpc(server, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "yxm-canvas", version: "1.0.0" },
  });
  await rpc(server, "notifications/initialized", {}, true);
  const result = (await rpc(server, "tools/list", {})) as { tools?: McpTool[] } | null;
  return result?.tools ?? [];
}

export async function callTool(server: McpServer, name: string, args: Record<string, unknown>): Promise<McpContent[]> {
  const result = (await rpc(server, "tools/call", { name, arguments: args })) as { content?: McpContent[]; isError?: boolean } | null;
  const content = result?.content ?? [];
  if (result?.isError) {
    const msg = content.find((c) => c.type === "text")?.text ?? "The tool reported an error.";
    throw new Error(msg.slice(0, 240));
  }
  return content;
}

/** Pull anything image-like out of a tool result: inline images, resource blobs and image URLs in text. */
export function imagesFrom(content: McpContent[]): string[] {
  const out: string[] = [];
  for (const c of content) {
    if (c.type === "image" && c.data) out.push(`data:${c.mimeType ?? "image/png"};base64,${c.data}`);
    if (c.type === "resource" && c.resource?.blob && (c.resource.mimeType ?? "").startsWith("image/")) out.push(`data:${c.resource.mimeType};base64,${c.resource.blob}`);
    if (c.type === "resource_link" && c.uri && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(c.uri)) out.push(c.uri);
    if (c.type === "text" && c.text) {
      for (const m of c.text.matchAll(/https?:\/\/[^\s"')\]]+\.(?:png|jpe?g|webp|gif)(?:\?[^\s"')\]]*)?/gi)) out.push(m[0]);
      try {
        const j = JSON.parse(c.text) as unknown;
        walk(j, (v) => {
          if (typeof v === "string" && /^https?:\/\/\S+\.(png|jpe?g|webp|gif)(\?|$)/i.test(v)) out.push(v);
          if (typeof v === "string" && v.startsWith("data:image/")) out.push(v);
        });
      } catch {
        /* plain text */
      }
    }
  }
  return [...new Set(out)];
}

function walk(v: unknown, fn: (x: unknown) => void, depth = 0) {
  if (depth > 6) return;
  fn(v);
  if (Array.isArray(v)) v.forEach((x) => walk(x, fn, depth + 1));
  else if (v && typeof v === "object") Object.values(v as Record<string, unknown>).forEach((x) => walk(x, fn, depth + 1));
}

export function textFrom(content: McpContent[]): string {
  return content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text as string)
    .join("\n")
    .trim();
}

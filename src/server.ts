import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyze, css, compare } from "./core.js";
import { Store, Conflict } from "./store.js";
const host = "127.0.0.1:7423",
  origin = "http://" + host;
const store = new Store(
  process.env.TOKENSTUDIO_DATA ?? ".local-data/themes.json",
);
const web = fileURLToPath(new URL("../web/", import.meta.url));
function send(
  res: ServerResponse,
  status: number,
  value: unknown,
  type = "application/json",
) {
  res.writeHead(status, {
    "Content-Type": type + "; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
  });
  res.end(type === "application/json" ? JSON.stringify(value) : value);
}
async function body(req: IncomingMessage): Promise<unknown> {
  let count = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Uint8Array);
    count += buffer.length;
    if (count > 256000) throw new Error("Request limit is 256 KB.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
const server = createServer(async (req, res) => {
  try {
    if (req.headers.host !== host)
      return send(res, 403, { error: "Use the printed loopback URL." });
    const path = new URL(req.url ?? "/", origin).pathname;
    if (req.method === "GET") {
      const assets: Record<string, [string, string]> = {
        "/": ["index.html", "text/html"],
        "/app.js": ["app.js", "text/javascript"],
        "/style.css": ["style.css", "text/css"],
      };
      if (Object.hasOwn(assets, path)) {
        const [file, type] = assets[path]!;
        return send(res, 200, readFileSync(resolve(web, file)), type);
      }
      if (path === "/api/projects") return send(res, 200, store.list());
      if (path.startsWith("/api/projects/"))
        return send(res, 200, store.get(path.slice("/api/projects/".length)));
      return send(res, 404, { error: "Not found." });
    }
    if (
      req.method !== "POST" ||
      req.headers.origin !== origin ||
      req.headers["x-requested-with"] !== "TokenStudio"
    )
      return send(res, 403, {
        error: "Request must come from the local workspace.",
      });
    const raw = await body(req);
    if (path === "/api/analyze") return send(res, 200, analyze(raw));
    if (path === "/api/export")
      return send(res, 200, { css: css(raw), document: analyze(raw).theme });
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Expected an object.");
    if (path === "/api/save") return send(res, 200, store.save(raw));
    if (path === "/api/compare") {
      const value = raw as { before?: unknown; after?: unknown };
      return send(res, 200, { changes: compare(value.before, value.after) });
    }
    send(res, 404, { error: "Unknown operation." });
  } catch (error) {
    send(res, error instanceof Conflict ? 409 : 400, {
      error: error instanceof Error ? error.message : "Invalid request.",
    });
  }
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(7423, "127.0.0.1", () => console.log("TokenStudio: " + origin));

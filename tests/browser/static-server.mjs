// A tiny static server for the browser checks: it serves one folder (the repo) on 127.0.0.1 at a free port. GET and
// HEAD only; a path that leaves the folder, or a file that does not exist, is a 404. No dependencies.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

// The file a request path points at, or null when it is malformed or leaves the root.
export function fileFor(root, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch { return null; }
  if (decoded.includes("\0")) return null;
  const base = resolve(root);
  const file = resolve(join(base, decoded.endsWith("/") ? `${decoded}index.html` : decoded));
  return file === base || file.startsWith(base + sep) ? file : null;
}

// Starts the server; resolves to { url, close() }. `url` ends with a slash.
export function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { allow: "GET, HEAD" });
      return res.end();
    }
    const file = fileFor(root, new URL(req.url, "http://127.0.0.1").pathname);
    try {
      if (!file || !(await stat(file)).isFile()) throw new Error("not a file");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("not found");
    }
  });
  return new Promise((done, fail) => {
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      done({ url: `http://127.0.0.1:${port}/`, close: () => new Promise((ok) => server.close(() => ok())) });
    });
  });
}

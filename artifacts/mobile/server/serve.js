/**
 * Production server for the TalkPrep PWA web build.
 * Serves the output of `expo export --platform web` (dist/).
 * All unknown paths fall back to index.html for SPA routing.
 * Gzip compression is applied for all compressible content types.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const DIST_ROOT = path.resolve(__dirname, "..", "dist");
const INDEX_HTML = path.join(DIST_ROOT, "index.html");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};

// File types that benefit from gzip compression
const COMPRESSIBLE = new Set([
  ".js", ".mjs", ".json", ".css", ".html", ".txt",
  ".svg", ".webmanifest", ".map",
]);

if (!fs.existsSync(DIST_ROOT)) {
  console.error("ERROR: dist/ directory not found. Run the build first.");
  process.exit(1);
}

if (!fs.existsSync(INDEX_HTML)) {
  console.error("ERROR: dist/index.html not found.");
  process.exit(1);
}

function acceptsGzip(req) {
  return (req.headers["accept-encoding"] || "").includes("gzip");
}

function serveFile(res, filePath, contentType, cacheControl, useGzip) {
  const headers = {
    "content-type": contentType,
    "cache-control": cacheControl,
    "vary": "Accept-Encoding",
  };

  if (useGzip) {
    headers["content-encoding"] = "gzip";
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(zlib.createGzip({ level: 6 })).pipe(res);
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  }
}

// Well-known paths that must never fall through to the SPA index.html fallback.
// Serving index.html for these causes crawlers / Lighthouse to report errors.
const EXACT_FILES = new Set(["/robots.txt", "/sitemap.xml", "/favicon.ico", "/apple-touch-icon.png"]);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Resolve to a file path inside dist/
  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(DIST_ROOT, safePath);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  // Try to serve the exact file
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const isHtml = ext === ".html";
    const cacheControl = isHtml
      ? "no-cache, no-store, must-revalidate"
      : "public, max-age=31536000, immutable";
    const compress = COMPRESSIBLE.has(ext) && acceptsGzip(req);

    serveFile(res, filePath, contentType, cacheControl, compress);
    return;
  }

  // Well-known paths that are not SPA routes — return 404 rather than
  // serving index.html, which would confuse crawlers (e.g. robots.txt).
  if (EXACT_FILES.has(pathname)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
    return;
  }

  // SPA fallback — serve index.html for all unmatched routes
  const compress = acceptsGzip(req);
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-cache, no-store, must-revalidate",
    "vary": "Accept-Encoding",
  };
  if (compress) {
    headers["content-encoding"] = "gzip";
    res.writeHead(200, headers);
    fs.createReadStream(INDEX_HTML).pipe(zlib.createGzip({ level: 6 })).pipe(res);
  } else {
    res.writeHead(200, headers);
    fs.createReadStream(INDEX_HTML).pipe(res);
  }
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`TalkPrep PWA serving from dist/ on port ${port} (gzip enabled)`);
});

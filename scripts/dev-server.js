#!/usr/bin/env node
/**
 * Zero-dependency static file server for local preview.
 *
 * Reads the port from process.env.PORT so the harness can assign a free one —
 * `python -m http.server <port>` had the port hardcoded, which collided with
 * any stray server still holding it.
 *
 * Usage: node scripts/dev-server.js            (PORT env, default 5173)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  // Resolve inside ROOT only — never serve outside the project.
  let filePath = path.join(ROOT, pathname);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      // Mirror GitHub Pages: unknown paths get the custom 404 page.
      const notFound = path.join(ROOT, '404.html');
      if (fs.existsSync(notFound)) {
        res.writeHead(404, { 'Content-Type': TYPES['.html'] });
        res.end(fs.readFileSync(notFound));
      } else {
        res.writeHead(404).end('Not found');
      }
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',   // always serve current files while iterating
    });
    res.end(buf);
  });
}).listen(PORT, () => {
  console.log(`autoDNG dev server on http://localhost:${PORT}`);
});

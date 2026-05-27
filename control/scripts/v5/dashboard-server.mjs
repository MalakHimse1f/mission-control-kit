#!/usr/bin/env node
/**
 * Mission Control Kit v5 dashboard server.
 *
 * CLI usage:
 *   node control/scripts/v5/dashboard-server.mjs <project-root>
 *
 * The argument is the PROJECT ROOT (the directory CONTAINING `control/v5/`),
 * not `control/v5/` itself. If omitted, the server walks up from cwd looking
 * for `control/v5/` and uses that directory's parent.
 *
 * Stdlib only (`node:http`). Endpoints:
 *   - GET  /                              → placeholder v5 dashboard HTML
 *   - GET  /feature/:slug                 → placeholder feature detail HTML
 *   - GET  /api/v5/features               → list of features in {controlRoot}/control/v5/features/
 *   - GET  /api/v5/decisions/:slug        → saved decisions JSON
 *   - POST /api/v5/decisions/:slug        → validate + write decisions JSON
 *   - GET  /diagrams/*                    → static files from {diagramsRoot}
 *   - *                                   → 404 JSON
 *
 * The v4 dashboard server at `control/scripts/dashboard-server.mjs` is left
 * untouched; this server runs alongside it on its own port and writes to its
 * own state file (`v5-dashboard-server.json`).
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readDecisions, writeDecisions } from '../../../lib/v5/decisions.mjs';
import { validateDecisions } from '../../../lib/v5/decisions-schema.mjs';
import {
  claimPort,
  clearServerStatus,
  statusFilePath,
  V5_DEFAULT_PORT,
  V5_MAX_PORT,
} from '../../../lib/v5/server-port.mjs';
import { loadDashboardData } from '../../../lib/v5/dashboard-data.mjs';
import { loadFeatureData } from '../../../lib/v5/feature-data.mjs';
import { renderDashboard } from './render-dashboard.mjs';
import { renderFeature } from './render-feature.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DASHBOARD_CSS_PATH = path.join(__dirname, 'dashboard.css');
const DASHBOARD_CLIENT_JS_PATH = path.join(__dirname, 'dashboard-client.js');
const FEATURE_CSS_PATH = path.join(__dirname, 'feature.css');
const FEATURE_CLIENT_JS_PATH = path.join(__dirname, 'feature-client.js');
// Default diagrams root inside the kit itself — used when no diagramsRoot is
// passed (e.g. from tests). The CLI entry point still derives diagramsRoot
// from the caller's controlRoot when available.
const KIT_DIAGRAMS_ROOT = path.resolve(__dirname, '..', '..', 'layout', 'diagrams');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function sendText(res, status, contentType, body) {
  const data = typeof body === 'string' ? body : String(body);
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readJsonBody(req, { limit = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error(`request body exceeds ${limit} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.length === 0) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// ---------------------------------------------------------------------------
// HTML placeholders (Tasks 5 and 6 replace these)
// ---------------------------------------------------------------------------

function renderDashboardPlaceholder() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mission Control Kit v5 — Dashboard</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f4f4f4; padding: 0.15em 0.35em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Mission Control Kit v5</h1>
  <p>This is a placeholder dashboard page. Task 5 of the v5 refactor will replace this with the real dashboard.</p>
  <p>API endpoints:</p>
  <ul>
    <li><a href="/api/v5/features">/api/v5/features</a> — list features</li>
    <li><code>GET /api/v5/decisions/:slug</code> — read decisions</li>
    <li><code>POST /api/v5/decisions/:slug</code> — write decisions</li>
  </ul>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// API: GET /api/v5/features
// ---------------------------------------------------------------------------

/**
 * List feature directories under `{controlRoot}/control/v5/features/`. For
 * each, read `status.json` and `decisions.json` (both optional) and surface
 * a summary record.
 *
 * @param {string} controlRoot — absolute path to the project root (the
 *   directory CONTAINING `control/v5/`).
 */
export async function listFeatures(controlRoot) {
  const featuresRoot = path.join(controlRoot, 'control', 'v5', 'features');
  let entries;
  try {
    entries = await fsp.readdir(featuresRoot, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  const features = [];
  for (const slug of dirs) {
    const statusPath = path.join(featuresRoot, slug, 'status.json');
    const decisionsPath = path.join(featuresRoot, slug, 'decisions.json');
    let status = null;
    let decisions = null;
    try {
      status = JSON.parse(await fsp.readFile(statusPath, 'utf8'));
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        // Surface the parse error in the record but keep going.
        status = { error: `status.json unreadable: ${err.message}` };
      }
    }
    try {
      decisions = JSON.parse(await fsp.readFile(decisionsPath, 'utf8'));
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        decisions = { error: `decisions.json unreadable: ${err.message}` };
      }
    }

    const phases = decisions && decisions.phases ? decisions.phases : null;
    // Canonical field is `stage` (Task 5). Fall back to legacy `pipelineStage`
    // so older feature files keep working until Task 4 cleans them up.
    const stageField =
      (status && (status.stage || status.pipelineStage)) || null;
    features.push({
      slug,
      stage: stageField,
      status,
      phases: phases
        ? {
            ux: (phases.ux && phases.ux.status) || 'not-started',
            ui: (phases.ui && phases.ui.status) || 'not-started',
            architecture:
              (phases.architecture && phases.architecture.status) || 'not-started',
          }
        : null,
    });
  }
  return features;
}

// ---------------------------------------------------------------------------
// Static asset serving (/diagrams/*)
// ---------------------------------------------------------------------------

/**
 * Resolve a request URL like `/diagrams/_shared/diagram.css` to a real file
 * under `diagramsRoot`. Returns null if the path escapes the root or doesn't
 * exist.
 */
async function resolveDiagramAsset(diagramsRoot, urlPath) {
  // Strip /diagrams prefix and any query (caller already passes pathname).
  const relRaw = urlPath.replace(/^\/diagrams\/?/, '');
  if (relRaw === '') return null;
  const rel = decodeURIComponent(relRaw);

  // Reject paths with .. segments after normalization.
  const target = path.normalize(path.join(diagramsRoot, rel));
  const rootResolved = path.resolve(diagramsRoot);
  const targetResolved = path.resolve(target);
  if (
    targetResolved !== rootResolved &&
    !targetResolved.startsWith(rootResolved + path.sep)
  ) {
    return null;
  }
  try {
    const stat = await fsp.stat(targetResolved);
    if (!stat.isFile()) return null;
    return targetResolved;
  } catch {
    return null;
  }
}

async function serveStatic(res, filePath) {
  res.writeHead(200, { 'Content-Type': mimeFor(filePath) });
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// Route matching
// ---------------------------------------------------------------------------

/**
 * Match `/feature/:slug` or `/api/v5/decisions/:slug` and return the slug, or
 * null if no match.
 */
function matchSlugRoute(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return null;
  const rest = pathname.slice(prefix.length);
  if (rest === '' || rest === '/') return null;
  // Reject nested paths like /feature/foo/bar
  const cleaned = rest.startsWith('/') ? rest.slice(1) : rest;
  if (cleaned.includes('/')) return null;
  if (!cleaned) return null;
  return decodeURIComponent(cleaned);
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

/**
 * Create (but do not start) the v5 dashboard HTTP server.
 *
 * Caller is responsible for `server.listen(port, host, cb)` — this lets tests
 * pick `port: 0` for a random free port and shut down cleanly.
 *
 * @param {{
 *   controlRoot: string,
 *   diagramsRoot?: string,
 * }} opts
 */
export function createServer({ controlRoot, diagramsRoot } = {}) {
  if (!controlRoot) throw new Error('createServer: opts.controlRoot is required');
  const controlRootAbs = path.resolve(controlRoot);
  // If the caller didn't pass diagramsRoot, fall back to the kit's bundled
  // primitives so the feature detail page can still link to
  // /diagrams/_shared/diagram.css.
  const diagramsRootAbs = diagramsRoot
    ? path.resolve(diagramsRoot)
    : KIT_DIAGRAMS_ROOT;

  const server = http.createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url || '/', 'http://127.0.0.1');
    } catch {
      return sendJson(res, 400, { error: 'invalid request URL' });
    }
    const pathname = url.pathname;
    const method = req.method || 'GET';

    try {
      // GET /
      if (method === 'GET' && pathname === '/') {
        try {
          const data = await loadDashboardData({ controlRoot: controlRootAbs });
          return sendText(res, 200, MIME_TYPES['.html'], renderDashboard(data));
        } catch (err) {
          // Fall back to the placeholder so the server never serves a 500 on
          // the homepage during early-bootstrap edge cases.
          const html = renderDashboardPlaceholder() +
            `<!-- dashboard-data error: ${escapeHtml(err.message || String(err))} -->`;
          return sendText(res, 200, MIME_TYPES['.html'], html);
        }
      }

      // GET /dashboard.css
      if (method === 'GET' && pathname === '/dashboard.css') {
        try {
          const css = await fsp.readFile(DASHBOARD_CSS_PATH, 'utf8');
          return sendText(res, 200, MIME_TYPES['.css'], css);
        } catch (err) {
          return sendJson(res, 404, { error: `dashboard.css missing: ${err.message}` });
        }
      }

      // GET /dashboard-client.js
      if (method === 'GET' && pathname === '/dashboard-client.js') {
        try {
          const js = await fsp.readFile(DASHBOARD_CLIENT_JS_PATH, 'utf8');
          return sendText(res, 200, MIME_TYPES['.js'], js);
        } catch (err) {
          return sendJson(res, 404, { error: `dashboard-client.js missing: ${err.message}` });
        }
      }

      // GET /feature.css
      if (method === 'GET' && pathname === '/feature.css') {
        try {
          const css = await fsp.readFile(FEATURE_CSS_PATH, 'utf8');
          return sendText(res, 200, MIME_TYPES['.css'], css);
        } catch (err) {
          return sendJson(res, 404, { error: `feature.css missing: ${err.message}` });
        }
      }

      // GET /feature-client.js
      if (method === 'GET' && pathname === '/feature-client.js') {
        try {
          const js = await fsp.readFile(FEATURE_CLIENT_JS_PATH, 'utf8');
          return sendText(res, 200, MIME_TYPES['.js'], js);
        } catch (err) {
          return sendJson(res, 404, { error: `feature-client.js missing: ${err.message}` });
        }
      }

      // GET /feature/:slug
      if (method === 'GET') {
        const featureSlug = matchSlugRoute(pathname, '/feature');
        if (featureSlug) {
          try {
            const data = await loadFeatureData({
              slug: featureSlug,
              controlRoot: controlRootAbs,
            });
            const html = renderFeature({ slug: featureSlug, data });
            return sendText(res, 200, MIME_TYPES['.html'], html);
          } catch (err) {
            if (err && err.code === 'ENOFEATURE') {
              return sendJson(res, 404, { error: err.message });
            }
            throw err;
          }
        }
      }

      // GET /api/v5/features
      if (method === 'GET' && pathname === '/api/v5/features') {
        const features = await listFeatures(controlRootAbs);
        return sendJson(res, 200, features);
      }

      // GET/POST /api/v5/decisions/:slug
      const decisionsSlug = matchSlugRoute(pathname, '/api/v5/decisions');
      if (decisionsSlug) {
        if (method === 'GET') {
          const data = await readDecisions(decisionsSlug, { controlRoot: controlRootAbs });
          return sendJson(res, 200, data);
        }
        if (method === 'POST') {
          let body;
          try {
            body = await readJsonBody(req);
          } catch (err) {
            return sendJson(res, 400, { error: err.message });
          }
          // Validate using validateDecisions on the raw payload so callers
          // can't sneak past schema with empty bodies (writeDecisions itself
          // re-validates, but we want a clean 400 with field-level errors).
          const candidate = {
            feature: typeof body.feature === 'string' ? body.feature : decisionsSlug,
            phases: body.phases,
            deferred: body.deferred,
            updatedAt: body.updatedAt || new Date().toISOString(),
          };
          const { valid, errors } = validateDecisions(candidate);
          if (!valid) {
            return sendJson(res, 400, { error: 'invalid decisions payload', details: errors });
          }
          try {
            const saved = await writeDecisions(decisionsSlug, body, {
              controlRoot: controlRootAbs,
            });
            return sendJson(res, 200, saved);
          } catch (err) {
            return sendJson(res, 400, { error: err.message });
          }
        }
        return sendJson(res, 405, { error: `method ${method} not allowed on ${pathname}` });
      }

      // GET /diagrams/*
      if (method === 'GET' && pathname.startsWith('/diagrams/')) {
        if (!diagramsRootAbs) {
          return sendJson(res, 404, { error: 'diagrams root not configured' });
        }
        const file = await resolveDiagramAsset(diagramsRootAbs, pathname);
        if (!file) return sendJson(res, 404, { error: 'diagram asset not found' });
        return serveStatic(res, file);
      }

      // Fallback 404
      return sendJson(res, 404, { error: `not found: ${method} ${pathname}` });
    } catch (err) {
      return sendJson(res, 500, { error: err.message || String(err) });
    }
  });

  return server;
}

/**
 * Convenience wrapper: create a server, listen on a port, and return a handle
 * with the actual bound port and a `close()` that shuts the server down.
 *
 * Used by tests (port: 0 → random free port) and the CLI entry below.
 */
export async function startServer({ controlRoot, diagramsRoot, port = 0, host = '127.0.0.1' } = {}) {
  const server = createServer({ controlRoot, diagramsRoot });
  await new Promise((resolve, reject) => {
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    server,
    port: boundPort,
    host,
    url: `http://${host}:${boundPort}`,
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

/**
 * Bind-then-claim port acquisition: walk ports [minPort..maxPort] calling
 * `startServer({port})`, retrying on EADDRINUSE. Falls back to `port: 0`
 * (OS-assigned) if the whole range is exhausted. Returns the same handle as
 * `startServer` so the caller has access to the actual bound port via
 * `handle.port`.
 *
 * This eliminates the TOCTOU window in the old `resolvePort` flow (probe →
 * close → bind), because we never close between the bind probe and the real
 * listen — we just retry on the actual listen() error.
 *
 * @param {{
 *   controlRoot: string,
 *   diagramsRoot?: string,
 *   host?: string,
 *   minPort?: number,
 *   maxPort?: number,
 *   fallbackToRandom?: boolean,
 * }} opts
 */
export async function startServerInRange({
  controlRoot,
  diagramsRoot,
  host = '127.0.0.1',
  minPort = V5_DEFAULT_PORT,
  maxPort = V5_MAX_PORT,
  fallbackToRandom = true,
} = {}) {
  if (!controlRoot) throw new Error('startServerInRange: opts.controlRoot is required');
  let lastErr = null;
  for (let p = minPort; p <= maxPort; p++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await startServer({ controlRoot, diagramsRoot, port: p, host });
    } catch (err) {
      if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  if (fallbackToRandom) {
    return startServer({ controlRoot, diagramsRoot, port: 0, host });
  }
  throw lastErr || new Error(
    `startServerInRange: no free port in ${minPort}–${maxPort}`,
  );
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

async function main() {
  // Resolve controlRoot (project root, containing control/v5/) from argv[2]
  // or by walking up from cwd looking for control/v5/.
  const argRoot = process.argv[2];
  let controlRootAbs;
  if (argRoot) {
    controlRootAbs = path.resolve(argRoot);
  } else {
    // Walk up from cwd looking for control/v5; return its parent.
    let dir = process.cwd();
    let found = null;
    for (let i = 0; i < 64; i++) {
      const candidate = path.join(dir, 'control', 'v5');
      if (fs.existsSync(candidate)) {
        found = dir;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!found) {
      console.error(
        'v5 dashboard-server: could not find control/v5/ by walking up from',
        process.cwd(),
      );
      console.error(
        'Pass the project root (directory containing control/v5/) as the first argument.',
      );
      process.exit(1);
    }
    controlRootAbs = found;
  }

  // controlRootAbs is the project root (.../<project>). The .mc state lives
  // at .../<project>/control/.mc/, and diagrams at .../<project>/control/layout/diagrams.
  let diagramsRootAbs = path.join(controlRootAbs, 'control', 'layout', 'diagrams');
  // If the project hasn't been seeded with diagram primitives yet, fall back
  // to the kit's bundled copy so the per-feature page's diagram.css link
  // still resolves.
  if (!fs.existsSync(diagramsRootAbs)) {
    diagramsRootAbs = KIT_DIAGRAMS_ROOT;
  }

  // Bind first, then claim. This eliminates the probe→bind race window: by the
  // time we write the status file, the OS has already handed us the port and
  // it cannot be stolen by another process.
  const handle = await startServerInRange({
    controlRoot: controlRootAbs,
    diagramsRoot: diagramsRootAbs,
  });
  const { server, url, port } = handle;
  const { pid, startedAt } = claimPort(port, { controlRoot: controlRootAbs });

  const shutdown = () => {
    try {
      clearServerStatus({ controlRoot: controlRootAbs });
    } catch {
      // best-effort
    }
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Mission Control Kit v5 dashboard: ${url}`);
  console.log(`Project root: ${controlRootAbs}`);
  console.log(`Diagrams root: ${diagramsRootAbs}`);
  console.log(`Status file: ${statusFilePath(controlRootAbs)}`);
  console.log(`pid=${pid}, startedAt=${startedAt}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

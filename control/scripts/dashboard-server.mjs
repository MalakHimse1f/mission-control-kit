#!/usr/bin/env node
/**
 * Local dashboard server — required for orchestrator control panel writes.
 * Serves dashboard.html and POST /api/orchestrator-controls.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { resolveControlRoot } from '../lib/resolve-control-root.mjs';
import {
  readOrchestratorControls,
  writeOrchestratorControls,
  ensureOrchestratorControls,
  canAutoAdvance,
} from '../lib/orchestrator-controls.mjs';
import { pickNextFeature } from '../lib/pick-next-feature.mjs';
import { resolveKitVersionInfo } from '../lib/kit-version-info.mjs';
import {
  DEFAULT_DASHBOARD_PORT,
  clearDashboardServerState,
  readDashboardServerState,
  resolveDashboardPort,
  writeDashboardServerState,
} from '../lib/dashboard-server-port.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEBUG = process.env.MC_DASHBOARD_DEBUG === '1';

function debugLog(label, detail) {
  if (!DEBUG) return;
  const ts = new Date().toISOString();
  if (detail === undefined) console.error(`[mc-dashboard ${ts}] ${label}`);
  else console.error(`[mc-dashboard ${ts}] ${label}`, detail);
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function regenerateDashboard(controlRoot) {
  const script = path.join(controlRoot, 'scripts', 'generate-dashboard.mjs');
  debugLog('regenerate:start', { controlRoot, script });
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: controlRoot,
      stdio: 'inherit',
      env: { ...process.env, MC_DASHBOARD_SERVE: '1', MC_CHECK_REMOTE_RELEASE: '1' },
    });
    child.on('exit', (code) => {
      if (code === 0) {
        debugLog('regenerate:done', { controlRoot });
        resolve();
      } else {
        debugLog('regenerate:fail', { controlRoot, code });
        reject(new Error(`generate-dashboard exited ${code}`));
      }
    });
  });
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function buildControlsApiPayload(controlRoot) {
  ensureOrchestratorControls(controlRoot);
  const controls = readOrchestratorControls(controlRoot);
  const global = readJson(path.join(controlRoot, 'state.json')) ?? {};
  const gate = canAutoAdvance(global, controls);
  const nextPick = pickNextFeature(controlRoot, global, controls);
  return { controls, gate, nextPick };
}

export async function buildKitVersionPayload(controlRoot, { forceRefresh = false, fetchFn } = {}) {
  return resolveKitVersionInfo(controlRoot, { fetchRemote: true, forceRefresh, fetchFn });
}

export function buildServerInfoPayload(controlRoot, port) {
  return {
    controlRoot: path.resolve(controlRoot),
    port,
    pid: process.pid,
  };
}

export function createDashboardServer(controlRoot, { port = DEFAULT_DASHBOARD_PORT, fetchFn } = {}) {
  const dashboardPath = path.join(controlRoot, 'dashboard.html');

  function currentPort() {
    const addr = server.address();
    return addr && typeof addr === 'object' ? addr.port : port;
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${currentPort()}`);
    debugLog('request', { method: req.method, path: url.pathname, controlRoot });

    if (req.method === 'GET' && url.pathname === '/api/server-info') {
      return jsonResponse(res, 200, buildServerInfoPayload(controlRoot, currentPort()));
    }

    if (req.method === 'GET' && url.pathname === '/api/kit-version') {
      try {
        const force = url.searchParams.get('refresh') === '1';
        debugLog('kit-version', { force });
        const payload = await buildKitVersionPayload(controlRoot, { forceRefresh: force, fetchFn });
        return jsonResponse(res, 200, payload);
      } catch (err) {
        debugLog('kit-version:error', err.message);
        return jsonResponse(res, 500, { error: err.message });
      }
    }

    if (req.method === 'GET' && url.pathname === '/api/orchestrator-controls') {
      const payload = buildControlsApiPayload(controlRoot);
      debugLog('controls:get', {
        advance: payload.controls.advanceToNextFeature,
        buildMode: payload.controls.buildWorkflow?.mode,
        nextPick: payload.nextPick?.slug ?? null,
      });
      return jsonResponse(res, 200, payload);
    }

    if (req.method === 'POST' && url.pathname === '/api/orchestrator-controls') {
      try {
        const patch = await readBody(req);
        debugLog('controls:post', patch);
        const saved = writeOrchestratorControls(controlRoot, patch, { updatedBy: 'dashboard-server' });
        await regenerateDashboard(controlRoot);
        const payload = buildControlsApiPayload(controlRoot);
        debugLog('controls:saved', { updatedAt: saved.updatedAt, path: path.join(controlRoot, '.mc/orchestrator-controls.json') });
        return jsonResponse(res, 200, { ok: true, controls: saved, ...payload });
      } catch (err) {
        debugLog('controls:post:error', err.message);
        return jsonResponse(res, 400, { ok: false, error: err.message });
      }
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard.html')) {
      if (!fs.existsSync(dashboardPath)) {
        debugLog('dashboard:missing', dashboardPath);
        res.writeHead(404);
        res.end('dashboard.html not found — run generate-dashboard first');
        return;
      }
      debugLog('dashboard:serve', dashboardPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(dashboardPath).pipe(res);
      return;
    }

    res.writeHead(404);
    debugLog('not-found', url.pathname);
    res.end('Not found');
  });

  return { server, port, dashboardPath, controlRoot };
}

async function main() {
  const projectRoot = process.argv[2] ?? process.cwd();
  const explicitPortRaw = process.env.MC_DASHBOARD_PORT ?? process.argv[3];
  const explicitPort = explicitPortRaw != null && explicitPortRaw !== '' ? parseInt(explicitPortRaw, 10) : null;
  const controlRoot = resolveControlRoot(projectRoot);
  ensureOrchestratorControls(controlRoot);
  await regenerateDashboard(controlRoot);

  const { server } = createDashboardServer(controlRoot, {
    port: explicitPort ?? DEFAULT_DASHBOARD_PORT,
  });

  const resolution = await resolveDashboardPort({
    controlRoot,
    preferredPort: DEFAULT_DASHBOARD_PORT,
    explicitPort,
    server,
  });

  if (resolution.alreadyRunning) {
    console.log(`Mission Control dashboard already running: http://127.0.0.1:${resolution.port}/`);
    console.log(`Control root: ${controlRoot}`);
    await new Promise((resolve) => server.close(resolve));
    return;
  }

  const { port } = resolution;
  writeDashboardServerState(controlRoot, {
    port,
    controlRoot: path.resolve(controlRoot),
    startedAt: new Date().toISOString(),
    pid: process.pid,
  });

  const shutdown = () => {
    const saved = readDashboardServerState(controlRoot);
    if (!saved?.pid || saved.pid === process.pid) clearDashboardServerState(controlRoot);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log(`Mission Control dashboard: http://127.0.0.1:${port}/`);
  console.log(`Control root: ${controlRoot}`);
  if (port !== DEFAULT_DASHBOARD_PORT) {
    console.log(`Port ${DEFAULT_DASHBOARD_PORT} was in use — using ${port} (saved in .mc/dashboard-server.json)`);
  }
  if (DEBUG) {
    console.error('[mc-dashboard] debug logging ON (MC_DASHBOARD_DEBUG=1)');
    console.error('[mc-dashboard] browser: add ?debug=1 or localStorage.mcDashboardDebug="1"');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

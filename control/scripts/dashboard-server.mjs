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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function regenerateDashboard(controlRoot) {
  const script = path.join(controlRoot, 'scripts', 'generate-dashboard.mjs');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: controlRoot,
      stdio: 'inherit',
      env: { ...process.env, MC_DASHBOARD_SERVE: '1' },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`generate-dashboard exited ${code}`));
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

export function createDashboardServer(controlRoot, { port = 9470 } = {}) {
  const dashboardPath = path.join(controlRoot, 'dashboard.html');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (req.method === 'GET' && url.pathname === '/api/orchestrator-controls') {
      return jsonResponse(res, 200, buildControlsApiPayload(controlRoot));
    }

    if (req.method === 'POST' && url.pathname === '/api/orchestrator-controls') {
      try {
        const patch = await readBody(req);
        const saved = writeOrchestratorControls(controlRoot, patch, { updatedBy: 'dashboard-server' });
        await regenerateDashboard(controlRoot);
        const payload = buildControlsApiPayload(controlRoot);
        return jsonResponse(res, 200, { ok: true, controls: saved, ...payload });
      } catch (err) {
        return jsonResponse(res, 400, { ok: false, error: err.message });
      }
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard.html')) {
      if (!fs.existsSync(dashboardPath)) {
        res.writeHead(404);
        res.end('dashboard.html not found — run generate-dashboard first');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(dashboardPath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return { server, port, dashboardPath };
}

async function main() {
  const projectRoot = process.argv[2] ?? process.cwd();
  const port = parseInt(process.env.MC_DASHBOARD_PORT ?? process.argv[3] ?? '9470', 10);
  const controlRoot = resolveControlRoot(projectRoot);
  ensureOrchestratorControls(controlRoot);
  await regenerateDashboard(controlRoot);
  const { server } = createDashboardServer(controlRoot, { port });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Mission Control dashboard: http://127.0.0.1:${port}/`);
    console.log(`Control root: ${controlRoot}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

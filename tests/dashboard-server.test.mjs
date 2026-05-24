import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDashboardServer } from '../control/scripts/dashboard-server.mjs';
import { readOrchestratorControls } from '../control/lib/orchestrator-controls.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function writeFeature(controlRoot, slug) {
  const dir = path.join(controlRoot, 'features', slug);
  fs.mkdirSync(path.join(dir, 'phases'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'phases', 'phase-1.md'), '# p1');
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({
    pipelineStage: 'build',
    specStatus: 'approved',
    tasks: [{ id: '1.1', status: 'backlog' }],
  }));
}

function request(port, method, pathname, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: pathname, method, headers: { 'Content-Type': 'application/json' } },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'),
          });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function runGenerate(controlRoot) {
  return new Promise((resolve, reject) => {
    const script = path.join(controlRoot, 'scripts', 'generate-dashboard.mjs');
    const child = spawn(process.execPath, [script], {
      cwd: controlRoot,
      env: { ...process.env, MC_DASHBOARD_SERVE: '1' },
      stdio: 'pipe',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
  });
}

describe('dashboard-server', () => {
  let tmp;
  let server;
  let port;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-dash-srv-'));
    const controlSrc = path.join(kitRoot, 'control');
    fs.cpSync(controlSrc, tmp, { recursive: true });
    fs.writeFileSync(path.join(tmp, 'state.json'), JSON.stringify({
      buildOrder: ['alpha'],
      portfolioReviewStatus: 'approved',
      activeFeature: 'alpha',
    }));
    writeFeature(tmp, 'alpha');
    await runGenerate(tmp);
    port = 9500 + Math.floor(Math.random() * 200);
    ({ server } = createDashboardServer(tmp, { port }));
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('GET /api/orchestrator-controls returns payload', async () => {
    const res = await request(port, 'GET', '/api/orchestrator-controls');
    assert.equal(res.status, 200);
    assert.ok(res.body.controls);
    assert.ok('gate' in res.body);
  });

  it('POST /api/orchestrator-controls persists toggles', async () => {
    const res = await request(port, 'POST', '/api/orchestrator-controls', {
      advanceToNextFeature: true,
      ralphLoop: { enabled: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    const onDisk = readOrchestratorControls(tmp);
    assert.equal(onDisk.advanceToNextFeature, true);
    assert.equal(onDisk.ralphLoop.enabled, true);
  });
});

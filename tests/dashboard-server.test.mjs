import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createDashboardServer, buildKitUpgradePayload } from '../control/scripts/dashboard-server.mjs';
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

const mockReleaseFetch = async () => ({
  ok: true,
  json: async () => ({ tag_name: 'mc-kit-v4.4.1', html_url: 'https://example.com/release' }),
});

describe('dashboard-server', () => {
  let projectTmp;
  let controlRoot;
  let server;
  let port;

  beforeEach(async () => {
    projectTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-dash-srv-'));
    controlRoot = path.join(projectTmp, 'docs/superpowers/control');
    fs.cpSync(path.join(kitRoot, 'control'), controlRoot, { recursive: true });
    fs.mkdirSync(path.join(projectTmp, 'mission-control-kit'), { recursive: true });
    fs.writeFileSync(
      path.join(projectTmp, 'mission-control-kit', 'kit-manifest.json'),
      JSON.stringify({
        kitVersion: '4.4.1',
        release: { github: 'acme/mission-control-kit' },
      }),
    );
    fs.mkdirSync(path.join(controlRoot, '.mc'), { recursive: true });
    fs.writeFileSync(
      path.join(controlRoot, '.mc/install.json'),
      JSON.stringify({ kitVersion: '4.3.1', kitPath: 'mission-control-kit' }),
    );
    fs.writeFileSync(path.join(controlRoot, 'state.json'), JSON.stringify({
      buildOrder: ['alpha'],
      portfolioReviewStatus: 'approved',
      activeFeature: 'alpha',
    }));
    writeFeature(controlRoot, 'alpha');
    await runGenerate(controlRoot);
    port = 9500 + Math.floor(Math.random() * 200);
    ({ server } = createDashboardServer(controlRoot, {
      port,
      fetchFn: mockReleaseFetch,
      runUpgrade: async () => ({ output: 'mock upgrade' }),
    }));
    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(projectTmp, { recursive: true, force: true });
  });

  it('GET /api/server-info returns control root and port', async () => {
    const res = await request(port, 'GET', '/api/server-info');
    assert.equal(res.status, 200);
    assert.equal(res.body.port, port);
    assert.equal(path.resolve(res.body.controlRoot), path.resolve(controlRoot));
  });

  it('GET /api/orchestrator-controls returns payload', async () => {
    const res = await request(port, 'GET', '/api/orchestrator-controls');
    assert.equal(res.status, 200);
    assert.ok(res.body.controls);
    assert.ok('gate' in res.body);
  });

  it('GET /api/kit-version checks GitHub release', async () => {
    const res = await request(port, 'GET', '/api/kit-version');
    assert.equal(res.status, 200);
    assert.equal(res.body.installed, '4.3.1');
    assert.equal(res.body.remoteVersion, '4.4.1');
    assert.equal(res.body.updateAvailable, true);
    assert.equal(res.body.updateSource, 'github');
  });

  it('POST /api/orchestrator-controls persists toggles', async () => {
    const res = await request(port, 'POST', '/api/orchestrator-controls', {
      advanceToNextFeature: true,
      ralphLoop: { enabled: true },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    const onDisk = readOrchestratorControls(controlRoot);
    assert.equal(onDisk.advanceToNextFeature, true);
    assert.equal(onDisk.ralphLoop.enabled, true);
  });

  it('POST /api/orchestrator-controls persists workflow routing toggles', async () => {
    const res = await request(port, 'POST', '/api/orchestrator-controls', {
      buildWorkflow: { mode: 'tdd-lite', reviewChain: 'none' },
      planWorkflow: { mode: 'executing-plans' },
    });
    assert.equal(res.status, 200);
    const onDisk = readOrchestratorControls(controlRoot);
    assert.equal(onDisk.buildWorkflow.mode, 'tdd-lite');
    assert.equal(onDisk.buildWorkflow.reviewChain, 'none');
    assert.equal(onDisk.planWorkflow.mode, 'executing-plans');
  });

  it('POST /api/kit-upgrade runs fetch upgrade when update available', async () => {
    const res = await request(port, 'POST', '/api/kit-upgrade');
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.ok(['upgraded', 'up-to-date'].includes(res.body.status));
  });

  it('buildKitUpgradePayload uses injected upgrade runner', async () => {
    let called = false;
    let pass = 0;
    const payload = await buildKitUpgradePayload(controlRoot, {
      versionInfo: async () => {
        pass += 1;
        if (pass === 1) {
          return { installed: '4.5.0', updateAvailable: true, remoteVersion: '4.5.1' };
        }
        return { installed: '4.5.1', updateAvailable: false, remoteVersion: '4.5.1' };
      },
      runUpgrade: async () => {
        called = true;
      },
      regenerate: async () => {},
    });
    assert.equal(called, true);
    assert.equal(payload.ok, true);
    assert.equal(payload.status, 'upgraded');
    assert.equal(payload.toVersion, '4.5.1');
  });
});

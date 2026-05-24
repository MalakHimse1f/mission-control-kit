import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  DEFAULT_DASHBOARD_PORT,
  listenOnPort,
  readDashboardServerState,
  resolveDashboardPort,
  writeDashboardServerState,
} from '../control/lib/dashboard-server-port.mjs';

describe('dashboard-server-port', () => {
  let tmpRoot;
  let controlRoot;
  let blocker;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-port-'));
    controlRoot = path.join(tmpRoot, 'control');
    fs.mkdirSync(path.join(controlRoot, '.mc'), { recursive: true });
  });

  afterEach(async () => {
    if (blocker) await new Promise((resolve) => blocker.close(resolve));
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('persists dashboard server state under .mc', () => {
    writeDashboardServerState(controlRoot, { port: 9472, controlRoot });
    const saved = readDashboardServerState(controlRoot);
    assert.equal(saved.port, 9472);
  });

  it('detects when this control root is already served', async () => {
    const port = 9510 + Math.floor(Math.random() * 100);
    const otherRoot = path.join(tmpRoot, 'other');
    fs.mkdirSync(otherRoot, { recursive: true });

    blocker = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ controlRoot, port }));
    });
    await listenOnPort(blocker, port);

    writeDashboardServerState(controlRoot, { port, controlRoot });

    const result = await resolveDashboardPort({
      controlRoot,
      server: http.createServer(),
      probeFn: async (p) => {
        if (p !== port) return null;
        return { controlRoot, port: p };
      },
    });

    assert.equal(result.alreadyRunning, true);
    assert.equal(result.port, port);
  });

  it('auto-select skips ports occupied by other MC projects', async () => {
    const taken = DEFAULT_DASHBOARD_PORT + 10;
    const otherRoot = path.join(tmpRoot, 'other-project');

    const probeFn = async (port) => {
      if (port === taken) return { controlRoot: otherRoot, port };
      return null;
    };

    const server = http.createServer();
    const result = await resolveDashboardPort({
      controlRoot,
      preferredPort: taken,
      probeFn,
      listenFn: listenOnPort,
      server,
      maxAttempts: 5,
    });

    assert.equal(result.alreadyRunning, false);
    assert.equal(result.port, taken + 1);
    await new Promise((resolve) => server.close(resolve));
  });

  it('fails on explicit port when in use by another project', async () => {
    const port = DEFAULT_DASHBOARD_PORT + 11;
    await assert.rejects(
      () =>
        resolveDashboardPort({
          controlRoot,
          explicitPort: port,
          probeFn: async () => ({ controlRoot: path.join(tmpRoot, 'other'), port }),
          server: http.createServer(),
        }),
      /Port .* is in use/,
    );
  });
});

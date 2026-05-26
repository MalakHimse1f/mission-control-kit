/**
 * Tests for the v5 dashboard server (control/scripts/v5/dashboard-server.mjs)
 * and its port resolver (lib/v5/server-port.mjs).
 *
 * The server is created with `startServer({ controlRoot, diagramsRoot, port: 0 })`
 * so each test gets a random free port and shuts down cleanly — no detached
 * subprocesses.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { startServer } from '../control/scripts/v5/dashboard-server.mjs';
import {
  resolvePort,
  readServerStatus,
  clearServerStatus,
  statusFilePath,
} from '../lib/v5/server-port.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

async function makeTmpProject() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-server-'));
  const controlRoot = path.join(tmp, 'control', 'v5');
  await fs.mkdir(path.join(controlRoot, 'features'), { recursive: true });
  const diagramsRoot = path.join(tmp, 'control', 'layout', 'diagrams');
  await fs.mkdir(path.join(diagramsRoot, '_shared'), { recursive: true });
  await fs.writeFile(
    path.join(diagramsRoot, '_shared', 'diagram.css'),
    ':root { --diagram-bg: #111; }\n',
    'utf8',
  );
  return { tmp, controlRoot, diagramsRoot, controlParent: path.join(tmp, 'control') };
}

async function startTestServer(controlRoot, diagramsRoot) {
  return startServer({ controlRoot, diagramsRoot, port: 0 });
}

async function httpRequest(url, { method = 'GET', body, headers } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body == null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }
  return { status: res.status, headers: res.headers, text, json: parsed };
}

// ---------------------------------------------------------------------------
// Tests: HTTP endpoints
// ---------------------------------------------------------------------------

test('GET / returns placeholder HTML containing "Mission Control Kit v5"', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, text, headers } = await httpRequest(`${handle.url}/`);
    assert.equal(status, 200);
    assert.ok((headers.get('content-type') || '').includes('text/html'));
    assert.ok(text.includes('Mission Control Kit v5'), 'expected v5 title in body');
    assert.ok(text.includes('/api/v5/features'), 'expected link to features API');
  } finally {
    await handle.close();
  }
});

test('GET /feature/foo returns placeholder HTML containing "foo"', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, text, headers } = await httpRequest(`${handle.url}/feature/foo`);
    assert.equal(status, 200);
    assert.ok((headers.get('content-type') || '').includes('text/html'));
    assert.ok(text.includes('foo'), `expected slug "foo" in body; got: ${text.slice(0, 200)}`);
  } finally {
    await handle.close();
  }
});

test('GET /api/v5/features returns [] when no features directory entries', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, json } = await httpRequest(`${handle.url}/api/v5/features`);
    assert.equal(status, 200);
    assert.deepEqual(json, []);
  } finally {
    await handle.close();
  }
});

test('GET /api/v5/features lists feature dirs with stage + phase status', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  // Seed a feature with status.json and decisions.json.
  const featureDir = path.join(controlRoot, 'features', 'alpha');
  await fs.mkdir(featureDir, { recursive: true });
  await fs.writeFile(
    path.join(featureDir, 'status.json'),
    JSON.stringify({ pipelineStage: 'build', specStatus: 'approved' }),
    'utf8',
  );
  await fs.writeFile(
    path.join(featureDir, 'decisions.json'),
    JSON.stringify({
      feature: 'alpha',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'in-progress', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00Z',
    }),
    'utf8',
  );

  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, json } = await httpRequest(`${handle.url}/api/v5/features`);
    assert.equal(status, 200);
    assert.equal(json.length, 1);
    assert.equal(json[0].slug, 'alpha');
    assert.equal(json[0].stage, 'build');
    assert.deepEqual(json[0].phases, {
      ux: 'complete',
      ui: 'in-progress',
      architecture: 'not-started',
    });
  } finally {
    await handle.close();
  }
});

test('POST /api/v5/decisions/:slug with valid payload writes to disk and GET returns same data', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const payload = {
      feature: 'test-feature',
      phases: {
        ux: { status: 'complete', decisions: [], pending: [] },
        ui: { status: 'not-started', decisions: [], pending: [] },
        architecture: { status: 'not-started', decisions: [], pending: [] },
      },
      deferred: [],
      updatedAt: '2026-05-26T10:00:00Z',
    };
    const post = await httpRequest(`${handle.url}/api/v5/decisions/test-feature`, {
      method: 'POST',
      body: payload,
    });
    assert.equal(post.status, 200, `POST failed: ${post.text}`);
    assert.equal(post.json.feature, 'test-feature');
    assert.equal(post.json.phases.ux.status, 'complete');

    // GET back same data.
    const get = await httpRequest(`${handle.url}/api/v5/decisions/test-feature`);
    assert.equal(get.status, 200);
    assert.equal(get.json.feature, 'test-feature');
    assert.equal(get.json.phases.ux.status, 'complete');

    // Verify on disk.
    const onDisk = JSON.parse(
      await fs.readFile(
        path.join(controlRoot, 'features', 'test-feature', 'decisions.json'),
        'utf8',
      ),
    );
    assert.equal(onDisk.feature, 'test-feature');
  } finally {
    await handle.close();
  }
});

test('POST /api/v5/decisions/:slug with missing phases key returns 400', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const post = await httpRequest(`${handle.url}/api/v5/decisions/bad`, {
      method: 'POST',
      body: { feature: 'bad', deferred: [], updatedAt: '2026-05-26T10:00:00Z' },
    });
    assert.equal(post.status, 400);
    assert.ok(post.json, 'expected JSON error body');
    assert.ok(
      String(post.json.error || '').match(/invalid|phases/i),
      `expected error mentioning invalid/phases, got: ${JSON.stringify(post.json)}`,
    );
  } finally {
    await handle.close();
  }
});

test('GET /api/v5/decisions/:slug returns default structure when none exists', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, json } = await httpRequest(`${handle.url}/api/v5/decisions/never-saved`);
    assert.equal(status, 200);
    assert.equal(json.feature, 'never-saved');
    assert.equal(json.phases.ux.status, 'not-started');
  } finally {
    await handle.close();
  }
});

test('GET unknown route returns 404', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const { status, json } = await httpRequest(`${handle.url}/does/not/exist`);
    assert.equal(status, 404);
    assert.ok(json && typeof json.error === 'string');
  } finally {
    await handle.close();
  }
});

test('GET /diagrams/_shared/diagram.css returns 200 with text/css', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    const res = await fetch(`${handle.url}/diagrams/_shared/diagram.css`);
    assert.equal(res.status, 200);
    const ct = res.headers.get('content-type') || '';
    assert.ok(ct.includes('text/css'), `expected text/css, got: ${ct}`);
    const body = await res.text();
    assert.ok(body.includes('--diagram-bg'), 'expected file contents to be served');
  } finally {
    await handle.close();
  }
});

test('GET /diagrams/..%2Fsecret.txt traversal attempts return 404', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  // Write a file outside the diagrams root that traversal might try to reach.
  await fs.writeFile(path.join(controlRoot, '..', 'secret.txt'), 'nope', 'utf8');
  const handle = await startTestServer(controlRoot, diagramsRoot);
  try {
    // Use a percent-encoded path so fetch doesn't normalize ../ away.
    const res = await fetch(`${handle.url}/diagrams/..%2Fsecret.txt`);
    assert.notEqual(res.status, 200, 'expected non-200 for traversal');
    const body = await res.text();
    assert.ok(!body.includes('nope'), 'expected secret file contents not to leak');
  } finally {
    await handle.close();
  }
});

test('server gracefully shuts down via close()', async () => {
  const { controlRoot, diagramsRoot } = await makeTmpProject();
  const handle = await startTestServer(controlRoot, diagramsRoot);
  const { url } = handle;
  // Sanity request first.
  const before = await fetch(`${url}/`);
  assert.equal(before.status, 200);
  await before.text();
  await handle.close();
  // After close, expect connection error.
  await assert.rejects(async () => {
    await fetch(`${url}/`);
  });
});

// ---------------------------------------------------------------------------
// Tests: server-port.mjs
// ---------------------------------------------------------------------------

test('resolvePort writes { port, pid, startedAt } to control/.mc/v5-dashboard-server.json', async () => {
  const { controlParent } = await makeTmpProject();
  const before = Date.now();
  const result = await resolvePort({ controlRoot: controlParent });
  assert.ok(result.port >= 9470 && result.port <= 9499);
  assert.equal(result.pid, process.pid);
  assert.ok(typeof result.startedAt === 'string' && result.startedAt.length > 0);

  const onDisk = readServerStatus({ controlRoot: controlParent });
  assert.deepEqual(onDisk, result);

  // File is in the right location.
  const expectedPath = path.join(controlParent, '.mc', 'v5-dashboard-server.json');
  assert.equal(statusFilePath(controlParent), expectedPath);
  const stat = await fs.stat(expectedPath);
  assert.ok(stat.isFile());

  const parsed = Date.parse(result.startedAt);
  assert.ok(parsed >= before - 1000, 'startedAt should be recent');
});

test('clearServerStatus removes the v5 status file', async () => {
  const { controlParent } = await makeTmpProject();
  await resolvePort({ controlRoot: controlParent });
  assert.ok(readServerStatus({ controlRoot: controlParent }) != null);
  clearServerStatus({ controlRoot: controlParent });
  assert.equal(readServerStatus({ controlRoot: controlParent }), null);
});

test('readServerStatus returns null when file does not exist', async () => {
  const { controlParent } = await makeTmpProject();
  assert.equal(readServerStatus({ controlRoot: controlParent }), null);
});

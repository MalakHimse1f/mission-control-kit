/**
 * Tests for the v5 auto-launch helper and its pure helpers.
 *
 * Covers:
 *   - URL construction with/without slug and anchor (incl. URL encoding).
 *   - Platform → open-command resolution.
 *   - `openDashboard()` calls `ensureRunning` and spawns no real subprocess
 *     when given mocked deps (dependency injection seam: `__deps`).
 *
 * Uses node:test only — no external mocking library required.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTargetUrl,
  getOpenCommand,
  isSupportedPlatform,
} from '../lib/v5/auto-launch-helpers.mjs';
import { openDashboard } from '../lib/v5/auto-launch.mjs';

// ---------------------------------------------------------------------------
// buildTargetUrl
// ---------------------------------------------------------------------------

test('buildTargetUrl: slug only → /feature/<slug>', () => {
  assert.equal(
    buildTargetUrl('http://127.0.0.1:9470', { slug: 'foo' }),
    'http://127.0.0.1:9470/feature/foo',
  );
});

test('buildTargetUrl: slug + anchor → /feature/<slug>#<anchor>', () => {
  assert.equal(
    buildTargetUrl('http://127.0.0.1:9470', { slug: 'foo', anchor: 'decisions' }),
    'http://127.0.0.1:9470/feature/foo#decisions',
  );
});

test('buildTargetUrl: empty options → base + "/"', () => {
  assert.equal(
    buildTargetUrl('http://127.0.0.1:9470', {}),
    'http://127.0.0.1:9470/',
  );
});

test('buildTargetUrl: trailing slash on base is normalized', () => {
  assert.equal(
    buildTargetUrl('http://127.0.0.1:9470/', { slug: 'foo' }),
    'http://127.0.0.1:9470/feature/foo',
  );
  assert.equal(
    buildTargetUrl('http://127.0.0.1:9470/', {}),
    'http://127.0.0.1:9470/',
  );
});

test('buildTargetUrl: slug with spaces is URL-encoded', () => {
  assert.equal(
    buildTargetUrl('http://x:9470', { slug: 'team collab' }),
    'http://x:9470/feature/team%20collab',
  );
});

test('buildTargetUrl: anchor with special chars is URL-encoded', () => {
  assert.equal(
    buildTargetUrl('http://x:9470', { slug: 'foo', anchor: 'decisions tab' }),
    'http://x:9470/feature/foo#decisions%20tab',
  );
});

test('buildTargetUrl: missing baseUrl throws', () => {
  assert.throws(() => buildTargetUrl('', { slug: 'foo' }), /baseUrl/);
  assert.throws(() => buildTargetUrl(undefined, { slug: 'foo' }), /baseUrl/);
});

// ---------------------------------------------------------------------------
// getOpenCommand / isSupportedPlatform
// ---------------------------------------------------------------------------

test('getOpenCommand: darwin → open', () => {
  assert.equal(getOpenCommand('darwin'), 'open');
});

test('getOpenCommand: linux → xdg-open', () => {
  assert.equal(getOpenCommand('linux'), 'xdg-open');
});

test('getOpenCommand: win32 → start', () => {
  assert.equal(getOpenCommand('win32'), 'start');
});

test('getOpenCommand: unknown platform throws', () => {
  // Documented behavior: throws with a descriptive error for unsupported
  // platforms (haiku, sunos, etc.). Caller should catch and report.
  assert.throws(() => getOpenCommand('haiku'), /unsupported platform/i);
});

test('isSupportedPlatform: darwin/linux/win32 → true, else false', () => {
  assert.equal(isSupportedPlatform('darwin'), true);
  assert.equal(isSupportedPlatform('linux'), true);
  assert.equal(isSupportedPlatform('win32'), true);
  assert.equal(isSupportedPlatform('haiku'), false);
  assert.equal(isSupportedPlatform(''), false);
  assert.equal(isSupportedPlatform(undefined), false);
});

// ---------------------------------------------------------------------------
// openDashboard (with mocked deps — never spawns a browser)
// ---------------------------------------------------------------------------

function makeMockDeps({ port = 9470, alreadyRunning = false, platform = 'darwin' } = {}) {
  const calls = { ensureRunning: [], exec: [] };
  return {
    calls,
    deps: {
      ensureRunning: async (opts) => {
        calls.ensureRunning.push(opts);
        return {
          port,
          url: `http://127.0.0.1:${port}`,
          pid: 12345,
          alreadyRunning,
        };
      },
      exec: (cmd, cb) => {
        calls.exec.push(cmd);
        // Simulate async success; never actually spawn anything.
        if (typeof cb === 'function') {
          setImmediate(() => cb(null, '', ''));
        }
        return { /* fake ChildProcess */ };
      },
      platform,
    },
  };
}

test('openDashboard: slug + anchor → URL with #anchor; exec gets `open <url>` on darwin', async () => {
  const { deps, calls } = makeMockDeps({ port: 9470, platform: 'darwin' });
  const result = await openDashboard({
    slug: 'user-onboarding',
    anchor: 'decisions',
    controlRoot: '/tmp/whatever',
    __deps: deps,
  });
  assert.equal(result.url, 'http://127.0.0.1:9470/feature/user-onboarding#decisions');
  assert.equal(result.port, 9470);
  assert.equal(result.alreadyRunning, false);
  assert.equal(calls.ensureRunning.length, 1);
  assert.equal(calls.ensureRunning[0].controlRoot, '/tmp/whatever');
  assert.equal(calls.exec.length, 1);
  assert.ok(
    calls.exec[0].startsWith('open '),
    `expected darwin exec to use 'open', got: ${calls.exec[0]}`,
  );
  assert.ok(calls.exec[0].includes('http://127.0.0.1:9470/feature/user-onboarding#decisions'));
});

test('openDashboard: no slug → URL is base + "/"; exec uses xdg-open on linux', async () => {
  const { deps, calls } = makeMockDeps({ port: 9480, platform: 'linux' });
  const result = await openDashboard({
    controlRoot: '/tmp/c',
    __deps: deps,
  });
  assert.equal(result.url, 'http://127.0.0.1:9480/');
  assert.ok(calls.exec[0].startsWith('xdg-open '));
});

test('openDashboard: win32 platform uses `start`', async () => {
  const { deps, calls } = makeMockDeps({ port: 9470, platform: 'win32' });
  await openDashboard({ slug: 'foo', controlRoot: '/tmp/c', __deps: deps });
  assert.ok(calls.exec[0].startsWith('start '));
});

test('openDashboard: alreadyRunning bubbles through from ensureRunning', async () => {
  const { deps } = makeMockDeps({ alreadyRunning: true });
  const result = await openDashboard({ slug: 'foo', controlRoot: '/tmp/c', __deps: deps });
  assert.equal(result.alreadyRunning, true);
});

test('openDashboard: missing controlRoot throws', async () => {
  const { deps } = makeMockDeps();
  await assert.rejects(
    () => openDashboard({ slug: 'foo', __deps: deps }),
    /controlRoot/,
  );
});

test('openDashboard: ensureRunning error propagates', async () => {
  const deps = {
    ensureRunning: async () => {
      throw new Error('server boom');
    },
    exec: () => {
      throw new Error('exec should not be called');
    },
    platform: 'darwin',
  };
  await assert.rejects(
    () => openDashboard({ slug: 'foo', controlRoot: '/tmp/c', __deps: deps }),
    /server boom/,
  );
});

test('openDashboard: unsupported platform throws before exec', async () => {
  let execCalled = false;
  const deps = {
    ensureRunning: async () => ({
      port: 9470,
      url: 'http://127.0.0.1:9470',
      pid: 1,
      alreadyRunning: true,
    }),
    exec: () => {
      execCalled = true;
    },
    platform: 'haiku',
  };
  await assert.rejects(
    () => openDashboard({ slug: 'foo', controlRoot: '/tmp/c', __deps: deps }),
    /unsupported platform/i,
  );
  assert.equal(execCalled, false);
});

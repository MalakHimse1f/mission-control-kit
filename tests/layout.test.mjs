import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  KIT_FOLDER_DEFAULT,
  layoutCandidates,
  resolveLayout,
  detectExistingLayout,
  resolveControlRoot,
  resolveInstallStampPath,
} from '../lib/layout.mjs';

let tmpRoot;

function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(p, obj) {
  mkdir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj));
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-layout-'));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('layoutCandidates', () => {
  it('returns three candidates in priority order', () => {
    const cands = layoutCandidates(tmpRoot);
    assert.equal(cands.length, 3);
    assert.deepEqual(
      cands.map((c) => c.kind),
      ['kit-nested', 'root', 'legacy-v4'],
    );
  });

  it('uses the default kit folder name', () => {
    const cands = layoutCandidates(tmpRoot);
    assert.equal(cands[0].kitFolder, KIT_FOLDER_DEFAULT);
    assert.ok(cands[0].controlRoot.endsWith(path.join(KIT_FOLDER_DEFAULT, 'control')));
  });

  it('respects a custom kit folder name', () => {
    const cands = layoutCandidates(tmpRoot, { kitFolder: 'mc' });
    assert.ok(cands[0].controlRoot.endsWith(path.join('mc', 'control')));
    assert.ok(cands[0].installStampPath.endsWith(path.join('mc', '.mc', 'install.json')));
    assert.ok(cands[0].userGuidePath.endsWith(path.join('mc', 'User-Guide.html')));
  });
});

describe('resolveLayout', () => {
  it('defaults to kit-nested when nothing is installed', () => {
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'kit-nested');
  });

  it('picks kit-nested when its stamp exists', () => {
    writeJson(
      path.join(tmpRoot, 'mission-control-kit', '.mc', 'install.json'),
      { kitVersion: '5.3.0' },
    );
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'kit-nested');
  });

  it('picks root when only the root stamp exists (back-compat)', () => {
    writeJson(path.join(tmpRoot, '.mc', 'install.json'), { kitVersion: '5.2.0' });
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'root');
    assert.equal(layout.controlRoot, path.join(tmpRoot, 'control'));
  });

  it('picks legacy-v4 when only the v4 stamp exists', () => {
    writeJson(
      path.join(tmpRoot, 'docs', 'superpowers', 'control', '.mc', 'install.json'),
      { kitVersion: '4.7.1' },
    );
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'legacy-v4');
  });

  it('prefers kit-nested when multiple stamps exist (defensive)', () => {
    writeJson(path.join(tmpRoot, '.mc', 'install.json'), { kitVersion: '5.2.0' });
    writeJson(
      path.join(tmpRoot, 'mission-control-kit', '.mc', 'install.json'),
      { kitVersion: '5.3.0' },
    );
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'kit-nested');
  });

  it('falls back to control-dir presence when stamp is missing', () => {
    mkdir(path.join(tmpRoot, 'control', 'v5'));
    const layout = resolveLayout(tmpRoot);
    assert.equal(layout.kind, 'root');
  });
});

describe('detectExistingLayout', () => {
  it('returns null when nothing is installed', () => {
    assert.equal(detectExistingLayout(tmpRoot), null);
  });

  it('returns the layout when an install is detected', () => {
    writeJson(path.join(tmpRoot, '.mc', 'install.json'), { kitVersion: '5.2.0' });
    const layout = detectExistingLayout(tmpRoot);
    assert.ok(layout);
    assert.equal(layout.kind, 'root');
  });
});

describe('convenience helpers', () => {
  it('resolveControlRoot returns the active control path', () => {
    writeJson(
      path.join(tmpRoot, 'mission-control-kit', '.mc', 'install.json'),
      { kitVersion: '5.3.0' },
    );
    assert.equal(
      resolveControlRoot(tmpRoot),
      path.join(tmpRoot, 'mission-control-kit', 'control'),
    );
  });

  it('resolveInstallStampPath returns the active stamp path', () => {
    assert.equal(
      resolveInstallStampPath(tmpRoot),
      path.join(tmpRoot, 'mission-control-kit', '.mc', 'install.json'),
    );
  });
});

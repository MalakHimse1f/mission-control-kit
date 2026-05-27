import fs from 'node:fs';
import path from 'node:path';

export const version = '5.0.0-v5-refactor';

const ROUTING_FILES = [
  'ROUTING-MANIFEST.md',
  'UI-REQUIREMENTS.md',
  'UX-PATTERNS.md',
  'ARCHITECTURE.md',
  'ARCHITECTURE-MVVM.md',
  'BUILD-GATES.md',
];

function noop() {}

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function pathExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function copyIfMissing(src, dest) {
  if (!(await pathExists(src))) return false;
  if (await pathExists(dest)) return false;
  await ensureDir(path.dirname(dest));
  await fs.promises.cp(src, dest, { recursive: true, force: false });
  return true;
}

/**
 * v5 refactor migration — installs the control/v5/ skeleton into a v4 project
 * on upgrade. Idempotent. Does not touch v4 control/ content.
 *
 * Signature matches the kit upgrade engine: `up({ controlRoot, kitRoot, log? })`.
 */
export async function up({ controlRoot, kitRoot, log } = {}) {
  const logFn = typeof log === 'function' ? log : noop;
  if (!controlRoot || !kitRoot) {
    throw new Error('5.0.0-v5-refactor: controlRoot and kitRoot are required');
  }

  const v5Root = path.join(controlRoot, 'v5');
  const routingDir = path.join(v5Root, 'routing');
  const featuresDir = path.join(v5Root, 'features');
  const techStackDir = path.join(v5Root, 'tech-stack');
  const diagramAssetsDir = path.join(v5Root, '_diagram-assets');

  // 1. Create directory skeleton
  await ensureDir(v5Root);
  logFn(`5.0.0: ensured ${v5Root}`);

  await ensureDir(routingDir);
  await ensureDir(featuresDir);
  await ensureDir(techStackDir);
  await ensureDir(diagramAssetsDir);
  logFn('5.0.0: ensured routing/, features/, tech-stack/, _diagram-assets/');

  // 2. Copy routing markdown files (do not clobber user edits)
  const kitRoutingDir = path.join(kitRoot, 'control', 'v5', 'routing');
  for (const file of ROUTING_FILES) {
    const src = path.join(kitRoutingDir, file);
    const dest = path.join(routingDir, file);
    const copied = await copyIfMissing(src, dest);
    if (copied) logFn(`5.0.0: copied routing/${file}`);
  }

  // 3. Copy diagram shared assets (css/js) into _diagram-assets/
  const kitSharedDir = path.join(kitRoot, 'control', 'layout', 'diagrams', '_shared');
  if (await pathExists(kitSharedDir)) {
    for (const name of await fs.promises.readdir(kitSharedDir)) {
      if (name.startsWith('.')) continue;
      if (!/\.(css|js)$/.test(name)) continue;
      const src = path.join(kitSharedDir, name);
      const dest = path.join(diagramAssetsDir, name);
      const copied = await copyIfMissing(src, dest);
      if (copied) logFn(`5.0.0: copied _diagram-assets/${name}`);
    }
  }

  // 4. Seed state.json if missing
  const statePath = path.join(v5Root, 'state.json');
  if (!(await pathExists(statePath))) {
    const stub = {
      version: '5.0.0',
      features: [],
      updatedAt: new Date().toISOString(),
    };
    await fs.promises.writeFile(statePath, `${JSON.stringify(stub, null, 2)}\n`);
    logFn('5.0.0: wrote control/v5/state.json stub');
  }
}

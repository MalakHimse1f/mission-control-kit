import fs from 'node:fs';
import path from 'node:path';

export const version = '5.1.0-expanded-primitives';

/**
 * v5.1.0 — Ship the expanded diagram primitive library to existing v5
 * projects.
 *
 * v5.0's migration copied `_diagram-assets/` files into the user project
 * with `copyIfMissing`, which means users who already have the v5.0 assets
 * would NOT pick up the new atom catalog automatically.
 *
 * This migration overwrites the kit-managed diagram assets, after
 * backing up the existing files so user customizations aren't silently
 * lost. The backup directory lives next to the assets so a user can
 * inspect / restore manually if needed.
 *
 * Idempotent: re-running with the same kit version writes the same
 * bytes; comparing checksums and skipping is more complex than just
 * overwriting, and the operation is cheap.
 */

const KIT_MANAGED_ASSETS = [
  'diagram.css',
  'decisions-client.js',
  'diagram-select.js',
];

function noop() {}

async function pathExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readMaybe(p) {
  try {
    return await fs.promises.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

export async function up({ controlRoot, kitRoot, log } = {}) {
  const logFn = typeof log === 'function' ? log : noop;
  if (!controlRoot || !kitRoot) {
    throw new Error('5.1.0-expanded-primitives: controlRoot and kitRoot are required');
  }

  const targetDir = path.join(controlRoot, 'v5', '_diagram-assets');
  const kitSharedDir = path.join(kitRoot, 'control', 'layout', 'diagrams', '_shared');

  if (!(await pathExists(kitSharedDir))) {
    logFn('5.1.0: kit shared diagrams directory missing; skipping (unexpected, but non-fatal)');
    return;
  }

  await fs.promises.mkdir(targetDir, { recursive: true });

  // Stamp the backup folder once per migration run.
  const backupStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(targetDir, '.backup', backupStamp);

  for (const filename of KIT_MANAGED_ASSETS) {
    const src = path.join(kitSharedDir, filename);
    const dest = path.join(targetDir, filename);
    if (!(await pathExists(src))) {
      logFn(`5.1.0: kit source missing for ${filename}, skipping`);
      continue;
    }
    const newContent = await fs.promises.readFile(src, 'utf8');
    const existing = await readMaybe(dest);
    if (existing === newContent) {
      logFn(`5.1.0: ${filename} already matches kit, no change`);
      continue;
    }
    if (existing !== null) {
      await fs.promises.mkdir(backupDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(backupDir, filename),
        existing,
        'utf8',
      );
      logFn(`5.1.0: backed up _diagram-assets/${filename} → .backup/${backupStamp}/`);
    }
    await fs.promises.writeFile(dest, newContent, 'utf8');
    logFn(`5.1.0: wrote _diagram-assets/${filename}`);
  }
}

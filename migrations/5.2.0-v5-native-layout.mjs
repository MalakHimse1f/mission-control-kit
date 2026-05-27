import fs from 'node:fs';
import path from 'node:path';

export const version = '5.2.0-v5-native-layout';

/**
 * v5.2.0 — Relocate to the v5-native install layout.
 *
 * Before v5.2.0, the kit's installer was v4-rooted: the control plane
 * lived at `{projectRoot}/docs/superpowers/control/`, and v5 work lived
 * under it at `.../control/v5/`. v5.2.0 drops that wrapping — control
 * plane is now `{projectRoot}/control/`, install stamp is
 * `{projectRoot}/.mc/install.json`, and the v4-era files
 * (ROUTER.md / ORCHESTRATOR.md / scripts/v4 generators / etc.) are
 * archived since nobody runs v4 anymore.
 *
 * What this migration does for existing v5.1.x installs:
 *
 *   - If `{projectRoot}/docs/superpowers/control/v5/` exists, move it to
 *     `{projectRoot}/control/v5/` (merging directory contents — never
 *     clobbering an existing v5 work tree).
 *   - If `{projectRoot}/docs/superpowers/control/.mc/install.json` exists,
 *     copy it to `{projectRoot}/.mc/install.json` if a v5 stamp doesn't
 *     already exist there. The caller (runUpgrade) writes the final
 *     v5.2.0 stamp after this migration runs.
 *   - Archive the rest of `{projectRoot}/docs/superpowers/control/`
 *     (the v4 files) into
 *     `{projectRoot}/.mc/v4-legacy-archive/<timestamp>/`. The user can
 *     restore from there if anything was missed; the runtime no longer
 *     reads from that path.
 *   - Remove the empty `{projectRoot}/docs/superpowers/` tree if nothing
 *     else lives there.
 *
 * Idempotent: if the v4 layout is already gone, the migration is a no-op.
 * If `{projectRoot}/control/v5/` and the v4 v5/ both exist, we leave the
 * canonical v5-native one alone and archive the v4 copy alongside the
 * other v4 files (data preservation > tidy archive structure).
 *
 * Signature accepts the v5.2.0 migration shape:
 *   up({ controlRoot, kitRoot, projectRoot, log })
 * (older v4-era migrations took only `{controlRoot, kitRoot}` — this one
 * needs projectRoot to find the legacy tree alongside the new one.)
 */

function noop() {}

async function pathExists(p) {
  try {
    await fs.promises.stat(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively move srcDir into destDir, merging directories and never
 * overwriting an existing file at the destination. Returns the list of
 * relative paths that were skipped because they already existed.
 */
async function mergeMoveDir(srcDir, destDir) {
  const skipped = [];
  await fs.promises.mkdir(destDir, { recursive: true });
  const entries = await fs.promises.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      const childSkipped = await mergeMoveDir(src, dest);
      for (const s of childSkipped) skipped.push(`${entry.name}/${s}`);
      // Remove src dir if it's now empty.
      try {
        const remaining = await fs.promises.readdir(src);
        if (remaining.length === 0) await fs.promises.rmdir(src);
      } catch {
        // ignore — non-empty after partial skip is expected
      }
    } else {
      if (await pathExists(dest)) {
        skipped.push(entry.name);
        continue;
      }
      await fs.promises.rename(src, dest);
    }
  }
  return skipped;
}

/**
 * Move (or copy then remove) `src` -> `dest`. Falls back to copy+unlink
 * if rename fails (e.g. across filesystems).
 */
async function moveFile(src, dest) {
  await fs.promises.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.promises.rename(src, dest);
  } catch {
    await fs.promises.copyFile(src, dest);
    await fs.promises.unlink(src);
  }
}

export async function up({ projectRoot, controlRoot, kitRoot: _kitRoot, log } = {}) {
  const logFn = typeof log === 'function' ? log : noop;
  // Older migration runners (v4) only pass controlRoot/kitRoot. Derive
  // projectRoot defensively for those.
  const root = projectRoot || (controlRoot ? path.resolve(controlRoot, '..') : null);
  if (!root) {
    throw new Error('5.2.0-v5-native-layout: projectRoot (or controlRoot) is required');
  }

  const legacyControlRoot = path.join(root, 'docs', 'superpowers', 'control');
  if (!(await pathExists(legacyControlRoot))) {
    logFn('5.2.0: no legacy docs/superpowers/control/ tree; nothing to relocate');
    return;
  }

  // 1. Move {legacy}/v5/ -> {root}/control/v5/
  const legacyV5 = path.join(legacyControlRoot, 'v5');
  const newV5 = path.join(root, 'control', 'v5');
  if (await pathExists(legacyV5)) {
    if (!(await pathExists(newV5))) {
      await fs.promises.mkdir(path.dirname(newV5), { recursive: true });
      await fs.promises.rename(legacyV5, newV5);
      logFn(`5.2.0: moved ${legacyV5} -> ${newV5}`);
    } else {
      const skipped = await mergeMoveDir(legacyV5, newV5);
      logFn(
        `5.2.0: merged ${legacyV5} into existing ${newV5}` +
          (skipped.length ? ` (kept existing for: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? `, +${skipped.length - 5} more` : ''})` : ''),
      );
    }
  }

  // 2. Move the install stamp if needed.
  const legacyStamp = path.join(legacyControlRoot, '.mc', 'install.json');
  const newStamp = path.join(root, '.mc', 'install.json');
  if ((await pathExists(legacyStamp)) && !(await pathExists(newStamp))) {
    await moveFile(legacyStamp, newStamp);
    logFn(`5.2.0: relocated install stamp to ${newStamp}`);
  }

  // 3. Archive the rest of the legacy control plane to
  //    `{root}/.mc/v4-legacy-archive/<timestamp>/`.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveDir = path.join(root, '.mc', 'v4-legacy-archive', stamp);
  // If anything is still under legacyControlRoot, move it wholesale into the archive.
  const remaining = await fs.promises.readdir(legacyControlRoot, { withFileTypes: true });
  if (remaining.length > 0) {
    await fs.promises.mkdir(archiveDir, { recursive: true });
    for (const entry of remaining) {
      const src = path.join(legacyControlRoot, entry.name);
      const dest = path.join(archiveDir, entry.name);
      try {
        await fs.promises.rename(src, dest);
      } catch {
        // cross-fs fallback: cp -r equivalent + remove
        await fs.promises.cp(src, dest, { recursive: true, force: false });
        await fs.promises.rm(src, { recursive: true, force: true });
      }
    }
    logFn(`5.2.0: archived legacy v4 control plane -> ${archiveDir}`);
  }

  // 4. Tear down the now-empty legacy directories.
  try {
    await fs.promises.rmdir(legacyControlRoot);
  } catch {
    // not empty (e.g. .DS_Store or user dropped files there) — leave it
  }
  const legacyParent = path.join(root, 'docs', 'superpowers');
  try {
    const parentChildren = await fs.promises.readdir(legacyParent);
    if (parentChildren.length === 0) await fs.promises.rmdir(legacyParent);
  } catch {
    // ignore
  }
  try {
    const docsChildren = await fs.promises.readdir(path.join(root, 'docs'));
    if (docsChildren.length === 0) await fs.promises.rmdir(path.join(root, 'docs'));
  } catch {
    // user may have their own docs/ — that's fine
  }

  logFn('5.2.0: v5-native layout in place');
}

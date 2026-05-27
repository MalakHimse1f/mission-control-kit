/**
 * Mission Control v4 — safe upgrade engine.
 * Syncs kit runtime to a project without overwriting user workspace.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONTROL_PRESERVE_EXACT = new Set([
  'state.json',
  'HANDOFF.md',
  'SPEC-PORTFOLIO-REVIEW.md',
  'tech-stack/stack.json',
  'tech-stack/CONTEXT.md',
  'dashboard.html',
]);

const KIT_TECH_STACK_SHIPPED = new Set([
  'tech-stack/README.md',
  'tech-stack/LAYOUT-TARGETS.md',
]);

export function parseVersion(v) {
  return String(v || '0.0.0')
    .replace(/^v/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

export function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (va[i] < vb[i]) return -1;
    if (va[i] > vb[i]) return 1;
  }
  return 0;
}

export function shouldPreserveControlPath(relPath) {
  const norm = relPath.replace(/\\/g, '/').replace(/^\.\//, '');

  if (CONTROL_PRESERVE_EXACT.has(norm)) return true;
  if (norm.startsWith('.mc/')) return true;
  if (norm.startsWith('custom/')) return true;
  if (norm.startsWith('project/')) return true;
  if (norm.startsWith('features/') && !norm.startsWith('features/_template/')) return true;
  if (norm.startsWith('tech-stack/')) {
    if (KIT_TECH_STACK_SHIPPED.has(norm)) return false;
    if (norm.startsWith('tech-stack/_template/')) return false;
    return true;
  }
  return false;
}

export function listControlSyncPlan(relativePaths) {
  const sync = [];
  const preserve = [];
  for (const rel of relativePaths) {
    if (shouldPreserveControlPath(rel)) preserve.push(rel);
    else sync.push(rel);
  }
  return { sync, preserve };
}

export function kitRootFromModule(metaUrl = import.meta.url) {
  return path.resolve(path.dirname(fileURLToPath(metaUrl)), '..');
}

export function readKitManifest(kitRoot) {
  const p = path.join(kitRoot, 'kit-manifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Install-stamp location for v5.2.0+ — lives at the project root, not
 * under the control plane. Matches `lib/v5/install-stamp.mjs` so the
 * dashboard's kit-version banner and this upgrade engine read from the
 * same place.
 *
 * The legacy v4 location (docs/superpowers/control/.mc/install.json)
 * is checked as a read-only fallback by `readInstallStamp` so v4-rooted
 * installs upgrading to v5.2.0 don't lose their version history. The
 * 5.2.0-v5-native-layout migration relocates the stamp to the v5
 * canonical location on first upgrade.
 */
export function installStampPath(projectRoot) {
  return path.join(projectRoot, '.mc', 'install.json');
}

export function legacyInstallStampPath(projectRoot) {
  return path.join(projectRoot, 'docs', 'superpowers', 'control', '.mc', 'install.json');
}

export function readInstallStamp(projectRoot) {
  const v5 = installStampPath(projectRoot);
  if (fs.existsSync(v5)) return JSON.parse(fs.readFileSync(v5, 'utf8'));
  const legacy = legacyInstallStampPath(projectRoot);
  if (fs.existsSync(legacy)) return JSON.parse(fs.readFileSync(legacy, 'utf8'));
  return null;
}

export function writeInstallStamp(projectRoot, stamp) {
  const p = installStampPath(projectRoot);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(stamp, null, 2)}\n`);
}

export function listRelativeFiles(rootDir, prefix = '') {
  const out = [];
  if (!fs.existsSync(rootDir)) return out;
  for (const name of fs.readdirSync(rootDir)) {
    if (name.startsWith('.')) continue;
    const full = path.join(rootDir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) out.push(...listRelativeFiles(full, rel));
    else out.push(rel.replace(/\\/g, '/'));
  }
  return out;
}

export function copyFileSafe(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

export function syncControlPlane({ kitControl, projectControl, dryRun = false }) {
  const kitFiles = listRelativeFiles(kitControl);
  const plan = listControlSyncPlan(kitFiles);
  const copied = [];
  const skipped = [...plan.preserve];

  for (const rel of plan.sync) {
    const src = path.join(kitControl, rel);
    const dest = path.join(projectControl, rel);
    if (!dryRun) copyFileSafe(src, dest);
    copied.push(rel);
  }

  return { copied, skipped, plan };
}

export function backupPreservedFiles({ projectControl, backupDir }) {
  fs.mkdirSync(backupDir, { recursive: true });
  const all = listRelativeFiles(projectControl);
  const preserved = all.filter((rel) => shouldPreserveControlPath(rel));
  for (const rel of preserved) {
    const src = path.join(projectControl, rel);
    const dest = path.join(backupDir, rel);
    copyFileSafe(src, dest);
  }
  const stamp = installStampPath(projectControl);
  if (fs.existsSync(stamp)) {
    copyFileSafe(stamp, path.join(backupDir, '.mc/install.json'));
  }
  return preserved;
}

export function syncDirectory({ srcDir, destDir, dryRun = false }) {
  if (!fs.existsSync(srcDir)) return [];
  const copied = [];
  fs.mkdirSync(destDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.startsWith('.')) continue;
    const src = path.join(srcDir, name);
    const dest = path.join(destDir, name);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copied.push(...syncDirectory({ srcDir: src, destDir: dest, dryRun }));
    } else if (!dryRun) {
      copyFileSafe(src, dest);
      copied.push(name);
    } else {
      copied.push(name);
    }
  }
  return copied;
}

export async function runMigrations({
  kitRoot,
  controlRoot,
  projectRoot,
  fromVersion,
  toVersion,
  dryRun = false,
}) {
  const migrationsDir = path.join(kitRoot, 'migrations');
  if (!fs.existsSync(migrationsDir)) return [];

  const ran = [];
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.mjs')).sort();
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(migrationsDir, file)).href);
    const migrationVersion = mod.version ?? file.replace('.mjs', '');
    if (compareVersions(fromVersion, migrationVersion) >= 0) continue;
    if (compareVersions(migrationVersion, toVersion) > 0) continue;
    if (!dryRun && typeof mod.up === 'function') {
      // v5.2.0+: migrations receive `projectRoot` too, so the layout-
      // migration (and any future layout-aware work) doesn't have to
      // path-arithmetic its way up from controlRoot. Existing v4-era
      // migrations ignore the extra field.
      await mod.up({ controlRoot, kitRoot, projectRoot });
    }
    ran.push(migrationVersion);
  }
  return ran;
}

export function upgradeReport({
  fromVersion,
  toVersion,
  copiedControl,
  skippedControl,
  migrations,
  backupDir,
  dryRun,
}) {
  const lines = [
    `# Mission Control upgrade ${dryRun ? '(dry-run) ' : ''}${fromVersion ?? 'none'} → ${toVersion}`,
    '',
    `- Control files synced: ${copiedControl.length}`,
    `- Control files preserved: ${skippedControl.length}`,
    `- Migrations: ${migrations.length ? migrations.join(', ') : 'none'}`,
  ];
  if (backupDir && !dryRun) lines.push(`- Backup: ${backupDir}`);
  lines.push('', '## Preserved (user workspace)', ...skippedControl.slice(0, 20).map((p) => `- ${p}`));
  if (skippedControl.length > 20) lines.push(`- … and ${skippedControl.length - 20} more`);
  return `${lines.join('\n')}\n`;
}

/**
 * v5.2.0 layout: the control plane lives at `{projectRoot}/control/`.
 * The kit's source-side control plane is still `{kitRoot}/control/`, but
 * it's no longer wholesale-synced into the user project — only v5
 * migrations copy the bits users need.
 */
export function resolvePaths(projectRoot, kitRoot) {
  const controlRoot = path.join(projectRoot, 'control');
  const kitControl = path.join(kitRoot, 'control');
  return { controlRoot, kitControl };
}

export function resolveLocalKitRoot(projectRoot, kitFolder = 'mission-control-kit') {
  const stamp = readInstallStamp(projectRoot);
  const folders = [
    stamp?.kitPath,
    kitFolder,
    'mission-control-kit-v4', // legacy folder name (pre-4.3.1)
  ].filter(Boolean);
  const seen = new Set();
  for (const folder of folders) {
    if (seen.has(folder)) continue;
    seen.add(folder);
    const candidate = path.join(projectRoot, folder);
    if (fs.existsSync(path.join(candidate, 'kit-manifest.json'))) return candidate;
  }
  return null;
}

export async function resolveKitRoot({
  projectRoot,
  kitRootArg,
  fetchRelease = false,
  releaseRepo,
  releaseVersion = 'latest',
  manifest,
}) {
  if (kitRootArg) {
    const resolved = path.resolve(kitRootArg);
    if (!fs.existsSync(path.join(resolved, 'kit-manifest.json'))) {
      throw new Error(`KIT_MANIFEST_MISSING at ${resolved}`);
    }
    return resolved;
  }

  const local = resolveLocalKitRoot(projectRoot, manifest?.kitFolder ?? 'mission-control-kit');
  if (local && !fetchRelease) return local;

  const release = manifest?.release;
  const repo = releaseRepo ?? release?.github;
  if (!repo) {
    if (local) return local;
    throw new Error('KIT_NOT_FOUND — add kit folder to project or configure release.github in kit-manifest.json');
  }

  const { fetchGitHubReleaseKit } = await import('./fetch-kit-release.mjs');
  const result = await fetchGitHubReleaseKit({
    projectRoot,
    repo,
    version: fetchRelease ? releaseVersion : releaseVersion,
    assetPattern: release?.assetPattern ?? 'mission-control-kit',
  });
  return result.kitRoot;
}

export async function runUpgrade({
  projectRoot,
  kitRoot: kitRootInput,
  kitRootArg,
  fetchRelease = false,
  releaseRepo,
  releaseVersion = 'latest',
  target = 'both',
  dryRun = false,
  install = false,
}) {
  const preliminaryManifestPath = kitRootInput
    ? path.join(kitRootInput, 'kit-manifest.json')
    : null;
  let manifest = preliminaryManifestPath && fs.existsSync(preliminaryManifestPath)
    ? JSON.parse(fs.readFileSync(preliminaryManifestPath, 'utf8'))
    : null;

  const kitRoot = kitRootInput ?? (await resolveKitRoot({
    projectRoot,
    kitRootArg,
    fetchRelease,
    releaseRepo,
    releaseVersion,
    manifest: manifest ?? (resolveLocalKitRoot(projectRoot)
      ? readKitManifest(resolveLocalKitRoot(projectRoot))
      : readKitManifest(kitRootFromModule())),
  }));

  const { controlRoot } = resolvePaths(projectRoot, kitRoot);
  manifest = readKitManifest(kitRoot);
  const toVersion = manifest.kitVersion;
  const stamp = readInstallStamp(projectRoot);
  const fromVersion = stamp?.kitVersion ?? null;

  if (!install && fromVersion && compareVersions(fromVersion, toVersion) >= 0) {
    return {
      status: 'up-to-date',
      fromVersion,
      toVersion,
      copiedControl: [],
      skippedControl: [],
      migrations: [],
    };
  }

  fs.mkdirSync(controlRoot, { recursive: true });

  // v5.2.0+: we no longer sync the kit's control/ directory wholesale —
  // migrations are the only mechanism that copies kit assets into the
  // user project. The vendor skill bundles and slash commands still
  // get refreshed below.
  if (target === 'cursor' || target === 'both') {
    syncDirectory({
      srcDir: path.join(kitRoot, 'skills'),
      destDir: path.join(projectRoot, '.cursor/skills'),
      dryRun,
    });
    const cmdSrc = path.join(kitRoot, 'commands');
    const cmdDest = path.join(projectRoot, '.cursor/commands');
    if (fs.existsSync(cmdSrc)) {
      fs.mkdirSync(cmdDest, { recursive: true });
      for (const f of fs.readdirSync(cmdSrc)) {
        if (f.startsWith('mc') && f.endsWith('.md')) {
          if (!dryRun) copyFileSafe(path.join(cmdSrc, f), path.join(cmdDest, f));
        }
      }
    }
  }

  if (target === 'claude' || target === 'both') {
    syncDirectory({
      srcDir: path.join(kitRoot, 'claude-skills'),
      destDir: path.join(projectRoot, '.claude/skills'),
      dryRun,
    });
  }

  const migrations = await runMigrations({
    kitRoot,
    controlRoot,
    projectRoot,
    fromVersion: fromVersion ?? '0.0.0',
    toVersion,
    dryRun,
  });

  if (!dryRun) {
    writeInstallStamp(projectRoot, {
      kitVersion: toVersion,
      schemaVersion: manifest.schemaVersion ?? 1,
      installedAt: new Date().toISOString(),
      kitPath: path.basename(kitRoot),
      migrationsApplied: [...(stamp?.migrationsApplied ?? []), ...migrations].filter(
        (v, i, a) => a.indexOf(v) === i,
      ),
      target,
    });

    const report = upgradeReport({
      fromVersion,
      toVersion,
      copiedControl: [],
      skippedControl: [],
      migrations,
      backupDir: null,
      dryRun: false,
    });
    fs.mkdirSync(path.join(projectRoot, '.mc'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, '.mc', 'UPGRADE-REPORT.md'), report);
  }

  return {
    status: install ? 'installed' : 'upgraded',
    fromVersion,
    toVersion,
    copiedControl: [],
    skippedControl: [],
    migrations,
    backupDir: null,
    dryRun,
  };
}

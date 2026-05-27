/**
 * Mission Control — install-layout resolver (single source of truth).
 *
 * Probes a project root and returns where the control plane, install stamp,
 * and user-guide live. Supports three layouts in priority order:
 *
 *   1. KIT-NESTED  (v5.3.0+ default for fresh installs)
 *        {projectRoot}/{kitFolder}/control/
 *        {projectRoot}/{kitFolder}/.mc/install.json
 *        {projectRoot}/{kitFolder}/User-Guide.html
 *
 *   2. ROOT  (v5.2.0 layout — kept supported indefinitely)
 *        {projectRoot}/control/
 *        {projectRoot}/.mc/install.json
 *        {projectRoot}/User-Guide.html
 *
 *   3. LEGACY-V4  (pre-v5.2.0 — accepted defensively)
 *        {projectRoot}/docs/superpowers/control/
 *        {projectRoot}/docs/superpowers/control/.mc/install.json
 *        {projectRoot}/User-Guide.html
 *
 * Resolution rule:
 *   - If an install stamp exists at any location, that layout wins. The
 *     candidates are scanned in the order above, so kit-nested is preferred
 *     when multiple coexist (shouldn't happen, but defensive).
 *   - If no stamp exists anywhere, the NEW (kit-nested) layout is returned
 *     so fresh installs land there.
 *
 * Stdlib only, sync only.
 */
import fs from 'node:fs';
import path from 'node:path';

export const KIT_FOLDER_DEFAULT = 'mission-control-kit';

/**
 * @typedef {Object} Layout
 * @property {('kit-nested'|'root'|'legacy-v4')} kind
 * @property {string} kitFolder            kit folder name relative to projectRoot
 * @property {string} controlRoot          absolute path to the control plane
 * @property {string} installStampPath     absolute path to .mc/install.json
 * @property {string} userGuidePath        absolute path to User-Guide.html
 * @property {string} mcDir                absolute path to .mc/
 * @property {string} projectRoot          absolute path to the project root
 */

/**
 * Return all candidate layouts for a project root, in priority order.
 *
 * @param {string} projectRoot
 * @param {{ kitFolder?: string }} [opts]
 * @returns {Layout[]}
 */
export function layoutCandidates(projectRoot, opts = {}) {
  // NOTE: do NOT path.resolve here. We want layoutCandidates to be a pure
  // string function (so '/x/y' stays '/x/y' instead of 'C:\\x\\y' on
  // Windows). Resolution belongs to callers that actually touch the FS.
  const root = projectRoot;
  const kitFolder = opts.kitFolder ?? KIT_FOLDER_DEFAULT;
  const kit = path.join(root, kitFolder);

  return [
    {
      kind: 'kit-nested',
      kitFolder,
      projectRoot: root,
      controlRoot: path.join(kit, 'control'),
      mcDir: path.join(kit, '.mc'),
      installStampPath: path.join(kit, '.mc', 'install.json'),
      userGuidePath: path.join(kit, 'User-Guide.html'),
    },
    {
      kind: 'root',
      kitFolder,
      projectRoot: root,
      controlRoot: path.join(root, 'control'),
      mcDir: path.join(root, '.mc'),
      installStampPath: path.join(root, '.mc', 'install.json'),
      userGuidePath: path.join(root, 'User-Guide.html'),
    },
    {
      kind: 'legacy-v4',
      kitFolder,
      projectRoot: root,
      controlRoot: path.join(root, 'docs', 'superpowers', 'control'),
      mcDir: path.join(root, 'docs', 'superpowers', 'control', '.mc'),
      installStampPath: path.join(
        root,
        'docs',
        'superpowers',
        'control',
        '.mc',
        'install.json',
      ),
      userGuidePath: path.join(root, 'User-Guide.html'),
    },
  ];
}

/**
 * Return the layout currently in use for a project, OR the layout that a
 * fresh install should use. Priority:
 *   1. Layout whose install stamp exists.
 *   2. Layout whose control plane directory exists (no stamp).
 *   3. NEW (kit-nested) — the fresh-install default.
 *
 * @param {string} projectRoot
 * @param {{ kitFolder?: string }} [opts]
 * @returns {Layout}
 */
export function resolveLayout(projectRoot, opts = {}) {
  const candidates = layoutCandidates(projectRoot, opts);
  for (const c of candidates) {
    if (fs.existsSync(c.installStampPath)) return c;
  }
  for (const c of candidates) {
    if (fs.existsSync(c.controlRoot)) return c;
  }
  return candidates[0];
}

/**
 * Return the layout for a project ONLY if it's already installed. Returns
 * null when no stamp and no control directory is present — useful for
 * callers that need to distinguish "fresh install" from "upgrade".
 *
 * @param {string} projectRoot
 * @param {{ kitFolder?: string }} [opts]
 * @returns {Layout|null}
 */
export function detectExistingLayout(projectRoot, opts = {}) {
  const candidates = layoutCandidates(projectRoot, opts);
  for (const c of candidates) {
    if (fs.existsSync(c.installStampPath)) return c;
  }
  for (const c of candidates) {
    if (fs.existsSync(c.controlRoot)) return c;
  }
  return null;
}

/**
 * Convenience: return just the active control-root path for a project.
 */
export function resolveControlRoot(projectRoot, opts = {}) {
  return resolveLayout(projectRoot, opts).controlRoot;
}

/**
 * Convenience: return just the install-stamp path for a project.
 */
export function resolveInstallStampPath(projectRoot, opts = {}) {
  return resolveLayout(projectRoot, opts).installStampPath;
}

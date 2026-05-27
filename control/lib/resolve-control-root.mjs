import fs from 'node:fs';
import path from 'node:path';

const KIT_FOLDER_DEFAULT = 'mission-control-kit';

// Probed in priority order. `state.json` lives at the v5 control plane
// root, so we probe `{candidate}/v5/state.json` first and fall back to
// `{candidate}/state.json` (legacy v4 location).
const CANDIDATES = [
  // v5.3+ kit-nested layout
  `${KIT_FOLDER_DEFAULT}/control`,
  // v5.2 root layout
  'control',
  // v4 legacy
  'docs/superpowers/control',
];

function hasControlState(dir) {
  return (
    fs.existsSync(path.join(dir, 'v5', 'state.json')) ||
    fs.existsSync(path.join(dir, 'state.json'))
  );
}

/** Resolve Mission Control control directory from a project or kit root. */
export function resolveControlRoot(projectRoot = process.cwd(), opts = {}) {
  const root = path.resolve(projectRoot);
  const kitFolder = opts.kitFolder ?? KIT_FOLDER_DEFAULT;
  const candidates = [
    `${kitFolder}/control`,
    'control',
    'docs/superpowers/control',
  ];
  for (const rel of candidates) {
    const dir = path.join(root, ...rel.split('/'));
    if (hasControlState(dir)) return dir;
  }
  throw new Error(
    `Mission Control control root not found under ${root} (expected state.json in ${CANDIDATES.join(' or ')})`,
  );
}

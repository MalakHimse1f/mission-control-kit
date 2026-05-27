// tests/helpers/tmp-project.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Create a fresh temp project root containing an empty control/v5/ skeleton.
 * Returns { root, cleanup }. `root` is the project root (contains control/v5/).
 */
export async function makeTmpProject({ withState = true } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mc-v5-'));
  await fs.mkdir(path.join(root, 'control', 'v5', 'features'), { recursive: true });
  if (withState) {
    const state = { version: '5.0.0', activeFeature: null, features: [], updatedAt: new Date().toISOString() };
    await fs.writeFile(
      path.join(root, 'control', 'v5', 'state.json'),
      JSON.stringify(state, null, 2) + '\n',
      'utf8',
    );
  }
  const cleanup = () => fs.rm(root, { recursive: true, force: true });
  return { root, cleanup };
}

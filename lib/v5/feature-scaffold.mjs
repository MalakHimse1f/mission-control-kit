/**
 * v5 feature scaffolding: create control/v5/features/{slug}/ with a default
 * status.json + schema-valid decisions.json, and register the feature in
 * state.json. Idempotent — never clobbers an existing feature.
 *
 * controlRoot is the project root (directory containing control/v5/).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { writeDecisions } from './decisions.mjs';
import { readState, upsertFeature } from './state.mjs';

const VALID_FEATURE_TYPES = ['feature', 'tech-stack'];

async function findNearestProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 64; i++) {
    try {
      const stat = await fs.stat(path.join(dir, 'control', 'v5'));
      if (stat.isDirectory()) return dir;
    } catch {
      // keep walking
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate project root (parent of control/v5/) from ${startDir}. ` +
      `Pass {controlRoot} explicitly.`,
  );
}

/**
 * @param {object} args
 * @param {string} args.slug
 * @param {string} [args.description]
 * @param {'feature'|'tech-stack'} [args.featureType]
 * @param {string} [args.controlRoot] project root containing control/v5/
 * @returns {Promise<{ slug, featureDir, statusPath, created, featureType, currentPhase }>}
 */
export async function scaffoldFeature({ slug, description = '', featureType = 'feature', controlRoot } = {}) {
  if (!slug || typeof slug !== 'string') {
    throw new Error('scaffoldFeature: slug must be a non-empty string');
  }
  if (!VALID_FEATURE_TYPES.includes(featureType)) {
    throw new Error(`scaffoldFeature: featureType must be one of ${VALID_FEATURE_TYPES.join('|')}`);
  }

  const root = controlRoot || (await findNearestProjectRoot(process.cwd()));
  const featureDir = path.join(root, 'control', 'v5', 'features', slug);
  const statusPath = path.join(featureDir, 'status.json');
  const currentPhase = featureType === 'tech-stack' ? 'architecture' : 'ux';

  let created = false;
  try {
    await fs.access(statusPath);
  } catch {
    created = true;
  }

  await fs.mkdir(featureDir, { recursive: true });

  if (created) {
    const status = {
      slug,
      feature: slug,
      stage: 'needs-input',
      currentPhase,
      featureType,
      description,
      lastUpdatedAt: new Date().toISOString(),
    };
    const tmp = `${statusPath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(status, null, 2) + '\n', 'utf8');
    await fs.rename(tmp, statusPath);

    // writeDecisions with {} creates the schema-valid default empty structure.
    await writeDecisions(slug, {}, { controlRoot: root });

    // Register the new feature in state.json.
    await upsertFeature({ slug, stage: 'needs-input', currentPhase }, { controlRoot: root });
  } else {
    // Re-scaffold: ensure the feature is registered, but never reset an
    // already-advanced stage/phase (idempotency — don't clobber).
    const state = await readState({ controlRoot: root });
    const known = Array.isArray(state.features) && state.features.some((f) => f && f.slug === slug);
    if (!known) {
      await upsertFeature({ slug, stage: 'needs-input', currentPhase }, { controlRoot: root });
    }
  }

  return { slug, featureDir, statusPath, created, featureType, currentPhase };
}

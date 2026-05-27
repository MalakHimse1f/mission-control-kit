/**
 * v5 read-only stack detection. Inspects a project root for framework /
 * platform signals so mc-init can pre-fill a tech-stack feature. Writes nothing.
 *
 * Returns: { likelyExisting, frameworks: string[], platforms: string[], signals: string[] }
 */
import fs from 'node:fs/promises';
import path from 'node:path';

async function readJsonIfPresent(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function detectStack({ projectRoot } = {}) {
  if (!projectRoot) throw new Error('detectStack: projectRoot is required');
  const frameworks = [];
  const platforms = [];
  const signals = [];

  const pkg = await readJsonIfPresent(path.join(projectRoot, 'package.json'));
  if (pkg) {
    signals.push('package.json');
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, marker] of [
      ['next', 'next'],
      ['react', 'react'],
      ['vue', 'vue'],
      ['svelte', 'svelte'],
      ['express', 'express'],
      ['@angular/core', 'angular'],
      ['react-native', 'React Native'],
      ['expo', 'Expo'],
      ['electron', 'Electron'],
      ['@supabase/supabase-js', 'Supabase'],
    ]) {
      if (deps[name]) frameworks.push(marker);
    }
    if (frameworks.some((f) => ['next', 'react', 'vue', 'svelte', 'angular'].includes(f))) {
      platforms.push('web');
    }
    if (frameworks.includes('React Native') || frameworks.includes('Expo')) {
      platforms.push('mobile');
    }
    if (frameworks.includes('Electron')) {
      platforms.push('desktop');
    }
  }

  if (await exists(path.join(projectRoot, 'Package.swift'))) {
    frameworks.push('swift');
    platforms.push('ios');
    signals.push('Package.swift');
  }
  if (await exists(path.join(projectRoot, 'build.gradle'))) {
    platforms.push('android');
    signals.push('build.gradle');
  }
  if (await exists(path.join(projectRoot, 'Cargo.toml'))) {
    frameworks.push('rust');
    signals.push('Cargo.toml');
  }
  if (await exists(path.join(projectRoot, 'pyproject.toml')) || (await exists(path.join(projectRoot, 'requirements.txt')))) {
    frameworks.push('python');
    signals.push('python');
  }
  if (
    (await exists(path.join(projectRoot, 'vite.config.ts'))) ||
    (await exists(path.join(projectRoot, 'vite.config.js')))
  ) {
    frameworks.push('Vite');
    signals.push('vite.config');
  }
  if (await exists(path.join(projectRoot, 'turbo.json'))) {
    frameworks.push('Turborepo');
    signals.push('turbo.json');
  }

  return {
    likelyExisting: signals.length > 0,
    frameworks: [...new Set(frameworks)],
    platforms: [...new Set(platforms)],
    signals,
  };
}

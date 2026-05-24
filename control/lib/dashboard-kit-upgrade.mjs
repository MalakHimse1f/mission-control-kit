import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export function projectRootFromControlRoot(controlRoot) {
  return path.resolve(controlRoot, '..', '..', '..');
}

export function kitUpgradeScriptPath(projectRoot, controlRoot) {
  const stampPath = path.join(controlRoot, '.mc/install.json');
  const stamp = fs.existsSync(stampPath) ? JSON.parse(fs.readFileSync(stampPath, 'utf8')) : null;
  const kitFolder = stamp?.kitPath ?? 'mission-control-kit';
  const script = path.join(projectRoot, kitFolder, 'scripts/mc-upgrade.mjs');
  if (!fs.existsSync(script)) {
    throw new Error(`Upgrade script not found: ${script}`);
  }
  return script;
}

export function runKitUpgradeCli(projectRoot, controlRoot, { spawnFn = spawn } = {}) {
  const script = kitUpgradeScriptPath(projectRoot, controlRoot);
  return new Promise((resolve, reject) => {
    const child = spawnFn(process.execPath, [script, projectRoot, '--fetch'], {
      cwd: projectRoot,
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      const output = `${stdout}${stderr}`.trim();
      if (code === 0) {
        resolve({ output });
        return;
      }
      reject(new Error(output || `mc-upgrade exited ${code}`));
    });
  });
}

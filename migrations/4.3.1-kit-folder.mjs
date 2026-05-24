export const version = '4.3.1-kit-folder';

/** Update install stamp when kit used legacy mission-control-kit-v4/ folder name. */
export async function up({ controlRoot }) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const stampPath = path.join(controlRoot, '.mc', 'install.json');
  if (!fs.existsSync(stampPath)) return;
  const stamp = JSON.parse(fs.readFileSync(stampPath, 'utf8'));
  if (stamp.kitPath === 'mission-control-kit-v4') {
    stamp.kitPath = 'mission-control-kit';
    fs.writeFileSync(stampPath, `${JSON.stringify(stamp, null, 2)}\n`);
  }
}

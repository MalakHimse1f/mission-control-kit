export const version = '4.2.0-custom-dir';

/** Ensure custom/ overlay directory exists for user overrides. */
export async function up({ controlRoot }) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const customDir = path.join(controlRoot, 'custom');
  fs.mkdirSync(customDir, { recursive: true });
  const readme = path.join(customDir, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# Custom overrides\n\nFiles here are **never overwritten** on upgrade.\n\nAdd local notes, ROUTER patches, or team conventions. The orchestrator should read \`custom/\` when present.\n`,
    );
  }
}

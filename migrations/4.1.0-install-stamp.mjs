export const version = '4.1.0-install-stamp';

/** Ensure .mc directory exists for install tracking. */
export async function up({ controlRoot }) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  fs.mkdirSync(path.join(controlRoot, '.mc'), { recursive: true });
}

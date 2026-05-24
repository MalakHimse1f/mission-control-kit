/** @typedef {import('../lib/mc-upgrade.mjs').runUpgrade} runUpgrade */
export const version = '4.0.0-baseline';

/** No-op baseline — marks fresh v4 projects. */
export async function up({ controlRoot }) {
  const stampPath = `${controlRoot}/.mc/install.json`;
  // Stamp written by runUpgrade after migrations
}

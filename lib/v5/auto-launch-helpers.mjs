/**
 * Pure helpers for v5 dashboard auto-launch.
 *
 * These functions are intentionally side-effect-free so they can be
 * unit-tested without spawning processes. The orchestrating logic lives
 * in `lib/v5/auto-launch.mjs`.
 *
 * Stdlib only.
 */

/**
 * Build the dashboard URL to open.
 *
 * - With `slug`:               `${baseUrl}/feature/${slug}`
 * - With `slug` and `anchor`:  `${baseUrl}/feature/${slug}#${anchor}`
 * - Without `slug`:            `${baseUrl}/`
 *
 * Slug and anchor are URL-encoded so values with spaces or special
 * characters produce a valid URL.
 *
 * @param {string} baseUrl  e.g. 'http://127.0.0.1:9470'
 * @param {{ slug?: string, anchor?: string }} [opts]
 * @returns {string}
 */
export function buildTargetUrl(baseUrl, opts = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('buildTargetUrl: baseUrl is required');
  }
  // Normalize: strip exactly one trailing slash so we can append cleanly.
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  const { slug, anchor } = opts || {};
  if (!slug) {
    return `${base}/`;
  }
  const encodedSlug = encodeURIComponent(slug);
  let url = `${base}/feature/${encodedSlug}`;
  if (anchor) {
    url += `#${encodeURIComponent(anchor)}`;
  }
  return url;
}

/**
 * Map a Node.js `process.platform` string to the OS open-URL command.
 *
 * - `darwin` → `open`
 * - `linux`  → `xdg-open`
 * - `win32`  → `start`
 *
 * Throws for unsupported platforms (haiku, sunos, etc.). Callers that
 * want a soft check can use `isSupportedPlatform()` first.
 *
 * @param {NodeJS.Platform | string} platform
 * @returns {'open' | 'xdg-open' | 'start'}
 */
export function getOpenCommand(platform) {
  switch (platform) {
    case 'darwin':
      return 'open';
    case 'linux':
      return 'xdg-open';
    case 'win32':
      return 'start';
    default:
      throw new Error(
        `getOpenCommand: unsupported platform "${platform}". ` +
          `Supported: darwin, linux, win32.`,
      );
  }
}

/**
 * @param {string} [platform]
 * @returns {boolean}
 */
export function isSupportedPlatform(platform) {
  return platform === 'darwin' || platform === 'linux' || platform === 'win32';
}

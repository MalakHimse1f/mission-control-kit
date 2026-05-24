export const KIT_VERSION_CLIENT_JS = `
(function () {
  if (window.location.protocol === "file:") return;
  const strip = document.querySelector(".kit-version-strip");
  if (!strip) return;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHint(hintEl, kv) {
    const installed = kv.installed ?? "not installed";
    const folder = esc(kv.kitFolder ?? "mission-control-kit");
    if (kv.updateAvailable) {
      const target = kv.updateSource === "github" ? kv.remoteVersion : kv.latest;
      const src = kv.updateSource === "github" ? "GitHub" : "local kit folder";
      hintEl.innerHTML =
        'Update on ' + src + ' (' + esc(installed) + " → " + esc(target) +
        '). Run <code>/mc-upgrade</code> or <code>node ' + folder +
        '/scripts/mc-upgrade.mjs . --fetch</code> — your specs are preserved.';
      hintEl.className = "kit-update-hint";
      strip.classList.add("update-available");
      return;
    }
    let msg = "Kit up to date";
    if (kv.remoteVersion) {
      msg += " · GitHub " + esc(kv.remoteVersion);
      if (kv.remoteFromCache) msg += " (cached)";
    } else if (kv.remoteError) {
      msg += " · GitHub check failed";
    }
    msg += ".";
    hintEl.className = "muted";
    hintEl.textContent = msg;
    strip.classList.remove("update-available");
  }

  fetch("/api/kit-version")
    .then(function (r) { return r.json(); })
    .then(function (kv) {
      const hint = strip.querySelector(".kit-update-hint, .muted");
      if (hint) renderHint(hint, kv);
    })
    .catch(function () {});
})();
`;

export function renderKitVersionStrip(kitVersion, escapeHtml) {
  if (!kitVersion?.installed && !kitVersion?.latest) return "";
  const installed = kitVersion.installed ?? "not installed";
  const folder = escapeHtml(kitVersion.kitFolder ?? "mission-control-kit");
  const cls = kitVersion.updateAvailable ? "kit-version-strip update-available" : "kit-version-strip";

  let hint;
  if (kitVersion.updateAvailable) {
    const target =
      kitVersion.updateSource === "github" ? kitVersion.remoteVersion : kitVersion.latest;
    const src = kitVersion.updateSource === "github" ? "GitHub" : "local kit folder";
    hint =
      `<span class="kit-update-hint">Update on ${src} (${escapeHtml(String(installed))} → ${escapeHtml(String(target))}). ` +
      `Run <code>/mc-upgrade</code> or <code>node ${folder}/scripts/mc-upgrade.mjs . --fetch</code> — your specs are preserved.</span>`;
  } else if (kitVersion.remoteChecked && kitVersion.remoteVersion) {
    const cached = kitVersion.remoteFromCache ? " (cached)" : "";
    hint = `<span class="muted">Kit up to date · GitHub ${escapeHtml(String(kitVersion.remoteVersion))}${cached}.</span>`;
  } else if (kitVersion.remoteError) {
    hint = `<span class="muted">Kit up to date locally · GitHub check failed.</span>`;
  } else if (!kitVersion.remoteChecked) {
    hint =
      `<span class="muted">Local kit folder matches install stamp · run <code>node docs/superpowers/control/scripts/dashboard-server.mjs</code> to check GitHub.</span>`;
  } else {
    hint = `<span class="muted">Kit up to date.</span>`;
  }

  return `<div class="${cls}"><span class="kit-version-badge">Mission Control ${escapeHtml(String(installed))}</span>${hint}</div>`;
}

export const KIT_UPGRADE_BUTTON_HTML =
  '<button type="button" class="btn btn-primary kit-upgrade-btn" id="kit-upgrade-btn" hidden>Upgrade kit</button>' +
  '<span class="kit-upgrade-msg" id="kit-upgrade-msg"></span>';

export const KIT_VERSION_CLIENT_JS = `
(function () {
  if (window.location.protocol === "file:") return;
  const strip = document.querySelector(".kit-version-strip");
  if (!strip) return;

  const upgradeBtn = document.getElementById("kit-upgrade-btn");
  const upgradeMsg = document.getElementById("kit-upgrade-msg");

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderStrip(kv) {
    const installed = kv.installed ?? "not installed";
    const badge = strip.querySelector(".kit-version-badge");
    if (badge) badge.textContent = "Mission Control " + installed;

    let hint = strip.querySelector(".kit-update-hint, .kit-version-muted");
    if (!hint) {
      hint = document.createElement("span");
      strip.insertBefore(hint, upgradeBtn || null);
    }

    if (kv.updateAvailable) {
      const target = kv.updateSource === "github" ? kv.remoteVersion : kv.latest;
      const src = kv.updateSource === "github" ? "GitHub" : "local kit folder";
      hint.innerHTML =
        "Update on " + src + " (" + esc(installed) + " → " + esc(target) +
        "). Your specs are preserved.";
      hint.className = "kit-update-hint";
      strip.classList.add("update-available");
      if (upgradeBtn) {
        upgradeBtn.hidden = false;
        upgradeBtn.disabled = false;
      }
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
    hint.className = "kit-version-muted muted";
    hint.textContent = msg;
    strip.classList.remove("update-available");
    if (upgradeBtn) upgradeBtn.hidden = true;
  }

  async function runUpgrade() {
    if (!upgradeBtn || upgradeBtn.disabled) return;
    upgradeBtn.disabled = true;
    if (upgradeMsg) upgradeMsg.textContent = "Upgrading…";
    try {
      const res = await fetch("/api/kit-upgrade", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Upgrade failed");
      if (upgradeMsg) {
        upgradeMsg.textContent = "Upgraded to " + (data.toVersion || "latest") + " — reloading…";
      }
      setTimeout(function () { location.reload(); }, 900);
    } catch (err) {
      if (upgradeMsg) upgradeMsg.textContent = err.message || "Upgrade failed";
      upgradeBtn.disabled = false;
    }
  }

  if (upgradeBtn) upgradeBtn.addEventListener("click", runUpgrade);

  fetch("/api/kit-version")
    .then(function (r) { return r.json(); })
    .then(renderStrip)
    .catch(function () {});
})();
`;

export function renderKitVersionStrip(kitVersion, escapeHtml) {
  if (!kitVersion?.installed && !kitVersion?.latest) return "";
  const installed = kitVersion.installed ?? "not installed";
  const cls = kitVersion.updateAvailable ? "kit-version-strip update-available" : "kit-version-strip";

  let hint;
  if (kitVersion.updateAvailable) {
    const target =
      kitVersion.updateSource === "github" ? kitVersion.remoteVersion : kitVersion.latest;
    const src = kitVersion.updateSource === "github" ? "GitHub" : "local kit folder";
    hint =
      `<span class="kit-update-hint">Update on ${src} (${escapeHtml(String(installed))} → ${escapeHtml(String(target))}). Your specs are preserved.</span>`;
  } else if (kitVersion.remoteChecked && kitVersion.remoteVersion) {
    const cached = kitVersion.remoteFromCache ? " (cached)" : "";
    hint = `<span class="kit-version-muted muted">Kit up to date · GitHub ${escapeHtml(String(kitVersion.remoteVersion))}${cached}.</span>`;
  } else if (kitVersion.remoteError) {
    hint = `<span class="kit-version-muted muted">Kit up to date locally · GitHub check failed.</span>`;
  } else if (!kitVersion.remoteChecked) {
    hint =
      `<span class="kit-version-muted muted">Local kit folder matches install stamp · run <code>node docs/superpowers/control/scripts/dashboard-server.mjs</code> to check GitHub.</span>`;
  } else {
    hint = `<span class="kit-version-muted muted">Kit up to date.</span>`;
  }

  const upgradeBtn = kitVersion.updateAvailable
    ? '<button type="button" class="btn btn-primary kit-upgrade-btn" id="kit-upgrade-btn">Upgrade kit</button>' +
      '<span class="kit-upgrade-msg" id="kit-upgrade-msg"></span>'
    : KIT_UPGRADE_BUTTON_HTML;

  return `<div class="${cls}"><span class="kit-version-badge">Mission Control ${escapeHtml(String(installed))}</span>${hint}${upgradeBtn}</div>`;
}

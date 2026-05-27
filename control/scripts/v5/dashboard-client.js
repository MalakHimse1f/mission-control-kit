/* Mission Control Kit v5 — dashboard client JS.
 *
 * Concerns:
 *   1. Filter-pill interactions on the All Items list.
 *   2. Copy-to-clipboard for the pickup prompt and How-to-use chips.
 */
(function () {
  'use strict';

  // ---- Copy buttons ----
  // Two flavours:
  //   - [data-copy]            → copy that literal string (How-to-use chips)
  //   - [data-copy-target=id]  → copy the textContent of the element with that
  //                              id (Pickup prompt block)
  function flashCopied(btn) {
    btn.classList.add('copied');
    setTimeout(function () { btn.classList.remove('copied'); }, 1500);
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (_) { /* swallow */ }
    document.body.removeChild(ta);
  }

  function doCopy(text, btn) {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { flashCopied(btn); },
        function () { fallbackCopy(text); flashCopied(btn); },
      );
    } else {
      fallbackCopy(text);
      flashCopied(btn);
    }
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy], [data-copy-target]');
    if (!btn) return;
    var literal = btn.getAttribute('data-copy');
    if (literal != null) {
      doCopy(literal, btn);
      return;
    }
    var targetId = btn.getAttribute('data-copy-target');
    if (targetId) {
      var el = document.getElementById(targetId);
      if (el) doCopy(el.textContent || '', btn);
    }
  });

  // ---- Filter pills ----
  var filterBar = document.querySelector('.filter-bar');
  var itemsList = document.querySelector('.items-list');
  if (!filterBar || !itemsList) return;

  var pills = Array.prototype.slice.call(filterBar.querySelectorAll('.filter-pill'));
  var rows = Array.prototype.slice.call(itemsList.querySelectorAll('.item-row'));

  function setActive(filter) {
    pills.forEach(function (pill) {
      var isActive = filter != null && pill.getAttribute('data-filter') === filter;
      pill.classList.toggle('active', isActive);
      pill.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    rows.forEach(function (row) {
      var cat = row.getAttribute('data-category');
      var visible = filter == null || cat === filter;
      row.classList.toggle('is-hidden', !visible);
    });
  }

  function syncUrl(filter) {
    try {
      var url = new URL(window.location.href);
      if (filter == null) {
        url.searchParams.delete('filter');
      } else {
        url.searchParams.set('filter', filter);
      }
      window.history.replaceState(null, '', url.toString());
    } catch (_) {
      /* older browsers: ignore */
    }
  }

  function applyFromUrl() {
    var current = null;
    try {
      var params = new URL(window.location.href).searchParams;
      var v = params.get('filter');
      if (v) current = v;
    } catch (_) {
      current = null;
    }
    setActive(current);
  }

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      var filter = pill.getAttribute('data-filter');
      // Toggle off if already active.
      if (pill.classList.contains('active')) {
        setActive(null);
        syncUrl(null);
      } else {
        setActive(filter);
        syncUrl(filter);
      }
    });
  });

  applyFromUrl();

  // ---- Kit-version banner ----
  // Polls /api/kit-version on load, rewrites the strip's inner HTML based on
  // the result, and wires the Upgrade-kit button to POST /api/kit-upgrade.
  // Server-side render primes the strip when SSR already had the data;
  // this loop covers the case where SSR ran before the network check
  // returned (the data loader makes the remote check best-effort).
  (function kitVersionStrip() {
    var strip = document.getElementById('kit-version-strip');
    if (!strip) return;

    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderUpToDate() {
      strip.hidden = true;
      strip.classList.remove('update-available');
      strip.classList.remove('check-error');
      strip.innerHTML = '';
    }

    function renderError(kv) {
      strip.hidden = false;
      strip.classList.remove('update-available');
      strip.classList.add('check-error');
      strip.innerHTML =
        '<div class="kit-version-body">' +
        '<span class="kit-version-muted">Kit update check failed: ' +
        esc(kv && kv.error ? kv.error : 'unknown error') +
        '</span></div>';
    }

    function renderUpdate(kv) {
      var local = esc(kv.local || '');
      var remote = esc(kv.remote || '');
      var repo = esc(kv.repo || '');
      var ref = esc(kv.ref || '');
      var migs = (kv.newMigrations || [])
        .map(function (m) { return '<code class="kit-migration-pill">' + esc(m) + '</code>'; })
        .join(' ');
      var migLine = migs
        ? '<div class="kit-migration-line">new migrations: ' + migs + '</div>'
        : '';
      strip.hidden = false;
      strip.classList.remove('check-error');
      strip.classList.add('update-available');
      strip.innerHTML =
        '<div class="kit-version-body">' +
        '<strong class="kit-version-headline">Mission Control Kit update available</strong>' +
        " — you're on <code class=\"kit-version-pill\">" + local + '</code>, ' +
        'latest is <code class="kit-version-pill">' + remote + '</code> ' +
        'on <a href="https://github.com/' + repo + '/releases" target="_blank" rel="noopener">' +
        repo + '@' + ref + '</a>.' +
        migLine +
        '<div class="kit-upgrade-msg" id="kit-upgrade-msg"></div>' +
        '</div>' +
        '<button type="button" id="kit-upgrade-btn" class="kit-upgrade-btn">Upgrade kit</button>';
      wireUpgradeButton();
    }

    function wireUpgradeButton() {
      var btn = document.getElementById('kit-upgrade-btn');
      var msg = document.getElementById('kit-upgrade-msg');
      if (!btn) return;
      btn.addEventListener('click', function () {
        btn.disabled = true;
        btn.classList.add('busy');
        btn.textContent = 'Upgrading…';
        if (msg) msg.textContent = 'Fetching kit and running migrations — this can take a few seconds.';
        fetch('/api/kit-upgrade', { method: 'POST' })
          .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
          .then(function (res) {
            if (!res.ok || !res.body || res.body.ok !== true) {
              throw new Error((res.body && res.body.error) || 'Upgrade failed');
            }
            btn.textContent = 'Upgraded — reloading…';
            if (msg) msg.textContent = 'Now on ' + res.body.toVersion + '. Reloading dashboard…';
            setTimeout(function () { location.reload(); }, 900);
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.classList.remove('busy');
            btn.textContent = 'Upgrade kit';
            if (msg) msg.textContent = 'Failed: ' + (err.message || String(err));
          });
      });
    }

    function render(kv) {
      if (!kv || !kv.ok) return renderError(kv || { error: 'no response' });
      if (kv.updateAvailable) return renderUpdate(kv);
      return renderUpToDate();
    }

    // If SSR already rendered an update banner, wire the button immediately
    // and ALSO refresh asynchronously so a manual stamp edit shows up.
    if (document.getElementById('kit-upgrade-btn')) wireUpgradeButton();

    fetch('/api/kit-version')
      .then(function (r) { return r.json(); })
      .then(render)
      .catch(function (err) { renderError({ error: err.message || String(err) }); });
  })();
})();

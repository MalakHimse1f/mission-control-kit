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
})();

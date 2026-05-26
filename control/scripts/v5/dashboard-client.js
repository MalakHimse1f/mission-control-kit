/* Mission Control Kit v5 — dashboard client JS.
 *
 * Single concern: filter-pill interactions on the All Items list.
 *   - Click a pill → show only that category.
 *   - Click the active pill again → clear the filter (show all).
 *   - Active filter is reflected in the URL as ?filter=needs-input so
 *     reloads / shareable links work. No filter param = show all.
 */
(function () {
  'use strict';

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

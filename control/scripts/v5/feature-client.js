/* Mission Control Kit v5 — feature detail page client JS.
 *
 * Concerns (in order):
 *   1. Tab switching: clicking .tab[data-tab=X] shows only #section-X.
 *   2. Diagram-style card selection is delegated to MCDiagramSelect
 *      (loaded from /diagrams/_shared/diagram-select.js).
 *   3. Server-rendered .selected classes are already in place, so no
 *      explicit "hydrate from JSON on mount" step is required — the page
 *      is correct on first paint. The hidden #mc-feature-state JSON is
 *      used only at save time so we can merge per-tab selections back
 *      onto the canonical decisions payload.
 *   4. Save: gather current selections via MCDiagramSelect.getSelections(),
 *      merge onto the preloaded decisions blob, POST to MCDecisions.save(),
 *      toast on success / error.
 */
(function () {
  'use strict';

  // ---- State ----
  var stateScript = document.getElementById('mc-feature-state');
  var state = {};
  if (stateScript && stateScript.textContent) {
    try {
      state = JSON.parse(stateScript.textContent);
    } catch (e) {
      console.error('feature-client: could not parse #mc-feature-state', e);
      state = {};
    }
  }
  var slug = state.slug || '';
  var initialDecisions = state.decisions || null;

  // ---- Tab switching ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[data-tab]'));
  var sections = Array.prototype.slice.call(
    document.querySelectorAll('.section[data-tab-section]')
  );

  function activateTab(key) {
    tabs.forEach(function (t) {
      var isActive = t.getAttribute('data-tab') === key;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    sections.forEach(function (sec) {
      var isActive = sec.getAttribute('data-tab-section') === key;
      if (isActive) {
        sec.style.display = 'block';
        // Force reflow so the transition runs.
        // eslint-disable-next-line no-unused-expressions
        sec.offsetHeight;
        sec.classList.add('visible');
      } else {
        sec.classList.remove('visible');
        sec.style.display = 'none';
      }
    });
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var key = t.getAttribute('data-tab');
      if (key) activateTab(key);
    });
  });

  // ---- Toast helper ----
  var toastEl = document.getElementById('toast');
  var toastMsgEl = toastEl && toastEl.querySelector('.toast-message');
  var toastTimer = null;

  function showToast(message, opts) {
    if (!toastEl) return;
    var isError = !!(opts && opts.error);
    if (toastTimer) clearTimeout(toastTimer);
    if (toastMsgEl) toastMsgEl.textContent = message;
    toastEl.classList.toggle('error', isError);
    toastEl.classList.add('show');
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 3000);
  }

  // ---- Build merged payload from current DOM selections ----
  /**
   * Returns a deep-cloned decisions payload with `selected` and `decidedAt`
   * applied for any decision whose group id appears in `groupSelections`.
   * Decisions not present in the DOM (e.g. saved to another phase) are
   * preserved intact — this is the whole reason we round-trip through the
   * preloaded blob instead of submitting per-tab snippets.
   */
  function buildMergedPayload(groupSelections, base) {
    var now = new Date().toISOString();
    // Start from a deep copy of the base, fall back to a minimal default
    // when the page was rendered without any decisions yet.
    var src =
      base && typeof base === 'object'
        ? JSON.parse(JSON.stringify(base))
        : {
            feature: slug,
            phases: {
              ux: { status: 'not-started', decisions: [], pending: [] },
              ui: { status: 'not-started', decisions: [], pending: [] },
              architecture: { status: 'not-started', decisions: [], pending: [] }
            },
            deferred: [],
            updatedAt: now
          };

    src.feature = slug;
    src.phases = src.phases || {};
    ['ux', 'ui', 'architecture'].forEach(function (key) {
      if (!src.phases[key]) {
        src.phases[key] = { status: 'not-started', decisions: [], pending: [] };
      } else {
        if (typeof src.phases[key].status !== 'string') {
          src.phases[key].status = 'not-started';
        }
        if (!Array.isArray(src.phases[key].decisions)) {
          src.phases[key].decisions = [];
        }
        if (!Array.isArray(src.phases[key].pending)) {
          src.phases[key].pending = [];
        }
      }
    });
    if (!Array.isArray(src.deferred)) src.deferred = [];

    // Walk every phase and update decision.selected when a matching DOM
    // selection exists.
    Object.keys(src.phases).forEach(function (phaseKey) {
      var phase = src.phases[phaseKey];
      phase.decisions.forEach(function (decision) {
        if (!decision || !decision.id) return;
        var picked = groupSelections[decision.id];
        if (typeof picked === 'string' && picked.length > 0 && picked !== decision.selected) {
          decision.selected = picked;
          decision.decidedAt = now;
        }
      });
    });

    src.updatedAt = now;
    return src;
  }

  // ---- Save handler ----
  function handleSave() {
    if (!slug) {
      showToast('No feature slug — cannot save', { error: true });
      return;
    }
    if (typeof window.MCDiagramSelect === 'undefined') {
      showToast('Selection helper not loaded', { error: true });
      return;
    }
    if (typeof window.MCDecisions === 'undefined') {
      showToast('Decisions API client not loaded', { error: true });
      return;
    }

    var selections = window.MCDiagramSelect.getSelections(document);
    var payload = buildMergedPayload(selections, initialDecisions);

    var btn = document.getElementById('btn-save');
    if (btn) btn.disabled = true;

    window.MCDecisions.save(slug, payload).then(
      function (saved) {
        // Refresh the local state so subsequent saves merge against the
        // most recent server-side blob (timestamps + any server tweaks).
        initialDecisions = saved || payload;
        var count = 0;
        Object.keys(payload.phases).forEach(function (k) {
          count += (payload.phases[k].decisions || []).length;
        });
        showToast(count + ' decision' + (count === 1 ? '' : 's') + ' saved');
        if (btn) btn.disabled = false;
      },
      function (err) {
        console.error('decisions save failed', err);
        var msg =
          (err && err.message) || 'Save failed — see console for details';
        showToast(msg, { error: true });
        if (btn) btn.disabled = false;
      }
    );
  }

  var saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSave);
  }

  // Expose for tests / debugging.
  window.MCFeaturePage = {
    activateTab: activateTab,
    handleSave: handleSave,
    buildMergedPayload: buildMergedPayload,
    getState: function () {
      return state;
    }
  };
})();

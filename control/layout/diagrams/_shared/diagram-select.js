/* ============================================================
   Mission Control Kit v5 — diagram-select.js
   ------------------------------------------------------------
   Client-side selection helper for diagram primitives.

   Behavior:
   - Looks for containers with [data-group] (one decision group).
   - Each option inside is identified by [data-value] on a clickable
     element (typically .mc-option-card or .mc-radio-choice).
   - Single-select per group: clicking an option toggles `.selected`
     and removes it from siblings.
   - Exposes a global MCDiagramSelect (also returned by attach()):
       * attach(root?)            — wire up listeners (idempotent)
       * getSelections(root?)     — { [groupId]: selectedValue }
       * setSelections(map, root?) — programmatically restore state
       * clearSelections(root?)   — remove all .selected
       * onSave(callback)         — register handler for save buttons

   Save buttons:
   - Any element with [data-mc-save] (or .mc-save-btn[data-mc-save])
     fires the registered onSave callback. The callback receives the
     current selections object: { [groupId]: selectedValue }.

   No frameworks, ES5-friendly syntax.
   ============================================================ */
(function (global) {
  'use strict';

  var SAVE_HANDLERS = [];

  function $all(root, sel) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function findGroup(el) {
    var node = el;
    while (node && node !== document) {
      if (node.nodeType === 1 && node.hasAttribute && node.hasAttribute('data-group')) {
        return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function findOptions(group) {
    // Any descendant with data-value is an option, but only if it
    // belongs to THIS group (not a nested data-group).
    return $all(group, '[data-value]').filter(function (opt) {
      return findGroup(opt) === group;
    });
  }

  function selectOption(opt) {
    var group = findGroup(opt);
    if (!group) return;
    findOptions(group).forEach(function (o) {
      o.classList.remove('selected');
      if (o.hasAttribute('role') && o.getAttribute('role') === 'radio') {
        o.setAttribute('aria-checked', 'false');
      }
    });
    opt.classList.add('selected');
    if (opt.hasAttribute('role') && opt.getAttribute('role') === 'radio') {
      opt.setAttribute('aria-checked', 'true');
    }
  }

  function handleClick(e) {
    var target = e.target;
    // Walk up to find the nearest [data-value] element.
    while (target && target !== document) {
      if (target.nodeType === 1 && target.hasAttribute && target.hasAttribute('data-value')) {
        selectOption(target);
        return;
      }
      target = target.parentNode;
    }
  }

  function handleKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var target = e.target;
    if (target && target.nodeType === 1 && target.hasAttribute && target.hasAttribute('data-value')) {
      e.preventDefault();
      selectOption(target);
    }
  }

  function attach(root) {
    root = root || document;
    if (root.__mcDiagramSelectAttached) return;
    root.__mcDiagramSelectAttached = true;

    root.addEventListener('click', handleClick);
    root.addEventListener('keydown', handleKey);

    // Make all options focusable for keyboard users.
    $all(root, '[data-group] [data-value]').forEach(function (opt) {
      if (!opt.hasAttribute('tabindex')) opt.setAttribute('tabindex', '0');
      if (!opt.hasAttribute('role'))     opt.setAttribute('role', 'radio');
    });

    // Wire save buttons.
    $all(root, '[data-mc-save]').forEach(function (btn) {
      if (btn.__mcSaveWired) return;
      btn.__mcSaveWired = true;
      btn.addEventListener('click', function () {
        var selections = getSelections(root);
        SAVE_HANDLERS.forEach(function (fn) {
          try { fn(selections, btn); }
          catch (err) { /* swallow — handler decides on feedback */ console && console.error && console.error(err); }
        });
      });
    });
  }

  function getSelections(root) {
    root = root || document;
    var result = {};
    $all(root, '[data-group]').forEach(function (group) {
      var groupId = group.getAttribute('data-group');
      if (!groupId) return;
      var picked = findOptions(group).filter(function (o) {
        return o.classList.contains('selected');
      })[0];
      if (picked) {
        result[groupId] = picked.getAttribute('data-value');
      }
    });
    return result;
  }

  function setSelections(map, root) {
    if (!map || typeof map !== 'object') return;
    root = root || document;
    $all(root, '[data-group]').forEach(function (group) {
      var groupId = group.getAttribute('data-group');
      var desired = map[groupId];
      findOptions(group).forEach(function (opt) {
        var isMatch = desired && opt.getAttribute('data-value') === desired;
        if (isMatch) {
          opt.classList.add('selected');
        } else {
          opt.classList.remove('selected');
        }
        if (opt.hasAttribute('role') && opt.getAttribute('role') === 'radio') {
          opt.setAttribute('aria-checked', isMatch ? 'true' : 'false');
        }
      });
    });
  }

  function clearSelections(root) {
    root = root || document;
    $all(root, '[data-group] [data-value]').forEach(function (opt) {
      opt.classList.remove('selected');
    });
  }

  function onSave(callback) {
    if (typeof callback === 'function') SAVE_HANDLERS.push(callback);
    return function off() {
      SAVE_HANDLERS = SAVE_HANDLERS.filter(function (fn) { return fn !== callback; });
    };
  }

  var api = {
    attach: attach,
    getSelections: getSelections,
    setSelections: setSelections,
    clearSelections: clearSelections,
    onSave: onSave
  };

  global.MCDiagramSelect = api;

  // Auto-attach on DOMContentLoaded if loaded via <script>.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { attach(document); });
    } else {
      attach(document);
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);

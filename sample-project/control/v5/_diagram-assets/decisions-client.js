/* ============================================================
   Mission Control Kit v5 — decisions-client.js
   ------------------------------------------------------------
   Browser fetch wrapper for the v5 decisions API.

   Usage:
       MCDecisions.save("team-collab", { ... })
         .then(function (res) { ... })
         .catch(function (err) { ... });

       MCDecisions.load("team-collab")
         .then(function (decisions) { ... });

   Endpoints (implemented by Task 3 dashboard server):
       POST /api/v5/decisions/{slug}   — body is the caller's
            decisions payload (passed through; this client does
            not enforce a schema). Server validates.
       GET  /api/v5/decisions/{slug}   — returns the persisted
            decisions JSON, or {} when none exist.

   The save payload SHAPE is determined by the caller (Task 6 will
   wrap diagram selections into the canonical decisions schema).
   For Task 1 we just JSON-stringify whatever is passed in.
   ============================================================ */
(function (global) {
  'use strict';

  var DEFAULT_BASE = '';   // same origin
  var BASE = DEFAULT_BASE;

  function setBase(base) {
    BASE = (typeof base === 'string') ? base.replace(/\/+$/, '') : DEFAULT_BASE;
  }

  function endpoint(slug) {
    if (!slug || typeof slug !== 'string') {
      throw new Error('MCDecisions: slug is required');
    }
    var safe = encodeURIComponent(slug);
    return BASE + '/api/v5/decisions/' + safe;
  }

  function asJSON(res) {
    var ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '';
    if (ct.indexOf('application/json') !== -1) {
      return res.json();
    }
    return res.text().then(function (txt) {
      try { return txt ? JSON.parse(txt) : {}; }
      catch (e) { return { raw: txt }; }
    });
  }

  function ensureOk(res) {
    if (res.ok) return Promise.resolve(res);
    return asJSON(res).then(function (body) {
      var msg = (body && body.error) || ('HTTP ' + res.status);
      var err = new Error('MCDecisions: ' + msg);
      err.status = res.status;
      err.body = body;
      throw err;
    });
  }

  /**
   * POST current decisions for a feature.
   * @param {string} slug
   * @param {object} payload — caller-defined; see Task 6 for canonical shape.
   * @returns {Promise<object>} server response JSON.
   */
  function save(slug, payload) {
    return new Promise(function (resolve, reject) {
      var url;
      try { url = endpoint(slug); } catch (e) { reject(e); return; }
      if (typeof fetch === 'undefined') {
        reject(new Error('MCDecisions: fetch is not available in this environment'));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload == null ? {} : payload)
      })
        .then(ensureOk)
        .then(asJSON)
        .then(resolve, reject);
    });
  }

  /**
   * GET current decisions for a feature. Resolves with the stored
   * payload, or `{}` when none exists (server returns 404 → resolved as {}).
   * @param {string} slug
   * @returns {Promise<object>}
   */
  function load(slug) {
    return new Promise(function (resolve, reject) {
      var url;
      try { url = endpoint(slug); } catch (e) { reject(e); return; }
      if (typeof fetch === 'undefined') {
        reject(new Error('MCDecisions: fetch is not available in this environment'));
        return;
      }
      fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
        .then(function (res) {
          if (res.status === 404) return {};
          return ensureOk(res).then(asJSON);
        })
        .then(resolve, reject);
    });
  }

  var api = {
    save: save,
    load: load,
    setBase: setBase,
    _endpoint: endpoint   // exposed for tests / debugging
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.MCDecisions = api;
})(typeof window !== 'undefined' ? window : globalThis);

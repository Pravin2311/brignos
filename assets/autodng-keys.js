/* ============================================================
   autoDNG — shared API key store

   Each tool stored the user's provider key under its own
   localStorage namespace:

       index      bl_k_<provider>
       valuation  dv2_k_<provider>
       handles    sh_k_<provider>
       trademarks tm2_k_<provider>
       vc-score   vcs_k_<provider>
       advanced   dngk<provider>
       analyze    autodng_analyze_key

   So a key pasted into one tool was invisible to the other six —
   the user had to re-enter it on every page of a product that is
   meant to be one place to go.

   One canonical namespace now, with a one-time migration from each
   legacy prefix so nobody loses a key they already saved. Keys stay
   in the browser and are never transmitted to us; see privacy.html.

   Exposes window.autodngKeys = { get, set, clear, all }
   ============================================================ */
(function (global) {
  'use strict';

  var PREFIX = 'adng_key_';
  var LEGACY = ['bl_k_', 'dv2_k_', 'sh_k_', 'tm2_k_', 'vcs_k_', 'dngk'];
  var PROVIDERS = ['openrouter', 'openai', 'gemini', 'groq'];
  var MIGRATED_FLAG = 'adng_keys_migrated';

  function read(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /**
   * Copy any key found under a legacy namespace into the canonical one.
   * Never overwrites a canonical value that already exists, and runs once.
   */
  function migrate() {
    if (read(MIGRATED_FLAG)) return;
    PROVIDERS.forEach(function (p) {
      if (read(PREFIX + p)) return;                 // already have one — leave it
      for (var i = 0; i < LEGACY.length; i++) {
        var found = read(LEGACY[i] + p);
        if (found) { write(PREFIX + p, found); break; }
      }
    });
    // analyze.html kept a single key with no provider concept.
    var solo = read('autodng_analyze_key');
    if (solo && !read(PREFIX + 'openrouter') && solo.indexOf('sk-or-') === 0) {
      write(PREFIX + 'openrouter', solo);
    }
    write(MIGRATED_FLAG, '1');
  }

  migrate();

  global.autodngKeys = {
    get: function (provider) { return read(PREFIX + provider); },

    set: function (provider, key) {
      write(PREFIX + provider, key || '');
      // Keep the page's legacy slot in step, so any code still reading the old
      // name during a partial migration does not see a stale value.
      LEGACY.forEach(function (p) { write(p + provider, key || ''); });
      return key;
    },

    clear: function (provider) {
      if (provider) { this.set(provider, ''); return; }
      PROVIDERS.forEach(function (p) { this.set(p, ''); }, this);
    },

    all: function () {
      var out = {};
      PROVIDERS.forEach(function (p) { out[p] = read(PREFIX + p) ? 'set' : ''; });
      return out;
    }
  };
})(window);

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

   The active provider and each provider's model are shared too,
   chosen on /settings.html — every tool reads them from here. A
   tool's own model picker writes back here, so a change made in
   any tool applies to all of them.

   Exposes window.autodngKeys = {
     get, set, clear, all,              per-provider keys
     getProvider, setProvider,          the active provider
     getModel, setModel,                the chosen model per provider
     meta, PROVIDERS,                   labels, placeholders, validators, models
     onChange                           fires when another tab edits settings
   }
   ============================================================ */
(function (global) {
  'use strict';

  var PREFIX = 'adng_key_';
  var LEGACY = ['bl_k_', 'dv2_k_', 'sh_k_', 'tm2_k_', 'vcs_k_', 'dngk'];
  var PROVIDERS = ['openrouter', 'openai', 'gemini', 'groq'];
  var MIGRATED_FLAG = 'adng_keys_migrated';
  var PROVIDER_KEY = 'adng_provider';
  // Each tool remembered its own last provider; the newest-looking one seeds
  // the shared choice the first time a user lands after this change.
  var LEGACY_PROVIDER = ['dngp', 'dv2_p', 'tm2_p', 'vcs_p', 'sh_p'];
  var MODEL_PREFIX = 'adng_model_';
  var LEGACY_MODEL = ['dngm', 'dv2_m_', 'tm2_m_', 'vcs_m_', 'sh_m_', 'an_m_'];

  var META = {
    openrouter: { label: 'OpenRouter', ph: 'sk-or-…', url: 'https://openrouter.ai/keys',
                  note: 'One key, hundreds of models. Recommended.',
                  models: [{ id: 'deepseek/deepseek-chat', l: 'DeepSeek V3' },
                           { id: 'meta-llama/llama-3.3-70b-instruct', l: 'Llama 3.3 70B' },
                           { id: 'google/gemini-2.0-flash-001', l: 'Gemini 2.0 Flash' },
                           { id: 'google/gemini-2.5-flash', l: 'Gemini 2.5 Flash' },
                           { id: 'openai/gpt-4o-mini', l: 'GPT-4o Mini' },
                           { id: 'anthropic/claude-3.5-sonnet', l: 'Claude 3.5 Sonnet' }],
                  val: function (k) { return k.indexOf('sk-or-') === 0; } },
    openai:     { label: 'OpenAI', ph: 'sk-…', url: 'https://platform.openai.com/api-keys',
                  note: 'GPT-4o family. Paid.',
                  models: [{ id: 'gpt-4o', l: 'GPT-4o' },
                           { id: 'gpt-4o-mini', l: 'GPT-4o Mini' },
                           { id: 'gpt-4.1-mini', l: 'GPT-4.1 Mini' }],
                  val: function (k) { return k.indexOf('sk-') === 0 && k.indexOf('sk-or-') !== 0; } },
    gemini:     { label: 'Google Gemini', ph: 'AIzaSy…', url: 'https://aistudio.google.com/app/apikey',
                  note: 'Free tier available via Google AI Studio.',
                  models: [{ id: 'gemini-2.5-flash', l: 'Gemini 2.5 Flash' },
                           { id: 'gemini-2.5-pro', l: 'Gemini 2.5 Pro' }],
                  val: function (k) { return k.indexOf('AIza') === 0; } },
    groq:       { label: 'Groq', ph: 'gsk_…', url: 'https://console.groq.com/keys',
                  note: 'Free tier, very fast open models.',
                  models: [{ id: 'llama-3.3-70b-versatile', l: 'Llama 3.3 70B' },
                           { id: 'qwen-qwq-32b', l: 'Qwen QwQ 32B' },
                           { id: 'llama-3.1-8b-instant', l: 'Llama 3.1 8B Instant' },
                           { id: 'meta-llama/llama-4-scout-17b-16e-instruct', l: 'Llama 4 Scout' }],
                  val: function (k) { return k.indexOf('gsk') === 0; } }
  };

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

  function getProvider() {
    var p = read(PROVIDER_KEY);
    if (META[p]) return p;
    for (var i = 0; i < LEGACY_PROVIDER.length; i++) {
      var old = read(LEGACY_PROVIDER[i]);
      if (META[old]) { write(PROVIDER_KEY, old); return old; }
    }
    return 'openrouter';
  }

  function hasModel(provider, id) {
    return META[provider].models.some(function (m) { return m.id === id; });
  }

  function getModel(provider) {
    if (!META[provider]) return '';
    var id = read(MODEL_PREFIX + provider);
    if (hasModel(provider, id)) return id;
    // First visit after models became shared: adopt a choice made in any tool.
    for (var i = 0; i < LEGACY_MODEL.length; i++) {
      var old = read(LEGACY_MODEL[i] + provider);
      if (hasModel(provider, old)) { write(MODEL_PREFIX + provider, old); return old; }
    }
    return META[provider].models[0].id;
  }

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
    },

    PROVIDERS: PROVIDERS.slice(),
    meta: function (provider) { return META[provider]; },
    getProvider: getProvider,
    getModel: getModel,
    setModel: function (provider, id) {
      if (META[provider] && hasModel(provider, id)) write(MODEL_PREFIX + provider, id);
      return getModel(provider);
    },
    setProvider: function (provider) {
      if (META[provider]) write(PROVIDER_KEY, provider);
      return getProvider();
    },

    /** Calls cb() when keys, the provider or a model change in another tab. */
    onChange: function (cb) {
      global.addEventListener('storage', function (e) {
        if (!e.key || e.key === PROVIDER_KEY || e.key.indexOf(PREFIX) === 0 ||
            e.key.indexOf(MODEL_PREFIX) === 0) cb();
      });
    }
  };
})(window);

/* ============================================================
   autoDNG — shared domain availability lookup

   Single source of truth. This logic previously existed as three
   diverging copies (index.html, autodng-upgraded.html,
   autodng-domain-intelligence.html) and each carried the same
   false-positive bug independently:

       if (res.status === 404) return 'available';

   rdap.org answers 404 both for unregistered names AND for TLDs it
   does not serve, so registered domains were reported as available:
       elevenlabs.io -> 404 -> "available"   (registered since 2017)
       vercel.co     -> 404 -> "available"   (registered)

   The fix is to resolve each TLD to its authoritative RDAP server via
   IANA's bootstrap registry, and to refuse to answer for TLDs with no
   reachable server rather than guessing.

   Exposes window.autodngRdap = { lookup, rdapProbe, dnsProbe, loadBootstrap }
   ============================================================ */
(function (global) {
  'use strict';

  var RDAP_TIMEOUT_MS = 7000;
  var DNS_TIMEOUT_MS = 3500;   // DNS answers fast; a slow one is a blocked one
  var BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
  var CACHE_KEY = 'dng_rdap_map';
  var CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // ccTLDs that run RDAP but are absent from IANA's bootstrap file.
  var FALLBACKS = { io: 'https://rdap.identitydigital.services/rdap/' };

  var bootstrap = null;
  var dnsStrikes = 0;
  var dnsDisabled = false;
  var cache = {};

  function timeout(ms) {
    return typeof AbortSignal !== 'undefined' && AbortSignal.timeout
      ? AbortSignal.timeout(ms) : undefined;
  }

  /** TLD -> RDAP base URL, cached for a week in localStorage. */
  async function loadBootstrap() {
    if (bootstrap) return bootstrap;
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.m && Date.now() - c.t < CACHE_TTL_MS) { bootstrap = c.m; return bootstrap; }
    } catch (e) {}

    var map = {};
    try {
      var r = await fetch(BOOTSTRAP_URL, { signal: timeout(RDAP_TIMEOUT_MS) });
      if (r.ok) {
        var j = await r.json();
        (j.services || []).forEach(function (svc) {
          var tlds = svc[0], urls = svc[1];
          if (!urls || !urls[0]) return;
          tlds.forEach(function (t) { map[t] = urls[0]; });
        });
      }
    } catch (e) {}

    Object.keys(FALLBACKS).forEach(function (k) { map[k] = FALLBACKS[k]; });
    bootstrap = map;
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), m: map })); } catch (e) {}
    return map;
  }

  /**
   * Query the authoritative registry.
   * -> 'taken' | 'free' | 'unsupported' (no RDAP server for this TLD) | 'unknown'
   */
  async function rdapProbe(domain) {
    var tld = String(domain).split('.').pop().toLowerCase();
    var map = await loadBootstrap();
    var base = map[tld];
    // Refuse to guess: a 404 from a generic endpoint proves nothing.
    if (!base) return 'unsupported';

    var url = base.replace(/\/+$/, '') + '/domain/' + encodeURIComponent(domain);
    for (var attempt = 0; attempt < 2; attempt++) {
      try {
        var res = await fetch(url, {
          mode: 'cors', credentials: 'omit', signal: timeout(RDAP_TIMEOUT_MS),
          headers: { 'Accept': 'application/rdap+json, application/json' }
        });
        if (res.status === 200) return 'taken';
        if (res.status === 404) return 'free';
        if (res.status === 429 || res.status >= 500) {
          await new Promise(function (r) { setTimeout(r, 600); });
          continue;
        }
        return 'unknown';
      } catch (e) {
        if (attempt === 0) await new Promise(function (r) { setTimeout(r, 400); });
      }
    }
    return 'unknown';
  }

  /**
   * DNS-over-HTTPS corroboration. Corporate networks and ad blockers block
   * DoH routinely, so this must never be required for an answer.
   * -> 'nxdomain' | 'resolves' | 'nodata' | 'unknown'
   */
  async function dnsProbe(domain) {
    if (dnsDisabled) return 'unknown';
    var d = encodeURIComponent(domain);
    // NS first (authoritative for delegation), then A. For TLDs with no
    // reachable RDAP — .co above all — DNS is the only evidence available, and
    // a registered domain parked without NS at this level may still have an A
    // record. Checking both materially widens what we can call for those.
    var resolvers = [
      'https://cloudflare-dns.com/dns-query?name=' + d + '&type=NS',
      'https://dns.google/resolve?name=' + d + '&type=NS',
      'https://cloudflare-dns.com/dns-query?name=' + d + '&type=A',
      'https://dns.google/resolve?name=' + d + '&type=A'
    ];
    var sawNodata = false;
    for (var i = 0; i < resolvers.length; i++) {
      try {
        var res = await fetch(resolvers[i], {
          headers: { 'Accept': 'application/dns-json' },
          mode: 'cors', signal: timeout(DNS_TIMEOUT_MS)
        });
        if (!res.ok) continue;
        var j = await res.json();
        dnsStrikes = 0;
        if (j.Status === 3) return 'nxdomain';                 // definitive: no such name
        if (j.Answer && j.Answer.length > 0) return 'resolves'; // definitive: registered
        if (j.Status === 0) { sawNodata = true; continue; }     // try the next record type
      } catch (e) {}
    }
    if (sawNodata) return 'nodata';
    // Once DoH is clearly unavailable, stop paying the timeout on every domain.
    if (++dnsStrikes >= 3) {
      dnsDisabled = true;
      if (global.console) console.info('autoDNG: DNS-over-HTTPS unreachable — relying on RDAP alone.');
    }
    return 'unknown';
  }

  /**
   * Combined verdict.
   * -> 'taken'     registration proven by either source
   *    'available' authoritative registry returned 404
   *    'likely'    DNS says no such name, but no RDAP server exists to confirm
   *    'nocheck'   TLD has no browser-reachable RDAP service (e.g. .co)
   *    'unknown'   lookup failed; retryable
   */
  async function lookup(domain, opts) {
    opts = opts || {};
    if (!opts.force && Object.prototype.hasOwnProperty.call(cache, domain)) return cache[domain];

    var results = await Promise.all([rdapProbe(domain), dnsProbe(domain)]);
    var rdap = results[0], dns = results[1];

    var verdict = 'unknown';
    if (rdap === 'taken' || dns === 'resolves')            verdict = 'taken';
    else if (rdap === 'free')                              verdict = 'available';
    else if (rdap === 'unsupported' && dns === 'nxdomain')  verdict = 'likely';
    else if (rdap === 'unsupported')                       verdict = 'nocheck';

    // Never cache a failure — leave it retryable rather than sticky.
    if (verdict !== 'unknown') cache[domain] = verdict;
    return verdict;
  }

  function clearCache(domain) {
    if (domain) delete cache[domain]; else cache = {};
  }

  global.autodngRdap = {
    lookup: lookup,
    rdapProbe: rdapProbe,
    dnsProbe: dnsProbe,
    loadBootstrap: loadBootstrap,
    clearCache: clearCache
  };
})(window);

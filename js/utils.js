/* Utilities: safe storage, logging, math, and ad-hooks.
   Ad-hooks are placeholders now; wired to CrazyGames SDK at integration time. */
(function (global) {
  'use strict';

  var DEBUG = global.CONFIG.DEBUG;

  // ---- Logging (no-op in production) ----
  var log = DEBUG ? function () { console.log.apply(console, arguments); } : function () {};
  var warn = DEBUG ? function () { console.warn.apply(console, arguments); } : function () {};

  // ---- Safe storage: localStorage with in-memory fallback ----
  // Designed so a cloud-storage adapter (FB/TikTok) can replace the backend later
  // without changing call sites.
  var memStore = {};
  var lsOk = (function () {
    try {
      var k = '__nds_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  var Storage = {
    get: function (key, fallback) {
      try {
        var raw = lsOk ? localStorage.getItem(key) : memStore[key];
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        warn('storage.get failed', key, e);
        return fallback;
      }
    },
    set: function (key, val) {
      var raw;
      try { raw = JSON.stringify(val); } catch (e) { return false; }
      try {
        if (lsOk) localStorage.setItem(key, raw);
        else memStore[key] = raw;
        return true;
      } catch (e) {
        // Quota or blocked: degrade to memory so gameplay never breaks.
        memStore[key] = raw;
        warn('storage.set fell back to memory', key);
        return false;
      }
    }
  };

  // ---- Math helpers ----
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ---- Ad hooks (placeholders). Return Promises so call sites are async-ready. ----
  // At integration: replace bodies with CrazyGames SDK calls
  // (window.CrazyGames.SDK.ad.requestAd(...)). Game state must be paused around these.
  var Ads = {
    _busy: false,
    showRewarded: function (placement) {
      log('Ad:rewarded request', placement);
      return new Promise(function (resolve) {
        if (Ads._busy) { resolve({ success: false, reason: 'busy' }); return; }
        Ads._busy = true;
        // Simulated ad: short delay then success. Replace with real SDK.
        setTimeout(function () {
          Ads._busy = false;
          resolve({ success: true, placement: placement });
        }, 400);
      });
    },
    showInterstitial: function (placement) {
      log('Ad:interstitial request', placement);
      return new Promise(function (resolve) {
        if (Ads._busy) { resolve({ success: false }); return; }
        Ads._busy = true;
        setTimeout(function () { Ads._busy = false; resolve({ success: true }); }, 300);
      });
    }
  };

  global.Utils = {
    log: log, warn: warn,
    Storage: Storage,
    Ads: Ads,
    clamp: clamp, lerp: lerp, rand: rand, randInt: randInt, choice: choice
  };
})(window);

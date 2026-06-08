/* Viral engine: the game's built-in marketing.
   - Share scorecard (Web Share API + clipboard fallback)
   - Challenge-a-friend deep links (?c=SCORE&n=NAME)
   - Local leaderboard (seeded rivals) so every player sees a rank to chase
   - "You beat X% of players" social-proof stat
   These hooks are platform-agnostic; on FB/CrazyGames the share text/URL
   can be swapped for the native SDK share call without touching call sites. */
(function (global) {
  'use strict';

  var GAME_NAME = 'Neon Drift Rush';
  // Canonical play URL (update if domain changes). Used in share + challenge links.
  var PLAY_URL = (function () {
    try {
      var u = location.origin + location.pathname;
      return u.replace(/index\.html$/, '');
    } catch (e) { return 'https://devsarun.github.io/firstgames/'; }
  })();

  // Seeded rival names give the local leaderboard a competitive, "alive" feel.
  var RIVALS = [
    'Jake', 'Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Lily',
    'Mason', 'Aria', 'Lucas', 'Ella', 'Ryan', 'Chloe', 'Dylan'
  ];

  var Viral = {
    GAME_NAME: GAME_NAME,
    PLAY_URL: PLAY_URL,
    challenge: null,   // {score, name} if launched from a challenge link

    // ---- Parse incoming challenge from URL (?c=score&n=name) ----
    init: function () {
      try {
        var p = new URLSearchParams(location.search);
        var c = parseInt(p.get('c'), 10);
        if (c && c > 0) {
          this.challenge = { score: c, name: (p.get('n') || 'A friend').slice(0, 16) };
        }
      } catch (e) { this.challenge = null; }
      this._ensureLeaderboard();
      return this.challenge;
    },

    clearChallenge: function () { this.challenge = null; },

    // ---- Local leaderboard ----
    // Stored as [{name, score, me}]. Seeded once with believable rival scores.
    _ensureLeaderboard: function () {
      var lb = Utils.Storage.get('nds_leaderboard', null);
      if (!lb || !lb.length) {
        lb = [];
        var base = 1800;
        for (var i = 0; i < 8; i++) {
          var nm = Utils.choice(RIVALS);
          lb.push({ name: nm, score: Math.floor(base - i * Utils.rand(120, 240) + Utils.rand(-60, 60)), me: false });
        }
        lb.sort(function (a, b) { return b.score - a.score; });
        Utils.Storage.set('nds_leaderboard', lb);
      }
      return lb;
    },

    getLeaderboard: function () { return this._ensureLeaderboard(); },

    // Insert/refresh the player's best into the board, return their rank (1-based).
    submitScore: function (score, name) {
      var lb = this._ensureLeaderboard();
      // remove old "me"
      lb = lb.filter(function (e) { return !e.me; });
      lb.push({ name: name || 'You', score: score, me: true });
      lb.sort(function (a, b) { return b.score - a.score; });
      if (lb.length > 12) lb = lb.slice(0, 12);
      Utils.Storage.set('nds_leaderboard', lb);
      for (var i = 0; i < lb.length; i++) if (lb[i].me) return i + 1;
      return lb.length;
    },

    // Social-proof: rough percentile vs a believable distribution.
    beatPercent: function (score) {
      // Logistic-ish curve centered ~700m; capped 1..99.
      var pct = 100 / (1 + Math.exp(-(score - 650) / 350));
      return Utils.clamp(Math.round(pct), 1, 99);
    },

    // ---- Build a challenge link the player can send to friends ----
    buildChallengeUrl: function (score, name) {
      var n = encodeURIComponent((name || 'I').slice(0, 16));
      return PLAY_URL + '?c=' + score + '&n=' + n;
    },

    // ---- Share ----
    // Tries native share, falls back to clipboard copy. Returns a Promise<{method}>.
    shareScore: function (score, opts) {
      opts = opts || {};
      var pct = this.beatPercent(score);
      var url = opts.challenge ? this.buildChallengeUrl(score, opts.name) : PLAY_URL;
      var text;
      if (opts.challenge) {
        text = 'I scored ' + score + 'm in ' + GAME_NAME + ' \uD83D\uDD25 Think you can beat me? \uD83D\uDC47';
      } else {
        text = 'I just hit ' + score + 'm in ' + GAME_NAME + ' \u2014 beat ' + pct + '% of players! Can you top it? \uD83D\uDE08';
      }

      // Native share (mobile / supported browsers)
      if (navigator.share) {
        return navigator.share({ title: GAME_NAME, text: text, url: url })
          .then(function () { return { method: 'native' }; })
          .catch(function () { return Viral._copy(text + ' ' + url); });
      }
      return this._copy(text + ' ' + url);
    },

    _copy: function (str) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(str)
          .then(function () { return { method: 'clipboard' }; })
          .catch(function () { return { method: 'manual', text: str }; });
      }
      // last-resort: legacy execCommand
      try {
        var ta = document.createElement('textarea');
        ta.value = str; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return Promise.resolve({ method: 'clipboard' });
      } catch (e) {
        return Promise.resolve({ method: 'manual', text: str });
      }
    }
  };

  global.Viral = Viral;
})(window);

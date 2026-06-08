/* UI layer: shows/hides DOM screens and wires buttons.
   Keeps DOM concerns out of the game loop. */
(function (global) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var UI = {
    el: {},
    game: null,

    init: function (game) {
      this.game = game;
      this.el = {
        loading: $('loading-screen'),
        loaderFill: document.querySelector('.loader-fill'),
        menu: $('menu-screen'),
        menuBest: $('menu-best-score'),
        streakCount: $('streak-count'),
        challengeBanner: $('challenge-banner'),
        cbName: $('cb-name'),
        cbScore: $('cb-score'),
        hud: $('hud'),
        hudDistance: $('hud-distance'),
        hudCoins: $('hud-coins'),
        chaseTag: $('chase-tag'),
        tutorial: $('tutorial-hint'),
        combo: $('combo-popup'),
        pause: $('pause-screen'),
        gameover: $('gameover-screen'),
        goScore: $('go-score'),
        goBest: $('go-best'),
        goRank: $('go-rank'),
        goProof: $('go-proof'),
        goNewBest: $('go-newbest'),
        goChallengeResult: $('go-challenge-result'),
        goCoins: $('go-coins'),
        reviveBtn: $('revive-btn'),
        leaderboard: $('leaderboard-screen'),
        lbList: $('leaderboard-list'),
        skins: $('skins-screen'),
        skinsGrid: $('skins-grid'),
        skinsCoins: $('skins-coins'),
        achToast: $('ach-toast'),
        achDesc: $('ach-desc'),
        infoToast: $('info-toast'),
        muteBtn: $('mute-btn')
      };
      this._wire();
    },

    _wire: function () {
      var g = this.game;
      $('play-btn').onclick = function () { GameAudio.click(); g.startRun(); };
      $('pause-btn').onclick = function () { g.pause(); };
      $('resume-btn').onclick = function () { GameAudio.click(); g.resume(); };
      $('quit-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('retry-btn').onclick = function () { GameAudio.click(); g.startRun(); };
      $('menu-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('revive-btn').onclick = function () { g.requestRevive(); };
      $('skins-btn').onclick = function () { GameAudio.click(); g.openSkins(); };
      $('skins-back-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('leaderboard-btn').onclick = function () { GameAudio.click(); g.openLeaderboard(); };
      $('lb-back-btn').onclick = function () { GameAudio.click(); g.toMenu(); };
      $('lb-challenge-btn').onclick = function () { g.shareChallenge(); };
      $('share-btn').onclick = function () { g.shareScore(); };
      $('challenge-btn').onclick = function () { g.shareChallenge(); };
      this.el.muteBtn.onclick = function () { g.toggleMute(); };
    },

    show: function (name) {
      ['loading', 'menu', 'pause', 'gameover', 'skins', 'leaderboard'].forEach(function (k) {
        if (UI.el[k]) UI.el[k].classList.add('hidden');
      });
      if (this.el[name]) this.el[name].classList.remove('hidden');
    },

    showHud: function (on) { this.el.hud.classList.toggle('hidden', !on); },
    setDistance: function (m) { this.el.hudDistance.textContent = m; },
    setCoins: function (c) { this.el.hudCoins.textContent = c; },

    showTutorial: function (on) { this.el.tutorial.classList.toggle('hidden', !on); },

    setChaseTag: function (text) {
      if (!text) { this.el.chaseTag.classList.add('hidden'); return; }
      this.el.chaseTag.textContent = text;
      this.el.chaseTag.classList.remove('hidden');
    },

    popCombo: function (text) {
      var el = this.el.combo;
      el.textContent = text;
      el.classList.remove('show');
      void el.offsetWidth; // reflow to restart animation
      el.classList.add('show');
    },

    updateMenu: function (best, streak) {
      this.el.menuBest.textContent = best;
      this.el.streakCount.textContent = streak;
    },

    showChallengeBanner: function (challenge) {
      if (!challenge) { this.el.challengeBanner.classList.add('hidden'); return; }
      this.el.cbName.textContent = challenge.name;
      this.el.cbScore.textContent = challenge.score;
      this.el.challengeBanner.classList.remove('hidden');
    },

    // Full game-over render including viral social proof + rank + challenge result.
    showGameOver: function (data) {
      this.el.goScore.textContent = data.score;
      this.el.goBest.textContent = data.best;
      this.el.goRank.textContent = '#' + data.rank;
      this.el.goProof.innerHTML = 'You beat <b>' + data.beatPct + '%</b> of players';
      this.el.goNewBest.classList.toggle('hidden', !data.newBest);
      this.el.goCoins.textContent = '\u25CF +' + data.coinsGot;

      var cr = this.el.goChallengeResult;
      if (data.challenge) {
        var won = data.score > data.challenge.score;
        cr.className = 'go-challenge-result ' + (won ? 'win' : 'lose');
        cr.textContent = won
          ? ('\uD83C\uDFC6 You beat ' + data.challenge.name + '\u2019s ' + data.challenge.score + 'm!')
          : ('\uD83D\uDE24 ' + data.challenge.name + ' leads by ' + (data.challenge.score - data.score) + 'm \u2014 retry!');
        cr.classList.remove('hidden');
      } else {
        cr.classList.add('hidden');
      }
      this.show('gameover');
    },

    setReviveAvailable: function (on) {
      this.el.reviveBtn.classList.toggle('hidden', !on);
    },

    renderLeaderboard: function (list) {
      var box = this.el.lbList;
      box.innerHTML = '';
      list.forEach(function (e, i) {
        var row = document.createElement('div');
        row.className = 'lb-row' + (e.me ? ' me' : '');
        row.innerHTML = '<span class="lb-rank">' + (i + 1) + '</span>' +
          '<span class="lb-name">' + (e.me ? 'YOU' : escapeHtml(e.name)) + '</span>' +
          '<span class="lb-score">' + e.score + ' <small>m</small></span>';
        box.appendChild(row);
      });
    },

    toast: function (desc) {
      var t = this.el.achToast;
      this.el.achDesc.textContent = desc;
      t.classList.remove('hidden');
      clearTimeout(this._toastT);
      this._toastT = setTimeout(function () { t.classList.add('hidden'); }, 2600);
    },

    info: function (msg) {
      var t = this.el.infoToast;
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(this._infoT);
      this._infoT = setTimeout(function () { t.classList.add('hidden'); }, 2400);
    },

    setMuteIcon: function (muted) {
      this.el.muteBtn.innerHTML = muted ? '&#128263;' : '&#128266;';
    },

    setLoaderProgress: function (p) {
      if (this.el.loaderFill) this.el.loaderFill.style.width = (p * 100) + '%';
    },

    renderSkins: function (save) {
      var grid = this.el.skinsGrid;
      this.el.skinsCoins.textContent = save.data.coinsBalance;
      grid.innerHTML = '';
      SKINS.forEach(function (skin) {
        var unlocked = save.data.unlockedSkins.indexOf(skin.id) >= 0;
        var selected = save.data.selectedSkin === skin.id;
        var cell = document.createElement('div');
        cell.className = 'skin-cell' + (selected ? ' selected' : '') + (unlocked ? '' : ' locked');
        var label = unlocked ? (selected ? 'EQUIPPED' : 'SELECT')
          : ('\u25CF ' + skin.price);
        cell.innerHTML = '<div class="skin-swatch" style="background:' + skin.color +
          ';box-shadow:0 0 14px ' + skin.color + '"></div>' +
          '<div class="skin-name">' + skin.name + '</div>' +
          '<div class="skin-price">' + label + '</div>';
        cell.onclick = function () { UI.game.onSkinClick(skin.id); };
        grid.appendChild(cell);
      });
    }
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.UI = UI;
})(window);

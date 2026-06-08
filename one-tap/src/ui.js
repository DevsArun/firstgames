/**
 * UI — DOM overlays over the canvas. Owns: HUD, READY, SO-CLOSE freeze
 * label, the FLEX CARD, SHOP/skins, toast, and the level-fade layer that
 * hides interstitials (rule 12).
 */
import { Store } from './store.js';
import { SKINS, skinById } from './skins.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {
      hud: $('hud'), score: $('score'), level: $('level'),
      ready: $('ready'), readyBest: $('readyBest'),
      soclose: $('soclose'),
      card: $('card'), fcResult: $('fcResult'), fcLevel: $('fcLevel'),
      fcScore: $('fcScore'), fcPercentile: $('fcPercentile'), flexcard: $('flexcard'),
      btnRevive: $('btnRevive'), btnDouble: $('btnDouble'), btnRetry: $('btnRetry'),
      btnShare: $('btnShare'), btnShop: $('btnShop'),
      shop: $('shop'), skinGrid: $('skinGrid'), btnRemoveAds: $('btnRemoveAds'), btnCloseShop: $('btnCloseShop'),
      fade: $('fade'), toast: $('toast'),
    };
  }

  setHUD(score, level) {
    this.el.score.textContent = score;
    this.el.level.textContent = 'LEVEL ' + level;
  }
  showHUD(v) { this.el.hud.classList.toggle('hidden', !v); }

  showReady(v) {
    this.el.ready.classList.toggle('hidden', !v);
    if (v) {
      const best = Store.get('best');
      this.el.readyBest.textContent = best > 0 ? `BEST  ${best}` : '';
    }
  }

  /** big SO CLOSE slam during the freeze-frame */
  flashSoClose(near) {
    if (!near) return;
    const e = this.el.soclose;
    e.classList.remove('hidden');
    // retrigger animation
    e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
  }
  hideSoClose() { this.el.soclose.classList.add('hidden'); }

  showCard({ near, score, level, percentile, doubled }) {
    this.hideSoClose();
    this.el.fcResult.textContent = near ? 'SO CLOSE' : (level >= 8 ? 'CLUTCH RUN' : 'NICE TRY');
    this.el.fcResult.classList.toggle('win', !near && level >= 6);
    this.el.fcLevel.textContent = 'LEVEL ' + level;
    this.el.fcScore.textContent = score;
    this.el.fcPercentile.textContent = `you beat ${percentile}% of players`;
    this.el.btnDouble.style.display = doubled ? 'none' : '';
    this.el.card.classList.remove('hidden');
  }
  hideCard() { this.el.card.classList.add('hidden'); }

  setDoubleScore(score) { this.el.fcScore.textContent = score; this.el.btnDouble.style.display = 'none'; }
  disableRevive() { this.el.btnRevive.style.display = 'none'; }
  resetCardButtons() {
    this.el.btnRevive.style.display = '';
    this.el.btnDouble.style.display = '';
  }

  /** level-fade transition; runs cb() while fully black (interstitial slot) */
  async levelFade(cb) {
    const f = this.el.fade;
    f.classList.add('show');
    await wait(300);
    if (cb) { try { await cb(); } catch {} }
    f.classList.remove('show');
    await wait(300);
  }

  buildShop(onSelect, onUnlockRewarded, onBuyIap) {
    const grid = this.el.skinGrid;
    grid.innerHTML = '';
    const current = Store.get('skin');
    for (const s of SKINS) {
      const unlocked = Store.isUnlocked(s.id) || s.free;
      const cell = document.createElement('div');
      cell.className = 'skin' + (current === s.id ? ' selected' : '');
      cell.innerHTML =
        `<div class="dot" style="background:${s.body};box-shadow:0 0 16px ${s.body}"></div>` +
        `<div class="lbl">${s.name}</div>` +
        (unlocked ? '' : `<div class="lock">${s.via === 'iap' ? '$0.99' : '▶ AD'}<div style="font-size:8px;opacity:.7">${s.via === 'iap' ? 'unlock' : 'watch'}</div></div>`);
      cell.onclick = () => {
        if (unlocked) { onSelect(s.id); this.buildShop(onSelect, onUnlockRewarded, onBuyIap); }
        else if (s.via === 'iap') onBuyIap(s.id);
        else onUnlockRewarded(s.id);
      };
      grid.appendChild(cell);
    }
    this.el.btnRemoveAds.style.display = Store.get('removeAds') ? 'none' : '';
  }
  showShop(v) { this.el.shop.classList.toggle('hidden', !v); }

  toast(msg, ms = 1600) {
    const t = this.el.toast;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.add('hidden'), ms);
  }
}

export function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

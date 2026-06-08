/**
 * ONE TAP — bootstrap & state machine.
 * Wires: Game <-> Renderer <-> UI <-> PlatformAdapter (ads/IAP).
 * States: READY -> PLAYING -> DEAD(freeze) -> CARD -> (REVIVE|RETRY)
 */
import { Game, STATE } from './game.js';
import { Renderer } from './render.js';
import { UI, wait } from './ui.js';
import { Audio } from './audio.js';
import { Store } from './store.js';
import { skinById } from './skins.js';
import { createAdapter, PLACEMENTS, PRODUCTS } from './sdk/adapter.js';

const DEAD_FREEZE_MS = 650; // freeze-frame dwell before the card
const INTERSTITIAL_MIN_GAP_MS = 75_000;
const INTERSTITIAL_FROM_LEVEL = 4;

class App {
  constructor() {
    this.game = new Game();
    this.game.skinId = Store.get('skin');
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas, this.game);
    this.ui = new UI();
    this.ads = null;
    this.last = performance.now();
    this.lastInterstitial = 0;
    this.doubled = false;
    this.revivedThisRun = false;

    this._wireGameEvents();
    this._wireInput();
    this._wireButtons();

    this.ui.showReady(true);
    this.ui.showHUD(false);
    requestAnimationFrame((t) => this.loop(t));
  }

  async initAds() {
    this.ads = await createAdapter();
    // pause/resume game loop with platform lifecycle
    this.ads.onPause(() => { this.paused = true; });
    this.ads.onResume(() => { this.paused = false; this.last = performance.now(); });
    console.log('[ONE TAP] adapter:', this.ads.name);
  }

  _wireGameEvents() {
    const g = this.game;
    g.emitScore = () => { this.ui.setHUD(g.score, g.level); Audio.score(); };
    g.emitLevel = (lvl) => this._onLevelUp(lvl);
    g.onDie = (near) => this._onDie(near);
  }

  _wireInput() {
    const tap = (e) => {
      if (e.cancelable) e.preventDefault();
      this._handleTap();
    };
    // primary tap zone = whole canvas
    this.canvas.addEventListener('pointerdown', tap, { passive: false });
    // space/tap-to-start accessibility
    window.addEventListener('keydown', (e) => { if (e.code === 'Space') this._handleTap(); });
  }

  _firstGesture() {
    if (this._gestured) return;
    this._gestured = true;
    Audio.unlock();
    this.initAds(); // lazy: only after a real user gesture
  }

  _handleTap() {
    this._firstGesture();
    const g = this.game;
    if (g.state === STATE.READY) {
      this.ui.showReady(false);
      this.ui.showHUD(true);
      this.ui.setHUD(0, 1);
      g.start();
      Audio.flap();
    } else if (g.state === STATE.PLAYING) {
      g.flap();
      Audio.flap();
    }
    // DEAD/CARD taps handled by buttons only
  }

  _onLevelUp(lvl) {
    Audio.level();
    this.ui.setHUD(this.game.score, lvl);
    // interstitial ONLY hidden in the level-fade (rule 12), gated + paced
    const now = performance.now();
    const eligible =
      !Store.get('removeAds') &&
      lvl >= INTERSTITIAL_FROM_LEVEL &&
      (lvl % 3 === 1) && // sparse
      now - this.lastInterstitial > INTERSTITIAL_MIN_GAP_MS;

    if (eligible && this.ads) {
      this.lastInterstitial = now;
      // freeze sim during fade so nothing happens mid-transition
      this.paused = true;
      this.ui.levelFade(async () => {
        await this.ads.showInterstitial(PLACEMENTS.LEVEL_FADE);
      }).then(() => { this.paused = false; this.last = performance.now(); });
    }
  }

  async _onDie(near) {
    Store.recordRun(this.game.score, this.game.level);
    if (near) Audio.nearMiss(); else Audio.crash();
    if (navigator.vibrate) { try { navigator.vibrate(near ? [30, 40, 60] : 40); } catch {} }
    this.ui.flashSoClose(near);

    // freeze-frame dwell, then the flex card
    await wait(DEAD_FREEZE_MS);
    if (this.game.state !== STATE.DEAD) return; // revived/changed
    this.game.finalizeCard();
    this.ui.resetCardButtons();
    if (this.revivedThisRun) this.ui.disableRevive();
    this.doubled = false;
    this.ui.showCard({
      near,
      score: this.game.score,
      level: this.game.level,
      percentile: this.game.percentile(),
      doubled: false,
    });
  }

  _wireButtons() {
    const ui = this.ui, g = this.game;

    // REVIVE (rewarded, highest intent) — continue from death
    ui.el.btnRevive.onclick = async () => {
      if (!this.ads) await this.initAds();
      const { completed } = await this.ads.showRewarded(PLACEMENTS.REVIVE);
      if (!completed) { ui.toast('Ad not completed'); return; }
      Audio.reward();
      this.revivedThisRun = true;
      ui.hideCard();
      ui.showHUD(true);
      g.revive();
    };

    // DOUBLE SCORE (rewarded) — on the card
    ui.el.btnDouble.onclick = async () => {
      if (!this.ads) await this.initAds();
      const { completed } = await this.ads.showRewarded(PLACEMENTS.DOUBLE);
      if (!completed) { ui.toast('Ad not completed'); return; }
      Audio.reward();
      this.doubled = true;
      g.score *= 2;
      Store.recordRun(g.score, g.level);
      this._animateScore(g.score);
      ui.setDoubleScore(g.score);
      ui.toast('Score doubled!');
    };

    ui.el.btnRetry.onclick = () => this._retry();

    // RECORD / SHARE — flex card capture (rule 6/14)
    ui.el.btnShare.onclick = async () => {
      const payload = {
        title: 'ONE TAP',
        desc: `I beat ${g.percentile()}% of players — Level ${g.level}. Can you? #onemoretry`,
      };
      let shared = false;
      if (this.ads && this.ads.reportShareReady) {
        const r = await this.ads.reportShareReady(payload);
        shared = r.shared;
      }
      if (!shared && navigator.share) {
        try { await navigator.share({ title: payload.title, text: payload.desc }); shared = true; } catch {}
      }
      if (!shared) ui.toast('📹 Screen-record this card & post #onemoretry', 2600);
    };

    ui.el.btnShop.onclick = () => { this._openShop(); };
    ui.el.btnCloseShop.onclick = () => ui.showShop(false);

    // REMOVE ADS (IAP $2.99)
    ui.el.btnRemoveAds.onclick = async () => {
      if (!this.ads) await this.initAds();
      const { success } = await this.ads.purchase(PRODUCTS.REMOVE_ADS);
      if (success) { Store.set('removeAds', true); ui.toast('Ads removed — thank you!'); this._refreshShop(); }
    };
  }

  _animateScore(target) {
    const el = this.ui.el.fcScore;
    let cur = parseInt(el.textContent, 10) || 0;
    const step = Math.max(1, Math.round((target - cur) / 18));
    const iv = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(iv); }
      el.textContent = cur; Audio.tickUp();
    }, 24);
  }

  _retry() {
    this.ui.hideCard();
    this.revivedThisRun = false;
    this.doubled = false;
    this.game.reset();
    this.game.skinId = Store.get('skin');
    this.ui.showHUD(true);
    this.ui.setHUD(0, 1);
    this.game.start();
    Audio.flap();
  }

  _openShop() {
    this._refreshShop();
    this.ui.showShop(true);
  }
  _refreshShop() {
    this.ui.buildShop(
      (id) => { Store.set('skin', id); this.game.skinId = id; Audio.score(); },
      async (id) => { // unlock via rewarded
        if (!this.ads) await this.initAds();
        const { completed } = await this.ads.showRewarded(PLACEMENTS.UNLOCK_SKIN);
        if (completed) { Store.unlock(id); Store.set('skin', id); this.game.skinId = id; Audio.reward(); this._refreshShop(); }
      },
      async (id) => { // unlock via IAP
        if (!this.ads) await this.initAds();
        const { success } = await this.ads.purchase(PRODUCTS.SKIN_PACK);
        if (success) { Store.unlock(id); Store.set('skin', id); this.game.skinId = id; this._refreshShop(); }
      },
    );
  }

  loop(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // clamp (tab refocus / low-end hitches)
    if (!this.paused) {
      this.game.update(dt);
      this.renderer.draw(dt);
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}

// boot
window.addEventListener('DOMContentLoaded', () => { new App(); });

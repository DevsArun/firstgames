import { PlatformAdapter } from './adapter.js';

/**
 * CRAZYGAMES ADAPTER  (auto-activates inside the CrazyGames host, where
 * window.CrazyGames.SDK is injected). #1 individual-friendly portal.
 * ------------------------------------------------------------------
 * Uses the CrazyGames HTML5 SDK v3:
 *   - SDK.init()                        (async)
 *   - SDK.ad.requestAd('rewarded', cb)  rewarded video
 *   - SDK.ad.requestAd('midgame', cb)   interstitial
 *   - SDK.game.gameplayStart()/Stop()   (we pause our sim around ads)
 *
 * To submit to CrazyGames, add their SDK script to index.html:
 *   <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
 * (Intentionally NOT added by default so the GitHub Pages / web build
 *  stays asset-clean and offline-safe. The factory feature-detects it.)
 *
 * NOTE: CrazyGames HTML5 monetizes via ad revenue-share, not native IAP.
 * So purchase() returns false here; skins unlock via rewarded ads instead.
 */
export class CrazyGamesAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'crazygames';
    this.sdk = (typeof window !== 'undefined' && window.CrazyGames && window.CrazyGames.SDK) || null;
  }

  async init() {
    if (!this.sdk) return;
    try { await this.sdk.init(); } catch (e) { console.warn('[crazygames] init failed', e); }
    document.addEventListener('visibilitychange', () => {
      document.hidden ? this._emitPause() : this._emitResume();
    });
  }

  showRewarded(_placement) {
    return new Promise((resolve) => {
      if (!this.sdk || !this.sdk.ad) return resolve({ completed: false });
      let done = false;
      const finish = (ok) => {
        if (done) return; done = true;
        try { this.sdk.game?.gameplayStart?.(); } catch {}
        resolve({ completed: ok });
      };
      try {
        this.sdk.game?.gameplayStop?.();
        this.sdk.ad.requestAd('rewarded', {
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch { finish(false); }
    });
  }

  showInterstitial(_placement) {
    return new Promise((resolve) => {
      if (!this.sdk || !this.sdk.ad) return resolve();
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        try { this.sdk.game?.gameplayStart?.(); } catch {}
        resolve();
      };
      try {
        this.sdk.game?.gameplayStop?.();
        this.sdk.ad.requestAd('midgame', { adFinished: finish, adError: finish });
      } catch { finish(); }
    });
  }

  async purchase(productId) {
    // CrazyGames HTML5 = ad revenue-share, no native IAP. Skins via rewarded.
    return { success: false, productId };
  }

  async reportShareReady() {
    return { shared: false };
  }
}

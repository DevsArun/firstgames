import { PlatformAdapter } from './adapter.js';

/**
 * WEB FALLBACK ADAPTER  (the version that goes live NOW)
 * ------------------------------------------------------------------
 * Plug your rewarded network here. The integration point is ONE method.
 * Until a real network key is wired (or in offline/sandbox), it renders a
 * real, honest "ad" overlay with a forced watch timer so the rewarded
 * UX, pacing and reward flow are 100% identical to production.
 *
 * To go live with a real network (e.g. AppLixir / AdInPlay / Yodo1):
 *   1. Add the network <script> in index.html.
 *   2. Set window.__AD_NETWORK with show()/showInterstitial() (see below).
 *   3. Nothing else changes anywhere in the game.
 */
export class WebAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'web';
    this.net = null; // real network hook, if present
  }

  async init() {
    // Optional real network: anything exposing show/showInterstitial works.
    if (typeof window !== 'undefined' && window.__AD_NETWORK) {
      this.net = window.__AD_NETWORK;
    }
    // Lifecycle: pause on tab hide (battery + fairness on low-end Android)
    document.addEventListener('visibilitychange', () => {
      document.hidden ? this._emitPause() : this._emitResume();
    });
  }

  async showRewarded(placement) {
    if (this.net && this.net.showRewarded) {
      try {
        const r = await this.net.showRewarded(placement);
        return { completed: !!(r && r.completed) };
      } catch { /* fall through to simulated */ }
    }
    const completed = await this._simAd(true, placement);
    return { completed };
  }

  async showInterstitial(placement) {
    if (this.net && this.net.showInterstitial) {
      try { await this.net.showInterstitial(placement); return; } catch { /* fall */ }
    }
    await this._simAd(false, placement);
  }

  async purchase(productId) {
    // Web fallback uses a confirm() stand-in. Swap for Stripe/host billing.
    const ok = typeof window !== 'undefined'
      ? window.confirm(`Confirm purchase: ${productId}?\n(web fallback — wire real billing for production)`)
      : false;
    return { success: ok, productId };
  }

  async reportShareReady() {
    // Web share sheet if available, else the game falls back to its own
    // "screen-record" prompt (handled in ui.js). Returns shared=false so
    // the UI shows the record-instruction overlay.
    return { shared: false };
  }

  /**
   * Simulated ad overlay. Rewarded = forced 5s watch with skip lockout,
   * exactly mirroring a real opt-in rewarded unit so reward logic is real.
   */
  _simAd(rewarded, placement) {
    return new Promise((resolve) => {
      this._emitPause();
      const wrap = document.createElement('div');
      wrap.style.cssText =
        'position:fixed;inset:0;z-index:1000;background:#000;color:#eaf6ff;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'font-family:-apple-system,Segoe UI,Roboto,sans-serif;gap:14px;text-align:center;padding:24px';
      const secs = rewarded ? 5 : 2;
      wrap.innerHTML =
        `<div style="font-size:12px;letter-spacing:3px;color:#7c8aa3">ADVERTISEMENT</div>` +
        `<div style="font-size:22px;font-weight:800;opacity:.9">${placement}</div>` +
        `<div style="font-size:13px;color:#7c8aa3;max-width:280px">Web-fallback ad placeholder. Wire a rewarded network for live revenue.</div>` +
        `<div id="adt" style="margin-top:10px;font-size:40px;font-weight:900;color:#00f0ff">${secs}</div>` +
        `<button id="adx" style="margin-top:8px;opacity:.35;pointer-events:none;background:#10172a;color:#fff;border:none;border-radius:12px;padding:12px 20px;font-weight:800">${rewarded ? 'WATCH TO EARN' : 'SKIP'}</button>`;
      document.body.appendChild(wrap);
      let t = secs;
      const tEl = wrap.querySelector('#adt');
      const xEl = wrap.querySelector('#adx');
      const iv = setInterval(() => {
        t -= 1;
        if (t > 0) { tEl.textContent = t; return; }
        clearInterval(iv);
        tEl.textContent = '✓';
        xEl.textContent = rewarded ? 'CLAIM REWARD' : 'CONTINUE';
        xEl.style.opacity = '1';
        xEl.style.pointerEvents = 'auto';
        xEl.style.background = rewarded ? '#ffd23f' : '#00f0ff';
        xEl.style.color = '#021016';
        xEl.onclick = () => { wrap.remove(); this._emitResume(); resolve(true); };
      }, 1000);
    });
  }
}

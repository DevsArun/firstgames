import { PlatformAdapter, PRODUCTS } from './adapter.js';

/**
 * TIKTOK MINI GAMES ADAPTER  (activated automatically once running
 * inside the TikTok host, where window.tt / TikTokMiniGame is injected).
 * ------------------------------------------------------------------
 * IMPORTANT: TikTok's Mini Games JS SDK surface is finalized during the
 * partner onboarding/approval you will run in parallel. Every call below
 * is FEATURE-DETECTED and wrapped in try/catch, so:
 *   - if a method name differs, we degrade gracefully (no crash),
 *   - you only adjust the thin mappings here, never the game.
 *
 * Reference flow per TikTok's "How to develop TikTok Mini Games" guide:
 *   ads (rewarded + interstitial), in-app purchase, lifecycle, login.
 * Map the real method names from your approved SDK build into the
 * marked spots below.
 */
export class TikTokAdapter extends PlatformAdapter {
  constructor() {
    super();
    this.name = 'tiktok';
    this.sdk = (typeof window !== 'undefined' && (window.tt || window.TikTokMiniGame || window.TikTokSDK)) || null;
    this._rewarded = null;
    this._interstitial = null;
  }

  async init() {
    if (!this.sdk) return;
    // ---- LIFECYCLE (rule 9) ----
    try {
      this.sdk.onHide?.(() => this._emitPause());
      this.sdk.onShow?.(() => this._emitResume());
    } catch {}

    // ---- PRE-CREATE AD UNITS (lower latency, higher fill) ----
    try {
      if (this.sdk.createRewardedVideoAd) {
        this._rewarded = this.sdk.createRewardedVideoAd({ adUnitId: 'REPLACE_REWARDED_UNIT_ID' });
      }
      if (this.sdk.createInterstitialAd) {
        this._interstitial = this.sdk.createInterstitialAd({ adUnitId: 'REPLACE_INTERSTITIAL_UNIT_ID' });
      }
    } catch (e) { console.warn('[tiktok] ad preload failed', e); }
  }

  showRewarded(_placement) {
    return new Promise((resolve) => {
      const ad = this._rewarded;
      if (!ad) return resolve({ completed: false });
      let settled = false;
      const done = (completed) => {
        if (settled) return; settled = true;
        try { ad.offClose?.(onClose); ad.offError?.(onErr); } catch {}
        resolve({ completed });
      };
      const onClose = (res) => done(!!(res && (res.isEnded === undefined ? true : res.isEnded)));
      const onErr = () => done(false);
      try {
        ad.onClose?.(onClose);
        ad.onError?.(onErr);
        const p = ad.show?.();
        if (p && p.catch) p.catch(() => { try { ad.load?.().then(() => ad.show?.()); } catch { done(false); } });
      } catch { done(false); }
    });
  }

  async showInterstitial(_placement) {
    const ad = this._interstitial;
    if (!ad) return;
    try {
      const p = ad.show?.();
      if (p && p.catch) await p.catch(async () => { try { await ad.load?.(); await ad.show?.(); } catch {} });
    } catch {}
  }

  async purchase(productId) {
    if (!this.sdk || !this.sdk.requestPayment) return { success: false, productId };
    const priceMap = { [PRODUCTS.REMOVE_ADS]: 'remove_ads_sku', [PRODUCTS.SKIN_PACK]: 'skin_pack_sku' };
    try {
      const res = await new Promise((resolve, reject) => {
        this.sdk.requestPayment({
          productId: priceMap[productId] || productId,
          success: resolve,
          fail: reject,
        });
      });
      return { success: !!res, productId };
    } catch { return { success: false, productId }; }
  }

  async reportShareReady(payload) {
    if (!this.sdk || !this.sdk.shareAppMessage) return { shared: false };
    try {
      await new Promise((resolve, reject) =>
        this.sdk.shareAppMessage({
          title: payload?.title || 'ONE TAP',
          desc: payload?.desc || '#onemoretry',
          success: resolve,
          fail: reject,
        }));
      return { shared: true };
    } catch { return { shared: false }; }
  }
}

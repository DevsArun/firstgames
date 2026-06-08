/**
 * SDK-AGNOSTIC PLATFORM ADAPTER
 * ------------------------------------------------------------------
 * The core game NEVER talks to an ad network or store directly.
 * It only ever calls this interface. Two concrete implementations:
 *   - WebAdapter    : web host you control NOW (rewarded network plug-in)
 *   - TikTokAdapter : TikTok Mini Games SDK once approved
 *
 * Same build, two distribution doors. Swap is one line in createAdapter().
 *
 * Interface (all async, all safe to call, all degrade gracefully):
 *   init()                          -> Promise<void>
 *   showRewarded(placement)         -> Promise<{completed:boolean}>
 *   showInterstitial(placement)     -> Promise<void>      (fire-and-forget safe)
 *   purchase(productId)             -> Promise<{success:boolean, productId}>
 *   onPause(cb) / onResume(cb)      -> lifecycle hooks
 *   reportShareReady(payload)       -> Promise<{shared:boolean}>  (record/share)
 *   name                            -> string  (telemetry / debug)
 */

export const PLACEMENTS = Object.freeze({
  REVIVE: 'revive',
  DOUBLE: 'double_score',
  UNLOCK_SKIN: 'unlock_skin',
  LEVEL_FADE: 'level_fade', // interstitial, hidden inside transition only
});

export const PRODUCTS = Object.freeze({
  REMOVE_ADS: 'remove_ads',     // $2.99
  SKIN_PACK: 'skin_pack',       // $0.99
});

/** Base class documents the contract; concrete adapters override. */
export class PlatformAdapter {
  constructor() { this.name = 'base'; this._pause = []; this._resume = []; }
  async init() {}
  async showRewarded(_placement) { return { completed: false }; }
  async showInterstitial(_placement) {}
  async purchase(productId) { return { success: false, productId }; }
  async reportShareReady(_payload) { return { shared: false }; }
  onPause(cb) { this._pause.push(cb); }
  onResume(cb) { this._resume.push(cb); }
  _emitPause() { this._pause.forEach((c) => c()); }
  _emitResume() { this._resume.forEach((c) => c()); }
}

/**
 * Environment detection + factory.
 * Detects TikTok Mini Games host; otherwise falls back to web.
 * Override with ?adapter=web|tiktok for testing.
 */
export async function createAdapter() {
  const forced = new URLSearchParams(location.search).get('adapter');

  const hasTikTok =
    typeof window !== 'undefined' &&
    (window.TikTokMiniGame || window.tt || window.TikTokSDK);

  let adapter;
  if (forced === 'tiktok' || (!forced && hasTikTok)) {
    const { TikTokAdapter } = await import('./tiktok.js');
    adapter = new TikTokAdapter();
  } else {
    const { WebAdapter } = await import('./web.js');
    adapter = new WebAdapter();
  }

  try { await adapter.init(); }
  catch (e) { console.warn('[adapter] init failed, continuing degraded:', e); }
  return adapter;
}

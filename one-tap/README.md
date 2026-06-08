# ONE TAP 🎮

One-tap neon precision arcade for **TikTok Mini Games + web**. Tap to thread each gap; die one pixel short and the game manufactures a recordable "SO CLOSE" meltdown clip. Built SDK-agnostic so the **same build** runs on a web host today and on the TikTok Mini Games SDK once approved.

- **Stack:** vanilla JS (ES modules) + Canvas 2D. No framework, no build step, no images.
- **Size:** ~48KB total (HTML+CSS+JS), ~13KB gzipped. Loads instantly, offline-safe.
- **Orientation:** portrait, mobile-first, 60fps, DPR-capped for low-end Android.

---

## Run locally

```bash
cd one-tap
python3 -m http.server 8080      # or: npx serve -l 8080 .
# open http://localhost:8080
```
> Must be served over http(s) (ES modules don't run from file://).

**Force an adapter for testing:** `?adapter=web` or `?adapter=tiktok`
The web adapter shows a real forced-watch placeholder ad so the rewarded flow is identical to production.

## Deploy the live web fallback (the link you post NOW)

Any static host works. Fastest = **GitHub Pages**:
1. Push this folder to a repo.
2. Settings → Pages → deploy from branch → `/one-tap` (or root).
3. Your link: `https://<user>.github.io/<repo>/`

To wire a **real rewarded network** (AppLixir / AdInPlay / Yodo1), add its `<script>` in `index.html` and expose `window.__AD_NETWORK = { showRewarded, showInterstitial }`. Nothing else changes — see `src/sdk/web.js`.

---

## File structure

```
one-tap/
├── index.html          # canvas + DOM overlays, black bg (zero load flash)
├── styles.css          # neon minimalist UI, flex card, shop, level-fade
├── package.json
└── src/
    ├── main.js         # bootstrap + state machine + game loop + ad/IAP wiring
    ├── game.js         # PURE engine: physics, hidden difficulty ramp, near-miss
    ├── render.js       # Canvas neon primitives, shake, flash, particles, stars
    ├── ui.js           # HUD, READY, SO-CLOSE label, flex card, shop, toast
    ├── audio.js        # WebAudio synthesis (zero asset files)
    ├── store.js        # guest localStorage session (no PII, cookie-free)
    ├── skins.js        # neon skin definitions (pure color)
    └── sdk/
        ├── adapter.js  # SDK-AGNOSTIC interface + environment factory
        ├── web.js      # web-host adapter (live now; pluggable network)
        └── tiktok.js   # TikTok Mini Games SDK adapter (feature-detected)
```

**Architecture rule:** the core engine (`game.js`/`render.js`) never imports an ad network or store. All monetization goes through `sdk/adapter.js`. Swapping platforms is one branch in `createAdapter()`.

**States:** `READY → PLAYING → DEAD (freeze-frame) → CARD → (REVIVE | RETRY)`

---

## The 15 rules — where each is satisfied

| # | Rule | How it's met | Where |
|---|------|--------------|-------|
| 1 | **Bounce 0% / <2s load** | Black bg painted by CSS before JS; canvas inits on first frame; ~13KB gzip; no loading screen | `index.html`, `styles.css` |
| 2 | **Absolute addiction** | First tap succeeds in ~1s; first near-miss death within ~10s → instant retry urge | `game.js` (curve), `main.js` |
| 3 | **Effortless progression** | Levels 1–3 unloseable (gap ≈46% of screen, slow); ramp is invisible and floored so it stays fair | `game.js` `gapHeight()/pipeSpeed()` |
| 4 | **Premium minimalist UI** | One full-screen tap zone, score top-center, thumb-reachable buttons, nothing else | `styles.css`, `ui.js` |
| 5 | **Trend-aligned metadata** | Rage/near-miss format; flex card + share text carry `#onemoretry`; fail sound for sound-on clips | `ui.js`, `main.js` (share payload) |
| 6 | **Organic share engine** | Every death ends on a postable spike + auto "RECORD / SHARE" prompt | `ui.js` `showCard`, `main.js` btnShare |
| 7 | **Silicon Valley aesthetic** | Black bg, neon accents, kinetic shake + particle bursts, WebAudio "juice" | `render.js`, `audio.js`, `styles.css` |
| 8 | **Self-marketing logic** | Flex/shame card: "you beat X% of players · LEVEL N", duet/stitch-bait share text | `ui.js`, `game.js` `percentile()` |
| 9 | **Native SDK compliance** | Rewarded + interstitial + IAP + lifecycle (onHide/onShow) + guest login via adapter | `sdk/tiktok.js`, `sdk/adapter.js` |
| 10 | **Bulletproof privacy** | Random guest id in localStorage, no PII, no login, no cookies, age-appropriate | `store.js` |
| 11 | **Viral explosion ready** | Every run is a fresh clip; near-miss spike engineered into collision logic | `game.js` `_die()` near-miss flag |
| 12 | **Invisible ad placement** | Interstitial fires ONLY inside the level-fade (black), never mid-action; paced + gated | `main.js` `_onLevelUp`, `ui.js` `levelFade` |
| 13 | **Max-yield revenue** | Rage-revive (highest intent) + double-score + skin-unlock rewarded; $2.99 remove-ads, $0.99 skin IAP | `main.js`, `sdk/*` |
| 14 | **Creator bait** | Vertical, screen-record-perfect 9:12 flex card creators naturally capture | `styles.css` `.flexcard`, `ui.js` |
| 15 | **Low friction = max revenue** | One tap, instant restart → more attempts → more sessions → more rewarded impressions | `main.js` `_retry()`, `game.js` |

---

## Monetization map

- **Rewarded (opt-in):** `REVIVE` (continue from death), `DOUBLE_SCORE` (on card), `UNLOCK_SKIN` (shop).
- **Interstitial:** `LEVEL_FADE` only — from level 4, sparse, min 75s apart, skipped if Remove-Ads owned.
- **IAP:** `REMOVE_ADS` ($2.99), `SKIN_PACK` ($0.99). Routed through the adapter (`requestPayment` on TikTok; pluggable billing on web).

## Honesty notes
- **Percentile** ("you beat X%") is a client-side curve, not a real leaderboard (no backend). Swap for a server stat later if desired.
- **Web fallback ads** are placeholders until you wire a real network key; the UX/pacing is already production-shaped.
- **TikTok SDK method names** are feature-detected with `REPLACE_*_UNIT_ID` markers — confirm exact names against your approved SDK build and fill in `sdk/tiktok.js`.

/**
 * GUEST SESSION STORE  (rule 8/10: no PII, no login, cookie-free)
 * All state lives in localStorage under one key. Guest id is a random,
 * non-identifying token used only for local best-score continuity.
 */
const KEY = 'onetap.v1';

const DEFAULTS = {
  guestId: '',
  best: 0,
  bestLevel: 1,
  plays: 0,
  coins: 0,
  removeAds: false,
  skin: 'cyan',
  unlocked: ['cyan'],
  muted: false,
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
    if (!data.guestId) {
      data.guestId = 'g_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    return data;
  } catch {
    return { ...DEFAULTS, guestId: 'g_' + Math.random().toString(36).slice(2) };
  }
}

let saveTimer = null;
function persist() {
  // debounce writes (low-end friendly)
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, 120);
}

export const Store = {
  get: (k) => state[k],
  all: () => ({ ...state }),
  set(k, v) { state[k] = v; persist(); },
  add(k, v) { state[k] = (state[k] || 0) + v; persist(); },
  recordRun(score, level) {
    state.plays += 1;
    if (score > state.best) state.best = score;
    if (level > state.bestLevel) state.bestLevel = level;
    persist();
  },
  unlock(id) {
    if (!state.unlocked.includes(id)) { state.unlocked.push(id); persist(); }
  },
  isUnlocked: (id) => state.unlocked.includes(id),
};

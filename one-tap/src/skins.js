/** Neon skins — pure color, zero assets. trail = glow color. */
export const SKINS = [
  { id: 'cyan',   name: 'CYAN',   body: '#00f0ff', trail: 'rgba(0,240,255,0.5)',  free: true },
  { id: 'magenta',name: 'MAGMA',  body: '#ff2d6b', trail: 'rgba(255,45,107,0.5)', free: false, via: 'rewarded' },
  { id: 'lime',   name: 'TOXIC',  body: '#27e3a7', trail: 'rgba(39,227,167,0.5)', free: false, via: 'rewarded' },
  { id: 'gold',   name: 'GOLD',   body: '#ffd23f', trail: 'rgba(255,210,63,0.5)', free: false, via: 'rewarded' },
  { id: 'violet', name: 'VOID',   body: '#a06bff', trail: 'rgba(160,107,255,0.5)',free: false, via: 'iap' },
  { id: 'white',  name: 'GHOST',  body: '#eaf6ff', trail: 'rgba(234,246,255,0.4)',free: false, via: 'iap' },
];

export const skinById = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

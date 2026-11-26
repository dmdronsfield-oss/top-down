import * as THREE from 'three';
import { canvas, canvasTex } from './materials.js';

function rng(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export { rng };

function noise(g, w, h, n, alpha, r) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},${alpha * r()})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2);
  }
}

// One tile = 2 m x 2 m of wall.
export function brickTexture(base, mortar, seed = 1) {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = mortar; g.fillRect(0, 0, S, S);
  const rows = 26, bh = S / rows, bw = S / 9;
  const col = new THREE.Color(base);
  for (let y = 0; y < rows; y++) {
    const off = (y % 2) * bw / 2;
    for (let x = -1; x < 10; x++) {
      const k = 0.86 + r() * 0.24;
      g.fillStyle = `rgb(${col.r * 255 * k | 0},${col.g * 255 * k | 0},${col.b * 255 * k | 0})`;
      g.fillRect(x * bw + off + 1, y * bh + 1, bw - 2, bh - 1.6);
    }
  }
  noise(g, S, S, 900, .08, r);
  return canvasTex(c, true);
}

// Rusticated stucco: deep horizontal joints every 0.45 m.
export function stuccoTexture(base, grooves, seed = 2) {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  noise(g, S, S, 1400, .05, r);
  // rain streaks
  for (let i = 0; i < 18; i++) {
    const x = r() * S; const grd = g.createLinearGradient(0, 0, 0, S);
    grd.addColorStop(0, 'rgba(40,40,50,.10)'); grd.addColorStop(1, 'rgba(40,40,50,0)');
    g.fillStyle = grd; g.fillRect(x, 0, 2 + r() * 5, S * (.3 + r() * .7));
  }
  if (grooves) {
    const n = Math.round(2 / .45);
    for (let y = 0; y < n; y++) {
      const yy = y * S / n;
      g.fillStyle = 'rgba(20,18,25,.45)'; g.fillRect(0, yy, S, 3);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, yy + 3, S, 1);
      if (y % 2) { g.fillStyle = 'rgba(20,18,25,.28)'; g.fillRect(S * .5, yy, 2, S / n); }
      else { g.fillStyle = 'rgba(20,18,25,.28)'; g.fillRect(0, yy, 2, S / n); }
    }
  }
  return canvasTex(c, true);
}

export function slateTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#4c5262'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    const k = .86 + r() * .24, w = r() < .06 ? 0.75 : 1; // the odd slipped or newer slate
    g.fillStyle = `rgb(${78 * k * w | 0},${84 * k * w | 0},${100 * k | 0})`;
    g.fillRect(x * 16 + (y % 2) * 8, y * 8, 15, 7);
    // a wet sheen along the lower edge of each course
    g.fillStyle = 'rgba(190,200,230,0.10)'; g.fillRect(x * 16 + (y % 2) * 8, y * 8 + 5, 15, 2);
  }
  // soot and lichen
  for (let i = 0; i < 18; i++) { g.fillStyle = r() < .5 ? 'rgba(20,20,28,0.18)' : 'rgba(110,120,80,0.12)'; g.beginPath(); g.arc(r() * S, r() * S, 4 + r() * 10, 0, 7); g.fill(); }
  return canvasTex(c, true);
}

// Flat roofs: lead or asphalt laid in rolls, with seams, patches and puddles.
export function leadRoofTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#545a66'; g.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 16) { g.fillStyle = 'rgba(25,26,32,0.55)'; g.fillRect(x, 0, 2, S); g.fillStyle = 'rgba(200,205,220,0.12)'; g.fillRect(x + 2, 0, 1, S); }
  for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(${40 + r() * 30 | 0},${42 + r() * 30 | 0},${50 + r() * 30 | 0},0.5)`; g.fillRect(r() * S, r() * S, 6 + r() * 20, 4 + r() * 14); }
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(150,165,200,0.18)'; g.beginPath(); g.ellipse(r() * S, r() * S, 6 + r() * 12, 3 + r() * 6, r() * 3, 0, 7); g.fill(); }
  return canvasTex(c, true);
}

// York stone flags: 1 tile = 4 m.
export function flagsTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(4);
  g.fillStyle = '#5d5a58'; g.fillRect(0, 0, S, S);
  const n = 6, s = S / n;
  for (let y = 0; y < n; y++) {
    let x = -r() * s;
    while (x < S) {
      const w = s * (.7 + r() * .9); const k = .9 + r() * .14;
      g.fillStyle = `rgb(${96 * k | 0},${92 * k | 0},${88 * k | 0})`;
      g.fillRect(x + 2, y * s + 2, w - 4, s - 4);
      x += w;
    }
  }
  noise(g, S, S, 3000, .035, r);
  return canvasTex(c, true);
}

// Granite setts / wood-block road: 1 tile = 4 m.
export function roadTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(5);
  g.fillStyle = '#2b2a2f'; g.fillRect(0, 0, S, S);
  const rows = 40, h = S / rows;
  for (let y = 0; y < rows; y++) {
    const off = (y % 2) * 6;
    for (let x = -1; x < 22; x++) {
      const k = .88 + r() * .2;
      g.fillStyle = `rgb(${46 * k | 0},${45 * k | 0},${51 * k | 0})`;
      g.fillRect(x * 24 + off + 1, y * h + 1, 22, h - 2);
    }
  }
  noise(g, S, S, 3000, .06, r);
  return canvasTex(c, true);
}

export function cobbleTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rng(6);
  g.fillStyle = '#26242a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    const x = r() * S, y = r() * S, k = .7 + r() * .5;
    g.fillStyle = `rgb(${70 * k | 0},${66 * k | 0},${70 * k | 0})`;
    g.beginPath(); g.ellipse(x, y, 5 + r() * 3, 4 + r() * 2, r() * 3, 0, Math.PI * 2); g.fill();
  }
  return canvasTex(c, true);
}

// Puddle mask: white = dry road (opaque), dark = puddle (shows the reflection).
export function puddleTexture() {
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), r = rng(12);
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) {
    const x = r() * S, y = r() * S, rad = 14 + r() * 50;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, 'rgba(70,70,70,1)'); grd.addColorStop(.6, 'rgba(90,90,90,.9)'); grd.addColorStop(1, 'rgba(216,216,216,0)');
    g.fillStyle = grd;
    g.save(); g.translate(x, y); g.scale(1, .45 + r() * .5); g.translate(-x, -y);
    g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill(); g.restore();
  }
  PUD = { d: g.getImageData(0, 0, S, S).data, S };
  return canvasTex(c, true, false);
}
// Is there standing water at this point of the road? (The puddle mask is laid at 37 m a tile.)
let PUD = null;
export function puddleAt(x, z) {
  if (!PUD) return false;
  const { d, S } = PUD, fr = (v) => v - Math.floor(v);
  const px = Math.floor(fr(x / 37) * S), py = Math.floor((1 - fr(-z / 37)) * S) % S;
  return d[(py * S + px) * 4] < 130;
}

export function grassTexture() {
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), r = rng(7);
  g.fillStyle = '#1f3326'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4000; i++) {
    const k = .7 + r() * .6;
    g.fillStyle = `rgba(${44 * k | 0},${72 * k | 0},${50 * k | 0},.8)`;
    g.fillRect(r() * S, r() * S, 1, 2 + r() * 3);
  }
  return canvasTex(c, true);
}

export function gravelTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d'), r = rng(8);
  g.fillStyle = '#6b6256'; g.fillRect(0, 0, S, S);
  noise(g, S, S, 2500, .25, r);
  return canvasTex(c, true);
}

// Glazed tiles for the pub front.
export function tileTexture(base) {
  const S = 128, c = canvas(S, S), g = c.getContext('2d'), r = rng(10);
  const col = new THREE.Color(base);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
    const k = .85 + r() * .25;
    g.fillStyle = `rgb(${col.r * 255 * k | 0},${col.g * 255 * k | 0},${col.b * 255 * k | 0})`;
    g.fillRect(x * 32, y * 16, 31, 15);
    g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x * 32 + 3, y * 16 + 2, 10, 2);
  }
  return canvasTex(c, true);
}

// Sash window with glazing bars; colour comes from the instance.
// sil: 0 none, 1 a man, 2 a woman with a bob, 3 a man raising a glass, 4 a couple face to face
export function sashTexture(sil = 0) {
  const W = 64, H = 128, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  // curtain edges
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(120,60,40,.55)'); grd.addColorStop(.18, 'rgba(120,60,40,0)');
  grd.addColorStop(.82, 'rgba(120,60,40,0)'); grd.addColorStop(1, 'rgba(120,60,40,.55)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  // someone at home, seen against the lamp from the waist up, behind the glazing bars
  if (sil) {
    g.fillStyle = 'rgba(46,26,16,.9)';
    const person = (cx, hy, hr, sw, hair) => {
      g.beginPath(); g.arc(cx, hy, hr, 0, Math.PI * 2); g.fill();
      if (hair) { g.beginPath(); g.ellipse(cx, hy + hr * 0.2, hr * 1.35, hr * 1.05, 0, Math.PI, 0); g.fill(); g.fillRect(cx - hr * 1.35, hy, hr * 2.7, hr * 0.7); }
      g.fillRect(cx - hr * 0.45, hy + hr * 0.8, hr * 0.9, hr * 0.8); // neck
      g.beginPath(); // shoulders and body, down below the sill
      g.moveTo(cx - sw / 2, H); g.lineTo(cx - sw / 2, hy + hr * 2.6);
      g.quadraticCurveTo(cx - sw / 2, hy + hr * 1.5, cx - sw / 4, hy + hr * 1.5);
      g.lineTo(cx + sw / 4, hy + hr * 1.5); g.quadraticCurveTo(cx + sw / 2, hy + hr * 1.5, cx + sw / 2, hy + hr * 2.6);
      g.lineTo(cx + sw / 2, H); g.fill();
    };
    if (sil === 1) person(W * 0.55, H * 0.42, 8.5, 40, false);
    if (sil === 2) person(W * 0.42, H * 0.45, 7.5, 32, true);
    if (sil === 3) {
      person(W * 0.4, H * 0.42, 8.5, 38, false);
      g.save(); g.translate(W * 0.58, H * 0.62); g.rotate(-0.6); g.fillRect(0, -3.5, 22, 7); g.restore(); // arm up
      g.beginPath(); g.moveTo(W * 0.74, H * 0.44); g.lineTo(W * 0.86, H * 0.44); g.lineTo(W * 0.8, H * 0.5); g.fill(); // the glass
      g.fillRect(W * 0.795, H * 0.5, 1.5, 6);
    }
    if (sil === 4) { person(W * 0.28, H * 0.47, 7, 26, true); person(W * 0.72, H * 0.43, 7.5, 30, false); }
  }
  g.fillStyle = '#1d1a22';
  g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H);
  g.fillRect(0, H / 2 - 3, W, 6);
  for (const y of [H / 6, H / 3, H * 2 / 3, H * 5 / 6]) g.fillRect(0, y - 1, W, 2);
  for (const x of [W / 3, W * 2 / 3]) g.fillRect(x - 1, 0, 2, H);
  const t = canvasTex(c, false);
  return t;
}

// Light pool on wet pavement.
export function poolTexture() {
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,190,110,.55)'); grd.addColorStop(.35, 'rgba(255,170,90,.22)'); grd.addColorStop(1, 'rgba(255,160,80,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return canvasTex(c, false);
}

export function shadowBlobTexture() {
  const S = 64, c = canvas(S, S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return canvasTex(c, false);
}

// A painted sign: fascia boards, hanging signs, street name plates.
export function signTexture(text, opts = {}) {
  const W = opts.w || 1024, H = opts.h || 128, c = canvas(W, H), g = c.getContext('2d');
  g.fillStyle = opts.bg || '#1b2a22'; g.fillRect(0, 0, W, H);
  if (opts.border !== false) {
    g.strokeStyle = opts.border || '#c9a55a'; g.lineWidth = H * .05; g.strokeRect(H * .08, H * .08, W - H * .16, H - H * .16);
  }
  g.fillStyle = opts.fg || '#e8cf8a';
  let size = opts.size || H * .52;
  g.font = `${opts.weight || 700} ${size}px ${opts.font || '"Josefin Sans", "Gill Sans", sans-serif'}`;
  while (g.measureText(text).width > W * .9 && size > 8) { size *= .92; g.font = `${opts.weight || 700} ${size}px ${opts.font || '"Josefin Sans", "Gill Sans", sans-serif'}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (opts.letter) g.letterSpacing = opts.letter;
  g.fillText(text, W / 2, H / 2 + size * .05);
  if (opts.sub) {
    g.font = `400 ${H * .16}px "Josefin Sans", sans-serif`;
    g.fillText(opts.sub, W / 2, H * .85);
  }
  return canvasTex(c, false);
}

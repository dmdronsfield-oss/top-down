import * as THREE from 'three';
import { PORTRAITS } from './portraits.js';
import { EXTRA } from './portraits-extra.js';
import { LEVELS } from '../game/police.js';
import { XS, ZS, BLOCKS, BOUNDS, SPECIAL, PLACES, CRESCENT } from '../world/map.js';
import { input } from '../core/input.js';
import { sfx } from '../audio/sfx.js';

const $ = (id) => document.getElementById(id);
export const PORT = { teddy: PORTRAITS.hero, mortlake: PORTRAITS.valet, plumtree: PORTRAITS.cop, constable: PORTRAITS.cop, hester: PORTRAITS.aunt, creamer: PORTRAITS.creamer, ...EXTRA };

export function fmtPurse(p) {
  const neg = p < 0; p = Math.abs(Math.round(p));
  const L = Math.floor(p / 240), s = Math.floor(p % 240 / 12), d = p % 12;
  return (neg ? 'IOU ' : '') + '£' + L + ' ' + s + 's ' + d + 'd';
}
export function fmtClock(mins) {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}.${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

// ---------------------------------------------------------------- HUD
export class HUD {
  constructor(camera) {
    this.camera = camera;
    this.floats = [];
    this.markers = [];
    this.voiceT = 0; this.toastT = 0;
    $('hint-portrait').innerHTML = PORT.mortlake;
    const pips = $('scandal-pips');
    for (let i = 0; i < 5; i++) { const d = document.createElement('div'); d.className = 'pip'; pips.appendChild(d); }
    this.mm = $('minimap').getContext('2d');
    this.mapBase = drawAtlas(440);
    this.lastPurse = null; this.lastLevel = -1;
  }
  show(on) { $('hud').hidden = !on; }
  telegram(text, goal) { $('tg-body').innerHTML = `${text}${goal ? `<span class="goal">${goal}</span>` : ''}`; }
  hint(text) { $('hint-body').textContent = text; }
  purse(p) { if (p !== this.lastPurse) { this.lastPurse = p; $('purse').textContent = fmtPurse(p); } }
  scandal(level, flash) {
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      [...$('scandal-pips').children].forEach((el, i) => el.classList.toggle('on', i < level));
      $('scandal-name').textContent = LEVELS[level];
    }
    if (flash) { const b = $('scandal-box'); b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); }
  }
  where(street, clock) { $('street').textContent = street; $('clock').textContent = clock; }
  prompt(text) {
    const el = $('prompt');
    if (!text) { el.hidden = true; return; }
    if (el.dataset.t !== text) { el.innerHTML = text; el.dataset.t = text; }
    el.hidden = false;
  }
  voice(name, text, secs = 6) { $('voice-name').textContent = name; $('voice-text').textContent = text; $('voice').hidden = false; this.voiceT = secs; }
  toast(text, sub, secs = 2.6) { $('toast').innerHTML = `${text}${sub ? `<span class="sub">${sub}</span>` : ''}`; $('toast').hidden = false; this.toastT = secs; }
  say(x, y, z, text, red, life = 3.2) {
    const el = document.createElement('div'); el.className = 'fl' + (red ? ' red' : ''); el.textContent = text;
    $('floats').appendChild(el);
    this.floats.push({ el, x, y, z, life, follow: null });
    if (this.floats.length > 8) { const f = this.floats.shift(); f.el.remove(); }
    return this.floats[this.floats.length - 1];
  }
  sayBy(actor, text, red, life) { const f = this.say(actor.x, actor.y + 2.2, actor.z, text, red, life); f.follow = actor; this.onSay && this.onSay(actor); return f; }
  setMarkers(list) {
    for (const m of this.markers) m.el.remove();
    this.markers = list.map((m) => {
      const el = document.createElement('div'); el.className = 'marker'; el.innerHTML = `▼<span>${m.label}</span>`;
      const ar = document.createElement('div'); ar.className = 'edge-arrow';
      $('floats').appendChild(el); $('floats').appendChild(ar);
      return { ...m, el, ar };
    });
  }
  update(dt, w, h, player, camYaw) {
    const v = new THREE.Vector3();
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      if (f.follow) { f.x = f.follow.x; f.z = f.follow.z; f.y = (f.follow.y || 0) + 2.25; }
      v.set(f.x, f.y, f.z).project(this.camera);
      f.el.style.left = ((v.x * .5 + .5) * w) + 'px'; f.el.style.top = ((-v.y * .5 + .5) * h) + 'px';
      f.el.style.opacity = Math.min(1, f.life * 2);
      if (f.life <= 0 || v.z > 1) { f.el.remove(); this.floats.splice(i, 1); }
    }
    for (const m of this.markers) {
      const tx = m.get ? m.get() : m;
      v.set(tx.x, (tx.y || 0) + 3.2 + Math.sin(performance.now() / 300) * 0.25, tx.z).project(this.camera);
      const sx = (v.x * .5 + .5) * w, sy = (-v.y * .5 + .5) * h;
      const on = v.z < 1 && sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30;
      m.el.style.display = on ? '' : 'none';
      m.el.style.left = sx + 'px'; m.el.style.top = sy + 'px';
      m.ar.style.display = on ? 'none' : '';
      if (!on) {
        // arrow at the screen edge pointing the way
        let dx = sx - w / 2, dy = sy - h / 2; if (v.z > 1) { dx = -dx; dy = -dy; }
        const a = Math.atan2(dy, dx), r = Math.min(w, h) * 0.42;
        m.ar.style.left = (w / 2 + Math.cos(a) * r - 12) + 'px'; m.ar.style.top = (h / 2 + Math.sin(a) * r - 11) + 'px';
        m.ar.style.transform = `rotate(${a + Math.PI / 2}rad)`;
      }
    }
    if (this.voiceT > 0) { this.voiceT -= dt; if (this.voiceT <= 0) $('voice').hidden = true; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) $('toast').hidden = true; }
  }
  minimap(player, yaw, cops, showCops, extra) {
    const g = this.mm, S = 220, scale = 0.9; // px per metre
    g.save();
    g.fillStyle = '#E5D9BE'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate(yaw);
    g.scale(scale, scale);
    g.translate(-player.x, -player.z);
    const k = 440 / 340;
    g.drawImage(this.mapBase, BOUNDS.x0 - 4, BOUNDS.z0 - 4, 340, 340);
    for (const m of this.markers) { const t = m.get ? m.get() : m; g.fillStyle = '#C9A44C'; g.strokeStyle = '#1F1C2B'; g.lineWidth = 2 / scale; g.beginPath(); g.arc(t.x, t.z, 5 / scale, 0, 7); g.fill(); g.stroke(); }
    if (showCops) for (const c of cops) { g.fillStyle = '#1C2340'; g.beginPath(); g.arc(c.x, c.z, 3.2 / scale, 0, 7); g.fill(); }
    g.restore();
    // the player, always in the middle, pointing up the screen when walking forward
    g.save(); g.translate(S / 2, S / 2);
    const h = player.car ? player.car.h : player.ang;
    g.rotate(-(h - yaw) + Math.PI);
    g.fillStyle = '#8C2B2B'; g.strokeStyle = '#1F1C2B'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#1F1C2B'; g.font = '700 11px "Josefin Sans", sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(S / 2, S / 2); g.rotate(yaw); g.fillText('N', 0, -S / 2 + 14); g.restore();
  }
}

// The pocket street atlas, drawn once.
export function drawAtlas(size, labels = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const S = size / (BOUNDS.x1 - BOUNDS.x0 + 8);
  const X = (x) => (x - BOUNDS.x0 + 4) * S, Z = (z) => (z - BOUNDS.z0 + 4) * S;
  g.fillStyle = '#F3EBD6'; g.fillRect(0, 0, size, size);
  // parks
  g.fillStyle = '#A9B894';
  g.fillRect(0, 0, X(XS[0].x - XS[0].w / 2 - 3), size);
  g.fillRect(0, Z(ZS[6].z + ZS[6].w / 2 + 3), size, size);
  for (const B of BLOCKS) {
    const sp = B.special;
    g.fillStyle = sp && sp.kind === 'square' ? '#A9B894' : '#D8C9A6';
    g.fillRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * S, (B.z1 - B.z0) * S);
    g.strokeStyle = '#1F1C2B'; g.lineWidth = Math.max(1, size / 500);
    g.strokeRect(X(B.x0), Z(B.z0), (B.x1 - B.x0) * S, (B.z1 - B.z0) * S);
    if (sp && sp.kind === 'square') { g.fillStyle = '#7F9470'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(X(B.x0 + 4 + (i % 3) * (B.x1 - B.x0 - 8) / 2), Z(B.z0 + 4 + Math.floor(i / 3) * (B.z1 - B.z0 - 8) / 2), 4 * S, 0, 7); g.fill(); } }
    if (sp && (sp.kind === 'mews' || sp.kind === 'market')) {
      g.fillStyle = '#F3EBD6';
      const xm = (B.x0 + B.x1) / 2, zm = (B.z0 + B.z1) / 2;
      if (sp.kind === 'market' || sp.dir === 'x') g.fillRect(X(B.x0), Z(zm - 3), (B.x1 - B.x0) * S, 6 * S);
      if (sp.kind === 'market' || sp.dir === 'z') g.fillRect(X(xm - 3), Z(B.z0), 6 * S, (B.z1 - B.z0) * S);
    }
  }
  { // Pevensey Crescent: the road bowed into its block, and the garden it embraces
    const C = CRESCENT, lim = (r) => Math.acos((C.cx - C.mouthX) / r), rm = (C.rIn + C.rOut) / 2;
    g.strokeStyle = '#1F1C2B'; g.lineWidth = (C.rOut - C.rIn + 1) * S;
    g.beginPath(); g.arc(X(C.cx), Z(C.cz), rm * S, Math.PI - lim(rm), Math.PI + lim(rm)); g.stroke();
    g.strokeStyle = '#F3EBD6'; g.lineWidth = (C.rOut - C.rIn) * S;
    g.beginPath(); g.arc(X(C.cx), Z(C.cz), rm * S, Math.PI - lim(rm) - 0.05, Math.PI + lim(rm) + 0.05); g.stroke();
    const pg = Math.acos((C.cx - C.gardenX) / C.rGarden);
    g.fillStyle = '#A9B894'; g.beginPath(); g.arc(X(C.cx), Z(C.cz), C.rGarden * S, Math.PI - pg, Math.PI + pg); g.closePath(); g.fill();
    if (labels) {
      g.save(); g.fillStyle = '#1F1C2B'; g.textAlign = 'center'; g.font = `italic ${Math.round(size / 85)}px "Libre Baskerville", serif`;
      g.translate(X(C.cx - C.rOut - 9), Z(C.cz)); g.rotate(-Math.PI / 2); g.fillText(C.name, 0, 0); g.restore();
    }
  }
  if (labels) {
    g.fillStyle = '#1F1C2B'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${Math.round(size / 75)}px "Josefin Sans", sans-serif`;
    for (const s of XS) { g.save(); g.translate(X(s.x), Z(-25 + (s.x % 100 === 0 ? 50 : 0))); g.rotate(-Math.PI / 2); g.fillText(s.name.toUpperCase(), 0, 0); g.restore(); }
    for (const s of ZS) g.fillText(s.name.toUpperCase(), X(-75 + (s.z % 100 === 0 ? 0 : 50)), Z(s.z));
    g.font = `italic ${Math.round(size / 70)}px "Libre Baskerville", serif`;
    for (const B of BLOCKS) if (B.special && B.special.kind !== 'mews') g.fillText(B.special.name, X((B.x0 + B.x1) / 2), Z((B.z0 + B.z1) / 2));
    g.save(); g.translate(X(XS[0].x - 20), size / 2); g.rotate(-Math.PI / 2); g.fillText('Hyde Park', 0, 0); g.restore();
    g.fillText('Green Park', size / 2, Z(ZS[6].z + 18));
  }
  return c;
}

export function drawBigMap(canvas, player, markers) {
  const g = canvas.getContext('2d'), size = canvas.width;
  g.drawImage(drawAtlas(size, true), 0, 0);
  const S = size / (BOUNDS.x1 - BOUNDS.x0 + 8);
  const X = (x) => (x - BOUNDS.x0 + 4) * S, Z = (z) => (z - BOUNDS.z0 + 4) * S;
  g.font = `700 ${Math.round(size / 60)}px "Josefin Sans", sans-serif`;
  for (const m of markers) { const t = m.get ? m.get() : m; g.fillStyle = '#C9A44C'; g.strokeStyle = '#1F1C2B'; g.lineWidth = 2; g.beginPath(); g.arc(X(t.x), Z(t.z), 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1F1C2B'; g.fillText(m.label, X(t.x), Z(t.z) - 16); }
  for (const k of ['flat', 'gannets', 'pub', 'hatter']) { const p = PLACES[k]; g.fillStyle = '#1F3A2C'; g.beginPath(); g.arc(X(p.x), Z(p.z), 5, 0, 7); g.fill(); g.fillStyle = '#1F3A2C'; g.font = `italic ${Math.round(size / 75)}px "Libre Baskerville", serif`; g.fillText(p.short, X(p.x), Z(p.z) + 14); }
  g.fillStyle = '#8C2B2B'; g.beginPath(); g.arc(X(player.x), Z(player.z), 8, 0, 7); g.fill(); g.strokeStyle = '#1F1C2B'; g.stroke();
}

// ---------------------------------------------------------------- dialogue cards
// card: { who, name, text, choices?: [string] } ; resolves to the chosen index.
export class Dialogue {
  constructor() { this.open = false; this.sel = 0; }
  show(card) {
    return new Promise((resolve) => {
      sfx.card();
      this.open = true;
      $('dialogue').hidden = false;
      $('dlg-portrait').innerHTML = PORT[card.who] || '';
      $('dlg-name').textContent = card.name || '';
      $('dlg-text').textContent = card.text;
      const ol = $('dlg-choices'); ol.innerHTML = '';
      const choices = card.choices && card.choices.length ? card.choices : ['Carry on'];
      this.sel = 0;
      const lis = choices.map((c, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<kbd>${i + 1}</kbd>${c}`;
        li.onclick = () => done(i);
        ol.appendChild(li);
        return li;
      });
      const mark = () => lis.forEach((l, i) => l.classList.toggle('sel', i === this.sel));
      mark();
      const done = (i) => { this.open = false; $('dialogue').hidden = true; this.poll = null; resolve(i); };
      this.poll = () => {
        if (input.hit('up')) { this.sel = (this.sel + lis.length - 1) % lis.length; mark(); }
        if (input.hit('down')) { this.sel = (this.sel + 1) % lis.length; mark(); }
        for (let i = 0; i < lis.length && i < 4; i++) if (input.hit('c' + (i + 1))) return done(i);
        if (input.hit('action') || input.hit('brake')) return done(this.sel);
      };
    });
  }
  update() { if (this.poll) this.poll(); }
}

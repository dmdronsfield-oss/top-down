import * as THREE from 'three';
import { glow } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';

// Now and then a passer-by near Teddy stops in the rain, strikes a match, lights a cigarette, and walks
// on with the ember glowing at their lips: a tiny point of fire moving through the dark.

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const geoE = new THREE.SphereGeometry(0.028, 6, 4), geoF = new THREE.SphereGeometry(0.05, 8, 6);
let DOT = null;
const dot = () => {
  if (DOT) return DOT;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 1, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return (DOT = new THREE.CanvasTexture(c));
};
const halo = (col, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); m.scale.setScalar(s); return m; };

export class Smokers {
  constructor(G) { this.G = G; this.t = 6; this.list = []; }
  update(dt) {
    const w = this.G.world, p = w.player;
    this.t -= dt;
    if (this.t <= 0 && this.list.length < 4) {
      this.t = 10 + Math.random() * 10;
      const cands = w.walkers.filter((wk) => { const a = wk.a; const d = dist(a, p); return !wk.leader && !wk.hold && !wk.crossing && !a._smoke && a.visible && a.busy <= 0 && !a.isCop && !a.seated && d > 5 && d < 22; });
      if (cands.length) this.light(cands[Math.floor(Math.random() * cands.length)]);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      s.t += dt;
      if (s.flame && s.t > 1.3) { s.flame.parent.remove(s.flame); s.flame = null; }
      if (s.flame) { const k = 0.8 + Math.random() * 0.5; s.flame.scale.setScalar(k * Math.min(1, s.t * 4)); }
      // the ember brightens as they draw on it, every few seconds
      const draw = Math.max(0, Math.sin(s.t * 0.9 + s.ph) - 0.7) * 6;
      s.mat.color.setRGB(1, 0.35, 0.1).multiplyScalar(1.6 + draw);
      s.ember.children[0].material.opacity = 0.55 + draw * 0.25;
      if (s.t > 70 || s.a.down > 0) { s.ember.parent.remove(s.ember); if (s.flame) s.flame.parent.remove(s.flame); s.a._smoke = false; this.list.splice(i, 1); }
    }
  }
  light(wk) {
    const a = wk.a, sc = a.spec.scale || 1;
    wk.pause = Math.max(wk.pause || 0, 2.8);
    a.speed = 0;
    a.oneShot('Interact', 1.3);
    a._smoke = true;
    const mat = patchCutout(glow('#ff5a1a', 1.6));
    const ember = new THREE.Mesh(geoE, mat); ember.position.set(0.02, 1.63 * sc, 0.19 * sc); a.fig.group.add(ember);
    const glowH = halo(new THREE.Color(1, 0.4, 0.12), 0.3); ember.add(glowH);
    const flame = new THREE.Mesh(geoF, patchCutout(glow('#ffd27a', 3))); flame.position.set(0.03, 1.6 * sc, 0.24 * sc); a.fig.group.add(flame);
    flame.add(halo(new THREE.Color(1, 0.8, 0.45), 0.9));
    this.list.push({ a, ember, flame, mat, t: 0, ph: Math.random() * 6 });
  }
}

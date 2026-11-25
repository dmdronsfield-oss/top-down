import * as THREE from 'three';
import { CAST } from '../people/cast.js';
import { toon, inked } from '../render/materials.js';

// Newsboys on two corners, with A-board placards that follow the evening's scandals.
const SPOTS = [{ x: 42.4, z: 138.2, ang: Math.PI }, { x: -42.4, z: 92.2, ang: -Math.PI / 2 }];

function headline(G) {
  const d = G.jobs.done, lvl = G.police.level;
  if (lvl >= 5) return 'AUNT IN MAYFAIR';
  if (lvl >= 4) return 'BLACK MARIA CHASE';
  if (lvl >= 3) return 'YARD BAFFLED';
  if (d.has('pig')) return 'PIG AT BERKELEY SQ';
  if (d.has('creamer')) return 'SILVER COW SENSATION';
  if (d.has('helmet')) return 'HELMET OUTRAGE';
  return 'FOG EXPECTED';
}
const CRIES = {
  'FOG EXPECTED': ['Fog expected! Read all abaht it!', 'Duchess’s Pekinese still missing!', 'Late final! Late final!'],
  'HELMET OUTRAGE': ['Constable’s ’elmet outrage! Read all abaht it!', 'Bobby bareheaded in Mount Street!'],
  'SILVER COW SENSATION': ['Silver cow sensation! Gossage speaks!', 'Milk jug in Mayfair window!'],
  'PIG AT BERKELEY SQ': ['Pig at Berkeley Square! Colonel overjoyed!', 'Prize sow takes second!'],
  'YARD BAFFLED': ['Scotland Yard baffled! Man in boater sought!', 'Mayfair menace strikes again!'],
  'BLACK MARIA CHASE': ['Black Maria chase down Curzon Street!', 'Bishop complains!'],
  'AUNT IN MAYFAIR': ['Shropshire aunt arrives! Nephew sought!', 'Gentlemen, lock your doors!'],
};

function placard(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 340;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6d0'; g.fillRect(0, 0, 256, 340);
  g.strokeStyle = '#1b1a20'; g.lineWidth = 6; g.strokeRect(8, 8, 240, 324);
  g.fillStyle = '#8c2b2b'; g.font = '700 22px "Josefin Sans", sans-serif'; g.textAlign = 'center';
  g.fillText('THE EVENING CRIER', 128, 44);
  g.fillRect(24, 56, 208, 3);
  g.fillStyle = '#1b1a20'; g.font = '700 46px "Josefin Sans", sans-serif';
  const words = text.split(' ');
  const y0 = 170 - (words.length - 1) * 26;
  words.forEach((w, i) => g.fillText(w, 128, y0 + i * 52, 220));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Newsboys {
  constructor(G) {
    this.G = G; this.boys = []; this.cur = null; this.t = 3;
    for (const s of SPOTS) {
      const a = G.world.addActor({ ...CAST.cabbie, colours: { ...CAST.cabbie.colours, Suit: '#4a4036' }, scale: 0.88 }, s.x, s.z, s.ang);
      a.name = 'Newsboy';
      // A-board beside him
      const board = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const k of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.95), mat); p.position.set(0, 0.6, k * 0.22); p.rotation.x = k * 0.42; p.rotation.y = k > 0 ? 0 : Math.PI; board.add(p);
      }
      const frame = inked(new THREE.BoxGeometry(0.74, 0.05, 0.36), toon('#3a2e22'), 0.01); frame.position.y = 1.12; board.add(frame);
      board.position.set(s.x + Math.cos(s.ang) * 1.0, 0.15, s.z - Math.sin(s.ang) * 1.0); board.rotation.y = s.ang + Math.PI / 2;
      G.scene.add(board);
      this.boys.push({ a, mat });
    }
    this.refresh();
  }
  refresh() {
    const h = headline(this.G);
    if (h === this.cur) return;
    this.cur = h;
    const tex = placard(h);
    for (const b of this.boys) { if (b.mat.map) b.mat.map.dispose(); b.mat.map = tex; b.mat.needsUpdate = true; }
  }
  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 7 + Math.random() * 5;
    this.refresh();
    const p = this.G.world.player;
    for (const b of this.boys) {
      if (Math.hypot(b.a.x - p.x, b.a.z - p.z) < 22) {
        const c = CRIES[this.cur] || CRIES['FOG EXPECTED'];
        this.G.hud.sayBy(b.a, c[Math.floor(Math.random() * c.length)], true, 3);
        if (b.a.busy <= 0) b.a.oneShot('Wave', 1.2);
      }
    }
  }
}

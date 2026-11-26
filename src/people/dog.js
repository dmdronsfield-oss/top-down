import * as THREE from 'three';
import { toon, inked } from '../render/materials.js';
import { groundY } from '../world/ground.js';

// Small dogs on leads: the Mayfair terrier, the dachshund and the Pekinese, each walking its owner.
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

const BREEDS = {
  scottie:   { col: '#1d1c22', len: 0.42, high: 0.13, legs: 0.13, head: 0.12, ears: 'up', tail: 'up' },
  westie:    { col: '#ebe6da', len: 0.38, high: 0.14, legs: 0.14, head: 0.12, ears: 'up', tail: 'up' },
  dachshund: { col: '#7a4526', len: 0.62, high: 0.12, legs: 0.08, head: 0.1, ears: 'down', tail: 'out' },
  peke:      { col: '#c98d4a', len: 0.34, high: 0.15, legs: 0.08, head: 0.13, ears: 'down', tail: 'up', fluffy: true },
};
export const BREED_NAMES = Object.keys(BREEDS);

function dogModel(kind) {
  const b = BREEDS[kind], m = toon(b.col), t = 0.012, g = new THREE.Group();
  const by = b.legs + b.high * 0.8;
  // terriers are boxes on legs; the others are sausages and powder puffs
  const boxy = b.ears === 'up';
  const body = inked(boxy ? new THREE.BoxGeometry(1, 1, 1) : new THREE.SphereGeometry(0.5, 10, 8), m, t);
  if (boxy) body.scale.set(b.high * 1.55, b.high * 1.5, b.len * 0.92);
  else body.scale.set(b.high * 1.9 * (b.fluffy ? 1.3 : 1), b.high * 1.8 * (b.fluffy ? 1.2 : 1), b.len);
  body.position.y = by; g.add(body);
  if (boxy) { // a terrier's skirt of rough coat under the belly
    const skirt = inked(new THREE.BoxGeometry(b.high * 1.6, b.high * 0.5, b.len * 0.7), m, t); skirt.position.y = by - b.high * 0.7; g.add(skirt);
  }
  const head = new THREE.Group(); head.position.set(0, by + b.high * 0.55, b.len * 0.5); g.add(head);
  const skull = inked(new THREE.SphereGeometry(b.head, 10, 8), m, t); head.add(skull);
  const muzzle = inked(new THREE.BoxGeometry(b.head * 0.8, b.head * 0.7, b.head * (kind === 'peke' ? 0.5 : 1.2)), m, t);
  muzzle.position.set(0, -b.head * 0.25, b.head * (kind === 'peke' ? 0.8 : 1.05)); head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(b.head * 0.18, 6, 5), toon('#0d0c10'));
  nose.position.set(0, -b.head * 0.15, b.head * (kind === 'peke' ? 1.05 : 1.65)); head.add(nose);
  for (const s of [-1, 1]) {
    const ear = inked(new THREE.ConeGeometry(b.head * 0.38, b.head * (b.ears === 'up' ? 0.9 : 0.8), 4), m, t);
    if (b.ears === 'up') { ear.position.set(s * b.head * 0.5, b.head * 0.85, -b.head * 0.1); ear.rotation.z = -s * 0.25; }
    else { ear.position.set(s * b.head * 0.85, -b.head * 0.1, -b.head * 0.1); ear.rotation.z = s * 2.6; }
    head.add(ear);
  }
  const collar = inked(new THREE.TorusGeometry(b.head * 0.75, b.head * 0.12, 5, 10), toon(kind === 'westie' ? '#8a1c1c' : '#2a4fa8'), 0.006);
  collar.position.set(0, -b.head * 0.55, -b.head * 0.4); collar.rotation.x = Math.PI / 2 - 0.4; head.add(collar);
  const legs = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Group(); p.position.set(x * b.high * 0.55, b.legs + 0.02, z * b.len * 0.32);
    const l = inked(new THREE.CylinderGeometry(0.03, 0.026, b.legs + 0.02, 5), m, 0.008); l.position.y = -(b.legs + 0.02) / 2; p.add(l);
    g.add(p); legs.push(p);
  }
  const tail = new THREE.Group(); tail.position.set(0, by + b.high * 0.3, -b.len * 0.48); g.add(tail);
  const tl = inked(new THREE.ConeGeometry(0.035, b.fluffy ? 0.2 : 0.17, 5), m, 0.008);
  tl.position.y = 0.08; tail.add(tl);
  tail.rotation.x = b.tail === 'up' ? -0.5 : -1.2;
  g.userData = { legs, tail, head, collarY: by + b.high * 0.55 - b.head * 0.3, collarZ: b.len * 0.5 - b.head * 0.2 };
  return g;
}

// The lead: a sagging cord from the owner's hand to the collar.
const LEAD_MAT = new THREE.LineBasicMaterial({ color: 0x2a1d16 });
const SEGS = 8;

export class Dog {
  constructor(owner, scene, R) {
    this.owner = owner; this.R = R;
    this.kind = BREED_NAMES[Math.floor(R() * BREED_NAMES.length)];
    this.g = dogModel(this.kind); scene.add(this.g);
    this.x = owner.x + 0.6; this.z = owner.z; this.y = 0; this.ang = owner.ang; this.speed = 0;
    this.phase = R() * TAU; this.sniff = 0; this.yap = 0;
    this.side = owner.spec && owner.spec.umbrella ? 1 : R() < 0.5 ? 1 : -1; // the lead goes in the hand without the umbrella
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGS + 1) * 3), 3));
    this.lead = new THREE.Line(geo, LEAD_MAT); this.lead.frustumCulled = false; scene.add(this.lead);
  }
  update(dt, onYap) {
    const o = this.owner, vis = o.visible !== false && o.g.visible;
    this.g.visible = this.lead.visible = vis;
    if (!vis) { this.x = o.x; this.z = o.z; return; }
    const fx = Math.sin(o.ang), fz = Math.cos(o.ang), lx = fz, lz = -fx;
    const moving = o.speed > 0.2;
    // trots a little ahead and to one side; noses about when the owner stands still
    if (!moving && this.sniff <= 0 && this.R() < dt * 0.4) this.sniff = 1.5 + this.R() * 2;
    this.sniff -= dt;
    const ahead = moving ? 0.9 : this.sniff > 0 ? 1.4 : 0.5, out = this.side * (moving ? 0.45 : 0.8);
    const tx = o.x + fx * ahead + lx * out, tz = o.z + fz * ahead + lz * out;
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    const want = d > 0.12 ? Math.min(3.2, Math.max(o.speed * 1.05, d * 2.2)) : 0;
    if (d > 6) { this.x = tx; this.z = tz; }
    else if (want > 0) { const s = Math.min(want * dt, d); this.x += dx / d * s; this.z += dz / d * s; this.ang += angDiff(Math.atan2(dx, dz), this.ang) * Math.min(1, dt * 8); }
    else this.ang += angDiff(o.ang, this.ang) * Math.min(1, dt * 2);
    this.speed = want;
    // startled when the owner is: a yap and a hop
    if (o.busy > 0 && !this.wasBusy) { this.yap = 0.5; onYap && onYap(this); }
    this.wasBusy = o.busy > 0;
    this.yap = Math.max(0, this.yap - dt);
    const hop = this.yap > 0 ? Math.abs(Math.sin(this.yap * 18)) * 0.12 : 0;
    // legs, tail, head
    this.phase += dt * (4 + this.speed * 7);
    const sw = Math.min(0.9, this.speed * 0.45), L = this.g.userData;
    L.legs.forEach((p, i) => { p.rotation.x = Math.sin(this.phase + (i === 0 || i === 3 ? 0 : Math.PI)) * sw; });
    L.tail.rotation.z = Math.sin(this.phase * 2.3) * (this.yap > 0 ? 0.2 : 0.5);
    L.head.rotation.x = this.sniff > 0 && !moving ? 0.55 : 0;
    this.y += (groundY(this.x, this.z) - this.y) * Math.min(1, dt * 14);
    this.g.position.set(this.x, this.y + hop, this.z);
    this.g.rotation.y = this.ang;
    // the lead, from the owner's hand on the dog's side to the collar, sagging between
    const sc = (o.spec && o.spec.scale) || 1;
    const hx = o.x + lx * 0.27 * this.side + fx * 0.1, hy = o.y + 0.86 * sc, hz = o.z + lz * 0.27 * this.side + fz * 0.1;
    const cf = Math.sin(this.ang), cc = Math.cos(this.ang);
    const cx = this.x + cf * L.collarZ, cy = this.y + hop + L.collarY, cz = this.z + cc * L.collarZ;
    const span = Math.hypot(cx - hx, cz - hz), sag = Math.max(0.03, 0.35 - span * 0.25);
    const pos = this.lead.geometry.attributes.position;
    for (let k = 0; k <= SEGS; k++) {
      const t = k / SEGS;
      pos.setXYZ(k, hx + (cx - hx) * t, hy + (cy - hy) * t - Math.sin(t * Math.PI) * sag, hz + (cz - hz) * t);
    }
    pos.needsUpdate = true;
  }
  remove(scene) { scene.remove(this.g); scene.remove(this.lead); }
}

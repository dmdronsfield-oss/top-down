import * as THREE from 'three';
import { NODES, lanePoint, streetWidth } from '../vehicles/car.js';
import { onRoad, BOUNDS } from '../world/map.js';
import { toon, inked } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';
import { sfx } from '../audio/sfx.js';

// Bus stops: an enamel flag on a post at the kerb, and a little queue under umbrellas. When a General
// omnibus comes up that side of the street it draws in, the queue climbs aboard the open platform at
// the back, the conductor rings twice and off it goes. The queue re-forms while nobody is looking.

const LINES = ['Is this the 22?', 'Three went by full.', 'They come in threes, like bad news.', 'Wet enough for you?', 'I shall write to the Board.', 'Has the 14 been?', 'Fares, please, he says. Fares!'];
const CONDUCTOR = ['Hold very tight, please!', 'Room on top!', 'Inside only, madam.', 'Any more fares?', 'Mind the step, sir.'];
const QUEUE = [
  { sex: 'w', body: 'w_suit', colours: { Black: '#2a2a35', White: '#d9d2c2', Brown: '#1b1a20', Hair_Brown: '#5a3c26', Hair_Blond: '#5a3c26', Skin: '#efcfb2' }, hat: 'cloche', hatCol: '#3a2a20', umbrella: true },
  { sex: 'm', colours: { Suit: '#2e2c2a', Tie: '#6a2a26', Hair: '#3a2a1c', Skin: '#e0b090' }, hat: 'bowler', hatCol: '#1d1b1a', umbrella: true },
  { sex: 'm', colours: { Suit: '#4a4036', Tie: '#2a3a2a', Hair: '#6b5a48', Skin: '#d9a882' }, hat: 'cap', hatCol: '#3a332a', kind: 'worker' },
  { sex: 'w', body: 'w_formal', colours: { LimeGreen: '#3a2a3a', Gold: '#9a7a3a', Red: '#1b1a20', Brown: '#6b4a2e', Skin: '#e8c4a4' }, hat: 'cloche', hatCol: '#2a3a4a', umbrella: true },
];

function flagTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const k = c.getContext('2d');
  k.fillStyle = '#e9e3d2'; k.beginPath(); k.arc(64, 64, 62, 0, Math.PI * 2); k.fill();
  k.strokeStyle = '#a3201b'; k.lineWidth = 14; k.beginPath(); k.arc(64, 64, 52, 0, Math.PI * 2); k.stroke();
  k.fillStyle = '#a3201b'; k.fillRect(6, 50, 116, 28);
  k.fillStyle = '#f1ead8'; k.font = 'bold 19px Georgia, serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
  k.fillText('BUS STOP', 64, 65);
  k.fillStyle = '#1b1a20'; k.font = 'italic 11px Georgia, serif';
  k.fillText('General', 64, 31); k.fillText('Fare stage', 64, 98);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function post(tex) {
  const g = new THREE.Group(), iron = patchCutout(toon('#1f2421'));
  const pole = inked(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), iron, 0.008); pole.position.y = 1.3; g.add(pole);
  const mat = patchCutout(new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), mat); flag.position.set(0.34, 2.45, 0); g.add(flag);
  const rim = inked(new THREE.BoxGeometry(0.66, 0.04, 0.03), iron, 0.004); rim.position.set(0.34, 2.12, 0); g.add(rim);
  return g;
}

export class BusStops {
  constructor(G) {
    this.G = G; this.stops = [];
    const w = G.world, solids = G.city.solids, tex = flagTexture();
    const free = (x, z, m) => !onRoad(x, z) && !solids.some((s) => x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m);
    const cand = [];
    for (const a of NODES) for (const b of a.adj) {
      if (a.soft || b.soft || b.oneway || !b.adj.includes(a)) continue;
      const L = Math.hypot(b.x - a.x, b.z - a.z), W = streetWidth(a, b);
      if (L < 44 || W < 12) continue;
      const ux = (b.x - a.x) / L, uz = (b.z - a.z) / L, lx = uz, lz = -ux;
      const t = L * 0.6, P = lanePoint(a, b, t), out = W / 4 + 0.75;
      const K = { x: P.x + lx * out, z: P.z + lz * out };
      if (K.x < BOUNDS.x0 + 12 || K.x > BOUNDS.x1 - 12 || K.z < BOUNDS.z0 + 12 || K.z > BOUNDS.z1 - 12) continue;
      // the post and four places behind it, a little back from the kerb, all on clear pavement
      const spots = [0, 1, 2, 3].map((i) => ({ x: K.x - ux * (1.0 + i * 0.95) + lx * 0.55, z: K.z - uz * (1.0 + i * 0.95) + lz * 0.55 }));
      if (!free(K.x, K.z, 0.5) || !spots.every((s) => free(s.x, s.z, 0.45))) continue;
      cand.push({ a, b, t, L, ux, uz, lx, lz, K, spots });
    }
    // a handful, well spread, and not two on one street
    cand.sort((p, q) => (q.L - p.L) || (p.K.x - q.K.x) || (p.K.z - q.K.z));
    for (const c of cand) {
      if (this.stops.length >= 5) break;
      if (this.stops.some((s) => Math.hypot(s.K.x - c.K.x, s.K.z - c.K.z) < 70)) continue;
      const g = post(tex); g.position.set(c.K.x, 0.15, c.K.z); g.rotation.y = Math.atan2(c.lx, c.lz) + Math.PI / 2; G.scene.add(g);
      solids.push({ x0: c.K.x - 0.12, x1: c.K.x + 0.12, z0: c.K.z - 0.12, z1: c.K.z + 0.12, small: true });
      const face = Math.atan2(-c.ux, -c.uz); // looking back up the street for the bus
      const n = 2 + (this.stops.length % 3);
      const queue = [];
      for (let i = 0; i < n; i++) {
        const sp = c.spots[i], a = w.addActor(QUEUE[(i + this.stops.length) % QUEUE.length], sp.x, sp.z, face + (Math.random() - 0.5) * 0.5);
        queue.push({ a, home: sp, ang: a.ang, gone: false });
      }
      (c.a.busTo = c.a.busTo || []).push(c.b);
      this.stops.push({ ...c, queue, s: null, cool: 4, chatT: 3 });
    }
  }
  update(dt) {
    const G = this.G, w = G.world, p = w.player;
    for (const st of this.stops) {
      const near = Math.hypot(p.x - st.K.x, p.z - st.K.z);
      // the queue re-forms when Teddy is well away
      if (!st.s && near > 45) for (const q of st.queue) if (q.gone) { q.gone = false; q.a.x = q.home.x; q.a.z = q.home.z; q.a.ang = q.ang; q.a.speed = 0; }
      // grumbles
      if (!st.s && near < 14) {
        st.chatT -= dt;
        if (st.chatT <= 0) {
          st.chatT = 5 + Math.random() * 5;
          const here = st.queue.filter((q) => !q.gone && q.a.busy <= 0);
          if (here.length) G.hud.sayBy(here[Math.floor(Math.random() * here.length)].a, LINES[Math.floor(Math.random() * LINES.length)]);
        }
      }
      if (!st.s) {
        st.cool -= dt; if (st.cool <= 0) { st.cool = 1; this.watch(st, w, p); }
        // Teddy is waiting about near a queue: a bus out of sight is sent round the corner for it
        st.callT = (st.callT ?? 12) - dt;
        if (near < 55 && st.callT <= 0) { st.callT = 30; this.summon(st, w, p); }
        continue;
      }
      this.serve(st, dt, G, p);
    }
  }
  summon(st, w, p) {
    if (!st.queue.some((q) => !q.gone)) return;
    if (w.drivers.some((d) => d.car.type === 'omnibus' && (d.b === st.a || d.b === st.b))) return;
    const ups = st.a.adj.filter((n) => n !== st.b && n.adj.includes(st.a) && !n.soft)
      .sort((m, n) => ((st.a.x - n.x) * st.ux + (st.a.z - n.z) * st.uz) / Math.hypot(st.a.x - n.x, st.a.z - n.z) - ((st.a.x - m.x) * st.ux + (st.a.z - m.z) * st.uz) / Math.hypot(st.a.x - m.x, st.a.z - m.z));
    for (const pa of ups) {
      const P = lanePoint(pa, st.a, 6);
      if (Math.hypot(P.x - p.x, P.z - p.z) < 45 || w.cars.some((c) => Math.hypot(c.x - P.x, c.z - P.z) < 11)) continue;
      const d = w.drivers.find((d) => d.car.type === 'omnibus' && !d.stopAt && Math.hypot(d.car.x - p.x, d.car.z - p.z) > 80 && Math.hypot(d.car.x - st.K.x, d.car.z - st.K.z) > 80);
      if (!d) return;
      const car = d.car;
      car.x = P.x; car.z = P.z; car.h = P.h; car.vx = car.vz = 0; car.yawRate = 0;
      d.a = pa; d.b = st.a; d.c = st.b; d.best = Infinity; d.revT = 0; d.wait = 0; d.overT = 0; d.yieldT = 0;
      return;
    }
  }
  // is a bus coming up this side of the street?
  watch(st, w, p) {
    if (!st.queue.some((q) => !q.gone)) return;
    for (const d of w.drivers) {
      const car = d.car;
      // one about to reach the corner is kept to its route
      if (car.type === 'omnibus' && d.b === st.a && d.a !== st.b && d.c !== st.b && !d.stopAt && Math.hypot(car.x - st.a.x, car.z - st.a.z) > 18) d.c = st.b;
      if (car.type !== 'omnibus' || car === p.car || d.stopAt || d.a !== st.a || d.b !== st.b) continue;
      const t = (car.x - st.a.x) * st.ux + (car.z - st.a.z) * st.uz;
      if (t > st.t - 12 || car.speed < 1) continue;
      // the open platform at the back of the bus comes to rest beside the queue
      const P = lanePoint(st.a, st.b, st.t - 1.5 + car.len / 2);
      d.stopAt = { x: P.x, z: P.z };
      st.s = { d, P, phase: 'in', age: 0, bt: 0, k: 0 };
      return;
    }
  }
  serve(st, dt, G, p) {
    const s = st.s, d = s.d, car = d.car;
    s.age += dt;
    const done = (cool) => {
      d.stopAt = null; st.s = null; st.cool = cool;
      for (const q of st.queue) if (!q.gone && q.walking) { q.walking = false; q.a.x = q.home.x; q.a.z = q.home.z; q.a.ang = q.ang; }
    };
    if (s.age > 30 || d.b !== st.b) return done(6);
    if (s.phase === 'in') {
      const along = (s.P.x - car.x) * car.fx + (s.P.z - car.z) * car.fz;
      if (along < -4) return done(6);
      if (along < 1.2 && Math.abs(car.speed) < 0.4) {
        s.phase = 'board'; s.bt = 0;
        if (Math.hypot(p.x - car.x, p.z - car.z) < 40) G.hud.say(car.x - car.fx * car.len * 0.45, 2.6, car.z - car.fz * car.len * 0.45, CONDUCTOR[Math.floor(Math.random() * CONDUCTOR.length)]);
      }
    } else {
      s.bt += dt;
      // the platform: nearside rear corner
      const px = car.x - car.fx * (car.len / 2 - 0.6) + car.fz * 1.6, pz = car.z - car.fz * (car.len / 2 - 0.6) - car.fx * 1.6;
      let left = 0;
      st.queue.forEach((q, i) => {
        if (q.gone) return;
        left++;
        if (s.bt < i * 0.7 || q.a.busy > 0 || q.a.down > 0) return;
        q.walking = true;
        if (q.a.stepTo(px, pz, 1.5, dt) < 0.35 || s.bt > 7 + i) { q.gone = true; q.walking = false; q.a.x = 9999; q.a.z = 9999; q.a.speed = 0; left--; }
      });
      if (!left) {
        if (Math.hypot(p.x - car.x, p.z - car.z) < 45) { sfx.ting(0); sfx.ting(0.28); }
        done(25);
      }
    }
  }
}

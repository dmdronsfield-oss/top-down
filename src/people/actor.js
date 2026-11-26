import * as THREE from 'three';
import { dressFigure, play } from './cast.js';
import { collide } from '../core/physics.js';
import { groundY } from '../world/ground.js';
import { BLOCKS, onRoad, DIAGS, diagTriangles } from '../world/map.js';

const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// A person in the street: a dressed figure plus a little physics and an animation state.
export class Actor {
  constructor(spec, x, z, ang = 0, scene) {
    this.spec = spec;
    this.fig = dressFigure(spec);
    this.g = this.fig.group;
    this.x = x; this.z = z; this.ang = ang; this.y = groundY(x, z);
    this.r = 0.32;
    this.state = 'idle';
    this.speed = 0;
    this.busy = 0;       // seconds of a one-off animation still playing
    this.lod = 0;
    this.visible = true;
    this.down = 0;       // seconds lying on the pavement
    scene.add(this.g);
    this.sync(0);
  }
  get idleAnim() { return this.fig.actions.Idle_Neutral ? 'Idle_Neutral' : 'Idle'; }
  // Move towards (tx,tz) at speed sp. Returns remaining distance.
  stepTo(tx, tz, sp, dt, run) {
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { this.speed = 0; return 0; }
    const s = Math.min(sp * dt, d);
    this.x += dx / d * s; this.z += dz / d * s;
    collide(this, this.r);
    const want = Math.atan2(dx, dz);
    this.ang += angDiff(want, this.ang) * Math.min(1, dt * 10);
    this.speed = sp; this.running = !!run;
    return d - s;
  }
  oneShot(name, secs, fade = 0.15) {
    if (!this.fig.actions[name]) return;
    play(this.fig, name, fade, 1, true);
    this.busy = secs;
  }
  knockDown() {
    if (this.down > 0) return;
    this.down = 2.6;
    play(this.fig, 'Death', 0.08, 1.6, true);
    this.busy = 2.6;
  }
  animate(dt, camX, camZ) {
    if (this.busy > 0) {
      this.busy -= dt;
      if (this.down > 0) this.down -= dt;
    } else {
      const moving = this.speed > 0.2;
      const brolly = this.fig.props.umbrella && this.fig.actions.WalkBrolly;
      const name = this.seated ? this.seatAnim : moving ? (this.running ? 'Run' : brolly ? 'WalkBrolly' : 'Walk') : brolly ? 'IdleBrolly' : this.idleAnim;
      play(this.fig, name, 0.22, moving ? (this.running ? Math.min(1.25, this.speed / 5) : Math.min(1.35, this.speed / 1.4)) : 1);
    }
    // distant people animate less often
    const d2 = (this.x - camX) ** 2 + (this.z - camZ) ** 2;
    this.visible = d2 < 95 * 95;
    this.g.visible = this.visible;
    if (!this.visible) return;
    const step = d2 > 45 * 45 ? 3 : d2 > 28 * 28 ? 2 : 1;
    this.lod = (this.lod + 1) % step;
    this._acc = (this._acc || 0) + dt;
    if (this.lod === 0) { this.fig.mixer.update(this._acc); this._acc = 0; }
  }
  sync(dt) {
    const gy = groundY(this.x, this.z);
    this.y += (gy - this.y) * Math.min(1, dt * 14 || 1);
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.y = this.ang;
  }
  remove(scene) { scene.remove(this.g); }
}

// ---------------------------------------------------------------- pavement network
export const RINGS = BLOCKS.flatMap((B) => {
  const k = 1.5, D = DIAGS.find((g) => g.bi === B.i && g.bj === B.j);
  // a block cut on the slant: walk each triangle, its fourth corner halfway down the slant
  // (corners listed NW, NE, SE, SW as near as a triangle allows)
  if (D) return diagTriangles(D, k).map(({ A1, Q, A2 }, i) => { const m = [(A1[0] + A2[0]) / 2, (A1[1] + A2[1]) / 2]; return { B, c: i ? [A2, m, A1, Q] : [A1, Q, A2, m] }; });
  return [{ B, c: [[B.kx0 + k, B.kz0 + k], [B.kx1 - k, B.kz0 + k], [B.kx1 - k, B.kz1 - k], [B.kx0 + k, B.kz1 - k]] }];
});
const ringAt = (i, j) => RINGS.find((r) => i >= r.B.i && i <= r.B.i1 && j >= r.B.j && j <= r.B.j1);

// Walks a pedestrian round a block, now and then crossing to the next one.
export class Walker {
  constructor(actor, ring, corner, dir, R) {
    Object.assign(this, { a: actor, ring, next: corner, dir, R, crossing: null, pause: 0 });
    this.pace = 1.05 + R() * 0.45;
  }
  target() { return this.crossing ? this.crossing.p : this.ring.c[this.next]; }
  // walking out together: keep abreast of the other, a little to their left
  keepUp(dt) {
    const a = this.a, L = this.leader.a;
    if (!L.visible && !a.visible) { a.x = L.x; a.z = L.z; return; }
    const fx = Math.sin(L.ang), fz = Math.cos(L.ang);
    const tx = L.x + fz * 0.72 - fx * 0.15, tz = L.z - fx * 0.72 - fz * 0.15;
    const d = Math.hypot(tx - a.x, tz - a.z);
    if (d > 12) { a.x = tx; a.z = tz; }
    const sp = L.speed > 0.2 ? L.speed * (d > 0.6 ? 1.25 : d < 0.25 ? 0.8 : 1) : d > 0.4 ? 1.1 : 0;
    if (sp > 0) a.stepTo(tx, tz, sp, dt, sp > 2.4);
    else { a.speed = 0; a.ang += angDiff(L.ang, a.ang) * Math.min(1, dt * 4); }
  }
  update(dt) {
    const a = this.a;
    if (a.busy > 0) { a.speed = 0; return; }
    if (this.hold) return; // someone else is steering them (hailing a cab)
    if (this.leader) return this.keepUp(dt);
    if (this.pause > 0) { this.pause -= dt; a.speed = 0; return; }
    const [tx, tz] = this.target();
    const rem = a.stepTo(tx, tz, this.pace * (a.hurry || 1), dt, (a.hurry || 1) > 1.6);
    if (rem > 0.4) return;
    if (this.crossing) {
      this.ring = this.crossing.ring;
      this.next = (this.crossing.corner + this.dir + 4) % 4;
      this.crossing = null;
      return;
    }
    const ci = this.next;
    if (this.R() < 0.3) {
      const B = this.ring.B;
      const di = ci === 1 || ci === 2 ? 1 : -1, dj = ci === 2 || ci === 3 ? 1 : -1;
      // the cell this corner belongs to (blocks can span two cells)
      const ci0 = di > 0 ? B.i1 : B.i, cj0 = dj > 0 ? B.j1 : B.j;
      const [px, pz] = this.ring.c[ci];
      const opts = [];
      for (const r of [ringAt(ci0 + di, cj0), ringAt(ci0, cj0 + dj)]) {
        if (!r || r === this.ring) continue;
        // the neighbour's nearest corner, if it is just across the road
        let best = -1, bd = 22;
        r.c.forEach(([x, z], k) => { const d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; best = k; } });
        if (best >= 0) opts.push({ ring: r, corner: best });
      }
      if (opts.length) {
        const o = opts[Math.floor(this.R() * opts.length)];
        this.crossing = { p: o.ring.c[o.corner], ring: o.ring, corner: o.corner };
        this.dir = this.R() < 0.5 ? 1 : -1;
        this.pause = 0.3 + this.R() * 1.2;
        return;
      }
    }
    this.next = (ci + this.dir + 4) % 4;
    if (this.R() < 0.15) this.pause = 1 + this.R() * 3;
  }
  get onRoad() { return onRoad(this.a.x, this.a.z); }
}

import { Actor, Walker, RINGS } from '../people/actor.js';
import { CAST, play } from '../people/cast.js';
import { sight, collide } from '../core/physics.js';
import { NODES, angDiff } from '../vehicles/car.js';

export const LEVELS = ['Spotless', 'A cross bobby', 'Whistle chorus', 'Scotland Yard'];
const TAU = Math.PI * 2;

// Scandal works like a wanted level, but each step is funnier rather than deadlier.
export class Police {
  constructor(world, hooks) {
    this.w = world; this.hooks = hooks;
    this.level = 0; this.cool = 0; this.seenT = 0;
    this.cops = [];
    this.tender = null;
    this.lastSeen = null;
    this.whistleT = 0;
  }
  spawn(n) {
    const R = this.w.R;
    for (let i = 0; i < n; i++) {
      const ring = RINGS[(i * 7 + 3) % RINGS.length];
      const k = Math.floor(R() * 4), p = ring.c[k];
      const a = new Actor(CAST.constable, p[0], p[1], 0, this.w.scene);
      a.isCop = true;
      const walker = new Walker(a, ring, (k + 1) % 4, R() < .5 ? 1 : -1, R);
      walker.pace = 1.0;
      a.walker = walker;
      a.mode = 'patrol';
      this.w.actors.push(a);
      this.cops.push(a);
    }
  }
  // Plumtree has his own beat and is added separately by the job.
  adopt(a) { a.isCop = true; a.mode = a.mode || 'beat'; this.cops.push(a); }

  canSee(c, x, z, wide) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz);
    if (d > (wide ? 30 : 22)) return false;
    if (d > 5 && !wide) {
      const a = Math.atan2(dx, dz);
      if (Math.abs(angDiff(a, c.ang)) > 1.15) return false;
    }
    if (c.distracted > 0 && d > 2.5) return false;
    return sight(c.x, c.z, x, z);
  }
  anyoneSees(x, z, wide) { return this.cops.some((c) => c.mode !== 'down' && c.visible !== false && this.canSee(c, x, z, wide)); }

  // A crime: raise scandal if a constable saw it.
  crime(severity, x, z, why) {
    const seen = this.anyoneSees(x, z, true);
    if (seen) this.raise(Math.min(3, this.level + severity), why);
    return seen;
  }
  raise(n, why) {
    n = Math.min(3, Math.max(this.level, n));
    if (n > this.level) { this.level = n; this.hooks.scandal && this.hooks.scandal(n, why); }
    this.cool = 0;
    const p = this.w.player;
    this.lastSeen = { x: p.x, z: p.z };
    for (const c of this.cops) if (c.mode !== 'down' && Math.hypot(c.x - p.x, c.z - p.z) < (n >= 2 ? 70 : 30)) c.mode = 'chase';
  }
  clear() {
    this.level = 0; this.cool = 0;
    for (const c of this.cops) if (c.mode === 'chase' || c.mode === 'search') c.mode = c.walker ? 'patrol' : 'beat';
    if (this.tender) { this.removeTender(); }
  }
  removeTender() {
    const t = this.tender; this.tender = null;
    const w = this.w; const i = w.cars.indexOf(t); if (i >= 0) w.cars.splice(i, 1);
    w.scene.remove(t.g);
  }

  update(dt) {
    const w = this.w, p = w.player;
    const px = p.x, pz = p.z;
    let seen = false;
    for (const c of this.cops) {
      if (c.distracted > 0) c.distracted -= dt;
      if (c.mode === 'down') { if (c.busy <= 0) c.mode = c.walker ? 'patrol' : 'beat'; continue; }
      if (this.level > 0 && this.canSee(c, px, pz)) {
        seen = true;
        this.lastSeen = { x: px, z: pz };
        if (c.mode !== 'chase') { c.mode = 'chase'; this.hooks.copShout && this.hooks.copShout(c); }
      }
      if (c.mode === 'chase' && this.level > 0) {
        const t = this.lastSeen || { x: px, z: pz };
        const rem = c.busy > 0 ? 1 : c.stepTo(t.x, t.z, 4.7, dt, true);
        if (rem < 0.6 && !this.canSee(c, px, pz)) c.mode = 'search', c.searchT = 6;
        // the collar
        const d = Math.hypot(c.x - px, c.z - pz);
        const inCar = p.car;
        if (c.busy <= 0 && d < (inCar ? 2.6 : 1.1) && (!inCar || Math.abs(inCar.speed) < 1.2)) { this.hooks.arrest && this.hooks.arrest(c); return; }
        if (this.level >= 2) {
          c.whistleT = (c.whistleT || 0) - dt;
          if (c.whistleT <= 0) { c.whistleT = 3.5 + Math.random() * 2; this.hooks.whistle && this.hooks.whistle(c); }
        }
      } else if (c.mode === 'search') {
        c.searchT -= dt;
        if (c.wanderT == null || c.wanderT <= 0) { c.wanderT = 1.5; c.wx = c.x + (Math.random() - .5) * 10; c.wz = c.z + (Math.random() - .5) * 10; }
        c.wanderT -= dt;
        c.stepTo(c.wx, c.wz, 1.6, dt);
        if (c.searchT <= 0) c.mode = c.walker ? 'patrol' : 'beat';
      } else if (c.mode === 'patrol' && c.walker) {
        c.walker.update(dt);
      }
      if (this.level === 0 && (c.mode === 'chase' || c.mode === 'search')) c.mode = c.walker ? 'patrol' : 'beat';
    }
    // cooling off when nobody can see you
    if (this.level > 0) {
      if (seen) this.cool = 0; else this.cool += dt;
      const need = 9 + this.level * 5;
      if (this.cool > need) {
        this.level--; this.cool = 0;
        this.hooks.scandal && this.hooks.scandal(this.level, null, true);
        if (this.level === 0) this.clear();
      }
    }
    // Scotland Yard sends a motor
    if (this.level >= 3 && !this.tender) this.spawnTender();
    if (this.tender) this.driveTender(dt);
  }

  spawnTender() {
    const w = this.w, p = w.player;
    let best = null, bd = 1e9;
    for (const n of NODES) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d > 55 && d < bd) { bd = d; best = n; } }
    if (!best) return;
    const t = w.addCar('tender', best.x, best.z, Math.atan2(p.x - best.x, p.z - best.z));
    t.police = true;
    this.tender = t;
    this.hooks.tender && this.hooks.tender(t);
  }
  driveTender(dt) {
    const t = this.tender, p = this.w.player;
    const want = Math.atan2(p.x - t.x, p.z - t.z);
    const d = Math.hypot(p.x - t.x, p.z - t.z);
    const steer = Math.max(-1, Math.min(1, angDiff(want, t.h) * 2));
    t.drive({ throttle: d > 6 ? 1 : (p.car ? 0.4 : -0.3), steer, brake: d < 5 && !p.car }, dt);
    t.bellT = (t.bellT || 0) - dt;
    if (t.bellT <= 0 && d < 60) { t.bellT = 2.5; this.hooks.bell && this.hooks.bell(t); }
    if (t.g.userData.beacon) t.g.userData.beacon.visible = Math.floor(performance.now() / 300) % 2 === 0;
    if (d < 3.4 && (!p.car || Math.abs(p.car.speed) < 1.5)) this.hooks.arrest && this.hooks.arrest(null);
  }
}

import * as THREE from 'three';
import { TYPES } from './models.js';
import { collide } from '../core/physics.js';
import { groundY } from '../world/ground.js';
import { XS, ZS } from '../world/map.js';

const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Car {
  constructor(type, x, z, h) {
    const T = TYPES[type];
    Object.assign(this, { type, T, x, z, h, vx: 0, vz: 0, steer: 0, damage: 0, driver: null, passenger: null, honkT: 0, steam: 0, lastHit: 0 });
    this.g = T.build();
    this.g.userData.car = this;
    this.len = T.len; this.wid = T.wid;
    this.r = T.wid / 2 + 0.05;
    this.ai = null;
    this.y = 0;
    this.roll = 0; this.pitch = 0;
    this.sync(0);
  }
  get fx() { return Math.sin(this.h); }
  get fz() { return Math.cos(this.h); }
  get speed() { return this.vx * this.fx + this.vz * this.fz; }

  // ctl: { throttle -1..1, steer -1..1 (positive = left), brake bool }
  drive(ctl, dt) {
    const T = this.T;
    const fx = this.fx, fz = this.fz, lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * lx + this.vz * lz;
    const thr = ctl.throttle || 0;
    if (thr > 0) vf += (vf < -0.5 ? T.accel * 1.6 : T.accel) * thr * dt * (1 - Math.max(0, vf) / T.maxV);
    else if (thr < 0) vf += (vf > 0.5 ? T.accel * 1.8 : T.accel * 0.5) * thr * dt;
    if (vf < -T.maxV * 0.35) vf = -T.maxV * 0.35;
    // rolling drag
    vf -= vf * (thr === 0 ? 0.6 : 0.12) * dt;
    if (ctl.brake) vf -= vf * 2.2 * dt;
    this.steer += ((ctl.steer || 0) - this.steer) * Math.min(1, dt * 8);
    const turn = this.steer * T.turn * clamp(vf / 5, -1, 1) * (1 - Math.min(0.45, Math.abs(vf) / T.maxV * 0.45));
    this.h += turn * dt;
    // lateral grip: the handbrake lets the tail out on wet setts
    const grip = ctl.brake ? 1.2 : T.grip;
    vl *= Math.exp(-grip * dt);
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h);
    this.vx = nfx * vf + nfz * vl;
    this.vz = nfz * vf - nfx * vl;
    this.slide = Math.abs(vl);
    this.bodyRoll = clamp(-turn * vf * 0.012 + vl * 0.02, -0.12, 0.12);
    this.move(dt);
  }

  move(dt) {
    this.x += this.vx * dt; this.z += this.vz * dt;
    // two circles along the body
    const off = this.len / 2 - this.r;
    let hit = null;
    for (const s of [off, -off, 0]) {
      const p = { x: this.x + this.fx * s, z: this.z + this.fz * s };
      const h = collide(p, this.r);
      if (h) { this.x += p.x - (this.x + this.fx * s); this.z += p.z - (this.z + this.fz * s); hit = h; }
    }
    if (hit) {
      const vn = this.vx * hit.nx + this.vz * hit.nz;
      if (vn < 0) {
        this.vx -= vn * hit.nx * 1.35; this.vz -= vn * hit.nz * 1.35;
        this.vx *= 0.8; this.vz *= 0.8;
        const imp = -vn;
        if (imp > 3) { this.damage += imp; this.lastHit = imp; this.onHit && this.onHit(imp, 'wall'); }
      }
    }
  }

  sync(dt) {
    const gy = groundY(this.x, this.z);
    this.y += (gy - this.y) * Math.min(1, dt * 12);
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.set(0, this.h, 0);
    this.roll += ((this.bodyRoll || 0) - this.roll) * Math.min(1, dt * 6);
    this.g.rotation.z = this.roll;
    const sp = this.speed;
    const w = this.g.userData.wheels;
    if (w) {
      for (const k of w) k.rotation.x += sp * dt / 0.4;
      for (const k of this.g.userData.front) k.rotation.y = this.steer * 0.45;
    }
  }
}

// ---------------------------------------------------------------- traffic network
// Nodes are junctions (i, j). A car drives on the left of each street.
export const NODES = [];
for (let i = 0; i < XS.length; i++) for (let j = 0; j < ZS.length; j++) NODES.push({ i, j, x: XS[i].x, z: ZS[j].z });
const node = (i, j) => NODES[i * ZS.length + j];
export function neighbours(n) {
  const out = [];
  if (n.i > 0) out.push(node(n.i - 1, n.j)); if (n.i < XS.length - 1) out.push(node(n.i + 1, n.j));
  if (n.j > 0) out.push(node(n.i, n.j - 1)); if (n.j < ZS.length - 1) out.push(node(n.i, n.j + 1));
  return out;
}
function streetWidth(a, b) { return a.i === b.i ? XS[a.i].w : ZS[a.j].w; }
// Point on the left-hand lane of the a->b street, t metres from a's centre.
export function lanePoint(a, b, t) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const lx = uz, lz = -ux; // left of travel direction
  const off = streetWidth(a, b) / 4;
  return { x: a.x + ux * t + lx * off, z: a.z + uz * t + lz * off, h: Math.atan2(ux, uz) };
}
export function randomEdge(R = Math.random) {
  const a = NODES[Math.floor(R() * NODES.length)];
  const ns = neighbours(a);
  return [a, ns[Math.floor(R() * ns.length)]];
}

export class Driver {
  constructor(car, a, b, R = Math.random) {
    this.car = car; this.a = a; this.b = b; this.R = R;
    this.target = 0.55 + R() * 0.3; // fraction of max speed this driver likes
    this.wait = 0; this.stuck = 0;
    this.pickNext();
  }
  pickNext() {
    const ns = neighbours(this.b).filter((n) => n !== this.a);
    this.c = ns.length ? ns[Math.floor(this.R() * ns.length)] : this.a;
  }
  update(dt, world) {
    const car = this.car;
    const L = Math.hypot(this.b.x - this.a.x, this.b.z - this.a.z);
    const jHalf = Math.max(streetWidth(this.a, this.b), streetWidth(this.b, this.c)) / 2 + 3.5;
    // progress along the current street
    const ux = (this.b.x - this.a.x) / L, uz = (this.b.z - this.a.z) / L;
    const t = (car.x - this.a.x) * ux + (car.z - this.a.z) * uz;
    let goal;
    if (t < L - jHalf) {
      goal = lanePoint(this.a, this.b, Math.min(L - jHalf, t + 7));
    } else {
      // through the junction to the next street's lane
      goal = lanePoint(this.b, this.c, jHalf + 2);
      const d = Math.hypot(goal.x - car.x, goal.z - car.z);
      if (d < 4.5) { this.a = this.b; this.b = this.c; this.pickNext(); }
    }
    const want = Math.atan2(goal.x - car.x, goal.z - car.z);
    const steer = clamp(angDiff(want, car.h) * 2.2, -1, 1);
    let desired = car.T.maxV * this.target * (Math.abs(steer) > 0.5 ? 0.45 : 1);
    // obstacles ahead: other cars, people on the road, the player
    const block = world.obstacleAhead(car, 4 + Math.max(0, car.speed) * 0.9);
    if (block) {
      desired = 0;
      this.wait += dt;
      if (block.isPlayer && this.wait > 1.2 && car.honkT <= 0) { car.honkT = 3 + Math.random() * 2; world.honk(car); }
    } else this.wait = 0;
    const sp = car.speed;
    const throttle = sp < desired - 0.5 ? 1 : sp > desired + 0.5 ? -1 : 0;
    car.honkT -= dt;
    car.drive({ throttle, steer, brake: desired === 0 && sp > 0.5 }, dt);
    // un-stick: a driver wedged for too long reverses a bit
    if (Math.abs(car.speed) < 0.2 && !block) { this.stuck += dt; if (this.stuck > 3) { car.h += 0.6; this.stuck = 0; } } else this.stuck = 0;
  }
}

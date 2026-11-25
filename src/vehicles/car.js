import * as THREE from 'three';
import { TYPES } from './models.js';
import { collide } from '../core/physics.js';
import { groundY } from '../world/ground.js';
import { XS, ZS, edgeClosed } from '../world/map.js';

const TAU = Math.PI * 2;
export const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// A steering wheel in front of the driver's seat, which turns with the front wheels.
const HELM = {};
function steeringWheel(seat) {
  if (!seat) return null;
  if (!HELM.rim) {
    const m = new THREE.MeshBasicMaterial({ color: 0x141317 });
    HELM.rim = new THREE.TorusGeometry(0.19, 0.022, 6, 18); HELM.spoke = new THREE.BoxGeometry(0.36, 0.02, 0.02); HELM.col = new THREE.CylinderGeometry(0.02, 0.025, 0.5, 6); HELM.m = m;
  }
  const g = new THREE.Group(), spin = new THREE.Group();
  spin.add(new THREE.Mesh(HELM.rim, HELM.m));
  const s1 = new THREE.Mesh(HELM.spoke, HELM.m); spin.add(s1);
  const s2 = new THREE.Mesh(HELM.spoke, HELM.m); s2.rotation.z = Math.PI / 2; spin.add(s2);
  g.add(spin);
  const col = new THREE.Mesh(HELM.col, HELM.m); col.position.set(0, -0.22, 0.12); col.rotation.x = 0.6; g.add(col);
  g.position.set(seat[0], seat[1] + 0.48, seat[2] + 0.4);
  g.rotation.x = 0.6;
  return g;
}

export class Car {
  constructor(type, x, z, h) {
    const T = TYPES[type];
    Object.assign(this, { type, T, x, z, h, vx: 0, vz: 0, steer: 0, damage: 0, driver: null, passenger: null, honkT: 0, steam: 0, lastHit: 0 });
    this.g = T.build();
    this.g.userData.car = this;
    // split the motor into a sprung body and the wheels that stay on the road
    this.body = new THREE.Group(); this.body.name = 'body';
    for (const ch of [...this.g.children]) if (!ch.userData.isWheel) this.body.add(ch);
    this.g.add(this.body);
    this.helm = steeringWheel(this.g.userData.seats && this.g.userData.seats.driver);
    if (this.helm) this.body.add(this.helm);
    this.len = T.len; this.wid = T.wid;
    this.r = T.wid / 2 + 0.05;
    this.ai = null;
    this.y = 0;
    this.roll = 0; this.pitch = 0; this.heave = 0; this.heaveV = 0; this.pitchV = 0; this.rollV = 0;
    this.sync(0);
  }
  get fx() { return Math.sin(this.h); }
  get fz() { return Math.cos(this.h); }
  get speed() { return this.vx * this.fx + this.vz * this.fz; }

  // ctl: { throttle -1..1, steer -1..1 (positive = left), brake bool }
  // A simple weighty model: the engine has a lag and fades with speed, the brakes
  // and tyres have limits (wet London setts), the nose has yaw inertia, and the body
  // rides on springs, so it squats, dives and leans.
  drive(ctl, dt) {
    const T = this.T, m = T.mass || 1;
    const fx = this.fx, fz = this.fz, lx = fz, lz = -fx;
    let vf = this.vx * fx + this.vz * fz;
    let vl = this.vx * lx + this.vz * lz;
    const v0f = vf, v0l = vl;
    // engine and pedals respond with a little lag, slower for heavy motors
    const want = ctl.throttle || 0;
    this.thr = (this.thr || 0) + (want - (this.thr || 0)) * Math.min(1, dt * (want === 0 ? 6 : 3.2 / Math.sqrt(m)));
    const thr = this.thr;
    if (thr > 0) {
      if (vf < -0.3) vf += 7.5 * thr * dt; // braking out of reverse
      else { const top = T.maxV * (this.damage > 70 ? 0.6 : 1); const fade = 1 - Math.pow(Math.max(0, vf) / top, 1.6); vf += T.accel * thr * fade * dt; }
    } else if (thr < 0) {
      if (vf > 0.3) vf += Math.min(vf, 7.5 / Math.sqrt(m) * -thr * dt) * -1; // footbrake
      else vf += T.accel * 0.45 * thr * dt;
    }
    if (vf < -T.maxV * 0.3) vf = -T.maxV * 0.3;
    // rolling resistance and air
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.35 + 0.0016 * vf * vf) * dt * (thr === 0 ? 1.6 : 1));
    this.braking = (ctl.brake ? 1 : 0) + (thr < -0.3 && vf > 1 ? 1 : 0);
    if (ctl.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4.5 * dt); // handbrake locks the rear
    // steering wheel: slow hands at speed
    const sMax = 1 - Math.min(0.55, Math.abs(vf) / T.maxV * 0.6);
    this.steer += ((ctl.steer || 0) * sMax - this.steer) * Math.min(1, dt * 5);
    // yaw: the nose follows the wheels with inertia
    const wantYaw = this.steer * T.turn * clamp(vf / 6, -1, 1);
    this.yawRate = (this.yawRate || 0) + (wantYaw - (this.yawRate || 0)) * Math.min(1, dt * 7 / m);
    this.h += this.yawRate * dt;
    // the velocity does not turn with the body: re-project it, then let the tyres fight the slip
    const nfx = Math.sin(this.h), nfz = Math.cos(this.h), nlx = nfz, nlz = -nfx;
    // (vf, vl) were in the old frame; express (vx, vz) in the new one
    const ox = fx * vf + lx * vl, oz = fz * vf + lz * vl;
    vf = ox * nfx + oz * nfz; vl = ox * nlx + oz * nlz;
    const latMax = (ctl.brake ? 2.2 : T.grip * 1.15) / Math.sqrt(m) * 9.81 / 6; // m/s^2 the tyres will give
    const cut = Math.min(Math.abs(vl), latMax * dt + Math.abs(vl) * (ctl.brake ? 0.4 : 2.5) * dt);
    vl -= Math.sign(vl) * cut;
    this.vx = nfx * vf + nlx * vl;
    this.vz = nfz * vf + nlz * vl;
    this.slide = Math.abs(vl);
    // accelerations for the springs (forward, and toward the left)
    this.ax = (vf - v0f) / Math.max(dt, 1e-3);
    this.al = this.yawRate * vf;
    this.move(dt);
  }

  // Bend a panel or two: a wing knocked askew, a lamp pushed in.
  dent(imp) {
    const parts = this.body ? this.body.children.filter((m) => m.isMesh && !m.material.blending) : [];
    const n = imp > 10 ? 2 : 1;
    for (let k = 0; k < n && parts.length; k++) {
      const m = parts[Math.floor(Math.random() * parts.length)];
      const a = Math.min(0.06, imp * 0.004);
      m.rotation.x += (Math.random() - .5) * a; m.rotation.z += (Math.random() - .5) * a; m.rotation.y += (Math.random() - .5) * a * 0.5;
      m.position.y -= Math.random() * a * 0.15;
    }
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
        this.pitchV = (this.pitchV || 0) + imp * 0.06; this.rollV = (this.rollV || 0) + (Math.random() - .5) * imp * 0.05;
        if (imp > 5) this.dent(imp);
        if (imp > 3) { this.damage += imp; this.lastHit = imp; this.onHit && this.onHit(imp, 'wall'); }
      }
    }
  }

  sync(dt) {
    const gy = groundY(this.x, this.z);
    const dy = gy - this.y;
    if (Math.abs(dy) > 0.05 && dt > 0) this.heaveV = (this.heaveV || 0) - dy * 4; // kerbs give a jolt
    this.y += dy * Math.min(1, dt * 12);
    this.g.position.set(this.x, this.y, this.z);
    this.g.rotation.set(0, this.h, 0);
    // suspension: damped springs for pitch, roll and heave
    if (dt > 0) {
      const m = this.T.mass || 1, k = 70 / m, c = 7 / Math.sqrt(m);
      const pT = clamp((this.ax || 0) * 0.009, -0.055, 0.055);   // squat under power, dive under brakes
      const rT = clamp((this.al || 0) * 0.014, -0.11, 0.11);  // lean out of the corner
      this.pitchV = (this.pitchV || 0) + (k * (pT - this.pitch) - c * (this.pitchV || 0)) * dt;
      this.rollV = (this.rollV || 0) + (k * (rT - this.roll) - c * (this.rollV || 0)) * dt;
      this.heave = this.heave || 0;
      this.heaveV = (this.heaveV || 0) + (k * 1.4 * -this.heave - c * 1.2 * this.heaveV) * dt;
      this.pitch += this.pitchV * dt; this.roll += this.rollV * dt; this.heave += this.heaveV * dt;
      this.heave = clamp(this.heave, -0.12, 0.12);
      // a little idle shimmy from the engine
      this.shim = (this.shim || 0) + dt * 38;
      const idle = this.driver || this.ai ? Math.sin(this.shim) * 0.0035 : 0;
      if (this.helm) this.helm.children[0].rotation.z += (-(this.steer || 0) * 1.6 - this.helm.children[0].rotation.z) * Math.min(1, dt * 10);
      const b = this.body;
      if (b) { b.rotation.set(-this.pitch, 0, this.roll); b.position.y = this.heave + idle; }
    }
    const beams = this.g.userData.beams;
    if (beams) beams.visible = !!(this.driver || this.ai);
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
  if (n.i > 0 && !edgeClosed('z', n.j, n.i - 1)) out.push(node(n.i - 1, n.j));
  if (n.i < XS.length - 1 && !edgeClosed('z', n.j, n.i)) out.push(node(n.i + 1, n.j));
  if (n.j > 0 && !edgeClosed('x', n.i, n.j - 1)) out.push(node(n.i, n.j - 1));
  if (n.j < ZS.length - 1 && !edgeClosed('x', n.i, n.j)) out.push(node(n.i, n.j + 1));
  return out;
}
function streetWidth(a, b) { return a.i === b.i ? XS[a.i].w : ZS[a.j].w; }
// Point on the left-hand lane of the a->b street, t metres from a's centre.
export function lanePoint(a, b, t, side = 1) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const lx = uz, lz = -ux; // left of travel direction
  const off = streetWidth(a, b) / 4 * side;
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
    // backing out of a nose-to-nose stand-off
    if (this.revT > 0) {
      this.revT -= dt; car.honkT -= dt;
      car.drive({ throttle: -0.7, steer: this.revSteer, brake: false }, dt);
      return;
    }
    const L = Math.hypot(this.b.x - this.a.x, this.b.z - this.a.z);
    const jHalf = Math.max(streetWidth(this.a, this.b), streetWidth(this.b, this.c)) / 2 + 3.5;
    // progress along the current street
    const ux = (this.b.x - this.a.x) / L, uz = (this.b.z - this.a.z) / L;
    const t = (car.x - this.a.x) * ux + (car.z - this.a.z) * uz;
    let goal;
    // overtaking a parked motor: borrow the other side of the road for a few seconds
    this.overT = Math.max(0, (this.overT || 0) - dt);
    const side = this.overT > 0 ? -1 : 1;
    if (t < L - jHalf) {
      goal = lanePoint(this.a, this.b, Math.min(L - jHalf, t + 7), side);
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
    let block = world.obstacleAhead(car, 4 + Math.max(0, car.speed) * 0.9, this.overT > 0);
    const parkedAhead = block && block.car && !block.car.ai && !block.isPlayer && Math.abs(block.car.speed) < 0.5;
    if (parkedAhead && t < L - jHalf - 10 && !world.obstacleAhead(car, 14, true, -1)) { this.overT = 3.2; block = null; }
    else if (parkedAhead && this.wait > 4) { this.overT = 3.2; block = null; }
    if (block) {
      desired = 0;
      this.wait += dt;
      // two motors face to face: whoever waited longest (or at random) backs off
      const o = block.car;
      if (o && this.wait > 1.5 && (o.fx * car.fx + o.fz * car.fz) < -0.3 && this.R() < dt * 2) {
        this.revT = 1.6; this.revSteer = this.R() < 0.5 ? -1 : 1; this.wait = 0; this.overT = 0;
      }
      if (block.isPlayer && this.wait > 1.2 && car.honkT <= 0) { car.honkT = 3 + Math.random() * 2; world.honk(car); }
    } else this.wait = 0;
    const sp = car.speed;
    const throttle = sp < desired - 0.5 ? 1 : sp > desired + 0.5 ? -1 : 0;
    car.honkT -= dt;
    car.drive({ throttle, steer, brake: desired === 0 && sp > 0.5 }, dt);
    // un-stick: a driver wedged for too long reverses a bit
    if (Math.abs(car.speed) < 0.2 && !block) {
      this.stuck += dt;
      if (this.stuck > 2.5 && !(this.revT > 0)) { this.revT = 1.3; this.revSteer = -Math.sign(angDiff(want, car.h)) || 1; this.tries = (this.tries || 0) + 1; this.stuck = 0; }
      // still wedged after several tries: quietly put the motor back on its lane, out of sight
      if (this.tries > 4 && world.offscreen && world.offscreen(car)) {
        const p = lanePoint(this.a, this.b, Math.max(6, Math.min(L - jHalf - 2, t)));
        car.x = p.x; car.z = p.z; car.h = p.h; car.vx = car.vz = 0; this.tries = 0;
      }
    } else { this.stuck = 0; if (Math.abs(car.speed) > 2) this.tries = 0; }
  }
}

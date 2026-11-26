import * as THREE from 'three';
import { TYPES } from './models.js';
import { poolTexture } from '../render/textures.js';
import { collide } from '../core/physics.js';
import { groundY } from '../world/ground.js';
import { puddleAt } from '../render/textures.js';
import { XS, ZS, edgeClosed, xAt, zAt, CRESCENT, CRESCENT_MOUTHS, crescentPt, DIAGS } from '../world/map.js';

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

const RIM = new Map();
function rimmed(m) {
  if (RIM.has(m)) return RIM.get(m);
  const r = m.clone();
  r.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', `{
      float rim = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
      outgoingLight += vec3(0.30, 0.34, 0.44) * pow(rim, 2.6) * 0.55;
    }
    #include <opaque_fragment>`);
  };
  r.customProgramCacheKey = () => 'rim';
  RIM.set(m, r);
  return r;
}

export class Car {
  constructor(type, x, z, h) {
    const T = TYPES[type];
    Object.assign(this, { type, T, x, z, h, vx: 0, vz: 0, steer: 0, damage: 0, driver: null, passenger: null, honkT: 0, steam: 0, lastHit: 0 });
    this.g = T.build();
    this.g.userData.car = this;
    // a cool rim of light round the bodywork, so a black cab at night still shows its shape
    this.g.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) o.material = rimmed(o.material); });
    // split the motor into a sprung body and the wheels that stay on the road
    this.body = new THREE.Group(); this.body.name = 'body';
    for (const ch of [...this.g.children]) if (!ch.userData.isWheel) this.body.add(ch);
    this.g.add(this.body);
    // a red wash on the wet road behind, when the stop lamps are lit
    if (this.g.userData.tails) {
      if (!HELM.glowMat) { HELM.glowGeo = new THREE.PlaneGeometry(2.4, 2.0); HELM.glowGeo.rotateX(-Math.PI / 2); HELM.glowTex = poolTexture(); }
      const m = new THREE.MeshBasicMaterial({ map: HELM.glowTex, color: 0xff2a14, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
      this.stopGlow = new THREE.Mesh(HELM.glowGeo, m);
      this.stopGlow.position.set(0, 0.04, -T.len / 2 - 0.6); this.stopGlow.renderOrder = -1;
      this.g.add(this.stopGlow);
    }
    this.helm = steeringWheel(this.g.userData.seats && this.g.userData.seats.driver);
    if (this.helm) this.body.add(this.helm);
    this.len = T.len; this.wid = T.wid;
    this.r = T.wid / 2 + 0.05;
    // trafficators: an amber arm folded into each side pillar that flicks out to signal a turn
    if (!T.noDrive && type !== 'float') {
      const bb = new THREE.Box3().setFromObject(this.body), y = bb.min.y + (bb.max.y - bb.min.y) * 0.78;
      if (!HELM.tfMat) { HELM.tfMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.1, 0.2), toneMapped: false }); HELM.tfGeo = new THREE.BoxGeometry(0.3, 0.045, 0.045); HELM.tfGeo.translate(0.15, 0, 0); }
      this.tf = [-1, 1].map((sd) => {
        const p = new THREE.Group(); p.position.set(sd * (T.wid / 2 - 0.02), y, T.len * 0.06);
        const arm = new THREE.Mesh(HELM.tfGeo, HELM.tfMat); arm.scale.x = sd; p.add(arm);
        p.rotation.z = -sd * Math.PI / 2; this.body.add(p);
        return p;
      });
      this.signal = 0; this.sigOut = [0, 0];
    }
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
    // rolling resistance and air; flagstones and kerbs drag harder than the road
    const onPave = (this.y || 0) > 0.08;
    // (the extra pavement drag is felt at speed only: a heavy bus creeping back off a kerb must still be able to)
    const paveK = onPave ? 1 + 2 * Math.min(1, Math.abs(vf) / 4) : 1;
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), (0.35 + 0.0016 * vf * vf) * dt * (thr === 0 ? 1.6 : 1) * paveK);
    // changing up: the revs fall and the body rocks back on its springs for a moment
    const gear = Math.min(3, Math.floor(Math.max(0, vf) / 7));
    if (this.gear != null && gear > this.gear && thr > 0.3) this.pitchV = (this.pitchV || 0) + 0.22;
    this.gear = gear;
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
    let latMax = (ctl.brake ? 2.2 : T.grip * 1.15) / Math.sqrt(m) * 9.81 / 6; // m/s^2 the tyres will give
    // a standing puddle taken fast: the tyres float for a moment, the grip goes and the nose wanders
    const pud = !!this.driver && !onPave && Math.abs(vf) > 11 && puddleAt(this.x, this.z);
    if (pud) {
      latMax *= 0.3;
      // one twitch as the front wheels hit the water, this way or that
      if (!this._pud) this.yawRate += (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.2) * Math.abs(vf) / 20;
    }
    this._pud = pud;
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
    // circles along the body, close enough that no lamp post can slip between them (a bus needs five)
    const off = this.len / 2 - this.r;
    if (!this._cs || this._csLen !== this.len) {
      const n = Math.max(1, Math.ceil(2 * off / this.r));
      this._cs = [off, -off]; for (let i = 1; i < n; i++) this._cs.push(-off + (2 * off * i) / n);
      this._csLen = this.len;
    }
    let hit = null;
    for (const s of this._cs) {
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
    // trafficators: Teddy's go out when he leans on the wheel at town speeds; drivers signal their turns
    if (this.tf && dt > 0) {
      if (this.driver) {
        const want = Math.abs(this.steer) > 0.4 && Math.abs(this.speed) < 14 ? Math.sign(this.steer) : 0;
        if (want) { this.signal = want; this.sigHold = 0.8; } else if ((this.sigHold = (this.sigHold || 0) - dt) <= 0) this.signal = 0;
      }
      // (steer is positive to the left, and +x is a motor's left: arm k=1 is the nearside one)
      for (let k = 0; k < 2; k++) {
        const sd = k ? 1 : -1, on = this.signal === sd ? 1 : 0;
        this.sigOut[k] += (on - this.sigOut[k]) * Math.min(1, dt * 12);
        this.tf[k].rotation.z = -sd * Math.PI / 2 * (1 - this.sigOut[k]);
        this.tf[k].visible = this.sigOut[k] > 0.02;
      }
    }
    const gy = groundY(this.x, this.z);
    const dy = gy - this.y;
    if (Math.abs(dy) > 0.05 && dt > 0) {
      this.heaveV = (this.heaveV || 0) - dy * 4; // kerbs give a jolt
    }
    // the moment a wheel meets a kerb: mounting it scrubs off speed and kicks the nose up,
    // dropping off it bumps the tail
    const step = gy - (this._gy ?? gy); this._gy = gy;
    if (Math.abs(step) > 0.05 && dt > 0) {
      const sp = Math.abs(this.speed), dy = step;
      if (dy > 0 && sp > 2.5) { this.vx *= 0.86; this.vz *= 0.86; this.pitchV = (this.pitchV || 0) + 0.25; this.rollV = (this.rollV || 0) + (Math.random() - .5) * 0.3; this.onKerb && this.onKerb(sp); }
      else if (dy < 0 && sp > 2.5) this.pitchV = (this.pitchV || 0) - 0.12;
    }
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
      // stop lamps flare under the brakes
      const tails = this.g.userData.tails;
      if (tails) {
        const lit = (this.braking > 0 || (this.thr || 0) < -0.3 && this.speed > 0.5) ? 3.2 : this.driver || this.ai ? 1.0 : 0.25;
        if (lit !== this._tl) { this._tl = lit; for (const t of tails) t.material.color.setRGB(1 * lit, 0.19 * lit, 0.12 * lit); }
        if (this.stopGlow) { const o = lit > 2 ? 0.75 : lit > 0.5 ? 0.18 : 0; this.stopGlow.material.opacity += (o - this.stopGlow.material.opacity) * Math.min(1, dt * 12); this.stopGlow.visible = this.stopGlow.material.opacity > 0.01; }
      }
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
// Nodes are junction points. A junction where one street jogs (a dogleg) is two nodes, joined
// by a short run along the other street. Pevensey Crescent is a one-way chain of soft nodes.
// A car drives on the left of each street.
export const NODES = [];
const mk = (x, z, xw, zw, extra) => { const n = { x, z, xw, zw, adj: [], ...extra }; NODES.push(n); return n; };
const link = (a, b, both = true) => { if (!a.adj.includes(b)) a.adj.push(b); if (both && !b.adj.includes(a)) b.adj.push(a); };
const unlink = (a, b) => { a.adj = a.adj.filter((n) => n !== b); b.adj = b.adj.filter((n) => n !== a); };
const PORTS = [];
for (let i = 0; i < XS.length; i++) {
  PORTS[i] = [];
  for (let j = 0; j < ZS.length; j++) {
    const xn = xAt(i, j - 1), xs = xAt(i, j), zw = zAt(j, i - 1), ze = zAt(j, i);
    const W = XS[i].w, Wz = ZS[j].w;
    if (xn !== xs) {        // the north-south street jogs here
      const A = mk(xn, zw, W, Wz, { i, j }), B = mk(xs, zw, W, Wz, { i, j });
      link(A, B);
      PORTS[i][j] = { N: A, S: B, W: xn < xs ? A : B, E: xn < xs ? B : A };
    } else if (zw !== ze) { // the east-west street jogs here
      const A = mk(xn, zw, W, Wz, { i, j }), B = mk(xn, ze, W, Wz, { i, j });
      link(A, B);
      PORTS[i][j] = { W: A, E: B, N: zw < ze ? A : B, S: zw < ze ? B : A };
    } else {
      const A = mk(xn, zw, W, Wz, { i, j });
      PORTS[i][j] = { N: A, S: A, E: A, W: A };
    }
  }
}
for (let i = 0; i < XS.length; i++) for (let j = 0; j < ZS.length; j++) {
  if (j < ZS.length - 1 && !edgeClosed('x', i, j)) link(PORTS[i][j].S, PORTS[i][j + 1].N);
  if (i < XS.length - 1 && !edgeClosed('z', j, i)) link(PORTS[i][j].E, PORTS[i + 1][j].W);
}
// Pevensey Crescent: in at the north mouth, round the bend, out at the south mouth.
{
  const C = CRESCENT, r = (C.rIn + C.rOut) / 2, dov = 5, w = C.rOut - C.rIn;
  const [mz0, mz1] = [CRESCENT_MOUTHS[0], CRESCENT_MOUTHS[1]].map(([a, b]) => (a + b) / 2);
  const split = (a, b, z) => { const m = mk(a.x, z, a.xw, a.zw); unlink(a, b); link(a, m); link(m, b); return m; };
  const M1 = split(PORTS[dov][1].S, PORTS[dov][2].N, mz0), M2 = split(PORTS[dov][2].S, PORTS[dov][3].N, mz1);
  const n = 8, pm = 80 * Math.PI / 180;
  let prev = M1;
  for (let k = 0; k <= n; k++) {
    const [x, z] = crescentPt(r, -pm + 2 * pm * k / n);
    const a = mk(x, z, w, w, { soft: true, oneway: true });
    link(prev, a, false); prev = a;
  }
  link(prev, M2, false);
}
// Slant streets run junction to junction.
for (const D of DIAGS) {
  const near = (p) => NODES.reduce((m, n) => (Math.hypot(n.x - p[0], n.z - p[1]) < Math.hypot(m.x - p[0], m.z - p[1]) ? n : m));
  link(near(D.a), near(D.b));
}
export function neighbours(n) { return n.adj; }
export function streetWidth(a, b) { return Math.abs(a.x - b.x) < 0.01 ? a.xw : Math.abs(a.z - b.z) < 0.01 ? a.zw : Math.min(a.xw, b.xw, 9); }
// Point on the left-hand lane of the a->b street, t metres from a's centre.
export function lanePoint(a, b, t, side = 1) {
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L;
  const lx = uz, lz = -ux; // left of travel direction
  const off = b.oneway ? 0 : streetWidth(a, b) / 4 * side;
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
    let ns = neighbours(this.b).filter((n) => n !== this.a);
    // no hairpins where a slant street meets a straight one: a motor cannot swing round that tight
    const ax = this.b.x - this.a.x, az = this.b.z - this.a.z, la = Math.hypot(ax, az) || 1;
    const easy = ns.filter((n) => { const cx = n.x - this.b.x, cz = n.z - this.b.z; return (ax * cx + az * cz) / (la * (Math.hypot(cx, cz) || 1)) > -0.5; });
    if (easy.length) ns = easy;
    // an omnibus keeps to its route: past the bus stops where it can
    if (this.car.type === 'omnibus' && this.b.busTo && this.R() < 0.8) { const r = ns.filter((n) => this.b.busTo.includes(n)); if (r.length) ns = r; }
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
    const jHalf = this.b.soft ? 2.5 : Math.max(streetWidth(this.a, this.b), streetWidth(this.b, this.c)) / 2 + 3.5;
    // progress along the current street
    const ux = (this.b.x - this.a.x) / L, uz = (this.b.z - this.a.z) / L;
    const t = (car.x - this.a.x) * ux + (car.z - this.a.z) * uz;
    let goal;
    // put the trafficator out in good time for a turn at the next corner
    if (car.tf) {
      let sig = 0;
      if (t > L - 28 && !this.b.soft) {
        const cx = this.c.x - this.b.x, cz = this.c.z - this.b.z, lc = Math.hypot(cx, cz) || 1;
        const side = (cx * uz - cz * ux) / lc; // along the left of a->b
        if (Math.abs(side) > 0.5) sig = side > 0 ? 1 : -1;
      }
      car.signal = sig;
    }
    // overtaking a parked motor: borrow the other side of the road for a few seconds
    this.overT = Math.max(0, (this.overT || 0) - dt);
    // told to make way by a horn behind: tuck in to the kerb and dawdle for a few seconds
    this.yieldT = Math.max(0, (this.yieldT || 0) - dt);
    const side = this.overT > 0 ? -1 : this.yieldT > 0 || this.stopAt ? 1.6 : 1;
    if (this.b.soft || (this.a.soft && this.b.oneway)) {
      // round a bend of short chords: chase a point a fixed distance ahead along the chain itself
      const look = 6, Lc = Math.hypot(this.c.x - this.b.x, this.c.z - this.b.z);
      goal = t + look <= L ? lanePoint(this.a, this.b, t + look) : lanePoint(this.b, this.c, Math.min(Lc, t + look - L));
      if (t >= L - 0.5) { this.a = this.b; this.b = this.c; this.pickNext(); this.best = Infinity; }
    } else if (t < L - jHalf) {
      // a long bus looks further up the road, so it does not oversteer back onto the kerb after a turn
      goal = lanePoint(this.a, this.b, Math.min(L - jHalf, t + 7 + Math.max(0, car.len - 4.5)), side);
    } else {
      // through the junction to the next street's lane
      // (never past the end of the next street: the jog of a dogleg is only a few metres long)
      goal = lanePoint(this.b, this.c, Math.min(jHalf + 2, Math.hypot(this.c.x - this.b.x, this.c.z - this.b.z)));
      const d = Math.hypot(goal.x - car.x, goal.z - car.z);
      if (d < 4.5) { this.a = this.b; this.b = this.c; this.pickNext(); this.best = Infinity; }
    }
    const want = Math.atan2(goal.x - car.x, goal.z - car.z);
    const steer = clamp(angDiff(want, car.h) * 2.2, -1, 1);
    let desired = car.T.maxV * this.target * (Math.abs(steer) > 0.5 ? 0.45 : 1) * (this.yieldT > 0 ? 0.35 : 1);
    // a cab drawing in for a fare: ease down to stop alongside them
    if (this.stopAt) {
      const ahead = (this.stopAt.x - car.x) * car.fx + (this.stopAt.z - car.z) * car.fz;
      desired = Math.min(desired, ahead < 0.6 ? 0 : Math.max(1.2, ahead * 0.7));
    }
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
      if (this.stuck > 2.5 && !(this.revT > 0)) {
        this.tries = (this.tries || 0) + 1; this.stuck = 0;
        const rs = -Math.sign(angDiff(want, car.h)) || 1;
        this.revT = 1.3 + 0.3 * Math.min(this.tries, 4); this.revSteer = [rs, 0, -rs][(this.tries - 1) % 3];
      }
      // still wedged after several tries: quietly put the motor back on its lane, out of sight
      if (this.tries > 4 && world.offscreen && world.offscreen(car)) {
        const p = lanePoint(this.a, this.b, Math.max(6, Math.min(L - jHalf - 2, t)));
        car.x = p.x; car.z = p.z; car.h = p.h; car.vx = car.vz = 0; this.tries = 0;
      }
    } else { this.stuck = 0; if (Math.abs(car.speed) > 2) this.tries = 0; }
    // grinding along a wall or a kerb post makes no progress even though the wheels turn
    const dB = Math.hypot(this.b.x - car.x, this.b.z - car.z);
    if (!(dB < (this.best ?? Infinity) - 0.5)) this.noProg = (this.noProg || 0) + (block ? 0 : dt);
    else { this.best = dB; this.noProg = 0; }
    if (this.noProg > 6 && !(this.revT > 0)) {
      this.noProg = 0; this.best = Infinity; this.tries = (this.tries || 0) + 1;
      // back out with the wheels turned for the goal; if that has failed, try them straight, then the other way
      // (a nose that has slipped past a lamp post has to come straight back before it can turn)
      const rs = -Math.sign(angDiff(want, car.h)) || 1;
      this.revT = 1.3 + 0.3 * Math.min(this.tries, 4); this.revSteer = [rs, 0, -rs][(this.tries - 1) % 3];
      if (this.tries > 3 && world.offscreen && world.offscreen(car)) {
        const p = lanePoint(this.a, this.b, Math.max(6, Math.min(L - jHalf - 2, t)));
        car.x = p.x; car.z = p.z; car.h = p.h; car.vx = car.vz = 0; this.tries = 0; this.revT = 0;
      }
    }
  }
}

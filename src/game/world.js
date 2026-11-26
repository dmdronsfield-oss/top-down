import * as THREE from 'three';
import { Actor, Walker, RINGS } from '../people/actor.js';
import { CAST, pedestrianSpec, play } from '../people/cast.js';
import { Car, Driver, NODES, neighbours, lanePoint, angDiff } from '../vehicles/car.js';
import { XS, ZS, PLACES, onRoad, BOUNDS } from '../world/map.js';
import { rng } from '../render/textures.js';
import { collide, blocked } from '../core/physics.js';
import { input } from '../core/input.js';
import { groundY } from '../world/ground.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

// Everyone and everything that moves.
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

export class World {
  constructor(scene, quality, hooks) {
    this.scene = scene; this.quality = quality; this.hooks = hooks;
    this.R = rng(1934);
    this.actors = []; this.walkers = []; this.cars = []; this.drivers = [];
    this.cam = { yaw: 0, dist: 15, x: 0, z: 0, shake: 0, wantYaw: 0 };
  }

  spawn() {
    const R = this.R, q = this.quality;
    // Teddy
    const f = PLACES.flat;
    this.player = new Actor(CAST.teddy, f.x + 1.2, f.z, -Math.PI / 2, this.scene);
    this.player.isPlayer = true;
    this.player.r = 0.3;
    this.player.car = null;
    // Teddy's own two-seater, outside the flat
    this.myCar = this.addCar('roadster', -46.4, f.z + 5, Math.PI);
    this.myCar.mine = true;
    // pedestrians
    const nPed = q === 'high' ? 70 : q === 'medium' ? 50 : 28;
    for (let i = 0; i < nPed; i++) this.addPedestrian();
    // traffic
    const nCar = q === 'high' ? 22 : q === 'medium' ? 16 : 9;
    const kinds = ['taxi', 'taxi', 'omnibus', 'saloon', 'saloonGreen', 'van', 'roadsterBlue', 'saloon', 'omnibus', 'taxi', 'van', 'omnibus'];
    for (let i = 0; i < nCar; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const a = NODES[Math.floor(R() * NODES.length)];
        const ns = neighbours(a); const b = ns[Math.floor(R() * ns.length)];
        if (!b || a.soft || Math.hypot(b.x - a.x, b.z - a.z) < 40) continue;
        const p = lanePoint(a, b, 14 + R() * 20);
        if (this.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 12)) continue;
        if (Math.hypot(p.x - this.player.x, p.z - this.player.z) < 18) continue;
        const c = this.addCar(kinds[i % kinds.length], p.x, p.z, p.h);
        c.ai = new Driver(c, a, b, R);
        c.driverActor = null;
        this.drivers.push(c.ai);
        break;
      }
    }
    // parked motors along the kerbs (some can be borrowed)
    const parked = [
      ['taxi', 25, 104.6, -Math.PI / 2, true], ['taxi', 31, 104.6, -Math.PI / 2, true], ['taxi', 37, 104.6, -Math.PI / 2, true],
      ['saloon', -88, -45.6, Math.PI / 2], ['van', 47.2, -32, Math.PI], ['saloonGreen', -2.7, -70, 0], ['roadsterBlue', 97, 30, 0],
      ['float', -75, 20, 0], ['saloon', 70, 95.4, Math.PI / 2], ['taxi', -147, 20, Math.PI],
    ];
    for (const [k, x, z, h, rank] of parked) { const c = this.addCar(k, x, z, h); c.parked = true; if (rank) c.rank = true; }
    this.milkFloat = this.cars.find((c) => c.type === 'float');
    // headlamp for the player's motor
    this.headlamp = new THREE.SpotLight(0xfff0c8, 0, 34, 0.55, 0.6, 1.2);
    this.scene.add(this.headlamp); this.scene.add(this.headlamp.target);
  }

  addCar(type, x, z, h) {
    const c = new Car(type, x, z, h);
    c.onHit = (imp, what) => this.hooks.carHit && this.hooks.carHit(c, imp, what);
    this.scene.add(c.g);
    this.cars.push(c);
    return c;
  }

  addPedestrian(spec) {
    const R = this.R;
    const ring = RINGS[Math.floor(R() * RINGS.length)];
    const k = Math.floor(R() * 4), p = ring.c[k], p2 = ring.c[(k + 1) % 4], t = R();
    const x = p[0] + (p2[0] - p[0]) * t, z = p[1] + (p2[1] - p[1]) * t;
    const a = new Actor(spec || pedestrianSpec(R), x, z, 0, this.scene);
    a.kind = a.spec.kind;
    const w = new Walker(a, ring, (k + 1) % 4, 1, R);
    a.walker = w;
    this.actors.push(a); this.walkers.push(w);
    // now and then a couple, walking out together
    if (!spec && R() < 0.2) {
      const b = new Actor(pedestrianSpec(R), x + 0.7, z, 0, this.scene);
      b.kind = b.spec.kind;
      const wb = new Walker(b, ring, (k + 1) % 4, 1, R);
      wb.leader = w; b.walker = wb;
      this.actors.push(b); this.walkers.push(wb);
    }
    return a;
  }

  addActor(spec, x, z, ang) {
    const a = new Actor(spec, x, z, ang, this.scene);
    this.actors.push(a);
    return a;
  }

  // ---------------------------------------------------------------- queries
  nearestCar(x, z, maxD, filter) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      if (filter && !filter(c)) continue;
      const d = Math.hypot(c.x - x, c.z - z) - c.len * 0.35;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  // Something in the lane ahead of a car?
  // skipParked: ignore stationary, driverless motors (we are overtaking them).
  // lane: 0 tests straight ahead; -1 tests the oncoming lane (to the right).
  obstacleAhead(car, range, skipParked = false, lane = 0) {
    const fx = car.fx, fz = car.fz;
    const shift = lane === -1 ? 3 : 0; // right of travel is (-fz, fx)
    const ox = car.x - fz * shift, oz = car.z + fx * shift;
    const test = (x, z, r) => {
      const dx = x - ox, dz = z - oz;
      const along = dx * fx + dz * fz;
      if (along < car.len * 0.3 || along > range + car.len / 2) return false;
      const side = Math.abs(dx * fz - dz * fx);
      return side < car.wid / 2 + r + 0.4;
    };
    for (const c of this.cars) {
      if (c === car) continue;
      if (skipParked && !c.ai && c !== this.player.car && Math.abs(c.speed) < 0.5) continue;
      if (test(c.x, c.z, c.wid / 2)) return { car: c, isPlayer: c === this.player.car };
    }
    const p = this.player;
    if (!p.car && test(p.x, p.z, 0.4)) return { isPlayer: true };
    for (const w of this.walkers) if (w.a.visible && onRoad(w.a.x, w.a.z) && test(w.a.x, w.a.z, 0.5)) return { ped: w.a };
    for (const a of this.extras || []) if (test(a.x, a.z, 0.5)) return { ped: a };
    return null;
  }
  offscreen(o) { const p = this.player, q = p.car || p; return Math.hypot(o.x - q.x, o.z - q.z) > 45; }
  honk(car) { this.hooks.honk && this.hooks.honk(car); }

  // ---------------------------------------------------------------- player
  updatePlayer(dt, ctlEnabled) {
    const p = this.player, cam = this.cam;
    if (p.car) return this.drivePlayer(dt, ctlEnabled);
    const ax = ctlEnabled ? input.axis() : { x: 0, y: 0 };
    const run = ctlEnabled && input.held('run');
    if (p.busy > 0) { p.speed = 0; }
    else if (ax.x || ax.y) {
      const y = cam.yaw;
      const fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      let mx = fx * ax.y + rx * ax.x, mz = fz * ax.y + rz * ax.x;
      const l = Math.hypot(mx, mz); mx /= l; mz /= l;
      const sp = (run ? 5.6 : 2.4) * (p.slow || 1);
      p.stepTo(p.x + mx, p.z + mz, sp, dt, run);
    } else p.speed = 0;
    if (ctlEnabled) {
      if (input.held('camL')) cam.yaw += dt * 1.6;
      if (input.held('camR')) cam.yaw -= dt * 1.6;
    }
  }

  drivePlayer(dt, ctlEnabled) {
    const c = this.player.car;
    const ax = ctlEnabled ? input.axis() : { x: 0, y: 0 };
    c.drive({ throttle: ax.y, steer: -ax.x, brake: ctlEnabled && input.held('brake') }, dt);
    this.player.x = c.x; this.player.z = c.z;
  }

  enterCar(c) {
    const p = this.player;
    p.car = c;
    c.driver = 'player';
    if (c.ai) { // turf out the driver
      const i = this.drivers.indexOf(c.ai); if (i >= 0) this.drivers.splice(i, 1);
      c.ai = null;
      const spec = c.type === 'taxi' ? CAST.cabbie : pedestrianSpec(this.R);
      const side = { x: c.x + Math.cos(c.h) * 1.6, z: c.z - Math.sin(c.h) * 1.6 };
      const a = this.addPedestrian(spec);
      a.x = side.x; a.z = side.z;
      collide(a, 0.4);
      a.oneShot('Wave', 1.8);
      a.indignant = 6;
      this.hooks.carTaken && this.hooks.carTaken(c, a);
    } else if (!c.mine) this.hooks.carTaken && this.hooks.carTaken(c, null);
    c.parked = false;
    this.seat(p, c, 'driver');
  }

  seat(actor, car, which) {
    const s = car.g.userData.seats[which];
    actor.g.removeFromParent();
    (car.body || car.g).add(actor.g);
    actor.g.position.set(s[0], s[1] - (car.g.userData.open ? 0.62 : 0.78), s[2]);
    actor.g.rotation.set(0, 0, 0);
    for (const m of actor.fig.meshes) if (m.userData.slot === 'Feet') m.visible = false;
    actor.seated = car;
    actor.seatAnim = actor.fig.actions.Drive && which === 'driver' ? 'Drive' : actor.fig.actions.Sit ? 'Sit' : actor.idleAnim;
    actor.speed = 0; actor.busy = 0;
    play(actor.fig, actor.seatAnim, 0.1);
  }
  unseat(actor, x, z) {
    actor.g.removeFromParent();
    this.scene.add(actor.g);
    for (const m of actor.fig.meshes) m.visible = true;
    actor.seated = null;
    actor.x = x; actor.z = z;
    collide(actor, 0.4);
    actor.sync(1);
  }
  leaveCar() {
    const p = this.player, c = p.car;
    if (!c) return;
    c.driver = null;
    p.car = null;
    const lx = Math.cos(c.h), lz = -Math.sin(c.h);
    let x = c.x + lx * 1.7, z = c.z + lz * 1.7;
    if (blocked(x, z, 0.35)) { x = c.x - lx * 1.7; z = c.z - lz * 1.7; }
    this.unseat(p, x, z);
    p.ang = c.h;
    c.parked = true;
    this.hooks.leftCar && this.hooks.leftCar(c, x, z);
  }

  // ---------------------------------------------------------------- per frame
  update(dt, ctlEnabled) {
    this.updatePlayer(dt, ctlEnabled);
    for (const d of this.drivers) d.update(dt, this);
    for (const c of this.cars) {
      if (!c.ai && c !== this.player.car) {
        // parked or abandoned: roll to a stop
        c.drive({ throttle: 0, steer: 0, brake: true }, dt);
      }
      c.sync(dt);
    }
    this.carCarCollisions();
    for (const w of this.walkers) w.update(dt);
    this.dodgeCars(dt);
    const cx = this.cam.x, cz = this.cam.z;
    for (const a of this.actors) {
      if (a.seated) { a.animate(dt, cx, cz); continue; }
      a.animate(dt, cx, cz); a.sync(dt);
    }
    const p = this.player;
    if (!p.seated) { p.animate(dt, cx, cz); p.sync(dt); } else p.animate(dt, cx, cz);
    // headlamp on the player's motor
    const c = p.car;
    if (c) {
      this.headlamp.intensity = 60;
      this.headlamp.position.set(c.x + c.fx * 2, 1.2, c.z + c.fz * 2);
      this.headlamp.target.position.set(c.x + c.fx * 14, 0, c.z + c.fz * 14);
    } else this.headlamp.intensity = 0;
  }

  carCarCollisions() {
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
      const R = (a.len + b.len) / 2;
      if (d2 > R * R) continue;
      // test the two circle chains
      for (const sa of [-1, 0, 1]) for (const sb of [-1, 0, 1]) {
        const ax = a.x + a.fx * sa * (a.len / 2 - a.r), az = a.z + a.fz * sa * (a.len / 2 - a.r);
        const bx = b.x + b.fx * sb * (b.len / 2 - b.r), bz = b.z + b.fz * sb * (b.len / 2 - b.r);
        const ex = bx - ax, ez = bz - az, d = Math.hypot(ex, ez), rr = a.r + b.r;
        if (d >= rr || d < 1e-4) continue;
        const nx = ex / d, nz = ez / d, pen = rr - d;
        const ma = a.T.mass, mb = b.T.mass, ta = mb / (ma + mb), tb = ma / (ma + mb);
        a.x -= nx * pen * ta; a.z -= nz * pen * ta; b.x += nx * pen * tb; b.z += nz * pen * tb;
        const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (rv < 0) {
          const jimp = -1.4 * rv / (1 / ma + 1 / mb);
          a.vx -= jimp * nx / ma; a.vz -= jimp * nz / ma; b.vx += jimp * nx / mb; b.vz += jimp * nz / mb;
          if (-rv > 3) { a.damage += -rv * 0.5; b.damage += -rv * 0.5; if (-rv > 5) { a.dent(-rv); b.dent(-rv); } this.hooks.carHit && this.hooks.carHit(a, -rv, b); }
        }
      }
    }
  }

  // People leap out of the way of motors; a slow one gets knocked over.
  dodgeCars(dt) {
    const pc = this.player.car;
    for (const c of this.cars) {
      const sp = c.speed;
      if (Math.abs(sp) < 2.5) continue;
      for (const a of this.actors) {
        if (a.seated || a.busy > 0 || !a.visible) continue;
        const dx = a.x - c.x, dz = a.z - c.z;
        const along = (dx * c.fx + dz * c.fz) * Math.sign(sp);
        const side = dx * c.fz - dz * c.fx;
        if (along > -c.len / 2 && along < c.len / 2 + 0.4 && Math.abs(side) < c.wid / 2 + 0.3) {
          a.knockDown();
          c.vx *= 0.7; c.vz *= 0.7;
          this.hooks.pedHit && this.hooks.pedHit(c, a);
        } else if (along > 0 && along < 4 + Math.abs(sp) * 0.5 && Math.abs(side) < c.wid / 2 + 0.7 && c === pc) {
          // dive aside
          const s = side >= 0 ? 1 : -1;
          a.ang = Math.atan2(c.fz * s, -c.fx * s);
          a.oneShot('Roll', 1.0, 0.05);
          a.dive = { vx: c.fz * s * 3.5, vz: -c.fx * s * 3.5, t: 0.6 };
          this.hooks.pedDive && this.hooks.pedDive(a);
        }
      }
    }
    for (const a of this.actors) if (a.dive) {
      a.x += a.dive.vx * dt; a.z += a.dive.vz * dt; collide(a, a.r);
      a.dive.t -= dt; if (a.dive.t <= 0) a.dive = null;
    }
  }

  // ---------------------------------------------------------------- camera
  updateCamera(camera, dt) {
    const p = this.player, cam = this.cam;
    let tx = p.x, tz = p.z, want = 13;
    if (p.car) {
      const c = p.car, sp = c.speed;
      // swing behind the bonnet
      const behind = c.h + Math.PI;
      const k = Math.min(1, dt * (Math.abs(sp) > 2 ? 2.2 : 0.6));
      if (Math.abs(sp) > 1) cam.yaw += angDiff(sp >= 0 ? behind : c.h, cam.yaw) * k;
      tx += c.vx * 0.55; tz += c.vz * 0.55;
      // look into the bend, and sit back a touch under hard acceleration
      const yr = c.yawRate || 0, lx = c.fz, lz = -c.fx;
      cam.lead = (cam.lead || 0) + (clampN(yr * sp * 0.35, -5, 5) - (cam.lead || 0)) * Math.min(1, dt * 2);
      tx += lx * cam.lead; tz += lz * cam.lead;
      cam.surge = (cam.surge || 0) + (clampN(-(c.ax || 0) * 0.25, -2.5, 2.5) - (cam.surge || 0)) * Math.min(1, dt * 3);
      want = 14 + Math.abs(sp) * 0.5 + cam.surge;
    }
    cam.dist += (want - cam.dist) * Math.min(1, dt * 1.5);
    cam.x += (tx - cam.x) * Math.min(1, dt * 6);
    cam.z += (tz - cam.z) * Math.min(1, dt * 6);
    const d = cam.dist, h = d * 1.62; // high enough to see over most roofs
    let sx = 0, sz = 0;
    if (cam.shake > 0) { cam.shake -= dt; sx = (Math.random() - .5) * cam.shake; sz = (Math.random() - .5) * cam.shake; }
    camera.position.set(cam.x + Math.sin(cam.yaw) * d + sx, h, cam.z + Math.cos(cam.yaw) * d + sz);
    camera.lookAt(cam.x, 1.0, cam.z);
  }
}

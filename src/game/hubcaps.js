import * as THREE from 'three';
import { toon, inked } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';
import { collide } from '../core/physics.js';
import { groundY } from '../world/ground.js';
import { sfx } from '../audio/sfx.js';

// A good knock and a hubcap comes off: it bowls away up the street on its edge, curving as it slows,
// bounces off whatever it meets, then wobbles down in a rising rattle and lies there, as hubcaps do.

const R = 0.21, MAX = 4;
const REMARKS = [
  ['goodForm', 'A hubcap has left the motor. It will not be coming back. Nor should it.'],
  ['logic', 'Something round and silver is overtaking you. It was recently part of the car.'],
  ['nerve', 'Shed a hubcap. Lighter now. Faster, probably.'],
];

export class Hubcaps {
  constructor(G) {
    this.G = G; this.caps = []; this.cool = 0; this.said = 0;
    this.geo = new THREE.CylinderGeometry(R, R, 0.035, 16);
    this.boss = new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    this.mat = patchCutout(toon('#cfcabd'));
  }
  pop(car, imp) {
    if (this.cool > 0 || imp < 7 || Math.random() < 0.35) return;
    this.cool = 6;
    const side = Math.random() < 0.5 ? 1 : -1, end = Math.random() < 0.6 ? 1 : -1;
    const lx = car.fz, lz = -car.fx;
    const x = car.x + car.fx * car.len * 0.3 * end + lx * (car.wid / 2 + 0.1) * side;
    const z = car.z + car.fz * car.len * 0.3 * end + lz * (car.wid / 2 + 0.1) * side;
    const vx = car.vx * 0.85 + lx * side * (1.5 + Math.random() * 1.5), vz = car.vz * 0.85 + lz * side * (1.5 + Math.random() * 1.5);
    if (Math.hypot(vx, vz) < 2) return;
    const yaw = new THREE.Group(), lean = new THREE.Group(), spin = new THREE.Group();
    const disc = inked(this.geo, this.mat, 0.01); disc.rotation.z = Math.PI / 2;
    const boss = new THREE.Mesh(this.boss, this.mat); boss.rotation.z = -Math.PI / 2; boss.position.x = 0.018;
    spin.add(disc, boss); lean.add(spin); yaw.add(lean);
    this.G.scene.add(yaw);
    this.caps.push({ g: yaw, lean, spin, x, z, vx, vz, a: 0, tilt: (Math.random() - 0.5) * 0.1, curl: (Math.random() - 0.5) * 0.6, phase: 'roll', t: 0, life: 70 });
    if (this.caps.length > MAX) { const o = this.caps.shift(); this.G.scene.remove(o.g); }
    sfx.clink(0, 1.2); sfx.clink(0.07, 0.8);
    if (this.said < 2 && Math.random() < (this.said ? 0.3 : 1)) { this.said++; const [k, s] = REMARKS[Math.floor(Math.random() * REMARKS.length)]; this.G.voice(k, s); }
  }
  update(dt) {
    this.cool -= dt;
    const p = this.G.world.player;
    for (let i = this.caps.length - 1; i >= 0; i--) {
      const c = this.caps[i];
      c.life -= dt;
      if (c.life <= 0) { this.G.scene.remove(c.g); this.caps.splice(i, 1); continue; }
      let heading = Math.atan2(c.vx, c.vz);
      if (c.phase === 'roll') {
        let sp = Math.hypot(c.vx, c.vz);
        // rolling: slows gently, and curls the way it leans
        sp = Math.max(0, sp - dt * (0.9 + sp * 0.05));
        heading += c.curl * dt * (1.5 / Math.max(1, sp));
        c.vx = Math.sin(heading) * sp; c.vz = Math.cos(heading) * sp;
        const bx = c.x + c.vx * dt, bz = c.z + c.vz * dt;
        c.x = bx; c.z = bz;
        collide(c, R);
        const nx = c.x - bx, nz = c.z - bz, nl = Math.hypot(nx, nz);
        if (nl > 1e-4) {
          const ux = nx / nl, uz = nz / nl, dot = c.vx * ux + c.vz * uz;
          if (dot < 0) { c.vx = (c.vx - 2 * dot * ux) * 0.55; c.vz = (c.vz - 2 * dot * uz) * 0.55; if (Math.hypot(p.x - c.x, p.z - c.z) < 30) sfx.clink(0, 0.9); }
        }
        c.a += sp / R * dt;
        c.tilt += (c.curl * 0.25 - c.tilt) * dt;
        if (sp < 0.7) {
          c.phase = 'wobble'; c.t = 0; c.prec = heading;
          if (Math.hypot(p.x - c.x, p.z - c.z) < 30) for (let k = 0, at = 0, gap = 0.22; k < 11; k++, gap *= 0.78) { at += gap; sfx.clink(at, 0.9 - k * 0.05); }
        }
        c.g.rotation.y = heading;
      } else if (c.phase === 'wobble') {
        // Euler's disc: it leans further and spins round faster until it slaps down flat
        c.t += dt;
        const k = Math.min(1, c.t / 1.6);
        c.tilt = Math.sign(c.curl || 1) * (0.2 + k * k * (Math.PI / 2 - 0.2));
        c.prec += dt * (3 + k * 22);
        c.x += c.vx * dt * (1 - k); c.z += c.vz * dt * (1 - k);
        c.g.rotation.y = c.prec;
        if (k >= 1) c.phase = 'flat';
      }
      c.lean.rotation.z = c.tilt;
      c.spin.rotation.x = c.a;
      c.g.position.set(c.x, groundY(c.x, c.z) + R * Math.cos(c.tilt) + 0.02 * Math.abs(Math.sin(c.tilt)), c.z);
    }
  }
}

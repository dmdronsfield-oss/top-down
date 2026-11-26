import * as THREE from 'three';
import { puddleAt } from './textures.js';

// Wet-street effects for motors: tyre marks, spray, and steam from hurt radiators.

function softDot() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// A pool of additive points; colour fades to black, which fades them out.
class Puffs {
  constructor(scene, n, size, tex) {
    this.n = n; this.i = 0;
    this.p = new Float32Array(n * 3); this.c = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n); this.col = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.geo = geo;
    const m = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
    this.pts = new THREE.Points(geo, m); this.pts.frustumCulled = false; scene.add(this.pts);
    for (let k = 0; k < n; k++) this.p[k * 3 + 1] = -99;
  }
  emit(x, y, z, vx, vy, vz, life, r, g, b) {
    const k = this.i; this.i = (this.i + 1) % this.n;
    this.p.set([x, y, z], k * 3); this.v.set([vx, vy, vz], k * 3); this.col.set([r, g, b], k * 3);
    this.life[k] = life; this.max[k] = life;
  }
  update(dt, drag = 1.5, rise = 0) {
    for (let k = 0; k < this.n; k++) {
      if (this.life[k] <= 0) { this.c[k * 3] = this.c[k * 3 + 1] = this.c[k * 3 + 2] = 0; continue; }
      this.life[k] -= dt;
      const o = k * 3, f = Math.max(0, this.life[k] / this.max[k]);
      this.v[o + 1] += rise * dt;
      const d = Math.exp(-drag * dt);
      this.v[o] *= d; this.v[o + 1] *= d; this.v[o + 2] *= d;
      this.p[o] += this.v[o] * dt; this.p[o + 1] += this.v[o + 1] * dt; this.p[o + 2] += this.v[o + 2] * dt;
      if (this.p[o + 1] < 0.05 && rise <= 0) { this.p[o + 1] = 0.05; this.v[o + 1] = 0; }
      const a = f * f;
      this.c[o] = this.col[o] * a; this.c[o + 1] = this.col[o + 1] * a; this.c[o + 2] = this.col[o + 2] * a;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

// Tyre marks: dark quads laid on the wet road that slowly dry away.
class Marks {
  constructor(scene, n) {
    this.n = n; this.i = 0; this.age = new Float32Array(n);
    const geo = new THREE.PlaneGeometry(0.22, 1); geo.rotateX(-Math.PI / 2);
    this.mat = new THREE.MeshBasicMaterial({ color: 0x050407, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, n); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.pv = new THREE.Vector3();
    for (let k = 0; k < n; k++) { this.m4.makeScale(0, 0, 0); this.mesh.setMatrixAt(k, this.m4); }
    scene.add(this.mesh);
  }
  lay(x0, z0, x1, z1, y) {
    const len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.05 || len > 3) return;
    const k = this.i; this.i = (this.i + 1) % this.n;
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(x1 - x0, z1 - z0));
    this.pv.set((x0 + x1) / 2, y + 0.012, (z0 + z1) / 2); this.s.set(1, 1, len);
    this.m4.compose(this.pv, this.q, this.s); this.mesh.setMatrixAt(k, this.m4);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export function makeFx(scene, quality) {
  const tex = softDot();
  const low = quality === 'low';
  const spray = new Puffs(scene, low ? 200 : 600, 0.35, tex);
  const steam = new Puffs(scene, low ? 120 : 300, 1.3, tex);
  const marks = new Marks(scene, low ? 300 : 900);
  const sheet = new Puffs(scene, low ? 160 : 420, 0.8, tex); // puddle water, thrown up and falling back
  const last = new WeakMap(), splashT = new WeakMap();
  return {
    update(dt, cars, groundY, cx, cz, onSplash) {
      for (const c of cars) {
        if (Math.abs(c.x - cx) > 60 || Math.abs(c.z - cz) > 60) { last.delete(c); continue; }
        const sp = Math.abs(c.speed), fx = c.fx, fz = c.fz, lx = fz, lz = -fx;
        const rear = -c.len * 0.3, half = c.wid * 0.42;
        const wheels = [[-half, rear], [half, rear]].map(([s, f]) => [c.x + fx * f + lx * s, c.z + fz * f + lz * s]);
        // tyre marks when sliding or locking up
        const skid = (c.slide || 0) > 1.4 || ((c.braking || 0) > 0 && sp > 6);
        const prev = last.get(c);
        if (skid && prev) for (let k = 0; k < 2; k++) marks.lay(prev[k][0], prev[k][1], wheels[k][0], wheels[k][1], c.y || 0);
        last.set(c, skid ? wheels : null);
        // spray from the tyres
        if (sp > 6 && Math.random() < dt * sp * (skid ? 3 : 1.2)) {
          const [wx, wz] = wheels[Math.random() < .5 ? 0 : 1];
          spray.emit(wx, 0.25, wz, -c.vx * 0.25 + (Math.random() - .5), 0.8 + Math.random() * 1.2, -c.vz * 0.25 + (Math.random() - .5), 0.6, 0.55, 0.6, 0.7);
        }
        // through a puddle at speed: a sheet of water thrown up from both front wheels
        const st = (splashT.get(c) || 0) - dt; splashT.set(c, st);
        if (sp > 5 && st <= 0 && (groundY(c.x, c.z) < 0.05)) {
          const front = c.len * 0.3, px = c.x + fx * front, pz = c.z + fz * front;
          if (puddleAt(px, pz)) {
            const k = Math.min(1.6, sp / 12);
            splashT.set(c, 0.45);
            for (const s of [-1, 1]) {
              const wx = px + lx * half * s, wz = pz + lz * half * s;
              for (let i = 0; i < (low ? 10 : 22) * k; i++) {
                const out = (1.5 + Math.random() * 3) * k * s, fwd = sp * (0.15 + Math.random() * 0.35);
                sheet.emit(wx, 0.2, wz, lx * out + fx * fwd, (2.2 + Math.random() * 3.2) * k, lz * out + fz * fwd, 0.7 + Math.random() * 0.4, 0.5, 0.56, 0.68);
              }
            }
            onSplash && onSplash(c, px, pz, k);
          }
        }
        // exhaust: a blue-grey puff when the throttle is opened hard from low speed
        if ((c.thr || 0) > 0.6 && sp < 9 && Math.random() < dt * 14) {
          const ex = c.x - fx * c.len * 0.5 + lx * c.wid * 0.25, ez = c.z - fz * c.len * 0.5 + lz * c.wid * 0.25;
          steam.emit(ex, (c.y || 0) + 0.35, ez, -fx * 1.2 + (Math.random() - .5) * 0.4, 0.3 + Math.random() * 0.3, -fz * 1.2 + (Math.random() - .5) * 0.4, 1.1, 0.34, 0.35, 0.4);
        }
        // a hurt radiator steams
        const rad = c.g.userData.radiator;
        if (rad && c.damage > 25 && Math.random() < dt * Math.min(14, (c.damage - 20) * 0.25)) {
          const h = c.h, cs = Math.cos(h), sn = Math.sin(h);
          const x = c.x + rad.x * cs + rad.z * sn, z = c.z - rad.x * sn + rad.z * cs;
          steam.emit(x, (c.y || 0) + rad.y, z, (Math.random() - .5) * 0.6 + c.vx * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - .5) * 0.6 + c.vz * 0.3, 2.2, 0.5, 0.5, 0.52);
        }
      }
      spray.update(dt, 1.0);
      sheet.update(dt, 0.6, -9);
      steam.update(dt, 1.2, 0.4);
    },
  };
}

// London particular: slow banks of mist drifting at head height round the camera.
export function makeMist(scene, quality) {
  const N = quality === 'low' ? 0 : quality === 'high' ? 90 : 60;
  const pos = new Float32Array(Math.max(N, 1) * 3);
  const R = 55;
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 2 * R; pos[i * 3 + 1] = 0.8 + Math.random() * 3.5; pos[i * 3 + 2] = (Math.random() - .5) * 2 * R; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ size: 16, map: softDot(), color: 0x8a92aa, transparent: true, opacity: 0.09, depthWrite: false, sizeAttenuation: true });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 2; scene.add(pts);
  let ox = 0, oz = 0;
  return {
    update(dt, cx, cz) {
      if (!N) return;
      ox += dt * 0.6; oz += dt * 0.25;
      for (let i = 0; i < N; i++) {
        let x = pos[i * 3] + dt * 0.6, z = pos[i * 3 + 2] + dt * 0.25;
        // wrap round the camera
        if (x - cx > R) x -= 2 * R; if (x - cx < -R) x += 2 * R;
        if (z - cz > R) z -= 2 * R; if (z - cz < -R) z += 2 * R;
        pos[i * 3] = x; pos[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

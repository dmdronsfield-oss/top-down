import { lanePoint, streetWidth } from '../vehicles/car.js';
import { onRoad } from '../world/map.js';

// Hailing a cab: someone on the pavement steps to the kerb and waves, a taxi coming up the street draws in
// and stops beside them, they climb in (and are gone), and the cab pulls away. One at a time, near Teddy.
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const DRIVER = ['Where to, guv?', 'Hop in, sir.', 'Right you are, madam.', 'Savoy? Lovely.'];

export class CabHail {
  constructor(G) { this.G = G; this.s = null; this.t = 2; }
  update(dt) {
    const G = this.G, w = G.world, p = w.player;
    if (!this.s) {
      this.t -= dt;
      if (this.t > 0) return;
      this.t = 1.5;
      this.start(w, p);
      return;
    }
    const s = this.s, a = s.wk.a, d = s.d, car = d.car;
    s.age += dt;
    const abort = () => { s.wk.hold = false; d.stopAt = null; this.s = null; this.t = 8; };
    if (s.age > 30 || d.b !== s.b || a.down > 0 || (s.phase !== 'board' && a.busy > 1.5)) return abort();
    if (s.phase === 'hail') {
      if (a.busy <= 0 && a.stepTo(s.K.x, s.K.z, 1.4, dt) < 0.25) {
        a.speed = 0; a.ang = Math.atan2(car.x - a.x, car.z - a.z);
        s.waveT -= dt;
        if (s.waveT <= 0) { a.oneShot('Wave', 1.2); s.waveT = 1.6; if (!s.said) { s.said = true; G.hud.sayBy(a, 'Taxi!', false, 2); } }
      }
      // the cabbie has seen them; has he gone past?
      const along = (s.P.x - car.x) * car.fx + (s.P.z - car.z) * car.fz;
      if (along < -3) return abort();
      if (along < 1.2 && Math.abs(car.speed) < 0.4) { s.phase = 'board'; s.bt = 0; G.hud.say(car.x, 2.4, car.z, DRIVER[Math.floor(Math.random() * DRIVER.length)]); }
    } else if (s.phase === 'board') {
      s.bt += dt;
      // to the nearside door
      const lx = car.fz, lz = -car.fx, dx = car.x + lx * 1.25, dz = car.z + lz * 1.25;
      if ((a.busy <= 0 && a.stepTo(dx, dz, 1.2, dt) < 0.3) || s.bt > 5) {
        // in they get: gone from the street, and back on their round somewhere out of sight
        const far = s.wk.ring.c.reduce((b, c) => (Math.hypot(c[0] - p.x, c[1] - p.z) > Math.hypot(b[0] - p.x, b[1] - p.z) ? c : b));
        a.x = far[0]; a.z = far[1]; a.speed = 0;
        s.wk.hold = false;
        d.stopAt = null; d.yieldT = 0;
        this.s = null; this.t = 10 + Math.random() * 6;
      }
    }
  }
  start(w, p) {
    const leaders = new Set(w.walkers.filter((x) => x.leader).map((x) => x.leader));
    const owners = new Set((w.dogs || []).map((d) => d.owner));
    for (const d of w.drivers) {
      const car = d.car;
      if (car.type !== 'taxi' || car === p.car || d.stopAt || dist(car, p) > 60) continue;
      if (d.b.soft || d.a.soft || d.b.oneway) continue;
      const L = Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z), ux = (d.b.x - d.a.x) / L, uz = (d.b.z - d.a.z) / L;
      const t = (car.x - d.a.x) * ux + (car.z - d.a.z) * uz;
      if (L - t < 22 || car.speed < 2.5) continue;
      const P = lanePoint(d.a, d.b, t + 14), W = streetWidth(d.a, d.b);
      const lx = uz, lz = -ux, out = W / 4 + 0.55;
      const K = { x: P.x + lx * out, z: P.z + lz * out };
      if (onRoad(K.x, K.z)) continue;
      let best = null, bd = 20;
      for (const wk of w.walkers) {
        const a = wk.a;
        if (wk.leader || leaders.has(wk) || owners.has(a) || !a.visible || a.busy > 0 || a.isCop || a.seated || wk.crossing) continue;
        const dd = dist(a, K);
        if (dd < bd) { bd = dd; best = wk; }
      }
      if (!best) continue;
      d.stopAt = { x: P.x, z: P.z }; best.hold = true;
      this.s = { d, b: d.b, wk: best, P, K, phase: 'hail', age: 0, waveT: 0, said: false };
      return;
    }
  }
}

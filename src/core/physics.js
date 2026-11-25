// Collision against axis-aligned rectangles, kept in a coarse spatial hash.
const CELL = 10;
let grid = new Map();
let all = [];

export function setSolids(list) {
  all = list;
  grid = new Map();
  for (const r of list) {
    for (let cx = Math.floor(r.x0 / CELL); cx <= Math.floor(r.x1 / CELL); cx++)
      for (let cz = Math.floor(r.z0 / CELL); cz <= Math.floor(r.z1 / CELL); cz++) {
        const k = cx * 10007 + cz;
        let a = grid.get(k); if (!a) grid.set(k, a = []);
        a.push(r);
      }
  }
}
export function addSolid(r) { all.push(r); setSolids(all); }

const near = [];
function query(x, z, r) {
  near.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const a = grid.get(cx * 10007 + cz);
      if (a) for (const s of a) if (!near.includes(s)) near.push(s);
    }
  return near;
}

// Push a circle out of every rectangle it overlaps. Returns the push vector and the hit normal.
export function collide(e, r) {
  let hit = null;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of query(e.x, e.z, r)) {
      const cx = Math.max(s.x0, Math.min(e.x, s.x1)), cz = Math.max(s.z0, Math.min(e.z, s.z1));
      let dx = e.x - cx, dz = e.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        // centre inside the rectangle: push out along the shortest axis
        const l = e.x - s.x0, rr = s.x1 - e.x, t = e.z - s.z0, b = s.z1 - e.z;
        const m = Math.min(l, rr, t, b);
        if (m === l) { e.x = s.x0 - r; dx = -1; dz = 0; } else if (m === rr) { e.x = s.x1 + r; dx = 1; dz = 0; }
        else if (m === t) { e.z = s.z0 - r; dx = 0; dz = -1; } else { e.z = s.z1 + r; dx = 0; dz = 1; }
        hit = { nx: dx, nz: dz, s };
        continue;
      }
      const d = Math.sqrt(d2), push = r - d;
      e.x += dx / d * push; e.z += dz / d * push;
      hit = { nx: dx / d, nz: dz / d, s };
    }
  }
  return hit;
}

export function blocked(x, z, r) {
  for (const s of query(x, z, r)) {
    const cx = Math.max(s.x0, Math.min(x, s.x1)), cz = Math.max(s.z0, Math.min(z, s.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

// Line of sight: true if nothing large stands between a and b.
export function sight(ax, az, bx, bz) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 1.5);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    for (const s of query(x, z, 0.1)) if (!s.small && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return false;
  }
  return true;
}

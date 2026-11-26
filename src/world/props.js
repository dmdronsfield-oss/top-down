import * as THREE from 'three';
import { Acc } from './geom.js';
import { XS, ZS, BOUNDS, PLACES, SEGS, BLOCKS, onRoad, CRESCENT_MOUTHS } from './map.js';

// Blue police boxes (new in 1934): reinforcements turn out of the nearest when scandal is high.
export const POLICE_BOXES = [{ x: -57.6, z: -80 }, { x: 7.2, z: -25 }, { x: -75, z: 92.8 }];
import { CURB } from './ground.js';
import { toon, glow, inkMat, INK } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';
import * as TX from '../render/textures.js';

const R = TX.rng(4242);

// Tar patching: darker, smoother, with a sheen of grit
function patchTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const k = c.getContext('2d');
  k.fillStyle = '#3d3c45'; k.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) { const v = 45 + R() * 45 | 0; k.fillStyle = `rgba(${v},${v},${v + 6},.55)`; k.fillRect(R() * 128, R() * 128, 1 + R() * 2, 1 + R() * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function buildProps(scene, city) {
  const gm = toon('#fff').gradientMap;
  const ft = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gm });
  const mats = {
    iron: ft('#1b1c22'), ironGreen: ft('#203629'), red: ft('#a3201b'), redDark: ft('#7a1713'), black: ft('#141418'), white: ft('#e6e2d8'),
    lampGlow: glow('#ffc37a', 2.4), amber: glow('#ff9a2a', 2.2), redGlow: glow('#ff3a20', 2.0), blue: ft('#1d3f7a'), stone: ft('#a8a296'),
    wood: ft('#5a4030'), canvas: ft('#c9c1a4'), green: ft('#2d5a3a'), trunk: ft('#4b4038'), cream: ft('#e2d8bd'),
    stripe: new THREE.MeshToonMaterial({ color: '#ffffff', map: stripeTex(), gradientMap: gm }),
    plate: ft('#ffffff'), paint: ft('#cfc9b8'),
    coal: ft('#3b3732'), rim: ft('#a09a8e'),
    tar: new THREE.MeshToonMaterial({ color: '#ffffff', map: patchTex(), gradientMap: gm, transparent: true, opacity: 0.5, depthWrite: false }),
  };
  for (const k in mats) patchCutout(mats[k]);
  const acc = new Acc();
  const lamps = [];
  const solids = city.solids;

  // ------------------------------------------------ gas lamps along every kerb
  const crossings = [];
  const addLamp = (x, z, y0 = CURB) => {
    acc.box('iron', x - 0.22, x + 0.22, y0, y0 + 0.45, z - 0.22, z + 0.22, 1, true);
    acc.cyl('iron', x, z, 0.07, y0 + 0.45, y0 + 3.6, 8, 0.05);
    acc.box('iron', x - 0.32, x + 0.32, y0 + 3.0, y0 + 3.06, z - 0.03, z + 0.03, 1, false); // ladder bar
    acc.cyl('iron', x, z, 0.18, y0 + 3.6, y0 + 3.7, 6, 0.18);
    acc.cyl('lampGlow', x, z, 0.17, y0 + 3.7, y0 + 4.25, 6, 0.24);
    acc.cyl('iron', x, z, 0.3, y0 + 4.25, y0 + 4.42, 6, 0.04);
    lamps.push({ x, y: y0 + 4.0, z });
    solids.push({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, small: true });
  };
  const near = (v, list, d) => list.some((s) => Math.abs(v - s) < d);
  // every lamp stands on the pavement of one stretch of street, clear of the junctions
  const xLines = [], zLines = [];
  for (const g of SEGS) (g.axis === 'x' ? xLines : zLines).push(g.c);
  for (const g of SEGS) {
    for (const side of [-1, 1]) {
      const along = g.axis === 'x' ? [BOUNDS.z0, BOUNDS.z1] : [BOUNDS.x0, BOUNDS.x1];
      const start = along[0] + (g.axis === 'x' ? 8 : 14) + (side > 0 ? 12 : 0);
      for (let t = start; t < along[1] - 6; t += 24) {
        const lo = g.axis === 'x' ? g.z0 : g.x0, hi = g.axis === 'x' ? g.z1 : g.x1;
        if (t <= lo || t >= hi) continue;
        if (near(t, g.axis === 'x' ? zLines : xLines, 12)) continue;
        const off = g.c + side * (g.w / 2 + 0.55);
        const [x, z] = g.axis === 'x' ? [off, t] : [t, off];
        if (x < BOUNDS.x0 + 3 || x > BOUNDS.x1 - 3) continue;
        if (g.name === 'Dover Street' && side < 0 && CRESCENT_MOUTHS.some(([a, b]) => z > a - 3.5 && z < b + 3.5)) continue;
        // a lamp on a dogleg's far kerb would stand in the other street
        if (onRoad(x, z)) continue;
        addLamp(x, z);
      }
    }
  }
  for (const [x, z] of city.extraLamps || []) addLamp(x, z);
  // a dashed white line down the middle of the two great roads, broken at the junctions
  for (const g of SEGS) {
    if (g.w < 16) continue;
    const [lo, hi] = g.axis === 'x' ? [Math.max(g.z0, BOUNDS.z0), Math.min(g.z1, BOUNDS.z1)] : [Math.max(g.x0, BOUNDS.x0), Math.min(g.x1, BOUNDS.x1)];
    for (let t = lo + 2; t < hi - 3; t += 7.5) {
      if (near(t, g.axis === 'x' ? zLines : xLines, 9) || near(t + 3, g.axis === 'x' ? zLines : xLines, 9)) continue;
      if (g.axis === 'x') acc.box('paint', g.c - 0.07, g.c + 0.07, 0.004, 0.012, t, t + 3, 1, false, 'Y');
      else acc.box('paint', t, t + 3, 0.004, 0.012, g.c - 0.07, g.c + 0.07, 1, false, 'Y');
    }
  }
  // wall-bracket lamps on the club and pub
  for (const l of city.lamps) {
    acc.box('iron', l.x - 0.05, l.x + 0.05, l.y - 0.1, l.y, l.z - 0.05, l.z + 0.05, 1, false);
    acc.cyl('lampGlow', l.x, l.z, 0.16, l.y, l.y + 0.5, 6, 0.22);
    acc.cyl('iron', l.x, l.z, 0.26, l.y + 0.5, l.y + 0.62, 6, 0.04);
    lamps.push({ x: l.x, y: l.y + 0.25, z: l.z });
  }

  // ------------------------------------------------ Belisha crossings (1934: brand new)
  const bel = [
    { x: 50, z: -75, axis: 'x' }, { x: 50, z: 25, axis: 'x' }, { x: -50, z: -25, axis: 'x' },
    { x: 25, z: 100, axis: 'z' }, { x: -75, z: -50, axis: 'z' }, { x: 75, z: 150, axis: 'z' },
  ];
  for (const b of bel) {
    const s = b.axis === 'x' ? XS.find((q) => q.x === b.x) : ZS.find((q) => q.z === b.z);
    const half = s.w / 2 + 0.5;
    const ends = b.axis === 'x' ? [[b.x - half, b.z - 1.6], [b.x + half, b.z + 1.6]] : [[b.x - 1.6, b.z - half], [b.x + 1.6, b.z + half]];
    for (const [x, z] of ends) {
      acc.cyl('stripe', x, z, 0.07, CURB, CURB + 2.7, 8);
      acc.cyl('amber', x, z, 0.22, CURB + 2.7, CURB + 3.1, 8, 0.22);
      lamps.push({ x, y: CURB + 2.9, z, amber: true, dim: true });
    }
    // studs across the road
    for (let t = -s.w / 2; t <= s.w / 2; t += 0.9) for (const o of [-1.4, 1.4]) {
      const [x, z] = b.axis === 'x' ? [b.x + t, b.z + o] : [b.x + o, b.z + t];
      acc.cyl('stone', x, z, 0.1, 0, 0.03, 6);
    }
    crossings.push({ ...b, w: s.w });
  }

  // ------------------------------------------------ refuges down the middle of the two great roads
  // a kerbed island with a lamp standard, and a lit KEEP LEFT bollard at each end
  for (const g of SEGS) {
    if (g.w < 16) continue;
    const lines = g.axis === 'x' ? zLines : xLines;
    for (let k = 0; k < lines.length - 1; k++) {
      const t = (lines[k] + lines[k + 1]) / 2;
      const [x, z] = g.axis === 'x' ? [g.c, t] : [t, g.c];
      const lo = g.axis === 'x' ? g.z0 : g.x0, hi = g.axis === 'x' ? g.z1 : g.x1;
      if (t <= lo + 10 || t >= hi - 10 || x < BOUNDS.x0 + 10 || x > BOUNDS.x1 - 10 || z < BOUNDS.z0 + 10 || z > BOUNDS.z1 - 10) continue;
      if (crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 12)) continue;
      if (city.solids.some((s) => !s.small && x > s.x0 - 3 && x < s.x1 + 3 && z > s.z0 - 3 && z < s.z1 + 3)) continue;
      const hl = 2.6, hw = 0.8; // half length, half width
      const [x0, x1, z0, z1] = g.axis === 'x' ? [x - hw, x + hw, z - hl, z + hl] : [x - hl, x + hl, z - hw, z + hw];
      acc.box('stone', x0, x1, 0, CURB, z0, z1, 1, true);
      acc.box('stone', x0 + 0.12, x1 - 0.12, CURB, CURB + 0.01, z0 + 0.12, z1 - 0.12, 1, false, 'Y');
      addLamp(x, z, CURB);
      for (const e of [-1, 1]) {
        const [bx, bz] = g.axis === 'x' ? [x, z + e * (hl - 0.35)] : [x + e * (hl - 0.35), z];
        acc.cyl('white', bx, bz, 0.2, CURB, CURB + 0.85, 10);
        acc.cyl('black', bx, bz, 0.21, CURB + 0.25, CURB + 0.4, 10);
        acc.cyl('amber', bx, bz, 0.17, CURB + 0.85, CURB + 1.05, 10, 0.12);
        lamps.push({ x: bx, y: CURB + 1.0, z: bz, amber: true, dim: true });
      }
      solids.push({ x0, x1, z0, z1, small: true });
    }
  }

  // ------------------------------------------------ iron in the street
  // Coal-hole plates in the pavement outside each house, manhole and valve covers in the carriageway,
  // and tar patches where the road has been dug up and made good, so the street is not one clean sheet.
  {
    const inHouse = (x, z) => solids.some((s) => !s.small && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1);
    const clear = (x, z, m) => !solids.some((s) => x > s.x0 - m && x < s.x1 + m && z > s.z0 - m && z < s.z1 + m);
    const coal = (x, z) => {
      acc.cyl('rim', x, z, 0.25, CURB, CURB + 0.006, 12);
      acc.cyl('coal', x, z, 0.2, CURB + 0.006, CURB + 0.011, 12);
    };
    for (const B of BLOCKS) {
      if (B.special) continue;
      // each frontage: building line, outward normal, run
      const fr = [
        ['x', B.z0, -1, B.x0, B.x1], ['x', B.z1, 1, B.x0, B.x1],
        ['z', B.x0, -1, B.z0, B.z1], ['z', B.x1, 1, B.z0, B.z1],
      ];
      for (const [ax, line, n, a0, a1] of fr) {
        for (let t = a0 + 3 + R() * 2; t < a1 - 3; t += 5.5 + R() * 3) {
          const [x, z] = ax === 'x' ? [t, line + n * 0.75] : [line + n * 0.75, t];
          const [ix, iz] = ax === 'x' ? [t, line - n * 0.8] : [line - n * 0.8, t];
          if (!inHouse(ix, iz) || !clear(x, z, 0.35) || onRoad(x, z)) continue;
          coal(x, z);
        }
      }
    }
    for (const g of SEGS) {
      const cross = g.axis === 'x' ? zLines : xLines;
      const lo = Math.max(g.axis === 'x' ? g.z0 : g.x0, g.axis === 'x' ? BOUNDS.z0 : BOUNDS.x0), hi = Math.min(g.axis === 'x' ? g.z1 : g.x1, g.axis === 'x' ? BOUNDS.z1 : BOUNDS.x1);
      const P = (t, off) => (g.axis === 'x' ? [g.c + off, t] : [t, g.c + off]);
      for (let t = lo + 10 + R() * 10; t < hi - 8; t += 22 + R() * 16) {
        if (near(t, cross, 9)) continue;
        const off = (R() < 0.5 ? -1 : 1) * g.w * (0.12 + R() * 0.2);
        const [x, z] = P(t, off);
        if (!onRoad(x, z) || crossings.some((c) => Math.hypot(c.x - x, c.z - z) < 4)) continue;
        if (R() < 0.6) { acc.cyl('rim', x, z, 0.42, 0.002, 0.008, 14); acc.cyl('coal', x, z, 0.36, 0.008, 0.012, 14); }
        else { const h = 0.33; acc.box('rim', x - h - 0.05, x + h + 0.05, 0.002, 0.008, z - h - 0.05, z + h + 0.05, 1, false, 'Y'); acc.box('coal', x - h, x + h, 0.008, 0.012, z - h, z + h, 1, false, 'Y'); }
        // the ground round a cover is often patched
        if (R() < 0.5) {
          const a = 1.0 + R() * 1.4, b = 0.8 + R() * 1.0;
          const [hx, hz] = g.axis === 'x' ? [b, a] : [a, b];
          acc.box('tar', x - hx, x + hx, 0.001, 0.004, z - hz, z + hz, 3, false, 'Y');
        }
      }
      // a long trench, filled in: one now and then along a street
      for (let t = lo + 20 + R() * 30; t < hi - 14; t += 60 + R() * 50) {
        if (near(t, cross, 12)) continue;
        const len = 4 + R() * 7, side = R() < 0.5 ? -1 : 1, wd = 0.7 + R() * 0.8;
        const c0 = side * (g.w / 2 - 0.6 - wd - R() * g.w * 0.15);
        const [x0, z0] = P(t, c0), [x1, z1] = P(t + len, c0 + wd);
        if (!onRoad(x0, z0) || !onRoad(x1, z1)) continue;
        acc.box('tar', Math.min(x0, x1), Math.max(x0, x1), 0.001, 0.0045, Math.min(z0, z1), Math.max(z0, z1), 3, false, 'Y');
      }
      // small gas and water valve covers near the kerbs
      for (let t = lo + 6 + R() * 12; t < hi - 6; t += 14 + R() * 14) {
        if (near(t, cross, 8)) continue;
        const [x, z] = P(t, (R() < 0.5 ? -1 : 1) * (g.w / 2 - 1.0));
        if (!onRoad(x, z)) continue;
        const [hx, hz] = g.axis === 'x' ? [0.14, 0.2] : [0.2, 0.14];
        acc.box('coal', x - hx, x + hx, 0.002, 0.009, z - hz, z + hz, 1, false, 'Y');
      }
    }
  }

  // ------------------------------------------------ pillar boxes, phone box, police pillar, trough, shelter
  const pillar = (x, z) => {
    acc.cyl('red', x, z, 0.32, CURB, CURB + 1.35, 12); acc.cyl('red', x, z, 0.36, CURB + 1.35, CURB + 1.5, 12, 0.1);
    acc.box('black', x - 0.12, x + 0.12, CURB + 1.05, CURB + 1.1, z - 0.36, z + 0.36, 1, false);
    solids.push({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.35, z1: z + 0.35, small: true });
  };
  pillar(-44.0 + 0.9, 3.0 + 6); pillar(44.3 - 0.6, -60); pillar(-100 - 6.3, 60); pillar(11.6, 92.2); pillar(-25, -49.4); pillar(90, -92.6);
  // K2 telephone kiosk on Mount Street
  const ph = PLACES.phone;
  {
    const x = ph.x, z = ph.z;
    acc.box('red', x - 0.55, x + 0.55, CURB, CURB + 0.25, z - 0.55, z + 0.55, 1, true);
    acc.box('red', x - 0.5, x + 0.5, CURB + 0.25, CURB + 2.45, z - 0.5, z + 0.5, 1, true);
    acc.box('lampGlow', x - 0.38, x + 0.38, CURB + 0.9, CURB + 2.15, z - 0.51, z + 0.51, 1, false);
    acc.box('lampGlow', x - 0.51, x + 0.51, CURB + 0.9, CURB + 2.15, z - 0.38, z + 0.38, 1, false);
    acc.box('redDark', x - 0.56, x + 0.56, CURB + 2.45, CURB + 2.7, z - 0.56, z + 0.56, 1, true);
    acc.cyl('red', x, z, 0.5, CURB + 2.7, CURB + 2.85, 4, 0.2);
    solids.push({ x0: x - 0.6, x1: x + 0.6, z0: z - 0.6, z1: z + 0.6, small: true });
    lamps.push({ x, y: CURB + 1.6, z, dim: true });
  }
  // Police telephone pillar by Berkeley Square
  {
    const x = 7.8, z = 43.6; acc.box('blue', x - 0.3, x + 0.3, CURB, CURB + 2.2, z - 0.3, z + 0.3, 1, true); acc.cyl('lampGlow', x, z, 0.12, CURB + 2.2, CURB + 2.45, 6);
    solids.push({ x0: x - 0.32, x1: x + 0.32, z0: z - 0.32, z1: z + 0.32, small: true });
  }
  for (const b of POLICE_BOXES) {
    const { x, z } = b, h = 0.62;
    acc.box('blue', x - h - 0.06, x + h + 0.06, CURB, CURB + 0.2, z - h - 0.06, z + h + 0.06, 1, true);
    acc.box('blue', x - h, x + h, CURB + 0.2, CURB + 2.6, z - h, z + h, 1, true);
    for (const [dx, dz] of [[-h, -h], [h, -h], [h, h], [-h, h]]) acc.box('blue', x + dx - 0.07, x + dx + 0.07, CURB, CURB + 2.75, z + dz - 0.07, z + dz + 0.07, 1, true);
    acc.box('lampGlow', x - h + 0.15, x + h - 0.15, CURB + 2.32, CURB + 2.52, z - h - 0.01, z + h + 0.01, 1, false);
    acc.box('lampGlow', x - h - 0.01, x + h + 0.01, CURB + 2.32, CURB + 2.52, z - h + 0.15, z + h - 0.15, 1, false);
    for (const y of [1.0, 1.7]) acc.box('lampGlow', x - h + 0.18, x + h - 0.18, CURB + y, CURB + y + 0.45, z - h - 0.005, z + h + 0.005, 1, false);
    acc.box('blue', x - h - 0.05, x + h + 0.05, CURB + 2.75, CURB + 2.9, z - h - 0.05, z + h + 0.05, 1, true);
    acc.box('blue', x - h + 0.12, x + h - 0.12, CURB + 2.9, CURB + 3.05, z - h + 0.12, z + h - 0.12, 1, true);
    acc.cyl('lampGlow', x, z, 0.1, CURB + 3.05, CURB + 3.35, 6);
    solids.push({ x0: x - h - 0.1, x1: x + h + 0.1, z0: z - h - 0.1, z1: z + h + 0.1, small: true });
    lamps.push({ x, y: CURB + 3.2, z, dim: true });
  }
  // Cabmen's shelter on Curzon Street: a green hut
  {
    const x = -26, z = 100; acc.box('ironGreen', x - 4.2, x + 4.2, 0, 2.6, z - 1.2, z + 1.2, 1, true);
    acc.box('lampGlow', x - 3.6, x + 3.6, 1.2, 2.1, z - 1.21, z + 1.21, 1, false);
    for (let k = -3; k <= 3; k += 1.2) acc.box('ironGreen', x + k - 0.06, x + k + 0.06, 1.2, 2.1, z - 1.25, z + 1.25, 1, false);
    acc.quad('ironGreen', [x - 4.5, 2.6, z + 1.5], [x + 4.5, 2.6, z + 1.5], [x + 4.5, 3.6, z], [x - 4.5, 3.6, z], 2, true);
    acc.quad('ironGreen', [x + 4.5, 2.6, z - 1.5], [x - 4.5, 2.6, z - 1.5], [x - 4.5, 3.6, z], [x + 4.5, 3.6, z], 2, true);
    acc.box('iron', x + 1, x + 1.4, 3.2, 4.2, z - 0.2, z + 0.2, 1, true);
    solids.push({ x0: x - 4.3, x1: x + 4.3, z0: z - 1.3, z1: z + 1.3 });
    lamps.push({ x, y: 2, z, dim: true });
  }
  // Horse trough at the top of Park Street
  { const x = -100, z = -128; acc.box('stone', x - 0.8, x + 0.8, 0, 0.8, z - 2.2, z + 2.2, 1, true); solids.push({ x0: x - 0.8, x1: x + 0.8, z0: z - 2.2, z1: z + 2.2 }); }
  // Coffee stall in Shepherd Market
  if (city.market) {
    const x = city.market.cx + 2.2, z = city.market.cz - 1.5;
    acc.box('wood', x - 1.2, x + 1.2, CURB, CURB + 1.6, z - 0.8, z + 0.8, 1, true);
    acc.box('lampGlow', x - 1.0, x + 1.0, CURB + 1.0, CURB + 1.5, z + 0.8, z + 0.82, 1, false);
    acc.quad('canvas', [x - 1.5, CURB + 2.3, z + 1.3], [x + 1.5, CURB + 2.3, z + 1.3], [x + 1.5, CURB + 2.7, z - 1.0], [x - 1.5, CURB + 2.7, z - 1.0], 2, true);
    solids.push({ x0: x - 1.2, x1: x + 1.2, z0: z - 0.8, z1: z + 0.8, small: true });
    lamps.push({ x, y: CURB + 2.0, z: z + 0.8 });
  }
  // Roadworks closing the edge of the map: red lanterns on trestles.
  const works = [];
  // only where a street would run on off the map: Hyde Park lies west of Park Lane and Green Park south of Piccadilly
  for (const s of XS) works.push([s.x, BOUNDS.z0 + 2, 'x', s.w]);
  for (const s of ZS) works.push([BOUNDS.x1 - 2, s.z, 'z', s.w]);
  for (const [x, z, axis, w] of works) {
    if (axis === 'x') {
      if (x === XS[0].x && false) continue;
      acc.box('stripe', x - w / 2, x + w / 2, 0.6, 0.9, z - 0.08, z + 0.08, 1, true);
      for (const t of [-w / 2 + 0.3, w / 2 - 0.3]) acc.box('wood', x + t - 0.06, x + t + 0.06, 0, 0.9, z - 0.4, z + 0.4, 1, false);
      for (let t = -w / 2 + 1; t < w / 2; t += 2.5) { acc.cyl('redGlow', x + t, z, 0.09, 0.9, 1.15, 6); lamps.push({ x: x + t, y: 1.0, z, red: true, dim: true }); }
      solids.push({ x0: x - w / 2 - 2, x1: x + w / 2 + 2, z0: z - (z < 0 ? 10 : 0.3), z1: z + (z < 0 ? 0.3 : 10) });
    } else {
      acc.box('stripe', x - 0.08, x + 0.08, 0.6, 0.9, z - w / 2, z + w / 2, 1, true);
      for (const t of [-w / 2 + 0.3, w / 2 - 0.3]) acc.box('wood', x - 0.4, x + 0.4, 0, 0.9, z + t - 0.06, z + t + 0.06, 1, false);
      for (let t = -w / 2 + 1; t < w / 2; t += 2.5) { acc.cyl('redGlow', x, z + t, 0.09, 0.9, 1.15, 6); lamps.push({ x, y: 1.0, z: z + t, red: true, dim: true }); }
      solids.push({ x0: x - (x < 0 ? 10 : 0.3), x1: x + (x < 0 ? 0.3 : 10), z0: z - w / 2 - 2, z1: z + w / 2 + 2 });
    }
  }

  // ------------------------------------------------ mews arches: a stucco arch over each mouth, the name above
  const archNames = [];
  for (const m of city.mews || []) {
    if (m.name === 'Shepherd Market') continue;
    const alongX = m.x1 - m.x0 > m.z1 - m.z0;
    const ends = alongX ? [m.x0 + 3.2, m.x1 - 3.2] : [m.z0 + 3.2, m.z1 - 3.2];
    const [s0, s1] = alongX ? [m.z0, m.z1] : [m.x0, m.x1];
    const sm = (s0 + s1) / 2, half = (s1 - s0) / 2, T = 0.7; // half-span, pier and arch depth
    for (const e of ends) {
      const B = (a0, a1, y0, y1, b0, b1, k = 'cream') => alongX ? acc.box(k, e - T / 2 + a0, e - T / 2 + a1, y0, y1, b0, b1, 1, true) : acc.box(k, b0, b1, y0, y1, e - T / 2 + a0, e - T / 2 + a1, 1, true);
      // piers standing in the line of the mews house fronts
      for (const sd of [-1, 1]) {
        const b0 = sd < 0 ? s0 : s1 - 0.75, b1 = sd < 0 ? s0 + 0.75 : s1;
        B(0, T, CURB, 4.2, b0, b1); B(-0.06, T + 0.06, 4.0, 4.25, b0 - 0.05, b1 + 0.05, 'stone');
        alongX ? solids.push({ x0: e - T / 2, x1: e + T / 2, z0: b0, z1: b1, small: true }) : solids.push({ x0: b0, x1: b1, z0: e - T / 2, z1: e + T / 2, small: true });
      }
      // the arch: voussoirs from pier to pier, then a straight attic with a cornice
      const r = half - 0.75, N = 9;
      for (let k = 0; k < N; k++) {
        const a0 = Math.PI * k / N, a1 = Math.PI * (k + 1) / N;
        const p0 = sm - Math.cos(a0) * r, p1 = sm - Math.cos(a1) * r, y = 4.25 + Math.sin((a0 + a1) / 2) * r * 0.45;
        B(0, T, y, 6.1, Math.min(p0, p1), Math.max(p0, p1));
      }
      B(0, T, 6.1, 6.5, s0, s1);
      B(-0.08, T + 0.08, 6.5, 6.68, s0 - 0.1, s1 + 0.1, 'stone');
      archNames.push({ alongX, e, sm, name: m.name.toUpperCase(), T });
    }
  }
  const g = acc.build(mats, patchCutout(new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.8 })), 'props');
  scene.add(g);

  // ------------------------------------------------ plane trees (instanced)
  const trees = [];
  for (const sq of city.squareCentres || []) {
    const { x0, x1, z0, z1 } = sq;
    for (let x = x0 + 4; x < x1 - 2; x += 7.5) for (const z of [z0 + 3.5, z1 - 3.5]) trees.push([x + R() * 1.2, z + R() * 1.2, 1 + R() * .35]);
    for (let z = z0 + 10; z < z1 - 8; z += 7.5) for (const x of [x0 + 3.5, x1 - 3.5]) trees.push([x + R(), z + R(), 1 + R() * .35]);
  }
  const X0 = XS[0], Z6 = ZS[6];
  for (let z = BOUNDS.z0; z < BOUNDS.z1 + 30; z += 11) trees.push([X0.x - X0.w / 2 - 9 - R() * 6, z + R() * 4, 1.2 + R() * .4]);
  for (let z = BOUNDS.z0; z < BOUNDS.z1 + 30; z += 14) trees.push([X0.x - X0.w / 2 - 22 - R() * 10, z + R() * 6, 1.2 + R() * .4]);
  for (let x = X0.x; x < XS[6].x; x += 11) trees.push([x + R() * 3, Z6.z + Z6.w / 2 + 10 + R() * 6, 1.2 + R() * .4]);
  for (let x = X0.x; x < XS[6].x; x += 15) trees.push([x + R() * 3, Z6.z + Z6.w / 2 + 24 + R() * 8, 1.2 + R() * .4]);
  for (const t of city.extraTrees || []) trees.push(t);
  buildTrees(scene, trees, solids);

  // ------------------------------------------------ light pools on the pavement (instanced, additive)
  const poolMat = new THREE.MeshBasicMaterial({ map: TX.poolTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, poolMat, lamps.length);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  lamps.forEach((l, i) => {
    const s = l.dim ? 4 : 9;
    m4.makeScale(s, 1, s); m4.setPosition(l.x, CURB + 0.03, l.z);
    pools.setMatrixAt(i, m4);
    pools.setColorAt(i, l.red ? c.setRGB(1, .3, .2) : l.amber ? c.setRGB(1, .6, .2) : c.setRGB(1, 1, 1));
  });
  pools.renderOrder = -1;
  scene.add(pools);
  // the mews names, lettered on both faces of each arch
  for (const a of archNames) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const k = c.getContext('2d');
    k.fillStyle = '#e2d8bd'; k.fillRect(0, 0, 512, 96);
    k.fillStyle = '#2a2420'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.font = '700 52px "Josefin Sans", sans-serif'; k.fillText(a.name.split('').join(String.fromCharCode(8202)), 256, 52, 480);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const mat = patchCutout(new THREE.MeshToonMaterial({ map: t, gradientMap: gm }));
    for (const sd of [-1, 1]) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.79), mat);
      const off = a.e + sd * (a.T / 2 + 0.01);
      if (a.alongX) { pl.position.set(off, 5.45, a.sm); pl.rotation.y = sd * Math.PI / 2; }
      else { pl.position.set(a.sm, 5.45, off); pl.rotation.y = sd > 0 ? 0 : Math.PI; }
      scene.add(pl);
    }
  }
  return { lamps, crossings };
}

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#eee'; g.fillRect(0, i * 8, 16, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTrees(scene, list, solids) {
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 5, 7); trunkGeo.translate(0, 2.5 + CURB, 0);
  const blob = new THREE.IcosahedronGeometry(1, 1);
  // London planes: bark that flakes in patches of cream, olive and grey; leaves in clumps of light and shade
  const trunkMat = patchCutout(new THREE.MeshToonMaterial({ color: '#ffffff', map: TX.barkTexture(), gradientMap: toon('#fff').gradientMap }));
  const leafTex = TX.leafTexture();
  const leafMats = ['#33553b', '#3b6140', '#2d4a35'].map((c) => patchCutout(new THREE.MeshToonMaterial({ color: c, map: leafTex, gradientMap: toon('#fff').gradientMap })));
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
  const per = 4;
  const leaves = leafMats.map((m) => new THREE.InstancedMesh(blob, m, Math.ceil(list.length * per / 3) + 3));
  const inks = leaves.map((l) => new THREE.InstancedMesh(blob, inkMat(0.06), l.count));
  const counts = [0, 0, 0];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  list.forEach(([x, z, k], i) => {
    m4.makeScale(k, k, k); m4.setPosition(x, 0, z); trunks.setMatrixAt(i, m4);
    solids.push({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.35, z1: z + 0.35, small: true });
    for (let b = 0; b < per; b++) {
      const which = (i + b) % 3;
      const a = b / per * Math.PI * 2 + R();
      const r = b === 0 ? 0 : 1.6 * k;
      p.set(x + Math.cos(a) * r, (5.6 + (b === 0 ? 1.4 : R() * 1.2)) * k, z + Math.sin(a) * r);
      const sc = (b === 0 ? 2.9 : 2.2 + R() * .6) * k;
      s.set(sc, sc * .8, sc); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6);
      m4.compose(p, q, s);
      leaves[which].setMatrixAt(counts[which], m4); inks[which].setMatrixAt(counts[which], m4);
      counts[which]++;
    }
  });
  scene.add(trunks);
  leaves.forEach((l, i) => { l.count = counts[i]; inks[i].count = counts[i]; l.computeBoundingSphere(); inks[i].computeBoundingSphere(); scene.add(l); scene.add(inks[i]); });
  trunks.computeBoundingSphere();
}

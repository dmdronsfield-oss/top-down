import * as THREE from 'three';
import { Acc } from './geom.js';
import { XS, ZS, BOUNDS, PLACES, closedAt } from './map.js';

// Blue police boxes (new in 1934): reinforcements turn out of the nearest when scandal is high.
export const POLICE_BOXES = [{ x: -57.6, z: -80 }, { x: 7.2, z: -25 }, { x: -75, z: 92.8 }];
import { CURB } from './ground.js';
import { toon, glow, inkMat, INK } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';
import * as TX from '../render/textures.js';

const R = TX.rng(4242);

export function buildProps(scene, city) {
  const gm = toon('#fff').gradientMap;
  const ft = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: gm });
  const mats = {
    iron: ft('#1b1c22'), ironGreen: ft('#203629'), red: ft('#a3201b'), redDark: ft('#7a1713'), black: ft('#141418'), white: ft('#e6e2d8'),
    lampGlow: glow('#ffc37a', 2.4), amber: glow('#ff9a2a', 2.2), redGlow: glow('#ff3a20', 2.0), blue: ft('#1d3f7a'), stone: ft('#a8a296'),
    wood: ft('#5a4030'), canvas: ft('#c9c1a4'), green: ft('#2d5a3a'), trunk: ft('#4b4038'), cream: ft('#e2d8bd'),
    stripe: new THREE.MeshToonMaterial({ color: '#ffffff', map: stripeTex(), gradientMap: gm }),
    plate: ft('#ffffff'),
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
  for (const s of XS) {
    for (const side of [-1, 1]) {
      const x = s.x + side * (s.w / 2 + 0.55);
      if (x < BOUNDS.x0 + 3 || x > BOUNDS.x1 - 3) continue;
      for (let z = BOUNDS.z0 + 8 + (side > 0 ? 12 : 0); z < BOUNDS.z1 - 6; z += 24) {
        if (near(z, ZS.map((q) => q.z), 12)) continue;
        if (s.name === 'Park Lane' && side < 0) continue;
        if (closedAt('x', XS.indexOf(s), z)) continue;
        addLamp(x, z);
      }
    }
  }
  for (const s of ZS) {
    for (const side of [-1, 1]) {
      const z = s.z + side * (s.w / 2 + 0.55);
      if (s.name === 'Piccadilly' && side > 0) continue;
      for (let x = BOUNDS.x0 + 14 + (side > 0 ? 12 : 0); x < BOUNDS.x1 - 6; x += 24) {
        if (near(x, XS.map((q) => q.x), 12)) continue;
        if (closedAt('z', ZS.indexOf(s), x)) continue;
        addLamp(x, z);
      }
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

  // ------------------------------------------------ pillar boxes, phone box, police pillar, trough, shelter
  const pillar = (x, z) => {
    acc.cyl('red', x, z, 0.32, CURB, CURB + 1.35, 12); acc.cyl('red', x, z, 0.36, CURB + 1.35, CURB + 1.5, 12, 0.1);
    acc.box('black', x - 0.12, x + 0.12, CURB + 1.05, CURB + 1.1, z - 0.36, z + 0.36, 1, false);
    solids.push({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.35, z1: z + 0.35, small: true });
  };
  pillar(-44.0 + 0.9, 3.0 + 6); pillar(44.3 - 0.6, -60); pillar(-100 + 6.3, 60); pillar(10, 96); pillar(-25, -44.4); pillar(90, -95);
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
    const x = 7.8, z = 46; acc.box('blue', x - 0.3, x + 0.3, CURB, CURB + 2.2, z - 0.3, z + 0.3, 1, true); acc.cyl('lampGlow', x, z, 0.12, CURB + 2.2, CURB + 2.45, 6);
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
    const x = -10, z = 100; acc.box('ironGreen', x - 4.2, x + 4.2, 0, 2.6, z - 1.2, z + 1.2, 1, true);
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
  for (const s of XS) { works.push([s.x, BOUNDS.z0 + 2, 'x', s.w]); works.push([s.x, BOUNDS.z1 - 2, 'x', s.w]); }
  for (const s of ZS) { works.push([BOUNDS.x0 + 2, s.z, 'z', s.w]); works.push([BOUNDS.x1 - 2, s.z, 'z', s.w]); }
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
  // street trees along Park Street and Hill Street pavements
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
  const trunkMat = patchCutout(new THREE.MeshToonMaterial({ color: '#5b5047', gradientMap: toon('#fff').gradientMap }));
  const leafMats = ['#29432f', '#2f4d33', '#243b2b'].map((c) => patchCutout(new THREE.MeshToonMaterial({ color: c, gradientMap: toon('#fff').gradientMap })));
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

import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Acc } from './geom.js';
import { BLOCKS, XS, ZS, BOUNDS, CRESCENT, CRESCENT_MOUTHS, crescentPt } from './map.js';
import * as TX from '../render/textures.js';
import { toon } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';

export const CURB = 0.15;

// Ground height at a point: pavements, squares and mews are raised by a kerb.
let RAISED = [];
const RAMP = 1.3; // dropped kerb at the crescent mouths
export function groundY(x, z) {
  if (x > CRESCENT.mouthX && x < CRESCENT.mouthX + RAMP) {
    for (const [a, b] of CRESCENT_MOUTHS) if (z > a && z < b) return CURB * (CRESCENT.mouthX + RAMP - x) / RAMP;
  }
  for (const r of RAISED) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) {
    if (r.R) { // rounded kerb at the block's corners
      const cx = x < r.x0 + r.R ? r.x0 + r.R : x > r.x1 - r.R ? r.x1 - r.R : null;
      const cz = z < r.z0 + r.R ? r.z0 + r.R : z > r.z1 - r.R ? r.z1 - r.R : null;
      if (cx !== null && cz !== null && (x - cx) ** 2 + (z - cz) ** 2 > r.R * r.R) continue;
    }
    return CURB;
  }
  return 0;
}

export function buildGround(scene, quality, city) {
  const gm = toon('#fff').gradientMap;
  const road = TX.roadTexture(); road.repeat.set(1, 1);
  const puddles = TX.puddleTexture(); puddles.channel = 1;
  const wet = quality !== 'low';
  const roadMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: road, gradientMap: gm, transparent: wet, alphaMap: wet ? puddles : null, opacity: 1 });
  const paveMat = new THREE.MeshToonMaterial({ color: '#ffffff', map: TX.flagsTexture(), gradientMap: gm, transparent: wet, opacity: wet ? 0.9 : 1 });
  const mats = {
    pave: paveMat,
    kerb: toon('#77736f'),
    grass: new THREE.MeshToonMaterial({ color: '#ffffff', map: TX.grassTexture(), gradientMap: gm }),
    gravel: new THREE.MeshToonMaterial({ color: '#ffffff', map: TX.gravelTexture(), gradientMap: gm }),
    cobble: new THREE.MeshToonMaterial({ color: '#ffffff', map: TX.cobbleTexture(), gradientMap: gm, transparent: wet, opacity: wet ? 0.85 : 1 }),
    iron: toon('#1a1a20'),
    setts: new THREE.MeshToonMaterial({ color: '#77747e', map: road, gradientMap: gm }),
    stone: toon('#b9b2a4'),
  };

  // Road: one big plane, with world-scale uvs and a second uv set for the puddle mask.
  const span = 420;
  const rg = new THREE.PlaneGeometry(span, span, 1, 1);
  rg.rotateX(-Math.PI / 2);
  const uv = rg.attributes.uv, pos = rg.attributes.position;
  const uv1 = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, pos.getX(i) / 4, -pos.getZ(i) / 4);
    uv1[i * 2] = pos.getX(i) / 37; uv1[i * 2 + 1] = -pos.getZ(i) / 37;
  }
  rg.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  const roadMesh = new THREE.Mesh(rg, roadMat);
  roadMesh.renderOrder = -2;
  scene.add(roadMesh);

  let reflector = null;
  if (wet) {
    const res = quality === 'high' ? 0.6 : 0.4;
    reflector = new Reflector(new THREE.PlaneGeometry(span, span), {
      textureWidth: Math.round(window.innerWidth * res), textureHeight: Math.round(window.innerHeight * res), color: 0x8a8a98,
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.y = -0.04;
    reflector.renderOrder = -3;
    scene.add(reflector);
  }

  // Pavements and the islands of squares, mews and market, as raised slabs.
  const acc = new Acc();
  RAISED = [];
  const slab = (x0, x1, z0, z1, top = 'pave', gapsX = null) => {
    acc.box(top, x0, x1, CURB - 0.001, CURB, z0, z1, 4, false, 'Y');
    acc.box('kerb', x0, x1, 0, CURB, z0, z1, 1, false, gapsX ? 'xzZ' : 'xXzZ');
    if (gapsX) { // east kerb face, broken where a road leaves the block
      let z = z0;
      for (const [a, b] of gapsX) { acc.box('kerb', x0, x1, 0, CURB, z, a, 1, false, 'X'); z = b; }
      acc.box('kerb', x0, x1, 0, CURB, z, z1, 1, false, 'X');
    }
    RAISED.push({ x0, x1, z0, z1 });
  };
  // A block's pavement: a slab with rounded corners, as London kerbs are, broken where a road leaves it.
  const roundSlab = (x0, x1, z0, z1, R) => {
    const pts = [], N = 6;
    const corner = (cx, cz, a0) => { for (let k = 0; k <= N; k++) { const a = a0 + k / N * Math.PI / 2; pts.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]); } };
    corner(x1 - R, z1 - R, 0); corner(x0 + R, z1 - R, Math.PI / 2); corner(x0 + R, z0 + R, Math.PI); corner(x1 - R, z0 + R, Math.PI * 1.5);
    const top = acc._b('pave'), kerb = acc._b('kerb');
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, y = CURB;
    for (let k = 0; k < pts.length; k++) {
      const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length];
      // top: a fan from the middle, wound to face up
      acc._quad(top, [mx, y, mz], [bx, y, bz], [ax, y, az], [ax, y, az], 0, 1, 0, [mx / 4, -mz / 4], [bx / 4, -bz / 4], [ax / 4, -az / 4], [ax / 4, -az / 4]);
      // kerb face, facing out
      const nx = bz - az, nz = -(bx - ax), L = Math.hypot(nx, nz) || 1;
      acc._quad(kerb, [bx, 0, bz], [ax, 0, az], [ax, y, az], [bx, y, bz], nx / L, 0, nz / L, [0, 0], [1, 0], [1, 1], [0, 1]);
    }
    RAISED.push({ x0, x1, z0, z1, R });
  };
  for (const B of BLOCKS) {
    const cres = B.i === CRESCENT.bi && B.j === CRESCENT.bj;
    if (cres) { slab(B.kx0, B.kx1, B.kz0, B.kz1, 'pave', CRESCENT_MOUTHS); RAISED[RAISED.length - 1].R = 0; }
    else roundSlab(B.kx0, B.kx1, B.kz0, B.kz1, 3.2);
    if (cres) crescentGround(acc, city);
    if (B.special && B.special.kind === 'square') squareGarden(acc, B, city);
  }
  for (const m of city.mews || []) acc.box('cobble', m.x0, m.x1, CURB, CURB + 0.003, m.z0, m.z1, 3, false, 'Y');
  // Outer pavements beyond the edge streets.
  const X0 = XS[0], X6 = XS[6], Z0 = ZS[0], Z6 = ZS[6];
  slab(BOUNDS.x0 - 40, X0.x - X0.w / 2, BOUNDS.z0 - 40, BOUNDS.z1 + 40);          // Hyde Park side
  slab(X6.x + X6.w / 2, BOUNDS.x1 + 40, BOUNDS.z0 - 40, BOUNDS.z1 + 40);          // east
  slab(X0.x + X0.w / 2, X6.x - X6.w / 2, BOUNDS.z0 - 40, Z0.z - Z0.w / 2);        // north
  slab(X0.x + X0.w / 2, X6.x - X6.w / 2, Z6.z + Z6.w / 2, BOUNDS.z1 + 40);        // Green Park side
  // Parks: grass beyond the railings.
  acc.box('grass', BOUNDS.x0 - 60, X0.x - X0.w / 2 - 4, CURB, CURB + 0.02, BOUNDS.z0 - 60, BOUNDS.z1 + 60, 6, false, 'Y');
  acc.box('grass', X0.x + X0.w / 2, X6.x - X6.w / 2, CURB, CURB + 0.02, Z6.z + Z6.w / 2 + 4, BOUNDS.z1 + 60, 6, false, 'Y');
  const g = acc.build(mats, null, 'ground');
  scene.add(g);

  // Park railings and trees along Park Lane and Piccadilly.
  const parkRail = [];
  const px = X0.x - X0.w / 2 - 3.6;
  parkRail.push([px, BOUNDS.z0 - 40, px, BOUNDS.z1 + 40]);
  const pz = Z6.z + Z6.w / 2 + 3.6;
  parkRail.push([X0.x + X0.w / 2, pz, X6.x - X6.w / 2, pz]);
  city.parkRails = parkRail;
  city.solids.push({ x0: BOUNDS.x0 - 60, x1: px, z0: BOUNDS.z0 - 60, z1: BOUNDS.z1 + 60 });
  city.solids.push({ x0: X0.x + X0.w / 2, x1: X6.x - X6.w / 2, z0: pz, z1: BOUNDS.z1 + 60 });
  return { roadMesh, reflector, mats };
}

// Garden square: lawn, gravel walks, railings with gates, a central feature.
function squareGarden(acc, B, city) {
  const inset = 3.2, x0 = B.kx0 + inset, x1 = B.kx1 - inset, z0 = B.kz0 + inset, z1 = B.kz1 - inset;
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  acc.box('grass', x0, x1, CURB, CURB + 0.03, z0, z1, 6, false, 'Y');
  acc.box('gravel', cx - 1.6, cx + 1.6, CURB, CURB + 0.05, z0, z1, 3, false, 'Y');
  acc.box('gravel', x0, x1, CURB, CURB + 0.05, cz - 1.6, cz + 1.6, 3, false, 'Y');
  acc.box('gravel', cx - 5, cx + 5, CURB, CURB + 0.055, cz - 5, cz + 5, 3, false, 'Y');
  city.squareRails = city.squareRails || [];
  // railings, leaving a gate in the middle of each side
  const gate = 2.2;
  city.squareRails.push([x0, z0, cx - gate, z0], [cx + gate, z0, x1, z0], [x0, z1, cx - gate, z1], [cx + gate, z1, x1, z1],
    [x0, z0, x0, cz - gate], [x0, cz + gate, x0, z1], [x1, z0, x1, cz - gate], [x1, cz + gate, x1, z1]);
  const t = 0.12;
  city.solids.push({ x0: x0 - t, x1: cx - gate, z0: z0 - t, z1: z0 + t }, { x0: cx + gate, x1: x1 + t, z0: z0 - t, z1: z0 + t },
    { x0: x0 - t, x1: cx - gate, z0: z1 - t, z1: z1 + t }, { x0: cx + gate, x1: x1 + t, z0: z1 - t, z1: z1 + t },
    { x0: x0 - t, x1: x0 + t, z0: z0, z1: cz - gate }, { x0: x0 - t, x1: x0 + t, z0: cz + gate, z1: z1 },
    { x0: x1 - t, x1: x1 + t, z0: z0, z1: cz - gate }, { x0: x1 - t, x1: x1 + t, z0: cz + gate, z1: z1 });
  city.squareCentres = city.squareCentres || [];
  city.squareCentres.push({ x: cx, z: cz, name: B.special.name, x0, x1, z0, z1 });
}

// Railings as alpha-tested quads, one merged mesh.
export function buildRailings(scene, lines, h = 1.3) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 2, 64, 4); g.fillRect(0, 50, 64, 4);
  for (let x = 2; x < 64; x += 10.67) { g.fillRect(x, 0, 2.5, 64); g.beginPath(); g.moveTo(x - 2, 4); g.lineTo(x + 1.2, -4); g.lineTo(x + 4.5, 4); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping;
  const mat = patchCutout(new THREE.MeshBasicMaterial({ color: 0x15141a, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide }));
  const p = [], uv = [];
  for (const [ax, az, bx, bz] of lines) {
    const L = Math.hypot(bx - ax, bz - az);
    const y0 = CURB, y1 = CURB + h;
    p.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az);
    uv.push(0, 0, L / 1.2, 0, L / 1.2, 1, 0, 0, L / 1.2, 1, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  scene.add(m);
  return m;
}

// Pevensey Crescent: carriageway, kerbs, dropped kerbs at the mouths, and the railed garden.
function crescentGround(acc, city) {
  const C = CRESCENT, y = CURB + 0.004;
  const P = (r, phi, yy = y) => { const [x, z] = crescentPt(r, phi); return [x, yy, z]; };
  const up = (key, a, b, c, d, uvw = 4) => {
    const pts = [a, b, c, d];
    const cr = (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]);
    const q = cr > 0 ? pts : [b, a, d, c];
    const uv = q.map((p) => [p[0] / uvw, -p[2] / uvw]);
    acc._quad(acc._b(key), q[0], q[1], q[2], q[3], 0, 1, 0, uv[0], uv[1], uv[2], uv[3]);
  };
  const lim = (r) => Math.acos((C.cx - C.mouthX) / r);
  const N = 56, mi = lim(C.rIn), mo = lim(C.rOut);
  for (let i = 0; i < N; i++) {
    const t0 = -1 + 2 * i / N, t1 = -1 + 2 * (i + 1) / N;
    up('setts', P(C.rIn, t0 * mi), P(C.rOut, t0 * mo), P(C.rOut, t1 * mo), P(C.rIn, t1 * mi));
    // kerbs: a raised strip on each pavement edge, with a face towards the road
    for (const [r, s, m] of [[C.rIn, -1, mi], [C.rOut, 1, mo]]) {
      const a0 = t0 * m, a1 = t1 * m, yk = CURB + 0.04;
      up('kerb', P(r, a0, yk), P(r + s * 0.28, a0, yk), P(r + s * 0.28, a1, yk), P(r, a1, yk), 1);
      const q = [P(r, a0, y), P(r, a1, y), P(r, a1, yk), P(r, a0, yk)];
      // the face points into the road: outwards from the centre on the inner kerb, inwards on the outer
      const ox = (q[0][0] - C.cx) * -s, oz = (q[0][2] - C.cz) * -s;
      const ux = q[1][0] - q[0][0], uz = q[1][2] - q[0][2]; // along the kerb; up is +y
      const nx = -uz, nz = ux; // (b-a) x (d-a) with d-a straight up
      if (nx * ox + nz * oz > 0) acc.quad('kerb', q[0], q[1], q[2], q[3], 1); else acc.quad('kerb', q[1], q[0], q[3], q[2], 1);
    }
  }
  // dropped kerbs down to Dover Street
  for (const [a, b] of CRESCENT_MOUTHS) {
    const x0 = C.mouthX, x1 = C.mouthX + RAMP;
    acc.quad('setts', [x0, CURB, b], [x1, 0.002, b], [x1, 0.002, a], [x0, CURB, a], 4);
  }
  // the garden: grass in a D between the inner pavement and Dover Street
  const gx = C.gardenX, pg = Math.acos((C.cx - gx) / C.rGarden), M = 28, yg = CURB + 0.03;
  const mid = [gx, yg, C.cz];
  for (let i = 0; i < M; i++) {
    const a0 = -pg + 2 * pg * i / M, a1 = -pg + 2 * pg * (i + 1) / M;
    up('grass', mid, P(C.rGarden, a0, yg), P(C.rGarden, a1, yg), P(C.rGarden, a1, yg), 6);
  }
  // gravel walk in from a gate on the Dover Street side, round a stone urn
  acc.box('gravel', C.cx - 8.5, gx, CURB, CURB + 0.05, C.cz - 1.1, C.cz + 1.1, 3, false, 'Y');
  acc.box('stone', C.cx - 9.6, C.cx - 7.4, CURB, CURB + 0.9, C.cz - 1.1, C.cz + 1.1, 2, true);
  acc.cyl('stone', C.cx - 8.5, C.cz, 0.45, CURB + 0.9, CURB + 1.5, 10, 0.6);
  // railings round the garden, with a gate on the Dover Street side
  city.squareRails = city.squareRails || [];
  const rails = city.squareRails, gate = 1.2, t = 0.12;
  const ends = [crescentPt(C.rGarden, -pg), crescentPt(C.rGarden, pg)];
  rails.push([gx, ends[0][1], gx, C.cz - gate], [gx, C.cz + gate, gx, ends[1][1]]);
  city.solids.push({ x0: gx - t, x1: gx + t, z0: ends[0][1], z1: C.cz - gate }, { x0: gx - t, x1: gx + t, z0: C.cz + gate, z1: ends[1][1] });
  const RS = 24;
  for (let i = 0; i < RS; i++) {
    const [ax, az] = crescentPt(C.rGarden, -pg + 2 * pg * i / RS), [bx, bz] = crescentPt(C.rGarden, -pg + 2 * pg * (i + 1) / RS);
    rails.push([ax, az, bx, bz]);
    city.solids.push({ x0: Math.min(ax, bx) - t, x1: Math.max(ax, bx) + t, z0: Math.min(az, bz) - t, z1: Math.max(az, bz) + t });
  }
  // lamps on both pavements, trees in the garden, for the props pass
  city.extraLamps = city.extraLamps || [];
  for (let k = -3; k <= 3; k++) {
    const a = k * 0.36;
    city.extraLamps.push(crescentPt(C.rOut + 0.4, a));
    if (Math.abs(k) <= 2 && k !== 0) city.extraLamps.push(crescentPt(C.rIn - 0.55, a * 1.15));
  }
  city.extraTrees = city.extraTrees || [];
  for (const a of [-0.9, 0.9]) { const [x, z] = crescentPt(C.rGarden - 3.4, a); city.extraTrees.push([x, z, 0.8]); }
  for (const s of [-1, 1]) city.extraTrees.push([90.2, C.cz + s * 26.5, 0.95]);
  city.crescent = C;
}

import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Acc } from './geom.js';
import { BLOCKS, XS, ZS, BOUNDS } from './map.js';
import * as TX from '../render/textures.js';
import { toon } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';

export const CURB = 0.15;

// Ground height at a point: pavements, squares and mews are raised by a kerb.
let RAISED = [];
export function groundY(x, z) {
  for (const r of RAISED) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return CURB;
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
  const slab = (x0, x1, z0, z1, top = 'pave') => {
    acc.box(top, x0, x1, CURB - 0.001, CURB, z0, z1, 4, false, 'Y');
    acc.box('kerb', x0, x1, 0, CURB, z0, z1, 1, false, 'xXzZ');
    RAISED.push({ x0, x1, z0, z1 });
  };
  for (const B of BLOCKS) {
    slab(B.kx0, B.kx1, B.kz0, B.kz1);
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

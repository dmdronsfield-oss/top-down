import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, inkMat, glow } from '../render/materials.js';
import { signTexture } from '../render/textures.js';

// Motors of 1934. Bodies are side profiles extruded across the car and bevelled, so they
// read as pressed steel: long bonnets, sweeping wings that run into the running boards,
// upright radiators, wire wheels and big chrome headlamps. Each faces +z.
const T = 0.022;
const CHROME = '#d9d4c8', TYRE = '#141317', GLASS = '#2a2f3c';

// Ink outline with smoothed normals, so hard-edged bodywork keeps an unbroken line.
function ink(mesh, geo, t = T) {
  const g = geo.clone(); g.deleteAttribute('uv'); g.deleteAttribute('normal');
  const s = mergeVertices(g, 1e-3); s.computeVertexNormals();
  const o = new THREE.Mesh(s, inkMat(t)); o.userData.ink = true; o.raycast = () => {};
  mesh.add(o); return mesh;
}
function solid(g, geo, col, t = T, extra) { const m = new THREE.Mesh(geo, typeof col === 'string' ? toon(col, extra) : col); if (t) ink(m, geo, t); g.add(m); return m; }
function box(g, w, h, d, col, x, y, z, t = T) { const m = solid(g, new THREE.BoxGeometry(w, h, d), col, t); m.position.set(x, y, z); return m; }
function cyl(g, r, l, col, x, y, z, rotZ = 0, rotX = 0, seg = 14, t = T) { const m = solid(g, new THREE.CylinderGeometry(r, r, l, seg), col, t); m.position.set(x, y, z); m.rotation.z = rotZ; m.rotation.x = rotX; return m; }

// A side profile [[z, y], ...] (front first is fine) extruded to width w, centred on x.
function profile(g, pts, w, col, x = 0, bevel = 0.05, t = T) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, w - bevel * 2), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6 });
  geo.rotateY(-Math.PI / 2); geo.translate(x + (w - bevel * 2) / 2, 0, 0);
  return solid(g, geo, col, t);
}
// Sample a smooth curve through control points (Catmull-Rom) as [z, y] pairs.
function curve(ctrl, n = 24) { const c = new THREE.CatmullRomCurve3(ctrl.map(([z, y]) => new THREE.Vector3(z, y, 0)), false, 'centripetal'); return c.getPoints(n).map((p) => [p.x, p.y]); }

// One-piece wing and running board: rises over the front wheel, sweeps down to the board,
// rises over the rear wheel. zf/zr are the wheel centres, r the wheel radius.
function wings(g, col, zf, zr, r, xo, w = 0.3, board = 0.4) {
  const top = curve([[zf + r * 2.1, r + 0.12], [zf + r * 1.2, r * 2.05], [zf, r * 2.25], [zf - r * 1.0, r * 1.9], [zf - r * 1.9, board + 0.06],
    [zr + r * 1.6, board + 0.06], [zr + r * 0.9, r * 2.0], [zr, r * 2.2], [zr - r * 1.15, r * 1.75], [zr - r * 1.6, r + 0.08]], 40);
  const bot = top.slice().reverse().map(([z, y], i, a) => [z, y - 0.07]);
  for (const s of [-1, 1]) profile(g, top.concat(bot), w, col, s * xo, 0.02, 0.018);
}
function wheel(r = 0.38, w = 0.2, wire = true, wall = false) {
  const g = new THREE.Group();
  const tyre = cyl(g, r, w, TYRE, 0, 0, 0, Math.PI / 2, 0, 20, 0.02);
  if (wall) cyl(g, r * 0.82, w + 0.01, '#e8e2d4', 0, 0, 0, Math.PI / 2, 0, 18, 0);
  cyl(g, r * 0.66, w + 0.02, wire ? '#4a4640' : '#26252b', 0, 0, 0, Math.PI / 2, 0, 18, 0);
  cyl(g, r * 0.2, w + 0.08, CHROME, 0, 0, 0, Math.PI / 2, 0, 10, 0.01);
  if (wire) {
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, b = a + 0.4, xs = (i % 2 ? 1 : -1) * w * 0.32;
      pts.push(xs, Math.cos(a) * r * 0.18, Math.sin(a) * r * 0.18, -xs * 0.2, Math.cos(b) * r * 0.64, Math.sin(b) * r * 0.64);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xcfc8b8 })));
  } else {
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, r * 1.1, 0.05), toon('#3a3840')); s.rotation.x = i * Math.PI / 6; g.add(s); }
  }
  g.userData.isWheel = true;
  return g;
}
function addWheels(g, zf, zr, track, r, w, wire, wall) {
  const ws = [];
  for (const [x, z] of [[-track, zf], [track, zf], [-track, zr], [track, zr]]) { const k = wheel(r, w, wire, wall); k.position.set(x, r, z); g.add(k); ws.push(k); }
  g.userData.wheels = ws; g.userData.front = [ws[0], ws[1]];
}
// Big chrome headlamps on a bar between the wings, with a faint beam that catches the rain.
function headlamps(g, xo, y, z, r = 0.15) {
  const lamps = [];
  for (const s of [-1, 1]) {
    const bowl = solid(g, new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), CHROME, 0.012);
    bowl.rotation.x = -Math.PI / 2; bowl.position.set(s * xo, y, z);
    const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.92, 16), glow('#fff2c8', 2.6)); face.position.set(s * xo, y, z + 0.005); g.add(face);
    lamps.push(face);
  }
  box(g, xo * 2, 0.04, 0.04, CHROME, 0, y - r * 0.9, z - 0.1, 0.008);
  // light beams (only shown when someone is driving)
  const beams = new THREE.Group(); beams.name = 'beams';
  const bm = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const s of [-1, 1]) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.5, 9, 18, 1, true), bm);
    c.rotation.x = -Math.PI / 2 - 0.08; c.position.set(s * xo, y - 0.2, z + 4.5); c.raycast = () => {};
    beams.add(c);
  }
  beams.visible = false; g.add(beams);
  g.userData.beams = beams;
  return lamps;
}
function radiator(g, w, h, y, z, col = CHROME) {
  box(g, w, h, 0.1, col, 0, y, z, 0.015);
  const slats = new THREE.Group();
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, h * 0.82, 0.02), toon('#1c1b20')); s.position.set(-w * 0.38 + i * w * 0.095, y, z + 0.055); slats.add(s); }
  g.add(slats);
  g.userData.radiator = { x: 0, y: y + h / 2 + 0.05, z: z - 0.1 };
}
function tail(g, x, y, z) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.05), glow('#ff3020', 1.0)); l.position.set(x, y, z); g.add(l); (g.userData.tails = g.userData.tails || []).push(l); }
function glassPane(g, w, h, x, y, z, ry = 0) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow('#3d3a46', 0.55)); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); return p; }
function sideSign(g, tex, w, h, xo, y, z) { for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(s * xo, y, z); p.rotation.y = s * Math.PI / 2; g.add(p); } }

// ---------------------------------------------------------------- the motors
export function roadster(col = '#d9cfb0', trim = '#6a1f2a') {
  const g = new THREE.Group();
  const zf = 1.3, zr = -1.25, r = 0.38;
  addWheels(g, zf, zr, 0.74, r, 0.17, true, true);
  // long bonnet, low scuttle, cut-down doors, boat tail
  profile(g, [[1.72, 0.5], [1.78, 1.06], [0.0, 1.13], [-0.2, 1.0], [-1.35, 1.0], ...curve([[-1.35, 1.0], [-1.9, 0.98], [-2.25, 0.75], [-2.2, 0.5]], 8).slice(1)], 1.12, col);
  profile(g, [[-0.15, 0.95], [-0.15, 1.08], [-1.4, 1.08], [-1.4, 0.95]], 1.16, '#2a1d16', 0, 0.03, 0.01); // leather rim
  box(g, 1.0, 0.3, 0.8, trim, 0, 0.98, -0.95, 0);                                                         // seat
  radiator(g, 0.78, 0.62, 0.86, 1.8);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) box(g, 0.01, 0.2, 0.05, '#3a3530', s * 0.58, 0.88, 1.2 - i * 0.16, 0); // louvres
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.34), new THREE.MeshBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.3, side: THREE.DoubleSide })); ws.position.set(0, 1.32, -0.12); ws.rotation.x = -0.3; g.add(ws);
  box(g, 1.04, 0.035, 0.035, CHROME, 0, 1.49, -0.06, 0);
  wings(g, col, zf, zr, r, 0.74, 0.3, 0.38);
  const sp = wheel(0.34, 0.15, true, true); sp.rotation.y = 0.12; sp.position.set(0.78, 0.82, 0.25); g.add(sp); // side-mounted spare
  g.userData.lamps = headlamps(g, 0.5, 1.02, 1.95);
  tail(g, -0.45, 0.72, -2.2); tail(g, 0.45, 0.72, -2.2);
  g.userData.seats = { driver: [-0.28, 0.55, -0.95], passenger: [0.28, 0.55, -0.95] };
  g.userData.open = true;
  return g;
}

export function saloon(col = '#121116', col2 = '#4a1a24') {
  const g = new THREE.Group();
  const zf = 1.55, zr = -1.6, r = 0.42;
  addWheels(g, zf, zr, 0.8, r, 0.2, true, false);
  // lower body to the waist, then a glasshouse and a roof
  profile(g, [[2.3, 0.52], [2.36, 1.22], [0.55, 1.32], [-1.6, 1.32], ...curve([[-1.6, 1.32], [-2.15, 1.25], [-2.45, 0.95], [-2.42, 0.52]], 8).slice(1)], 1.5, col2);
  profile(g, [[0.5, 1.3], [0.2, 1.98], [-1.5, 1.98], [-1.85, 1.3]], 1.36, GLASS, 0, 0.02, 0.016);
  profile(g, [[0.25, 1.96], [0.18, 2.1], [-1.55, 2.1], [-1.55, 1.96]], 1.44, col, 0, 0.04, 0.016);
  for (const zz of [0.33, -0.65, -1.72]) for (const s of [-1, 1]) box(g, 0.05, 0.68, zz === -1.72 ? 0.32 : 0.1, col, s * 0.69, 1.64, zz, 0.008); // pillars
  box(g, 1.38, 0.68, 0.06, col, 0, 1.64, -1.86, 0.008);
  radiator(g, 0.86, 0.72, 1.02, 2.38);
  const lady = solid(g, new THREE.ConeGeometry(0.045, 0.16, 5), '#e8e2d4', 0.006); lady.position.set(0, 1.47, 2.36);
  box(g, 0.95, 0.4, 0.55, '#1a181d', 0, 1.0, -2.55, 0.015); // luggage trunk
  wings(g, col, zf, zr, r, 0.82, 0.32, 0.4);
  g.userData.lamps = headlamps(g, 0.58, 1.18, 2.48, 0.16);
  tail(g, -0.55, 0.9, -2.45); tail(g, 0.55, 0.9, -2.45);
  g.userData.seats = { driver: [-0.36, 0.78, -0.1], passenger: [0.36, 0.78, -1.15] };
  return g;
}

export function taxi() {
  const g = new THREE.Group();
  const zf = 1.35, zr = -1.3, r = 0.4, black = '#16151a';
  addWheels(g, zf, zr, 0.74, r, 0.19, false, false);
  profile(g, [[1.9, 0.55], [1.95, 1.18], [0.55, 1.22], [0.55, 0.95], [0.0, 0.95], [0.0, 1.25], [-1.75, 1.25], [-1.82, 0.55]], 1.36, black);
  // tall carriage-work for the passengers, and an open seat for the driver
  profile(g, [[0.05, 1.24], [0.05, 2.0], [-1.7, 2.0], [-1.78, 1.24]], 1.38, GLASS, 0, 0.02, 0.016);
  profile(g, [[0.12, 1.98], [0.12, 2.12], [-1.8, 2.12], [-1.8, 1.98]], 1.46, black, 0, 0.04, 0.016);
  for (const zz of [0.0, -0.85, -1.72]) for (const s of [-1, 1]) box(g, 0.05, 0.75, 0.12, black, s * 0.7, 1.62, zz, 0.008);
  box(g, 0.55, 0.06, 0.6, '#2a2620', 0.32, 1.0, 0.3, 0); // luggage platform beside the driver
  radiator(g, 0.78, 0.6, 0.92, 1.98);
  wings(g, black, zf, zr, r, 0.76, 0.28, 0.42);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.08), glow('#ffcf6a', 1.6)); sign.position.set(0, 2.22, 0.08); g.add(sign);
  g.userData.lamps = headlamps(g, 0.52, 1.1, 2.05, 0.14);
  tail(g, -0.55, 0.85, -1.85); tail(g, 0.55, 0.85, -1.85);
  g.userData.seats = { driver: [-0.36, 0.62, 0.3], passenger: [0.22, 0.75, -0.85] };
  g.userData.sign = sign;
  return g;
}

export function bakersVan(label = 'HOVINGHAM’S BREAD', col = '#2c4a36', box2 = '#e2d6b5', fg = '#7a1f1f') {
  const g = new THREE.Group();
  const zf = 1.5, zr = -1.4, r = 0.42;
  addWheels(g, zf, zr, 0.8, r, 0.21, false, false);
  profile(g, [[2.15, 0.55], [2.2, 1.18], [1.0, 1.25], [0.6, 1.95], [0.1, 2.05], [0.1, 0.55]], 1.5, col);
  glassPane(g, 1.2, 0.5, 0, 1.62, 0.82).rotation.x = -0.55;
  profile(g, [[0.12, 0.6], [0.12, 2.35], [-2.45, 2.35], [-2.5, 0.6]], 1.72, box2, 0, 0.05);
  sideSign(g, signTexture(label, { w: 512, h: 128, bg: box2, fg, border: col }), 2.2, 0.55, 0.87, 1.75, -1.2);
  radiator(g, 0.8, 0.6, 0.92, 2.22);
  wings(g, col, zf, zr, r, 0.82, 0.3, 0.42);
  g.userData.lamps = headlamps(g, 0.55, 1.12, 2.3, 0.14);
  tail(g, -0.7, 0.8, -2.52); tail(g, 0.7, 0.8, -2.52);
  g.userData.seats = { driver: [-0.35, 0.72, 0.55], passenger: [0.35, 0.72, 0.55] };
  return g;
}

export function blackMaria() {
  const g = bakersVan('METROPOLITAN POLICE', '#0e0e14', '#14141c', '#e8e2d4');
  // barred windows at the back
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) box(g, 0.02, 0.4, 0.03, '#8a8a90', s * 0.88, 1.6, -0.4 - i * 0.12 - 1.4, 0);
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.12), glow('#9fc3ff', 1.6)); s.position.set(0, 2.5, 0.0); g.add(s);
  g.userData.beacon = s;
  return g;
}

export function milkFloat() {
  const g = new THREE.Group();
  addWheels(g, 1.1, -1.1, 0.7, 0.3, 0.16, false, false);
  box(g, 1.5, 0.25, 3.2, '#e8e2d4', 0, 0.55, -0.2);
  profile(g, [[1.45, 0.65], [1.45, 1.5], [0.55, 1.55], [0.55, 0.65]], 1.4, '#2a3a6a', 0, 0.06);
  for (let i = 0; i < 3; i++) for (const x of [-0.4, 0.4]) {
    box(g, 0.6, 0.3, 0.55, '#7a5a3a', x, 0.83, -0.4 - i * 0.6, 0.012);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 6), toon('#f2eee2')); b.position.set(x - 0.2 + (k % 2) * 0.4, 1.05, -0.5 - i * 0.6 + Math.floor(k / 2) * 0.25); g.add(b); }
  }
  for (const [x, z] of [[-0.7, 1.5], [0.7, 1.5], [-0.7, -1.7], [0.7, -1.7]]) box(g, 0.06, 1.5, 0.06, '#e8e2d4', x, 1.4, z, 0.01);
  profile(g, [[1.8, 2.12], [1.75, 2.24], [-1.85, 2.24], [-1.9, 2.12]], 1.6, '#2a3a6a', 0, 0.03);
  sideSign(g, signTexture('MAYFAIR DAIRY', { w: 512, h: 96, bg: '#2a3a6a', fg: '#f2eee2', border: '#f2eee2' }), 1.8, 0.28, 0.81, 2.0, -0.1);
  g.userData.lamps = headlamps(g, 0.5, 0.9, 1.55, 0.08);
  g.userData.seats = { driver: [-0.3, 0.6, 0.95], passenger: [0.3, 0.6, -0.5] };
  return g;
}

export function tender() {
  const g = saloon('#0e0e14', '#0e0e14');
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.12), glow('#9fc3ff', 1.6)); s.position.set(0, 2.24, -0.4); g.add(s);
  const tex = signTexture('POLICE', { w: 256, h: 64, bg: '#0e0e14', fg: '#e8e2d4', border: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.18), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(0, 2.24, -0.335); g.add(p);
  const bell = solid(g, new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c9a44c', 0.01); bell.rotation.x = Math.PI; bell.position.set(0.5, 1.35, 2.35);
  g.userData.beacon = s;
  return g;
}

export function omnibus() {
  const g = new THREE.Group();
  const red = '#a3201b';
  addWheels(g, 2.4, -2.4, 0.95, 0.5, 0.3, false, false);
  // a covered-top double-decker with a snub bonnet and an open platform at the back
  const rnd = curve([[3.6, 4.25], [3.75, 4.1], [3.8, 3.8]], 4);
  profile(g, [[3.8, 0.6], [3.8, 2.6], ...rnd.slice().reverse().map(([z, y]) => [z, y]), [-3.45, 4.3], [-3.7, 4.05], [-3.7, 0.6]].filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]), 2.3, red, 0, 0.08);
  profile(g, [[4.5, 0.6], [4.5, 1.6], [3.8, 1.75], [3.8, 0.6]], 1.4, red, 0, 0.05);
  box(g, 2.34, 0.18, 7.6, '#e8e2d4', 0, 2.75, 0.05, 0.012);
  for (const s of [-1, 1]) for (const y of [2.05, 3.65]) for (let i = 0; i < 6; i++) glassPane(g, 0.98, 0.72, s * 1.17, y, 3.0 - i * 1.15, s * Math.PI / 2).material = glow('#ffcf8a', 1.2);
  for (const s of [-1, 1]) for (const y of [2.05, 3.65]) for (let i = 0; i < 7; i++) box(g, 0.03, 0.8, 0.12, red, s * 1.16, y, 3.58 - i * 1.15, 0);
  sideSign(g, signTexture('GENERAL', { w: 512, h: 96, bg: red, fg: '#f2d98a', border: '#f2d98a' }), 3, 0.42, 1.18, 2.4, 0.4);
  sideSign(g, signTexture('MANDEVILLE’S COCOA', { w: 512, h: 96, bg: '#1b2a4a', fg: '#f2eee2' }), 4.5, 0.42, 1.18, 3.05, 0);
  radiator(g, 0.9, 0.8, 1.15, 4.52, '#2a2a30');
  wings(g, '#1a1a1e', 2.4, -2.4, 0.5, 0.98, 0.34, 0.5);
  g.userData.lamps = headlamps(g, 0.62, 1.4, 4.6, 0.16);
  g.userData.seats = { driver: [-0.7, 1.2, 3.0], passenger: [0, 1.0, -3] };
  return g;
}

export const TYPES = {
  roadster: { build: () => roadster(), len: 4.6, wid: 1.7, maxV: 26, accel: 9.5, turn: 2.3, grip: 6.0, mass: 1, horn: 'parp' },
  roadsterBlue: { build: () => roadster('#2a3a5a', '#c9c3b5'), len: 4.6, wid: 1.7, maxV: 25, accel: 9, turn: 2.3, grip: 6.0, mass: 1, horn: 'parp' },
  taxi: { build: taxi, len: 4.0, wid: 1.75, maxV: 17, accel: 7, turn: 2.6, grip: 6.5, mass: 1.1, horn: 'honk' },
  saloon: { build: () => saloon(), len: 4.9, wid: 1.85, maxV: 21, accel: 7.5, turn: 1.9, grip: 5.5, mass: 1.5, horn: 'honk' },
  saloonGreen: { build: () => saloon('#1c2a22', '#2c4a36'), len: 4.9, wid: 1.85, maxV: 21, accel: 7.5, turn: 1.9, grip: 5.5, mass: 1.5, horn: 'honk' },
  van: { build: () => bakersVan(), len: 5.0, wid: 1.85, maxV: 15, accel: 6, turn: 1.9, grip: 5.5, mass: 1.6, horn: 'honk' },
  float: { build: milkFloat, len: 3.9, wid: 1.6, maxV: 8.5, accel: 3.5, turn: 2.2, grip: 7.0, mass: 1.2, horn: 'bell', quiet: true },
  tender: { build: tender, len: 4.9, wid: 1.85, maxV: 23, accel: 9, turn: 2.1, grip: 6.0, mass: 1.6, horn: 'bell' },
  maria: { build: blackMaria, len: 5.0, wid: 1.85, maxV: 20, accel: 7, turn: 1.9, grip: 5.8, mass: 1.8, horn: 'bell' },
  omnibus: { build: omnibus, len: 8.4, wid: 2.4, maxV: 12, accel: 3.5, turn: 1.2, grip: 6, mass: 4, horn: 'honk', noDrive: true },
};

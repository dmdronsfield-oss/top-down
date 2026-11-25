import * as THREE from 'three';
import { toon, inked, glow } from '../render/materials.js';
import { signTexture } from '../render/textures.js';

// Motors of 1934, built from simple solids with ink outlines. Each faces +z.
const T = 0.025;
function box(g, w, h, d, col, x, y, z, t = T) { const m = inked(new THREE.BoxGeometry(w, h, d), toon(col), t); m.position.set(x, y, z); g.add(m); return m; }
function cyl(g, r, l, col, x, y, z, rotZ = 0, rotX = 0, seg = 14, t = T) { const m = inked(new THREE.CylinderGeometry(r, r, l, seg), toon(col), t); m.position.set(x, y, z); m.rotation.z = rotZ; m.rotation.x = rotX; g.add(m); return m; }

function wheel(r = 0.38, w = 0.2, spokes = true) {
  const g = new THREE.Group();
  const tyre = inked(new THREE.CylinderGeometry(r, r, w, 18), toon('#141317'), 0.02); tyre.rotation.z = Math.PI / 2; g.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 14), toon(spokes ? '#c9c3b5' : '#2a2a2e')); hub.rotation.z = Math.PI / 2; g.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, w + 0.05, 8), toon('#e6e0d0')); cap.rotation.z = Math.PI / 2; g.add(cap);
  if (spokes) for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, r * 1.05, 0.03), toon('#6b665c')); s.rotation.x = i * Math.PI / 4; g.add(s); }
  g.userData.isWheel = true;
  return g;
}
function wing(g, len, col, x, y, z, r = 0.44) {
  // a sweeping mudguard: half a tube over the wheel
  const m = inked(new THREE.CylinderGeometry(r, r, 0.3, 14, 1, true, 0, Math.PI), toon(col, { side: THREE.DoubleSide }), 0.02);
  // axis across the car, arch on top, stretched along the car's length
  m.rotation.z = Math.PI / 2; m.position.set(x, y, z); m.scale.set(1, 1, Math.max(1, len / (2 * r))); g.add(m); return m;
}
function lamp(g, x, y, z, r = 0.12) {
  const l = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), glow('#fff2c8', 2.4)); l.position.set(x, y, z); g.add(l);
  const rim = inked(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.08, 10), toon('#d8d2c4'), 0.01); rim.rotation.x = Math.PI / 2; rim.position.set(x, y, z - 0.03); g.add(rim);
  return l;
}
function tail(g, x, y, z) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), glow('#ff3020', 1.8)); l.position.set(x, y, z); g.add(l); }
function addWheels(g, wb, track, r, w, spokes) {
  const ws = [];
  for (const [x, z] of [[-track, wb], [track, wb], [-track, -wb], [track, -wb]]) { const k = wheel(r, w, spokes); k.position.set(x, r, z); g.add(k); ws.push(k); }
  g.userData.wheels = ws; g.userData.front = [ws[0], ws[1]];
}

export function roadster(col = '#d9cfb0', trim = '#6a1f2a') {
  const g = new THREE.Group();
  addWheels(g, 1.25, 0.72, 0.38, 0.18, true);
  box(g, 1.15, 0.5, 2.0, col, 0, 0.78, 0.55);                         // bonnet
  box(g, 1.25, 0.55, 1.5, trim, 0, 0.82, -1.05);                      // cockpit tub
  box(g, 1.25, 0.18, 1.5, '#2a1d16', 0, 1.1, -1.05, 0);               // leather rim
  const tailG = inked(new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon(trim), T); tailG.scale.set(1, 0.7, 0.9); tailG.rotation.x = -Math.PI / 2; tailG.position.set(0, 0.82, -1.8); g.add(tailG);
  box(g, 0.9, 0.62, 0.12, '#cfc9bb', 0, 0.86, 1.6);                   // radiator shell
  box(g, 0.74, 0.5, 0.05, '#3a3a40', 0, 0.86, 1.67, 0);               // grille
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.36), new THREE.MeshBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); ws.position.set(0, 1.3, -0.35); ws.rotation.x = -0.25; g.add(ws);
  box(g, 1.06, 0.04, 0.04, '#cfc9bb', 0, 1.48, -0.3, 0);
  wing(g, 2.1, col, -0.72, 0.42, 1.1); wing(g, 2.1, col, 0.72, 0.42, 1.1);
  wing(g, 1.6, col, -0.72, 0.42, -1.25); wing(g, 1.6, col, 0.72, 0.42, -1.25);
  box(g, 0.25, 0.06, 1.0, col, -0.72, 0.36, -0.1); box(g, 0.25, 0.06, 1.0, col, 0.72, 0.36, -0.1); // running boards
  const sp = wheel(0.34, 0.16, true); sp.rotation.y = Math.PI / 2; sp.position.set(0, 0.85, -2.25); g.add(sp);
  g.userData.lamps = [lamp(g, -0.55, 1.0, 1.75), lamp(g, 0.55, 1.0, 1.75)];
  tail(g, -0.5, 0.75, -2.2); tail(g, 0.5, 0.75, -2.2);
  g.userData.seats = { driver: [-0.3, 0.55, -0.9], passenger: [0.3, 0.55, -0.9] };
  g.userData.open = true;
  return g;
}

export function taxi() {
  const g = new THREE.Group();
  addWheels(g, 1.3, 0.72, 0.4, 0.2, false);
  box(g, 1.25, 0.55, 1.4, '#16151a', 0, 0.85, 1.2);
  box(g, 1.4, 1.1, 2.0, '#16151a', 0, 1.25, -0.5);
  box(g, 1.42, 0.12, 2.1, '#0e0d11', 0, 1.86, -0.5);
  // windows (glow faintly from the cab lamp)
  for (const x of [-0.71, 0.71]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), glow('#5a5040', 0.8)); w.position.set(x, 1.45, -0.5); w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(w); }
  box(g, 0.25, 0.65, 0.6, '#16151a', -0.45, 0.95, 0.35); // open driver's side
  box(g, 0.85, 0.6, 0.1, '#c9c3b5', 0, 0.9, 1.92); box(g, 0.7, 0.48, 0.05, '#2a2a30', 0, 0.9, 1.98, 0);
  wing(g, 2.0, '#16151a', -0.72, 0.44, 1.2); wing(g, 2.0, '#16151a', 0.72, 0.44, 1.2);
  wing(g, 1.4, '#16151a', -0.72, 0.44, -1.3); wing(g, 1.4, '#16151a', 0.72, 0.44, -1.3);
  box(g, 0.3, 0.06, 1.3, '#16151a', -0.72, 0.38, 0); box(g, 0.3, 0.06, 1.3, '#16151a', 0.72, 0.38, 0);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), glow('#ffcf6a', 1.6)); sign.position.set(0, 2.02, 0.4); g.add(sign);
  g.userData.lamps = [lamp(g, -0.55, 1.05, 1.95), lamp(g, 0.55, 1.05, 1.95)];
  tail(g, -0.6, 0.8, -1.55); tail(g, 0.6, 0.8, -1.55);
  g.userData.seats = { driver: [-0.38, 0.6, 0.35], passenger: [0.2, 0.75, -0.8] };
  g.userData.sign = sign;
  return g;
}

export function saloon(col = '#121116', col2 = '#4a1a24') {
  const g = new THREE.Group();
  addWheels(g, 1.6, 0.78, 0.42, 0.2, true);
  box(g, 1.2, 0.6, 1.9, col2, 0, 0.92, 1.35);
  box(g, 1.55, 0.75, 2.8, col2, 0, 1.0, -0.65);
  box(g, 1.5, 0.75, 2.4, col, 0, 1.72, -0.75);
  box(g, 1.55, 0.08, 2.5, '#0c0b0f', 0, 2.12, -0.75);
  for (const x of [-0.76, 0.76]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.5), glow('#3a3540', 0.7)); w.position.set(x, 1.75, -0.75); w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(w); }
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.5), glow('#3a3540', 0.6)); ws.position.set(0, 1.75, 0.46); g.add(ws);
  box(g, 0.95, 0.75, 0.14, '#d8d2c4', 0, 1.0, 2.33); box(g, 0.78, 0.6, 0.05, '#2a2a30', 0, 1.0, 2.41, 0);
  const lady = inked(new THREE.ConeGeometry(0.05, 0.16, 5), toon('#e8e2d4'), 0.008); lady.position.set(0, 1.45, 2.3); g.add(lady);
  wing(g, 2.3, col, -0.8, 0.46, 1.4, 0.48); wing(g, 2.3, col, 0.8, 0.46, 1.4, 0.48);
  wing(g, 1.6, col, -0.8, 0.46, -1.6, 0.48); wing(g, 1.6, col, 0.8, 0.46, -1.6, 0.48);
  box(g, 0.3, 0.06, 1.6, col, -0.8, 0.4, -0.1); box(g, 0.3, 0.06, 1.6, col, 0.8, 0.4, -0.1);
  g.userData.lamps = [lamp(g, -0.62, 1.2, 2.4, 0.15), lamp(g, 0.62, 1.2, 2.4, 0.15)];
  tail(g, -0.6, 0.9, -2.08); tail(g, 0.6, 0.9, -2.08);
  g.userData.seats = { driver: [-0.38, 0.75, 0.0], passenger: [0.38, 0.75, -1.2] };
  return g;
}

export function bakersVan() {
  const g = new THREE.Group();
  addWheels(g, 1.4, 0.8, 0.4, 0.22, false);
  box(g, 1.2, 0.6, 1.2, '#2c4a36', 0, 0.85, 1.55);
  box(g, 1.5, 1.2, 1.0, '#2c4a36', 0, 1.25, 0.6);
  box(g, 1.7, 1.8, 2.6, '#e2d6b5', 0, 1.6, -1.2);
  const tex = signTexture('HOVINGHAM’S BREAD', { w: 512, h: 128, bg: '#e2d6b5', fg: '#7a1f1f', border: '#2c4a36' });
  for (const x of [-0.86, 0.86]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.55), new THREE.MeshBasicMaterial({ map: tex })); s.position.set(x, 1.9, -1.2); s.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(s); }
  box(g, 0.9, 0.55, 0.1, '#c9c3b5', 0, 0.9, 2.18); box(g, 0.74, 0.45, 0.05, '#2a2a30', 0, 0.9, 2.24, 0);
  wing(g, 1.6, '#2c4a36', -0.8, 0.44, 1.45); wing(g, 1.6, '#2c4a36', 0.8, 0.44, 1.45);
  g.userData.lamps = [lamp(g, -0.55, 1.05, 2.2), lamp(g, 0.55, 1.05, 2.2)];
  tail(g, -0.7, 0.8, -2.52); tail(g, 0.7, 0.8, -2.52);
  g.userData.seats = { driver: [-0.35, 0.7, 0.55], passenger: [0.35, 0.7, 0.55] };
  return g;
}

export function milkFloat() {
  const g = new THREE.Group();
  addWheels(g, 1.1, 0.7, 0.3, 0.16, false);
  box(g, 1.5, 0.25, 3.2, '#e8e2d4', 0, 0.55, -0.2);
  box(g, 1.4, 0.9, 0.9, '#2a3a6a', 0, 1.1, 1.0);
  for (let i = 0; i < 3; i++) for (const x of [-0.4, 0.4]) {
    box(g, 0.6, 0.3, 0.55, '#7a5a3a', x, 0.83, -0.4 - i * 0.6, 0.012);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 6), toon('#f2eee2')); b.position.set(x - 0.2 + (k % 2) * 0.4, 1.05, -0.5 - i * 0.6 + Math.floor(k / 2) * 0.25); g.add(b); }
  }
  for (const [x, z] of [[-0.7, 1.5], [0.7, 1.5], [-0.7, -1.7], [0.7, -1.7]]) box(g, 0.06, 1.5, 0.06, '#e8e2d4', x, 1.4, z, 0.01);
  box(g, 1.6, 0.06, 3.5, '#2a3a6a', 0, 2.16, -0.1);
  const tex = signTexture('MAYFAIR DAIRY', { w: 512, h: 96, bg: '#2a3a6a', fg: '#f2eee2', border: '#f2eee2' });
  for (const x of [-0.81, 0.81]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.28), new THREE.MeshBasicMaterial({ map: tex })); s.position.set(x, 2.0, -0.1); s.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(s); }
  g.userData.lamps = [lamp(g, -0.5, 0.9, 1.5, 0.08), lamp(g, 0.5, 0.9, 1.5, 0.08)];
  g.userData.seats = { driver: [-0.3, 0.6, 0.95], passenger: [0.3, 0.6, -0.5] };
  return g;
}

export function tender() {
  const g = saloon('#0e0e14', '#0e0e14');
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.2, 0.12), glow('#9fc3ff', 1.6)); s.position.set(0, 2.24, 0.0); g.add(s);
  const tex = signTexture('POLICE', { w: 256, h: 64, bg: '#0e0e14', fg: '#e8e2d4', border: false });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.18), new THREE.MeshBasicMaterial({ map: tex })); p.position.set(0, 2.24, 0.065); g.add(p);
  const bell = inked(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), toon('#c9a44c'), 0.01); bell.rotation.x = Math.PI; bell.position.set(0.5, 1.3, 2.3); g.add(bell);
  g.userData.beacon = s;
  return g;
}

export function omnibus() {
  const g = new THREE.Group();
  addWheels(g, 2.6, 0.95, 0.5, 0.3, false);
  box(g, 2.3, 1.9, 7.4, '#a3201b', 0, 1.7, 0);
  box(g, 2.3, 1.7, 7.4, '#a3201b', 0, 3.55, 0);
  box(g, 2.32, 0.18, 7.5, '#e8e2d4', 0, 2.7, 0);
  box(g, 2.35, 0.12, 7.6, '#3a1a18', 0, 4.45, 0);
  for (const x of [-1.16, 1.16]) for (const y of [1.95, 3.7]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 0.75), glow('#ffcf8a', 1.2)); w.position.set(x, y, 0.1); w.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(w); }
  const tex = signTexture('GENERAL', { w: 512, h: 96, bg: '#a3201b', fg: '#f2d98a', border: '#f2d98a' });
  for (const x of [-1.17, 1.17]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.42), new THREE.MeshBasicMaterial({ map: tex })); s.position.set(x, 2.35, 0.2); s.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(s); }
  const adv = signTexture('BOVRIL', { w: 512, h: 96, bg: '#1b2a4a', fg: '#f2eee2' });
  for (const x of [-1.17, 1.17]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 0.42), new THREE.MeshBasicMaterial({ map: adv })); s.position.set(x, 3.0, 0); s.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2; g.add(s); }
  g.userData.lamps = [lamp(g, -0.85, 1.2, 3.72, 0.14), lamp(g, 0.85, 1.2, 3.72, 0.14)];
  g.userData.seats = { driver: [-0.7, 1.2, 3.0], passenger: [0, 1.0, -3] };
  return g;
}

export const TYPES = {
  roadster: { build: () => roadster(), len: 4.6, wid: 1.65, maxV: 26, accel: 9.5, turn: 2.3, grip: 6.0, mass: 1, horn: 'parp' },
  roadsterBlue: { build: () => roadster('#2a3a5a', '#c9c3b5'), len: 4.6, wid: 1.65, maxV: 25, accel: 9, turn: 2.3, grip: 6.0, mass: 1, horn: 'parp' },
  taxi: { build: taxi, len: 4.0, wid: 1.7, maxV: 17, accel: 7, turn: 2.6, grip: 6.5, mass: 1.1, horn: 'honk' },
  saloon: { build: () => saloon(), len: 4.9, wid: 1.85, maxV: 21, accel: 7.5, turn: 1.9, grip: 5.5, mass: 1.5, horn: 'honk' },
  saloonGreen: { build: () => saloon('#1c2a22', '#2c4a36'), len: 4.9, wid: 1.85, maxV: 21, accel: 7.5, turn: 1.9, grip: 5.5, mass: 1.5, horn: 'honk' },
  van: { build: bakersVan, len: 5.0, wid: 1.85, maxV: 15, accel: 6, turn: 1.9, grip: 5.5, mass: 1.6, horn: 'honk' },
  float: { build: milkFloat, len: 3.9, wid: 1.6, maxV: 8.5, accel: 3.5, turn: 2.2, grip: 7.0, mass: 1.2, horn: 'bell', quiet: true },
  tender: { build: tender, len: 4.9, wid: 1.85, maxV: 23, accel: 9, turn: 2.1, grip: 6.0, mass: 1.6, horn: 'bell' },
  omnibus: { build: omnibus, len: 8.0, wid: 2.4, maxV: 12, accel: 3.5, turn: 1.2, grip: 6, mass: 4, horn: 'honk', noDrive: true },
};

import * as THREE from 'three';
import { makeFigure, attach, play } from './figures.js';
import { toon, inked, glow } from '../render/materials.js';

// ---------------------------------------------------------------- hats (metres; origin at the crown of the head)
const half = (r, sy = 1, thetaLen = Math.PI / 2) => { const g = new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, thetaLen); g.scale(1, sy, 1.08); return g; };
const disc = (r, h) => new THREE.CylinderGeometry(r, r, h, 20);

export function buildHat(kind, col) {
  const g = new THREE.Group();
  const add = (geo, c, t = 0.012, y = 0) => { const m = inked(geo, toon(c), t); m.position.y = y; g.add(m); return m; };
  switch (kind) {
    case 'bowler': add(half(0.112, 0.95), col || '#17161b', 0.012, 0.0); add(disc(0.165, 0.014), col || '#17161b', 0.01, 0.0); add(disc(0.114, 0.022), '#2c2a31', 0, 0.02); break;
    case 'homburg': { add(disc(0.105, 0.14), col || '#3b3a42', 0.012, 0.07); const d = add(half(0.105, 0.3), col || '#3b3a42', 0, 0.14); d.scale.set(.9, 1, .7); add(disc(0.17, 0.014), col || '#3b3a42', 0.01, 0.0); add(disc(0.107, 0.03), '#1b1a20', 0, 0.025); break; }
    case 'topper': add(new THREE.CylinderGeometry(0.105, 0.1, 0.2, 20), '#111015', 0.012, 0.1); add(disc(0.165, 0.014), '#111015', 0.01, 0.0); add(disc(0.102, 0.03), '#2a2930', 0, 0.025); break;
    case 'boater': add(disc(0.11, 0.075), '#E8D49A', 0.012, 0.04); add(disc(0.19, 0.012), '#E8D49A', 0.01, 0.0); add(disc(0.112, 0.03), '#1C2340', 0, 0.025); break;
    case 'cap': { const c = add(half(0.12, 0.45), col || '#5a5246', 0.012, 0.0); c.scale.set(1.05, 1, 1.12); const p = add(new THREE.BoxGeometry(0.2, 0.012, 0.09), col || '#5a5246', 0.008, 0.005); p.position.z = 0.13; break; }
    case 'helmet': {
      const d = add(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), '#1a2036', 0.014, -0.03); d.scale.set(1, 1.6, 1.12);
      add(disc(0.15, 0.014), '#1a2036', 0.01, -0.03);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), glow('#d8d2c4', 1)); k.position.y = 0.17; g.add(k);
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.035, 6), glow('#d8cfa8', 1.1)); b.position.set(0, 0.06, 0.135); g.add(b);
      break;
    }
    case 'cloche': { const c = add(half(0.125, 1.05, Math.PI * 0.58), col || '#5a2a3a', 0.012, -0.05); c.scale.z = 1.12; add(new THREE.CylinderGeometry(0.14, 0.15, 0.03, 20), col || '#5a2a3a', 0.008, -0.04); add(disc(0.127, 0.025), '#1b1a20', 0, 0.0); break; }
    case 'toque': { add(new THREE.CylinderGeometry(0.12, 0.115, 0.13, 20), col || '#3a1f3f', 0.012, 0.05); const f = add(new THREE.ConeGeometry(0.03, 0.26, 6), '#e8e2d4', 0.008, 0.18); f.rotation.z = 0.5; f.position.x = 0.07; break; }
    case 'chauffeur': add(disc(0.12, 0.06), '#20222a', 0.012, 0.04); add(new THREE.BoxGeometry(0.2, 0.012, 0.1), '#0e0e12', 0.008, 0.004).position.z = 0.12; break;
    default: break;
  }
  g.userData.kind = kind;
  return g;
}

// ---------------------------------------------------------------- props
export function umbrella(col = '#15141a') {
  const g = new THREE.Group();
  const c = inked(new THREE.ConeGeometry(0.62, 0.28, 8, 1, true), toon(col, { side: THREE.DoubleSide }), 0.02); c.position.y = 0.95; g.add(c);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 5), toon('#2a2522')); s.position.y = 0.45; g.add(s);
  return g;
}
export function cane() { const g = new THREE.Group(); const s = inked(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 5), toon('#3a2a1e'), 0.008); s.position.y = -0.38; g.add(s); return g; }
export function newspaper() { const m = inked(new THREE.BoxGeometry(0.3, 0.02, 0.22), toon('#d9d2bd'), 0.008); return m; }
export function parcel() { const g = new THREE.Group(); g.add(inked(new THREE.BoxGeometry(0.26, 0.18, 0.2), toon('#a58a5e'), 0.01)); const s = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.19, 0.02), toon('#6b2a22')); g.add(s); return g; }
export function carnation() { const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), glow('#d8343a', 0.9)); return m; }
export function moustache(col = '#3a2e24') { const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.02), toon(col)); return m; }
export function spectacles() { const g = new THREE.Group(); for (const x of [-0.035, 0.035]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 10), toon('#c9a44c')); r.position.x = x; g.add(r); } return g; }

export function cowCreamer() {
  const g = new THREE.Group();
  const silver = toon('#cfd3da'); const ink = 0.008;
  const body = inked(new THREE.SphereGeometry(0.09, 12, 10), silver, ink); body.scale.set(1.5, 0.9, 0.9); body.position.y = 0.12; g.add(body);
  const head = inked(new THREE.SphereGeometry(0.05, 10, 8), silver, ink); head.position.set(0.15, 0.17, 0); g.add(head);
  for (const [x, z] of [[-0.08, -0.04], [-0.08, 0.04], [0.08, -0.04], [0.08, 0.04]]) { const l = inked(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), silver, ink); l.position.set(x, 0.04, z); g.add(l); }
  const tail = inked(new THREE.TorusGeometry(0.04, 0.008, 5, 8, Math.PI), silver, ink); tail.position.set(-0.15, 0.15, 0); tail.rotation.z = 1.2; g.add(tail);
  const lid = inked(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 8), silver, ink); lid.position.set(0, 0.2, 0); g.add(lid);
  return g;
}

export function milkJug() {
  const g = new THREE.Group();
  const j = inked(new THREE.CylinderGeometry(0.05, 0.07, 0.15, 10), toon('#f2eee2'), 0.008); j.position.y = 0.075; g.add(j);
  const h = inked(new THREE.TorusGeometry(0.035, 0.008, 5, 8, Math.PI), toon('#f2eee2'), 0.006); h.position.set(-0.07, 0.08, 0); h.rotation.z = Math.PI / 2; g.add(h);
  return g;
}

export function pram() {
  const g = new THREE.Group();
  const body = inked(new THREE.BoxGeometry(0.5, 0.35, 0.95), toon('#1d2a3a'), 0.02); body.position.y = 0.6; g.add(body);
  const hood = inked(new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI, 0, Math.PI / 2), toon('#1d2a3a', { side: THREE.DoubleSide }), 0.015); hood.rotation.y = Math.PI / 2; hood.position.set(0, 0.76, -0.3); hood.scale.set(1, 1, 0.85); g.add(hood);
  for (const [x, z] of [[-0.28, -0.35], [0.28, -0.35], [-0.28, 0.35], [0.28, 0.35]]) { const w = inked(new THREE.TorusGeometry(0.17, 0.02, 5, 14), toon('#151418'), 0.008); w.rotation.y = Math.PI / 2; w.position.set(x, 0.2, z); g.add(w); }
  const handle = inked(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5), toon('#c9c3b5'), 0.008); handle.rotation.z = Math.PI / 2; handle.position.set(0, 0.95, 0.68); g.add(handle);
  return g;
}

export function pig() {
  const g = new THREE.Group();
  const pink = toon('#e7b3a5'); const t = 0.02;
  const body = inked(new THREE.SphereGeometry(0.35, 14, 10), pink, t); body.scale.set(0.95, 0.85, 1.45); body.position.y = 0.45; g.add(body);
  const head = inked(new THREE.SphereGeometry(0.2, 12, 10), pink, t); head.position.set(0, 0.52, 0.5); g.add(head);
  const snout = inked(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 10), toon('#d99a8e'), 0.012); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.48, 0.7); g.add(snout);
  for (const x of [-0.11, 0.11]) { const e = inked(new THREE.ConeGeometry(0.07, 0.14, 4), pink, 0.012); e.position.set(x, 0.72, 0.45); e.rotation.x = 0.6; e.rotation.z = x > 0 ? -0.4 : 0.4; g.add(e); }
  for (const x of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), toon('#111')); e.position.set(x, 0.58, 0.66); g.add(e); }
  const legs = [];
  for (const [x, z] of [[-0.17, -0.3], [0.17, -0.3], [-0.17, 0.3], [0.17, 0.3]]) { const p = new THREE.Group(); p.position.set(x, 0.3, z); const l = inked(new THREE.CylinderGeometry(0.06, 0.05, 0.3, 6), pink, 0.012); l.position.y = -0.15; p.add(l); g.add(p); legs.push(p); }
  const ribbon = inked(new THREE.TorusGeometry(0.17, 0.03, 6, 12), toon('#2a4fa8'), 0.008); ribbon.position.set(0, 0.5, 0.34); g.add(ribbon);
  g.userData.legs = legs;
  return g;
}

// ---------------------------------------------------------------- wardrobes
// Material names in the models: m_suit: Suit, White (shirt), Tie, Black (shoes), DarkBrown, Grey, Hair, Eyebrows, Skin, Eye.
// w_formal: LimeGreen (dress), Gold (belt), Red (shoes), Brown (hair). w_suit: Black, White, Brown, Hair_Brown, Hair_Blond.
// w_casual: White (top), Orange (trousers), Grey, Brown, Hair_Brown, Hair_Blond.
const SKINS = ['#e9c3a0', '#e3b893', '#f0d0b4', '#d9a882', '#c98f6a', '#f2d6bf'];
const HAIRS = ['#2a1d15', '#4a3122', '#6b4a2e', '#8c6a3c', '#b89060', '#5a5550', '#9a958c', '#1a1716'];

export const CAST = {
  teddy:     { sex: 'm', colours: { Suit: '#b9a684', Tie: '#7a1f2a', Hair: '#c09a5a', Eyebrows: '#8a6a3c', Skin: '#efcdb0', Black: '#2a1d16' }, hat: 'boater', extras: ['carnation'] },
  mortlake:  { sex: 'm', colours: { Suit: '#1a191f', Tie: '#1a191f', Hair: '#8e8a83', Eyebrows: '#5e5a55', Skin: '#e6c3a6' }, hat: 'bowler' },
  plumtree:  { sex: 'm', colours: { Suit: '#1b2236', Tie: '#1b2236', White: '#1b2236', Hair: '#6b4a2e', Skin: '#eac2a2', Black: '#111' }, hat: 'helmet', extras: ['moustache'], scale: 1.04 },
  constable: { sex: 'm', colours: { Suit: '#1b2236', Tie: '#1b2236', White: '#1b2236', Hair: '#3a2a1c', Skin: '#e8bf9c', Black: '#111' }, hat: 'helmet', scale: 1.03 },
  gossage:   { sex: 'm', colours: { Suit: '#5a4632', Tie: '#2a3a2a', Hair: '#c7c2b8', Eyebrows: '#9a958c', Skin: '#efcfb6' }, hat: null, extras: ['spectacles'] },
  tresham:   { sex: 'm', colours: { Suit: '#26242c', Tie: '#4a1a1a', Hair: '#1a1716', Skin: '#e0b896' }, hat: 'homburg', extras: ['moustache'] },
  ollerenshaw: { sex: 'm', colours: { Suit: '#111015', Tie: '#111015', Hair: '#d0b070', Skin: '#f2c9b0' }, hat: 'topper' },
  fitch:     { sex: 'm', colours: { Suit: '#1d3b2f', Tie: '#c9a24c', Hair: '#b8b2a6', Skin: '#e6c0a2' }, hat: 'topper', extras: ['moustache'] },
  cabbie:    { sex: 'm', colours: { Suit: '#3f3326', Tie: '#6a5a3c', Hair: '#4a3122', Skin: '#d9a882' }, hat: 'cap' },
  colonel:   { sex: 'm', colours: { Suit: '#6a5838', Tie: '#6a1f1f', Hair: '#dedad0', Skin: '#e8a890' }, hat: 'cap', hatCol: '#6a5838', extras: ['moustache-white'] },
  nanny:     { sex: 'w', body: 'w_formal', colours: { LimeGreen: '#5d6878', Gold: '#e8e2d4', Red: '#1a191f', Brown: '#5a3c26', Skin: '#efcdb0' }, hat: 'cloche', hatCol: '#2a3040' },
  hester:    { sex: 'w', body: 'w_formal', colours: { LimeGreen: '#2c1a33', Gold: '#c9a24c', Red: '#111', Brown: '#9a958c', Skin: '#efd2bc' }, hat: 'toque', scale: 1.05 },
  milkman:   { sex: 'm', colours: { Suit: '#e8e2d4', Tie: '#2a3a6a', Hair: '#6b4a2e', Skin: '#e3b893' }, hat: 'cap', hatCol: '#2a3a6a' },
};

export function pedestrianSpec(R) {
  const s = pedestrianKind(R);
  s.scale = (s.scale || 1) * (0.93 + R() * 0.13); // not everyone is of a height
  return s;
}
function pedestrianKind(R) {
  const t = R();
  const skin = SKINS[Math.floor(R() * SKINS.length)], hair = HAIRS[Math.floor(R() * HAIRS.length)];
  if (t < 0.32) { // gentleman
    const suit = ['#1c1b22', '#2a2f3a', '#3a3530', '#24262b', '#3d3a44', '#2b3328'][Math.floor(R() * 6)];
    return { sex: 'm', colours: { Suit: suit, Tie: ['#5a1a22', '#1a2a4a', '#2a2a2a', '#4a3a1a'][Math.floor(R() * 4)], Hair: hair, Skin: skin }, hat: R() < .5 ? 'bowler' : 'homburg', hatCol: R() < .5 ? null : '#3a3633', extras: R() < .35 ? ['moustache'] : [], umbrella: R() < .55, kind: 'gent' };
  }
  if (t < 0.42) { // evening dress
    return { sex: 'm', colours: { Suit: '#0f0e13', Tie: '#0f0e13', Hair: hair, Skin: skin }, hat: 'topper', extras: R() < .4 ? ['carnation'] : [], cane: R() < .5, kind: 'swell' };
  }
  if (t < 0.6) { // lady, evening
    const dress = ['#5a1f2e', '#1f2a4a', '#2c4a3a', '#6a5a3a', '#3a2a4a', '#7a6f66', '#1b1a20'][Math.floor(R() * 7)];
    return { sex: 'w', body: 'w_formal', head: R() < .5 ? 'w_formal' : 'w_suit', colours: { LimeGreen: dress, Gold: '#c9a24c', Red: '#1b1a20', Brown: hair, Hair_Brown: hair, Hair_Blond: hair, Skin: skin }, hat: R() < .7 ? 'cloche' : null, hatCol: dress, umbrella: R() < .4, kind: 'lady' };
  }
  if (t < 0.74) { // lady, tailored
    const suit = ['#3a3a44', '#4a3a2e', '#24262f', '#5a4e44'][Math.floor(R() * 4)];
    return { sex: 'w', body: 'w_suit', colours: { Black: suit, White: '#e8e2d4', Brown: '#1b1a20', Hair_Brown: hair, Hair_Blond: hair, Skin: skin }, hat: 'cloche', hatCol: ['#1b1a20', '#5a2a3a', '#2a3a4a'][Math.floor(R() * 3)], umbrella: R() < .5, kind: 'lady' };
  }
  if (t < 0.88) { // working man
    const suit = ['#4a3f33', '#3a3a3a', '#504536', '#2f3540'][Math.floor(R() * 4)];
    return { sex: 'm', colours: { Suit: suit, Tie: '#6a5a3c', White: '#c9c1a8', Hair: hair, Skin: skin }, hat: 'cap', hatCol: ['#5a5246', '#3a3a3a', '#4a3f33'][Math.floor(R() * 3)], newspaper: R() < .3, kind: 'worker' };
  }
  // young woman, day clothes
  return { sex: 'w', body: 'w_casual', colours: { White: '#d9cbb0', Orange: ['#2a2a33', '#4a3a2a', '#3a2a3a'][Math.floor(R() * 3)], Brown: '#1b1a20', Hair_Brown: hair, Hair_Blond: hair, Skin: skin }, hat: R() < .6 ? 'cloche' : null, hatCol: '#3a2a2a', umbrella: R() < .45, kind: 'girl' };
}

// A prop carried upright in the right fist of the umbrella pose. It hangs from the figure itself,
// not the wrist, so it stays upright however the clip moves the hand.
function attachUpright(fig, _bone, obj) {
  const sc = fig.spec.scale || 1;
  const g = new THREE.Group(); g.position.set(-0.13 * sc, 1.47 * sc, 0.27 * sc); g.add(obj);
  fig.group.add(g);
  return g;
}

// Builds a dressed figure with its hat and props.
export function dressFigure(spec) {
  const fig = makeFigure({ ...spec, ink: 0.012 });
  fig.group.updateMatrixWorld(true);
  // find the crown of the head
  let top = 1.7;
  const box = new THREE.Box3();
  let found = -1;
  for (const m of fig.meshes) if (m.userData.slot === 'Head') { box.setFromObject(m); found = Math.max(found, box.max.y); }
  if (found > 0) top = found;
  if (!isFinite(top) || top < 1.2) top = 1.72 * (spec.scale || 1);
  const headBone = fig.bones.Head;
  const hb = new THREE.Vector3(); headBone.getWorldPosition(hb);
  fig.headTopOffset = top - hb.y;
  if (spec.hat) {
    const hat = buildHat(spec.hat, spec.hatCol);
    // hats sit a little below the very top of the hair
    hat.position.set(0, fig.headTopOffset - (spec.sex === 'w' ? 0.025 : 0.06), spec.sex === 'w' ? -0.01 : 0.005);
    fig.props.hat = attach(fig, 'Head', hat);
    fig.props.hatObj = hat;
  }
  for (const e of spec.extras || []) {
    if (e === 'carnation') { const c = carnation(); c.position.set(0.09, -0.12, 0.1); fig.props.flower = attach(fig, 'Neck', c) || attach(fig, 'Head', c); }
    if (e.startsWith('moustache')) { const m = moustache(e.endsWith('white') ? '#e8e2d4' : '#3a2e24'); m.position.set(0, fig.headTopOffset - 0.2, 0.105); attach(fig, 'Head', m); }
    if (e === 'spectacles') { const s = spectacles(); s.position.set(0, fig.headTopOffset - 0.13, 0.11); attach(fig, 'Head', s); }
  }
  if (spec.umbrella) {
    // held up in the right hand: the shaft runs from the fist to well above the hat
    const u = umbrella(['#15141a', '#15141a', '#2a1a1a', '#1a2a1a', '#3a2a22'][Math.floor(Math.random() * 5)]);
    u.position.set(0, -0.38, 0); u.scale.setScalar(1.05);
    fig.props.umbrella = attachUpright(fig, 'Wrist.R', u);
  }
  if (spec.cane) { fig.props.cane = attach(fig, 'Wrist.R', cane()); }
  if (spec.newspaper) { const n = newspaper(); n.position.set(0, -0.05, 0.05); fig.props.paper = attach(fig, 'Wrist.L', n); }
  return fig;
}

export { play };

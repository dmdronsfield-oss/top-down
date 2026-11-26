import * as THREE from 'three';

// People cut in code, to Apparel Arts proportions: gentlemen in padded-shoulder suits with full
// trousers, a constable in his tunic, ladies in day dresses with bobbed hair. Each is built from lofted
// rings in the rig's bind pose (a T-pose, arms along x, facing +z) and skinned to the bones of the
// Quaternius figures, so every clip they have (walk, idle, sit, drive, umbrella) drives it unchanged.
// One geometry and one toon material with vertex colours: a single draw call per person.
//
// The rigs come from compressed files, so their bind space is not in metres and differs between the
// men's and women's skeletons. Everything here is designed in metres for a figure whose ankle-to-head-
// joint height is REF, then scaled into the rig's own space.

const SEG = 18, REF = 1.867;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const C = (h) => new THREE.Color(h);

// bind-pose joint positions, read from the skeleton's inverse bind matrices
export function bindPositions(skeleton) {
  const out = {};
  skeleton.bones.forEach((b, i) => {
    const m = skeleton.boneInverses[i].clone().invert();
    out[b.name] = { i, p: new THREE.Vector3().setFromMatrixPosition(m) };
  });
  return out;
}

class Builder {
  constructor() { this.pos = []; this.col = []; this.si = []; this.sw = []; this.idx = []; }
  vert(p, c, w) {
    this.pos.push(p.x, p.y, p.z); this.col.push(c.r, c.g, c.b);
    const ws = w.filter(([, x]) => x > 0.001).sort((a, b) => b[1] - a[1]).slice(0, 4); while (ws.length < 4) ws.push([0, 0]);
    const tot = ws.reduce((s, [, x]) => s + x, 0) || 1;
    for (const [b, x] of ws) { this.si.push(b); this.sw.push(x / tot); }
    return this.pos.length / 3 - 1;
  }
  P(i) { return new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]); }
  // rings: [{ c, u, v, ru, rv, ex, w: weights or (p, a) => weights, col: (a, k, p) => Color, warp?: (p, a) => void }]
  loft(rings, { capStart = false, capEnd = false, seg = SEG } = {}) {
    const start = this.pos.length / 3;
    rings.forEach((r, k) => {
      for (let s = 0; s < seg; s++) {
        const a = (s / seg) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = 2 / (r.ex || 2);
        const cu = Math.sign(ca) * Math.pow(Math.abs(ca), e), sv = Math.sign(sa) * Math.pow(Math.abs(sa), e);
        const p = r.c.clone().addScaledVector(r.u, cu * r.ru).addScaledVector(r.v, sv * (r.rv ?? r.ru));
        if (r.warp) r.warp(p, a);
        this.vert(p, r.col(a, k, p), typeof r.w === 'function' ? r.w(p, a) : r.w);
      }
    });
    // wind every band outwards, whichever way the rings run
    for (let k = 0; k < rings.length - 1; k++) {
      let best = -1, sb = 0;
      for (let s = 0; s < seg; s++) { const d = this.P(start + k * seg + s).distanceTo(rings[k].c); if (d > best) { best = d; sb = s; } }
      const a0 = start + k * seg + sb, b0 = start + k * seg + (sb + 1) % seg, c0 = a0 + seg;
      const flip = this.P(c0).sub(this.P(a0)).cross(this.P(b0).sub(this.P(a0))).dot(this.P(a0).sub(rings[k].c)) < 0;
      for (let s = 0; s < seg; s++) {
        const a = start + k * seg + s, b = start + k * seg + (s + 1) % seg, c = a + seg, d = b + seg;
        if (flip) this.idx.push(a, b, c, b, d, c); else this.idx.push(a, c, b, b, c, d);
      }
    }
    const cap = (k, end) => {
      const r = rings[k], w = typeof r.w === 'function' ? r.w(r.c, 0) : r.w, centre = this.vert(r.c, r.col(0, k, r.c), w);
      const out = (end ? r.c.clone().sub(rings[k - 1].c) : r.c.clone().sub(rings[1].c)).normalize();
      const a0 = start + k * seg, flip = this.P(a0).sub(r.c).cross(this.P(a0 + 1).sub(r.c)).dot(out) < 0;
      for (let s = 0; s < seg; s++) { const a = start + k * seg + s, b = start + k * seg + (s + 1) % seg; if (flip) this.idx.push(centre, b, a); else this.idx.push(centre, a, b); }
    };
    if (capStart) cap(0, false);
    if (capEnd) cap(rings.length - 1, true);
  }
  // an ellipsoid-ish solid as a stack of rings along an axis; shape(t) scales the section
  blob(c, axis, u, v, len, ru, rv, w, col, n = 10, shape = (t) => Math.sin(t * Math.PI), opts = {}) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, s = Math.max(0.0005, shape(t));
      rings.push({ c: c.clone().addScaledVector(axis, (t - 0.5) * len), u, v, ru: ru * s, rv: rv * s, w, col: typeof col === 'function' ? col : () => col, warp: opts.warp, ex: opts.ex });
    }
    this.loft(rings, { seg: opts.seg });
  }
  // a flat strip laid along a list of points (for brows, mouths, belts and the like)
  geometry(scale) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos.map((v) => v * scale), 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

// the rig, measured and brought into design metres
function frame(bind) {
  const S = (bind.Head.p.y - bind.FootL.p.y) / REF;
  const P = (n) => bind[n].p.clone().multiplyScalar(1 / S), B = (n) => bind[n].i;
  return { S, P, B };
}

// ---------------------------------------------------------------- shared parts
function head(b, F, o) {
  const { P, B } = F;
  const skin = C(o.skin || '#e8c4a4'), hair = C(o.hair || '#3a2a1e'), ink = C('#1c1416');
  const neckY = P('Neck').y, headY = P('Head').y, nz = P('Neck').z, hz = P('Head').z;
  const lady = !!o.lady, headH = lady ? 0.255 : 0.27, hw = lady ? 0.088 : 0.096, hd = lady ? 0.104 : 0.112;
  const hc = new THREE.Vector3(0, headY + headH * 0.32, hz + 0.012);
  const W = [[B('Head'), 1]];
  // neck
  b.loft([[neckY - 0.01, lady ? 0.04 : 0.049], [headY + 0.03, lady ? 0.037 : 0.046]].map(([y, r]) => ({ c: new THREE.Vector3(0, y, nz), u: X, v: Z, ru: r, rv: r, w: y < headY ? [[B('Neck'), 1]] : [[B('Neck'), 0.5], [B('Head'), 0.5]], col: () => skin })));
  // the head: crown wider than the jaw, chin a little forward
  b.blob(hc, Y, X, Z, headH, hw, hd, W, (a, k, p) => (!lady && p.y > hc.y + headH * 0.1 && (p.z < hz + 0.06 || p.y > hc.y + headH * 0.3) ? hair : skin), 14,
    (t) => Math.pow(Math.sin(t * Math.PI), 0.75) * lerp(0.8, 1.03, clamp(t * 1.7)),
    { warp: (p) => { if (p.y < hc.y - headH * 0.15) p.z += (hc.y - headH * 0.15 - p.y) * 0.25; } });
  // features, kept spare in the fashion-plate way: brow lines, almond eyes, a nose, a mouth
  const fz = hz + hd + 0.004, eyeY = hc.y + headH * 0.04;
  for (const s of [1, -1]) {
    b.blob(new THREE.Vector3(s * 0.036, eyeY, fz - 0.012), X, Y, Z, 0.024, 0.0065, 0.006, W, ink, 4);
    b.blob(new THREE.Vector3(s * 0.037, eyeY + 0.026, fz - 0.01), new THREE.Vector3(1, s * -0.18, 0).normalize(), Y, Z, 0.036, 0.0035, 0.006, W, lady ? ink : hair, 4);
    if (!lady) b.blob(new THREE.Vector3(s * (hw + 0.002), hc.y + 0.005, hz - 0.005), Y, Z, X, 0.055, 0.017, 0.009, W, skin, 4);
  }
  b.blob(new THREE.Vector3(0, eyeY - 0.03, fz + 0.004), new THREE.Vector3(0, -0.85, 0.5).normalize(), X, Z, 0.048, 0.011, 0.013, W, skin, 5, (t) => Math.sin(t * Math.PI * 0.5 + 0.2));
  b.blob(new THREE.Vector3(0, eyeY - 0.072, fz - 0.016), X, Y, Z, lady ? 0.028 : 0.034, lady ? 0.006 : 0.0035, 0.006, W, lady ? C(o.lips || '#9a2a32') : ink, 4);
  if (o.moustache) b.blob(new THREE.Vector3(0, eyeY - 0.056, fz - 0.009), X, Y, Z, 0.05, 0.008, 0.008, W, o.moustache === 'white' ? C('#e8e2d4') : hair, 5);
  if (lady) {
    // a bob: a shell over the crown and down to the jaw, cut away at the face, with a fringe
    b.blob(new THREE.Vector3(0, hc.y + 0.012, hc.z - 0.012), Y, X, Z, headH * 1.02, hw * 1.17, hd * 1.1, W, hair, 12,
      (t) => (t < 0.28 ? 0.92 : 1) * Math.pow(Math.sin(t * Math.PI), 0.5),
      { warp: (p) => { const front = p.z - (hz + 0.03); if (front > 0 && p.y < eyeY + 0.035) p.z -= front + 0.06; } });
  }
  return { top: hc.y + headH * 0.5 };
}

function hands(b, F, o) {
  const { P, B } = F;
  const skin = C(o.glove || o.skin || '#e8c4a4');
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, wr = P('Wrist' + side), W = [[B('Wrist' + side), 1]];
    // fingers together, a little cupped; the back of the hand faces out
    b.blob(new THREE.Vector3(wr.x + s * 0.07, wr.y - 0.004, wr.z + 0.004), X, Y, Z, 0.15, 0.04, 0.019, W, skin, 8,
      (t) => Math.pow(Math.sin(clamp(t * 1.05) * Math.PI), 0.55) * lerp(0.85, 1, clamp(t * 2)));
    b.blob(new THREE.Vector3(wr.x + s * 0.04, wr.y - 0.012, wr.z + 0.03), new THREE.Vector3(s * 0.55, -0.15, 0.8).normalize(), X, Y, 0.065, 0.013, 0.013, W, skin, 5);
  }
}

function shoes(b, F, o, heel = false) {
  const { P, B } = F;
  const shoe = C(o.shoe || '#1b1612'), ankleY = P('FootL').y;
  for (const side of ['L', 'R']) {
    const fp = P('Foot' + side), W = [[B('Foot' + side), 1]];
    const len = heel ? 0.22 : 0.29, wid = heel ? 0.04 : 0.052;
    b.blob(new THREE.Vector3(fp.x, ankleY - (heel ? 0.0 : 0.022), fp.z + (heel ? 0.05 : 0.06)), Z, X, Y, len, wid, heel ? 0.032 : 0.048, W, shoe, 10,
      (t) => Math.pow(Math.sin(Math.min(1, t * 1.05) * Math.PI), 0.6) * (heel ? lerp(1, 0.7, t) : 1));
    if (heel) b.blob(new THREE.Vector3(fp.x, ankleY - 0.045, fp.z - 0.035), Y, X, Z, 0.07, 0.014, 0.016, W, shoe, 4, () => 1, { ex: 4 });
  }
}

// sleeves from the shoulder to the cuff, with a shirt cuff showing
function sleeves(b, F, o, { cloth, clothDk, cuff, r0 = 0.085, r1 = 0.05 }) {
  const { P, B } = F;
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, ua = P('UpperArm' + side), el = P('LowerArm' + side), wr = P('Wrist' + side);
    const along = (ax) => { const t = (ax - Math.abs(ua.x)) / (Math.abs(wr.x) - Math.abs(ua.x)); return new THREE.Vector3(s * ax, lerp(ua.y, wr.y, t), lerp(ua.z, wr.z, t)); };
    const ex = Math.abs(el.x), wx = Math.abs(wr.x), ux = Math.abs(ua.x);
    const R = [
      [ux - 0.06, r0 * 1.02, [[B('Chest'), 0.55], [B('UpperArm' + side), 0.45]]],
      [ux + 0.02, r0 * 0.94, [[B('UpperArm' + side), 0.85], [B('Chest'), 0.15]]],
      [lerp(ux, ex, 0.6), lerp(r0, r1, 0.45), [[B('UpperArm' + side), 1]]],
      [ex, lerp(r0, r1, 0.6), [[B('UpperArm' + side), 0.5], [B('LowerArm' + side), 0.5]]],
      [ex + 0.05, lerp(r0, r1, 0.7), [[B('LowerArm' + side), 1]]],
      [wx - 0.035, r1, [[B('LowerArm' + side), 1]]],
      [wx - 0.015, r1 * 1.02, [[B('LowerArm' + side), 0.7], [B('Wrist' + side), 0.3]]],
    ];
    b.loft(R.map(([ax, r, w], k) => ({ c: along(ax), u: Z, v: Y, ru: r, rv: r * 1.04, ex: 2.1, w, col: () => (k === R.length - 1 ? clothDk : cloth) })), { capEnd: true });
    if (cuff) b.loft([0, 0.022].map((d) => ({ c: along(wx - 0.02 + d), u: Z, v: Y, ru: r1 * 0.72, rv: r1 * 0.7, w: [[B('LowerArm' + side), 0.5], [B('Wrist' + side), 0.5]], col: () => cuff })), { capEnd: true });
  }
}

// a skirt of cloth below the hips (jacket skirt or dress) that follows the thighs as they swing
function legFollow(F, ru, yTop, yBot, amount) {
  const { B } = F;
  return (p) => {
    const t = clamp((yTop - p.y) / (yTop - yBot)), f = amount * t * t, xn = clamp(p.x / ru, -1, 1);
    return [[B('Hips'), 1 - f], [B('UpperLegL'), f * (0.5 + 0.5 * xn)], [B('UpperLegR'), f * (0.5 - 0.5 * xn)]];
  };
}

// ---------------------------------------------------------------- the gentleman (and the constable)
export function tailorGent(bind, o = {}) {
  const F = frame(bind), { P, B } = F;
  const tunic = o.cut === 'tunic';
  const cloth = C(o.suit || '#2a2b33'), clothDk = cloth.clone().multiplyScalar(0.7);
  const shirt = C(o.shirt || '#e9e3d3'), tie = C(o.tie || '#6b1f2a');
  const b = new Builder();
  const ankleY = P('FootL').y, kneeY = P('LowerLegL').y, hipY = P('UpperLegL').y;
  const hipsY = P('Hips').y, absY = P('Abdomen').y, torsoY = P('Torso').y, chestY = P('Chest').y, neckY = P('Neck').y;
  const shY = P('UpperArmL').y, tz = P('Torso').z;

  // trousers: full and straight, with a crease and turn-ups
  for (const side of ['L', 'R']) {
    const ul = P('UpperLeg' + side), x0 = ul.x * 0.85;
    const steps = [[hipY + 0.05, 0.12, 0.12], [hipY - 0.08, 0.113, 0.113], [lerp(hipY, kneeY, 0.6), 0.1, 0.102], [kneeY, 0.094, 0.097], [lerp(kneeY, ankleY, 0.5), 0.09, 0.092], [ankleY + 0.075, 0.089, 0.091], [ankleY + 0.04, 0.092, 0.095]];
    b.loft(steps.map(([y, ru, rv], k) => {
      const t = (hipY - y) / (hipY - ankleY);
      const w = y > kneeY + 0.06 ? [[B('UpperLeg' + side), 1], [B('Hips'), y > hipY - 0.02 ? 0.6 : 0]] : y > kneeY - 0.06 ? [[B('UpperLeg' + side), 0.5], [B('LowerLeg' + side), 0.5]] : [[B('LowerLeg' + side), 1]];
      return { c: new THREE.Vector3(lerp(x0, ul.x, clamp(t * 3)), y, ul.z + 0.005), u: X, v: Z, ru, rv, ex: 2.2, w,
        col: (a) => (k === steps.length - 1 || Math.abs(Math.sin(a) - 1) < 0.03 ? clothDk : cloth) };
    }), { capEnd: true });
  }
  shoes(b, F, o);

  // the jacket (or tunic): skirt over the seat, suppressed waist, chest, square padded shoulders
  const skirtTop = hipsY + 0.02, skirtBot = hipsY - 0.21;
  const J = [
    [hipsY - 0.21, 0.206, 0.152, 2.4],
    [hipsY - 0.09, 0.2, 0.146, 2.4],
    [hipsY + 0.02, 0.19, 0.132, 2.4],
    [absY + 0.06, tunic ? 0.18 : 0.168, 0.12, 2.3],
    [lerp(absY, torsoY, 0.6), 0.174, 0.122, 2.3],
    [torsoY + 0.08, 0.2, 0.132, 2.4],
    [chestY - 0.04, 0.218, 0.137, 2.6],
    [chestY + 0.05, 0.24, 0.128, 3.2],
    [shY, 0.272, 0.116, 4.5],
    [shY + 0.045, 0.236, 0.1, 4.5],
    [neckY - 0.01, tunic ? 0.062 : 0.075, tunic ? 0.06 : 0.07, 2],
  ];
  const torsoW = (y) => y < skirtTop ? legFollow(F, 0.2, skirtTop, skirtBot, 0.42)
    : y < absY + 0.1 ? [[B('Hips'), 0.4], [B('Abdomen'), 0.6]] : y < torsoY ? [[B('Abdomen'), 0.6], [B('Torso'), 0.4]]
      : y < chestY ? [[B('Torso'), 0.6], [B('Chest'), 0.4]] : y < neckY - 0.03 ? [[B('Chest'), 1]] : [[B('Chest'), 0.5], [B('Neck'), 0.5]];
  const JR = [];
  for (let k = 0; k < J.length; k++) {
    const sub = k < J.length - 1 ? (k >= 3 && k <= 7 ? 4 : 2) : 1;
    for (let j = 0; j < sub; j++) {
      const t = j / sub, A = J[k], Bq = J[Math.min(k + 1, J.length - 1)], y = lerp(A[0], Bq[0], t), ww = torsoW(y);
      JR.push({ c: new THREE.Vector3(0, y, tz + 0.01), u: X, v: Z, ru: lerp(A[1], Bq[1], t), rv: lerp(A[2], Bq[2], t), ex: lerp(A[3], Bq[3], t),
        w: typeof ww === 'function' ? ww : ww, col: (a, kk, p) => (p.y < hipsY - 0.18 ? clothDk : cloth) });
    }
  }
  b.loft(JR, { seg: 40 });
  // a lining across the inside of the skirt, so the hem never shows the void
  b.loft([{ c: new THREE.Vector3(0, skirtBot + 0.01, tz + 0.01), u: X, v: Z, ru: 0.2, rv: 0.146, ex: 2.4, w: [[B('Hips'), 1]], col: () => clothDk },
    { c: new THREE.Vector3(0, skirtBot + 0.08, tz + 0.01), u: X, v: Z, ru: 0.001, rv: 0.001, w: [[B('Hips'), 1]], col: () => clothDk }]);

  // something laid on the front of the jacket, following its surface
  const surf = (y, x) => {
    let k = 0; while (k < JR.length - 2 && JR[k + 1].c.y < y) k++;
    const A = JR[k], Bq = JR[k + 1], t = clamp((y - A.c.y) / (Bq.c.y - A.c.y));
    const ru = lerp(A.ru, Bq.ru, t), rv = lerp(A.rv, Bq.rv, t), ex = lerp(A.ex, Bq.ex, t);
    const f = Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / ru), ex)), w = torsoW(y);
    return { z: tz + 0.01 + rv * Math.pow(f, 1 / ex), w: typeof w === 'function' ? w(new THREE.Vector3(x, y, 0)) : w };
  };
  const panel = (yb, yt, x0, x1, dz, col, rows = 9, cols = 6) => {
    const base = b.pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const y = lerp(yb, yt, r / rows);
      for (let c = 0; c <= cols; c++) { const x = lerp(x0(y), x1(y), c / cols), s = surf(y, x); b.vert(new THREE.Vector3(x, y, s.z + dz), col, s.w); }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const a = base + r * (cols + 1) + c, bb = a + 1, cc = a + cols + 1, d = cc + 1; b.idx.push(a, bb, cc, bb, d, cc); }
  };
  const dot = (x, y, r, col) => { const s = surf(y, x); b.blob(new THREE.Vector3(x, y, s.z + 0.004), Z, X, Y, 0.014, r, r, s.w, col, 3); };
  if (tunic) {
    // buttoned to the throat: a row of buttons, a belt, a stand collar
    const brass = C(o.buttons || '#c9c4b8');
    for (let i = 0; i < 5; i++) dot(0, lerp(absY - 0.02, shY + 0.03, i / 4), 0.011, brass);
    panel(absY - 0.08, absY - 0.035, (y) => -0.25, (y) => 0.25, 0.006, C('#141218'), 2, 14);
    b.loft([[neckY - 0.03, 0.068], [neckY + 0.045, 0.06]].map(([y, r]) => ({ c: new THREE.Vector3(0, y, P('Neck').z), u: X, v: Z, ru: r, rv: r, w: [[B('Neck'), 1]], col: () => cloth })));
    for (const s of [1, -1]) panel(shY + 0.0, shY + 0.03, () => s * 0.02, () => s * 0.06, 0.006, brass, 1, 2); // collar numerals
  } else {
    // shirt front, tie and lapels in the V of the jacket
    const vb = absY + 0.05, vt = shY + 0.04, half = (y) => 0.006 + lerp(0, 0.09, (y - vb) / (vt - vb));
    panel(vb, vt, (y) => -half(y), half, 0.004, shirt);
    panel(vb + 0.06, vt - 0.01, (y) => -(y > vt - 0.05 ? 0.022 : 0.016), (y) => (y > vt - 0.05 ? 0.022 : 0.016), 0.007, tie);
    for (const s of [1, -1]) panel(vb, vt + 0.02, (y) => s * half(y), (y) => s * (half(y) + lerp(0.012, 0.05, (y - vb) / (vt + 0.02 - vb))), 0.006, clothDk, 9, 1);
    dot(0.012, absY - 0.005, 0.009, clothDk);
    // pocket flaps and a breast-pocket square
    for (const s of [1, -1]) panel(hipsY - 0.02, hipsY + 0.005, () => s * 0.08, () => s * 0.16, 0.005, clothDk, 1, 3);
    if (o.square !== false) panel(chestY + 0.0, chestY + 0.022, () => 0.1, () => 0.145, 0.005, C(o.square || '#e9e3d3'), 1, 3);
    b.loft([[neckY - 0.03, 0.062], [neckY + 0.025, 0.056]].map(([y, r]) => ({ c: new THREE.Vector3(0, y, P('Neck').z), u: X, v: Z, ru: r, rv: r * 0.95, w: [[B('Neck'), 1]], col: () => shirt })));
  }
  sleeves(b, F, o, { cloth, clothDk, cuff: tunic ? null : shirt });
  hands(b, F, o);
  const h = head(b, F, o);
  const g = b.geometry(F.S);
  g.userData.headTop = h.top * F.S;
  return g;
}

// ---------------------------------------------------------------- the lady
export function tailorLady(bind, o = {}) {
  const F = frame(bind), { P, B } = F;
  const dress = C(o.dress || '#3a2a4a'), dressDk = dress.clone().multiplyScalar(0.72);
  const trim = C(o.trim || '#e8e2d4'), stocking = C(o.stocking || '#c9a48c');
  const b = new Builder();
  const ankleY = P('FootL').y, kneeY = P('LowerLegL').y, hipY = P('UpperLegL').y;
  const hipsY = P('Hips').y, absY = P('Abdomen').y, torsoY = P('Torso').y, chestY = P('Chest').y, neckY = P('Neck').y;
  const shY = P('UpperArmL').y, tz = P('Torso').z;
  const hem = lerp(kneeY, ankleY, 0.42);

  // stockinged legs below the hem
  for (const side of ['L', 'R']) {
    const ul = P('UpperLeg' + side), x = ul.x * 0.9;
    b.loft([[hem + 0.05, 0.049], [lerp(kneeY, ankleY, 0.45), 0.05], [ankleY + 0.06, 0.03], [ankleY + 0.01, 0.032]].map(([y, r]) => ({
      c: new THREE.Vector3(lerp(x, ul.x, 0.5), y, ul.z + 0.01), u: X, v: Z, ru: r, rv: r * 1.05,
      w: y > kneeY + 0.03 ? [[B('UpperLeg' + side), 0.5], [B('LowerLeg' + side), 0.5]] : [[B('LowerLeg' + side), 1]], col: () => stocking })));
  }
  shoes(b, F, o, true);

  // the dress: a fitted bodice, a sash at the natural waist, a skirt cut on the bias, falling to mid-calf
  const D = [
    [hem, 0.235, 0.2, 2.1], [lerp(hem, kneeY, 0.5), 0.215, 0.18, 2.1], [kneeY + 0.05, 0.19, 0.155, 2.2],
    [lerp(kneeY, hipY, 0.5), 0.18, 0.14, 2.2], [hipY + 0.02, 0.178, 0.132, 2.3], [hipsY + 0.04, 0.165, 0.118, 2.3],
    [absY + 0.04, 0.135, 0.1, 2.2], [lerp(absY, torsoY, 0.6), 0.138, 0.1, 2.2], [torsoY + 0.06, 0.16, 0.118, 2.2],
    [chestY - 0.02, 0.17, 0.125, 2.3], [chestY + 0.06, 0.18, 0.105, 2.8], [shY - 0.005, 0.2, 0.092, 3.5], [shY + 0.035, 0.17, 0.08, 3.5], [neckY + 0.012, 0.056, 0.054, 2],
  ];
  const skirtTop = hipsY + 0.02;
  const dW = (y) => y < skirtTop ? legFollow(F, 0.2, skirtTop, hem, y < kneeY ? 0.75 : 0.6)
    : y < absY + 0.08 ? [[B('Hips'), 0.5], [B('Abdomen'), 0.5]] : y < torsoY ? [[B('Abdomen'), 0.6], [B('Torso'), 0.4]]
      : y < chestY ? [[B('Torso'), 0.6], [B('Chest'), 0.4]] : y < neckY - 0.03 ? [[B('Chest'), 1]] : [[B('Chest'), 0.5], [B('Neck'), 0.5]];
  const sashLo = absY - 0.015, sashHi = absY + 0.03;
  const DR = [];
  for (let k = 0; k < D.length; k++) {
    const sub = k < D.length - 1 ? 2 : 1;
    for (let j = 0; j < sub; j++) {
      const t = j / sub, A = D[k], Bq = D[Math.min(k + 1, D.length - 1)], y = lerp(A[0], Bq[0], t);
      DR.push({ c: new THREE.Vector3(0, y, tz + 0.02), u: X, v: Z, ru: lerp(A[1], Bq[1], t), rv: lerp(A[2], Bq[2], t), ex: lerp(A[3], Bq[3], t), w: dW(y),
        col: (a, kk, p) => (p.y > sashLo && p.y < sashHi ? C(o.sash || '#1b1a20') : p.y < hem + 0.02 ? dressDk : dress) });
    }
  }
  b.loft(DR, { seg: 32 });
  b.loft([{ c: new THREE.Vector3(0, hem + 0.004, tz + 0.02), u: X, v: Z, ru: 0.232, rv: 0.198, ex: 2.1, w: dW(hem), col: () => dressDk },
    { c: new THREE.Vector3(0, hem + 0.2, tz + 0.02), u: X, v: Z, ru: 0.001, rv: 0.001, w: [[B('Hips'), 1]], col: () => dressDk }]);
  // a white collar lying on the shoulders
  b.loft([[neckY - 0.01, 0.1, 0.085], [neckY + 0.018, 0.064, 0.06]].map(([y, ru, rv]) => ({ c: new THREE.Vector3(0, y, P('Neck').z + 0.006), u: X, v: Z, ru, rv, w: [[B('Chest'), 0.6], [B('Neck'), 0.4]], col: () => trim })), { seg: 24 });
  sleeves(b, F, o, { cloth: dress, clothDk: dressDk, cuff: o.gloves ? null : trim, r0: 0.07, r1: 0.04 });
  hands(b, F, { ...o, glove: o.gloves });
  const h = head(b, F, { ...o, lady: true });
  const g = b.geometry(F.S);
  g.userData.headTop = h.top * F.S;
  return g;
}

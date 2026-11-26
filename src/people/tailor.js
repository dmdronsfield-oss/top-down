import * as THREE from 'three';

// A gentleman cut in code, to Apparel Arts proportions: broad padded shoulders, a suppressed waist,
// a jacket skirt over the seat, full trousers with turn-ups, a small neat head. Built as lofted rings
// in the rig's bind pose (a T-pose, arms along x, facing +z) and skinned to the same bones as the
// Quaternius figures, so every clip they have (walk, idle, sit, drive, umbrella) drives it unchanged.
// One geometry, one toon material with vertex colours: a single draw call per person.

const SEG = 18;

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
    const ws = w.slice(0, 4); while (ws.length < 4) ws.push([0, 0]);
    const tot = ws.reduce((s, [, x]) => s + x, 0) || 1;
    for (const [b, x] of ws) { this.si.push(b); this.sw.push(x / tot); }
    return this.pos.length / 3 - 1;
  }
  // rings: [{ c: Vector3, u: Vector3, v: Vector3, ru, rv, ex (superellipse exponent), w: [[bone, weight]...], col: (angle, ring) => Color }]
  loft(rings, { capStart = false, capEnd = false, seg = SEG } = {}) {
    const SEG = seg;
    const start = this.pos.length / 3;
    rings.forEach((r, k) => {
      for (let s = 0; s < SEG; s++) {
        const a = (s / SEG) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), e = 2 / (r.ex || 2);
        const cu = Math.sign(ca) * Math.pow(Math.abs(ca), e), sv = Math.sign(sa) * Math.pow(Math.abs(sa), e);
        const p = r.c.clone().addScaledVector(r.u, cu * r.ru).addScaledVector(r.v, sv * (r.rv ?? r.ru));
        if (r.warp) r.warp(p, a);
        this.vert(p, r.col(a, k, p), r.w);
      }
    });
    // wind every band outwards, whichever way the rings run
    const P = (i) => new THREE.Vector3(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    for (let k = 0; k < rings.length - 1; k++) {
      let flip = false;
      { let best = 0, sb = 0; for (let s = 0; s < SEG; s++) { const d = P(start + k * SEG + s).distanceTo(rings[k].c); if (d > best) { best = d; sb = s; } }
        const a = start + k * SEG + sb, b = start + k * SEG + (sb + 1) % SEG, c = a + SEG;
        const n = P(c).sub(P(a)).cross(P(b).sub(P(a)));
        flip = n.dot(P(a).sub(rings[k].c)) < 0; }
      for (let s = 0; s < SEG; s++) {
        const a = start + k * SEG + s, b = start + k * SEG + (s + 1) % SEG, c = a + SEG, d = b + SEG;
        if (flip) this.idx.push(a, b, c, b, d, c); else this.idx.push(a, c, b, b, c, d);
      }
    }
    const cap = (k, end) => {
      const r = rings[k], centre = this.vert(r.c, r.col(0, k, r.c), r.w);
      const out = (end ? r.c.clone().sub(rings[k - 1].c) : r.c.clone().sub(rings[1].c)).normalize();
      const a0 = start + k * SEG, n = P(a0).sub(r.c).cross(P(a0 + 1).sub(r.c));
      const flip = n.dot(out) < 0;
      for (let s = 0; s < SEG; s++) { const a = start + k * SEG + s, b = start + k * SEG + (s + 1) % SEG; if (flip) this.idx.push(centre, b, a); else this.idx.push(centre, a, b); }
    };
    if (capStart) cap(0, false);
    if (capEnd) cap(rings.length - 1, true);
  }
  // an ellipsoid as a stack of rings along an axis
  blob(c, axis, u, v, len, ru, rv, w, col, n = 10, shape = (t) => Math.sin(t * Math.PI)) {
    const rings = [];
    for (let k = 0; k <= n; k++) {
      const t = k / n, s = Math.max(0.001, shape(t));
      rings.push({ c: c.clone().addScaledVector(axis, (t - 0.5) * len), u, v, ru: ru * s, rv: rv * s, w, col });
    }
    this.loft(rings);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

export function tailorGent(bind, o = {}) {
  const C = (h) => new THREE.Color(h);
  const cloth = C(o.suit || '#2a2b33'), clothDk = cloth.clone().multiplyScalar(0.72);
  const shirt = C(o.shirt || '#e9e3d3'), tie = C(o.tie || '#6b1f2a'), skin = C(o.skin || '#e8c4a4');
  const hair = C(o.hair || '#3a2a1e'), shoe = C(o.shoe || '#1b1612'), sock = C('#1c1a20');
  const B = (n) => bind[n].i, P = (n) => bind[n].p;
  const b = new Builder();
  const groundY = P('FootL').p ? 0 : 0; // (kept for clarity: foot bone sits at the ankle)
  const ankleY = P('FootL').y, kneeY = P('LowerLegL').y, hipY = P('UpperLegL').y;
  const hipsY = P('Hips').y, absY = P('Abdomen').y, torsoY = P('Torso').y, chestY = P('Chest').y, neckY = P('Neck').y, headY = P('Head').y;
  const shY = P('UpperArmL').y, shX = P('UpperArmL').x, elX = P('LowerArmL').x, wrX = P('WristL').x;
  const H = neckY - ankleY; // scale for proportions

  // ---- trousers: full, straight, a crease, turn-ups
  for (const side of ['L', 'R']) {
    const sx = Math.sign(P('UpperLeg' + side).x), x0 = P('UpperLeg' + side).x * 0.86;
    const rings = [];
    const steps = [[hipY + 0.05, 0.118, 0.12], [hipY - 0.08, 0.112, 0.112], [lerp(hipY, kneeY, 0.6), 0.098, 0.1], [kneeY, 0.092, 0.095], [lerp(kneeY, ankleY, 0.5), 0.088, 0.09], [ankleY + 0.07, 0.087, 0.09], [ankleY + 0.035, 0.09, 0.093]];
    steps.forEach(([y, ru, rv], k) => {
      const t = (hipY - y) / (hipY - ankleY);
      const kt = Math.min(1, Math.max(0, (hipY - y) / (hipY - kneeY)));
      let w;
      if (y > kneeY + 0.06) w = [[B('UpperLeg' + side), 1], [B('Hips'), y > hipY - 0.02 ? 0.5 : 0]];
      else if (y > kneeY - 0.06) w = [[B('UpperLeg' + side), 0.5], [B('LowerLeg' + side), 0.5]];
      else w = [[B('LowerLeg' + side), 1]];
      const xc = lerp(x0, P('UpperLeg' + side).x, Math.min(1, t * 3));
      rings.push({ c: new THREE.Vector3(xc, y, P('UpperLeg' + side).z + 0.005), u: X, v: Z, ru, rv, ex: 2.2, w,
        col: (a) => (k === steps.length - 1 ? clothDk : Math.abs(Math.sin(a) - 1) < 0.02 ? clothDk : cloth) });
    });
    b.loft(rings, { capEnd: true });
    // shoe: a long narrow oxford, toe forward (+z)
    const fp = P('Foot' + side);
    b.blob(new THREE.Vector3(fp.x, ankleY - 0.02, fp.z + 0.06), Z, X, Y, 0.3, 0.055, 0.05, [[B('Foot' + side), 1]], () => shoe, 10, (t) => Math.pow(Math.sin(Math.min(1, t * 1.05) * Math.PI), 0.6));
    b.blob(new THREE.Vector3(fp.x, ankleY + 0.02, fp.z - 0.01), Y, X, Z, 0.06, 0.045, 0.045, [[B('Foot' + side), 1]], () => sock, 4);
  }

  // ---- jacket: skirt over the seat, suppressed waist, chest, padded square shoulders
  const front = (p) => p.z > P('Torso').z + 0.02;
  const vNeck = (p) => {
    // the opening of the jacket: a deep V from the first button up to the collar
    const top = neckY - 0.02, bot = absY + 0.04, half = lerp(0.0, 0.085, (p.y - bot) / (top - bot));
    return front(p) && p.y > bot && Math.abs(p.x) < half;
  };
  const jacketCol = (a, k, p) => {
    if (vNeck(p)) return Math.abs(p.x) < 0.017 && p.y > bot2 && p.y < neckY - 0.04 ? tie : shirt;
    // lapel edge and the hem a shade darker
    if (front(p) && p.y > absY && Math.abs(Math.abs(p.x) - lerp(0, 0.085, (p.y - absY - 0.04) / (neckY - absY - 0.06))) < 0.022) return clothDk;
    return cloth;
  };
  const bot2 = absY + 0.12;
  const tz = P('Torso').z;
  const J = [
    // y, half width, half depth, exponent, weights
    [hipsY - 0.2, 0.205, 0.15, 2.4, [[B('Hips'), 1]]],
    [hipsY - 0.08, 0.2, 0.145, 2.4, [[B('Hips'), 1]]],
    [hipsY + 0.02, 0.19, 0.13, 2.4, [[B('Hips'), 0.7], [B('Abdomen'), 0.3]]],
    [absY + 0.06, 0.168, 0.118, 2.3, [[B('Abdomen'), 1]]],
    [lerp(absY, torsoY, 0.6), 0.172, 0.12, 2.3, [[B('Abdomen'), 0.4], [B('Torso'), 0.6]]],
    [torsoY + 0.08, 0.198, 0.13, 2.4, [[B('Torso'), 1]]],
    [chestY - 0.04, 0.215, 0.135, 2.6, [[B('Torso'), 0.4], [B('Chest'), 0.6]]],
    [chestY + 0.05, 0.235, 0.125, 3.2, [[B('Chest'), 1]]],
    [shY + 0.0, 0.27, 0.115, 4.5, [[B('Chest'), 1]]],
    [shY + 0.045, 0.235, 0.1, 4.5, [[B('Chest'), 1]]],
    [neckY - 0.01, 0.075, 0.07, 2, [[B('Chest'), 0.5], [B('Neck'), 0.5]]],
  ];
  const JR = [];
  for (let k = 0; k < J.length; k++) {
    const sub = k < J.length - 1 ? (k >= 3 && k <= 7 ? 4 : 2) : 1;
    for (let j = 0; j < sub; j++) {
      const t = j / sub, A = J[k], Bq = J[Math.min(k + 1, J.length - 1)];
      const w = t < 0.5 ? A[4] : Bq[4];
      JR.push({ c: new THREE.Vector3(0, lerp(A[0], Bq[0], t), tz + 0.01), u: X, v: Z, ru: lerp(A[1], Bq[1], t), rv: lerp(A[2], Bq[2], t), ex: lerp(A[3], Bq[3], t), w, col: jacketCol });
    }
  }
  b.loft(JR.map((r) => ({ ...r, col: (a, k, p) => (p.y < hipsY - 0.17 ? clothDk : cloth) })), { seg: 40 });
  // the shirt front and tie in the V of the jacket: panels laid on the jacket's surface
  const surfZ = (y, x) => {
    let k = 0; while (k < JR.length - 2 && JR[k + 1].c.y < y) k++;
    const A = JR[k], Bq = JR[k + 1], t = Math.min(1, Math.max(0, (y - A.c.y) / (Bq.c.y - A.c.y)));
    const ru = lerp(A.ru, Bq.ru, t), rv = lerp(A.rv, Bq.rv, t), ex = lerp(A.ex, Bq.ex, t);
    const f = Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(x) / ru), ex));
    return { z: tz + 0.01 + rv * Math.pow(f, 1 / ex), w: t < 0.5 ? A.w : Bq.w };
  };
  const panel = (yb, yt, halfAt, dz, col) => {
    const rows = 9, cols = 6, base = b.pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const y = lerp(yb, yt, r / rows), h = halfAt(y);
      for (let c = 0; c <= cols; c++) {
        const x = lerp(-h, h, c / cols), sz = surfZ(y, x);
        b.vert(new THREE.Vector3(x, y, sz.z + dz), col, sz.w);
      }
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = base + r * (cols + 1) + c, bb = a + 1, cc = a + cols + 1, d = cc + 1;
      b.idx.push(a, bb, cc, bb, d, cc);
    }
  };
  const vb = absY + 0.05, vt = shY + 0.04;
  panel(vb, vt, (y) => 0.006 + lerp(0, 0.09, (y - vb) / (vt - vb)), 0.004, shirt);
  panel(vb + 0.06, vt - 0.01, (y) => (y > vt - 0.05 ? 0.022 : 0.016 + 0.006 * (y - vb) / (vt - vb)), 0.007, tie);
  // lapels: two darker strips along the edge of the V
  for (const sgn of [1, -1]) {
    const base = b.pos.length / 3, rows = 9;
    for (let r = 0; r <= rows; r++) {
      const y = lerp(vb, vt + 0.02, r / rows), e = 0.006 + lerp(0, 0.09, (y - vb) / (vt - vb)), wdt = lerp(0.012, 0.05, r / rows);
      for (const x of [e, e + wdt]) { const sz = surfZ(y, sgn * x); b.vert(new THREE.Vector3(sgn * x, y, sz.z + 0.006), clothDk, sz.w); }
    }
    for (let r = 0; r < rows; r++) { const a = base + r * 2; if (sgn > 0) b.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); else b.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  // inside of the skirt: a dark lining cap so the hem does not show the void
  b.loft([{ c: new THREE.Vector3(0, hipsY - 0.19, tz + 0.01), u: X, v: Z, ru: 0.2, rv: 0.145, ex: 2.4, w: [[B('Hips'), 1]], col: () => clothDk }, { c: new THREE.Vector3(0, hipsY - 0.12, tz + 0.01), u: X, v: Z, ru: 0.001, rv: 0.001, w: [[B('Hips'), 1]], col: () => clothDk }]);

  // ---- sleeves, shirt cuffs and hands (arms lie along x in the bind pose)
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1, sx = (v) => new THREE.Vector3(s * v, 0, 0);
    const ua = P('UpperArm' + side), la = P('LowerArm' + side), wr = P('Wrist' + side);
    const at = (x, dy = 0) => new THREE.Vector3(x, lerp(ua.y, wr.y, (Math.abs(x) - Math.abs(ua.x)) / (Math.abs(wr.x) - Math.abs(ua.x))) + dy, lerp(ua.z, wr.z, (Math.abs(x) - Math.abs(ua.x)) / (Math.abs(wr.x) - Math.abs(ua.x))));
    const rings = [
      [Math.abs(ua.x) - 0.05, 0.085, 0.09, [[B('Chest'), 0.6], [B('UpperArm' + side), 0.4]]],
      [Math.abs(ua.x) + 0.03, 0.078, 0.08, [[B('UpperArm' + side), 1]]],
      [Math.abs(elX) - 0.04, 0.062, 0.064, [[B('UpperArm' + side), 1]]],
      [Math.abs(elX), 0.06, 0.062, [[B('UpperArm' + side), 0.5], [B('LowerArm' + side), 0.5]]],
      [Math.abs(elX) + 0.05, 0.057, 0.058, [[B('LowerArm' + side), 1]]],
      [Math.abs(wr.x) - 0.04, 0.05, 0.052, [[B('LowerArm' + side), 1]]],
      [Math.abs(wr.x) - 0.02, 0.051, 0.053, [[B('LowerArm' + side), 1]]],
    ].map(([ax, rv, ru, w], k, arr) => ({ c: at(s * ax), u: Z, v: Y, ru, rv, ex: 2.1, w, col: () => (k === arr.length - 1 ? clothDk : cloth) }));
    b.loft(rings, { capEnd: true });
    // cuff
    b.loft([0, 0.025].map((d) => ({ c: at(s * (Math.abs(wr.x) - 0.022 + d)), u: Z, v: Y, ru: 0.038, rv: 0.036, w: [[B('LowerArm' + side), 0.6], [B('Wrist' + side), 0.4]], col: () => shirt })), { capEnd: true });
    // hand: a neat mitten
    const hc = new THREE.Vector3(wr.x + s * 0.075, wr.y - 0.005, wr.z + 0.005);
    b.blob(hc, X, Z, Y, 0.15, 0.028, 0.045, [[B('Wrist' + side), 1]], () => skin, 8, (t) => Math.pow(Math.sin(t * Math.PI), 0.7));
    b.blob(new THREE.Vector3(wr.x + s * 0.045, wr.y - 0.012, wr.z + 0.045), new THREE.Vector3(s * 0.6, -0.2, 0.75).normalize(), X, Y, 0.075, 0.016, 0.016, [[B('Wrist' + side), 1]], () => skin, 5);
  }

  // ---- collar, neck and head
  const nz = P('Neck').z;
  b.loft([[neckY - 0.03, 0.06], [neckY + 0.03, 0.055]].map(([y, r]) => ({ c: new THREE.Vector3(0, y, nz), u: X, v: Z, ru: r, rv: r * 0.95, w: [[B('Neck'), 1]], col: () => shirt })));
  b.loft([[neckY + 0.01, 0.05], [headY + 0.02, 0.048]].map(([y, r]) => ({ c: new THREE.Vector3(0, y, nz - 0.005), u: X, v: Z, ru: r, rv: r, w: [[B('Neck'), 0.6], [B('Head'), 0.4]], col: () => skin })));
  const hz = P('Head').z, headH = H * 0.15, hc = new THREE.Vector3(0, headY + headH * 0.3, hz + 0.01);
  // the head: an egg, jaw a little narrower than the crown
  b.blob(hc, Y, X, Z, headH, 0.098, 0.115, [[B('Head'), 1]], (a, k, p) => (p.y > hc.y + headH * 0.12 && (p.z < hz + 0.07 || p.y > hc.y + headH * 0.3)) ? hair : skin, 12,
    (t) => Math.pow(Math.sin(t * Math.PI), 0.8) * lerp(0.82, 1.04, Math.min(1, t * 1.6)));
  // nose and ears
  b.blob(new THREE.Vector3(0, hc.y - headH * 0.04, hz + 0.122), new THREE.Vector3(0, -0.6, 0.8).normalize(), X, Y, 0.05, 0.012, 0.012, [[B('Head'), 1]], () => skin, 4);
  for (const s of [1, -1]) b.blob(new THREE.Vector3(s * 0.098, hc.y, hz + 0.0), Y, Z, X, 0.055, 0.018, 0.01, [[B('Head'), 1]], () => skin, 4);
  // eyes and brows: small dark dabs
  for (const s of [1, -1]) {
    b.blob(new THREE.Vector3(s * 0.038, hc.y + headH * 0.06, hz + 0.109), X, Y, Z, 0.022, 0.007, 0.006, [[B('Head'), 1]], () => C('#1a1414'), 4);
    b.blob(new THREE.Vector3(s * 0.04, hc.y + headH * 0.14, hz + 0.106), X, Y, Z, 0.032, 0.005, 0.006, [[B('Head'), 1]], () => hair, 4);
  }
  if (o.moustache) b.blob(new THREE.Vector3(0, hc.y - headH * 0.15, hz + 0.113), X, Y, Z, 0.06, 0.007, 0.008, [[B('Head'), 1]], () => hair, 4);
  const g = b.geometry();
  g.userData.headTop = new THREE.Vector3(0, hc.y + headH * 0.5, hc.z);
  return g;
}

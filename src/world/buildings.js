import * as THREE from 'three';
import { Acc, Frame } from './geom.js';
import { BLOCKS, PLACES, CRESCENT, crescentPt, XS, ZS } from './map.js';
import { toon, glow, INK } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';
import * as TX from '../render/textures.js';

const rng = TX.rng;

// ---------------------------------------------------------------- materials
function tmat(color, map, extra) {
  const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: toon('#fff').gradientMap }, extra || {}));
  if (map) m.map = map;
  return patchCutout(m);
}
let M = null, EDGE = null, RAIL = null;
function materials() {
  if (M) return M;
  const stock = TX.brickTexture('#8f7a5e', '#6b6457', 3);
  const red = TX.brickTexture('#8a4433', '#6f625b', 5);
  const dark = TX.brickTexture('#5f5246', '#4a4540', 7);
  const rust = TX.stuccoTexture('#d9d0bd', true, 2);
  const plain = TX.stuccoTexture('#ddd5c4', false, 3);
  const portland = TX.stuccoTexture('#cfc8b8', false, 11);
  const slate = TX.slateTexture();
  M = {
    brickStock: tmat('#ffffff', stock), brickRed: tmat('#ffffff', red), brickDark: tmat('#ffffff', dark),
    stuccoRust: tmat('#ffffff', rust), stucco: tmat('#ffffff', plain), stuccoPink: tmat('#f2d9cc', plain), stuccoGreen: tmat('#d8e2d0', plain), stuccoBlue: tmat('#d4dbe6', plain),
    stone: tmat('#d8d0bd', portland), trim: tmat('#e8e2d4'),
    slate: tmat('#ffffff', slate), lead: tmat('#5d6372'), roofFlat: tmat('#ffffff', TX.leadRoofTexture()), skylight: glow('#ffcf8f', 0.9), skyFrame: tmat('#2a2b31'), tank: tmat('#4a3a30'),
    chimney: tmat('#ffffff', dark), pot: tmat('#9a5a3c'),
    iron: tmat('#1a1a20'), area: new THREE.MeshBasicMaterial({ color: 0x0c0b10 }),
    doorBlack: tmat('#16151b'), doorGreen: tmat('#1f3a2c'), doorRed: tmat('#6a1f1c'), doorBlue: tmat('#1e2c4a'), doorYellow: tmat('#a8862e'),
    wood: tmat('#4c3624'), stable: tmat('#2f4a35'), stableBlue: tmat('#334d66'),
    shopGreen: tmat('#1d3b2f'), shopMaroon: tmat('#4b1d22'), shopBlack: tmat('#18171c'), shopNavy: tmat('#1c2742'), shopCream: tmat('#d7cfb5'),
    pubTile: tmat('#ffffff', TX.tileTexture('#2c4a36')), pubTileRed: tmat('#ffffff', TX.tileTexture('#6b2520')),
    gilt: tmat('#c9a24c'), awnGreen: tmat('#2f5a3c', null, { side: THREE.DoubleSide }), awnStripe: tmat('#7a2b2b', null, { side: THREE.DoubleSide }),
    awnCream: tmat('#cbbf9a', null, { side: THREE.DoubleSide }),
    lampGlow: glow('#ffc37a', 2.2), shopGlow: glow('#ffcf8f', 1.6), pubGlow: glow('#ffb560', 1.9), basement: glow('#ff9e50', 0.5),
    fanlight: glow('#ffd28a', 1.7), carpet: tmat('#8a1c1c'),
  };
  for (const k of ['lampGlow', 'shopGlow', 'pubGlow', 'basement', 'fanlight', 'area', 'skylight']) patchCutout(M[k]);
  EDGE = patchCutout(new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.75 }));
  // Iron railing texture for areas and balconies: alpha-tested quads.
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 6); g.fillRect(0, 54, 64, 5);
  for (let x = 4; x < 64; x += 16) { g.fillRect(x, 0, 3, 64); g.beginPath(); g.moveTo(x - 3, 2); g.lineTo(x + 1.5, -6); g.lineTo(x + 6, 2); g.fill(); }
  for (let x = 12; x < 64; x += 16) g.fillRect(x, 6, 2, 48);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  RAIL = patchCutout(new THREE.MeshBasicMaterial({ color: 0x15141a, alphaMap: t, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false }));
  M.railing = RAIL;
  return M;
}

// ---------------------------------------------------------------- shop names
const SHOPS = [
  ['HUBBARD & VANCE', 'TAILORS'], ['MRS ASHDOWN', 'FLORIST'], ['BELLING', 'TOBACCONIST'], ['J. QUARRIE', 'CHEMIST'],
  ['TOLLEMACHE', 'GLOVER'], ['FANSHAWE', 'BOOTMAKER'], ['LORIMER & PIKE', 'WINE MERCHANTS'], ['OTTOLINE', 'GOWNS'],
  ['DACRE & CO', 'BOOKSELLERS'], ['PROWSE', 'JEWELLER'], ['THE CHEVAL GALLERY', 'PICTURES'], ['SALLIS', 'SHIRTMAKER'],
  ['KETTERING', 'SADDLER'], ['MME VARENNE', 'MILLINERY'], ['HOLLIS', 'PERFUMER'], ['PEMBER', 'SILVERSMITH'],
  ['TUFNELL', 'UMBRELLAS'], ['ABERCROMBY', 'STATIONER'], ['GILLOW & SWAN', 'CONFECTIONERS'], ['ROOKSBY', 'FURRIER'],
];
const SHOP_COLS = ['shopGreen', 'shopMaroon', 'shopBlack', 'shopNavy', 'shopCream'];

// ---------------------------------------------------------------- city builder
export function buildCity(scene, quality) {
  materials();
  const out = {
    solids: [],          // {x0,x1,z0,z1}
    windows: [],         // {x,y,z,w,h,ry,lit}
    signs: [],           // {mesh}
    doors: {},           // place key -> {x,z}
    shopWindows: [],
    lamps: [],
    chunks: [],
    gossageWindow: null,
  };
  const signGroup = new THREE.Group(); scene.add(signGroup);
  let shopIdx = 0;

  for (const B of BLOCKS) {
    const acc = new Acc();
    const R = rng(1000 + B.i * 37 + B.j * 101);
    const sp = B.special;
    if (sp && sp.kind === 'square') { out.squares = out.squares || []; out.squares.push(B); continue; }
    const shopping = (B.i === 3 || B.i === 4) ; // New Bond Street frontages
    const ctx = { acc, R, out, signGroup, B, shopping, nextShop: () => SHOPS[(shopIdx++) % SHOPS.length] };
    if (sp && sp.kind === 'mews') {
      const L = 7; // lane width
      if (sp.dir === 'x') {
        const zm = (B.z0 + B.z1) / 2;
        subBlock(ctx, { x0: B.x0, x1: B.x1, z0: B.z0, z1: zm - L / 2 }, { n: 'street', w: 'street', e: 'street', s: 'mews' });
        subBlock(ctx, { x0: B.x0, x1: B.x1, z0: zm + L / 2, z1: B.z1 }, { s: 'street', w: 'street', e: 'street', n: 'mews' });
        out.mews = out.mews || []; out.mews.push({ x0: B.x0 - 3.2, x1: B.x1 + 3.2, z0: zm - L / 2, z1: zm + L / 2, name: sp.name });
      } else {
        const xm = (B.x0 + B.x1) / 2;
        subBlock(ctx, { x0: B.x0, x1: xm - L / 2, z0: B.z0, z1: B.z1 }, { n: 'street', w: 'street', s: 'street', e: 'mews' });
        subBlock(ctx, { x0: xm + L / 2, x1: B.x1, z0: B.z0, z1: B.z1 }, { n: 'street', e: 'street', s: 'street', w: 'mews' });
        out.mews = out.mews || []; out.mews.push({ x0: xm - L / 2, x1: xm + L / 2, z0: B.z0 - 3.2, z1: B.z1 + 3.2, name: sp.name });
      }
    } else if (sp && sp.kind === 'market') {
      const xm = (B.x0 + B.x1) / 2, zm = (B.z0 + B.z1) / 2, L = 6;
      const opts = { market: true };
      subBlock(ctx, { x0: B.x0, x1: xm - L / 2, z0: B.z0, z1: zm - L / 2 }, { n: 'street', w: 'street', e: 'lane', s: 'lane' }, opts);
      subBlock(ctx, { x0: xm + L / 2, x1: B.x1, z0: B.z0, z1: zm - L / 2 }, { n: 'street', e: 'street', w: 'lane', s: 'lane' }, opts);
      subBlock(ctx, { x0: B.x0, x1: xm - L / 2, z0: zm + L / 2, z1: B.z1 }, { s: 'street', w: 'street', e: 'lane', n: 'pub' }, opts);
      subBlock(ctx, { x0: xm + L / 2, x1: B.x1, z0: zm + L / 2, z1: B.z1 }, { s: 'street', e: 'street', w: 'lane', n: 'lane' }, opts);
      out.market = { x0: xm - L / 2, x1: xm + L / 2, z0: B.z0 - 3.2, z1: B.z1 + 3.2, cx: xm, cz: zm, B };
      out.mews = out.mews || [];
      out.mews.push({ x0: xm - L / 2, x1: xm + L / 2, z0: B.z0 - 3.2, z1: B.z1 + 3.2, name: 'Shepherd Market' });
      out.mews.push({ x0: B.x0 - 3.2, x1: B.x1 + 3.2, z0: zm - L / 2, z1: zm + L / 2, name: 'Shepherd Market' });
    } else if (B.i === CRESCENT.bi && B.j === CRESCENT.bj) {
      crescentBlock(ctx);
    } else {
      const major = MAJOR[B.i + ',' + B.j] || ((B.i >= 2 && B.i <= 4) ? 'z' : 'x');
      subBlock(ctx, { x0: B.x0, x1: B.x1, z0: B.z0, z1: B.z1 }, { n: 'street', s: 'street', w: 'street', e: 'street' }, { major });
    }
    streetSigns(acc, B);
    const chunk = acc.build(M, EDGE, `block ${B.i},${B.j}`);
    scene.add(chunk);
    out.chunks.push(chunk);
  }
  return out;
}

const MAJOR = { '3,4': 'x', '4,0': 'x' };

// Enamelled street-name plates on the corner houses, black on white with the district in red,
// as Westminster has them. All names share one texture, a row each.
const SIGN_ROWS = [];
function signAtlas() {
  const names = [...new Set([...XS, ...ZS].map((s) => s.name))];
  const rowH = 64, c = document.createElement('canvas'); c.width = 512; c.height = rowH * names.length;
  const g = c.getContext('2d');
  names.forEach((n, k) => {
    const y = k * rowH;
    g.fillStyle = '#efeadc'; g.fillRect(0, y, 512, rowH);
    g.strokeStyle = '#17161b'; g.lineWidth = 5; g.strokeRect(6, y + 6, 500, rowH - 12);
    g.fillStyle = '#17161b'; g.textBaseline = 'middle'; g.textAlign = 'center';
    let fs = 34; g.font = `700 ${fs}px "Josefin Sans", "Gill Sans", sans-serif`;
    while (g.measureText(n.toUpperCase()).width > 400 && fs > 18) { fs -= 2; g.font = `700 ${fs}px "Josefin Sans", "Gill Sans", sans-serif`; }
    g.fillText(n.toUpperCase(), 236, y + rowH / 2 + 2);
    g.fillStyle = '#a3201b'; g.font = '700 22px "Josefin Sans", sans-serif'; g.fillText('W.1', 472, y + rowH / 2 + 2);
    SIGN_ROWS.push(n);
  });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  M.sign = tmat('#ffffff', t);
  return names.length;
}
function streetSigns(acc, B) {
  if (B.special && B.special.kind === 'square') return;
  if (!M.sign) signAtlas();
  const rows = SIGN_ROWS.length, w = 1.45, h = 0.32, y = 4.42, out = 0.19, inset = 0.16 + w / 2;
  const b = acc._b('sign');
  const plate = (cx, cz, nx, nz, name) => {
    const k = SIGN_ROWS.indexOf(name); if (k < 0) return;
    const rx = nz, rz = -nx; // the viewer's right, facing the wall
    const v0 = 1 - (k + 1) / rows, v1 = 1 - k / rows;
    const x = cx + nx * out, z = cz + nz * out;
    const L = [x - rx * w / 2, z - rz * w / 2], Rr = [x + rx * w / 2, z + rz * w / 2];
    acc._quad(b, [L[0], y - h / 2, L[1]], [Rr[0], y - h / 2, Rr[1]], [Rr[0], y + h / 2, Rr[1]], [L[0], y + h / 2, L[1]], nx, 0, nz, [0, v0], [1, v0], [1, v1], [0, v1]);
  };
  const { x0, x1, z0, z1 } = B;
  // each corner: a plate on both faces, naming the street that face looks onto
  plate(x0 + inset, z0, 0, -1, B.north); plate(x0, z0 + inset, -1, 0, B.west);
  plate(x1 - inset, z0, 0, -1, B.north); plate(x1, z0 + inset, 1, 0, B.east);
  plate(x0 + inset, z1, 0, 1, B.south); plate(x0, z1 - inset, -1, 0, B.west);
  plate(x1 - inset, z1, 0, 1, B.south); plate(x1, z1 - inset, 1, 0, B.east);
}

// Pevensey Crescent: a curved stucco terrace facing a garden, with ordinary rows on the three
// straight frontages and low back premises filling the ground between.
function crescentBlock(ctx) {
  const { acc, out, B } = ctx, C = CRESCENT;
  const back = C.cx - C.rBack, zN = C.cz - C.rBack - 0.5, zS = C.cz + C.rBack + 0.5; // -80.5 .. -19.5
  const xW = 65.5;
  // straight rows on Grosvenor Street, Charles Street and New Bond Street
  row(ctx, new Frame(B.x0, B.z0, 1, 0, 0, -1), B.x1 - B.x0, zN - B.z0, 'street', 'n', {});
  row(ctx, new Frame(B.x1, B.z1, -1, 0, 0, 1), B.x1 - B.x0, B.z1 - zS, 'street', 's', {});
  row(ctx, new Frame(B.x0, zS, 0, -1, -1, 0), zS - zN, xW - B.x0, 'street', 'w', {});
  out.solids.push({ x0: B.x0, x1: B.x1, z0: B.z0, z1: zN }, { x0: B.x0, x1: B.x1, z0: zS, z1: B.z1 }, { x0: B.x0, x1: xW, z0: zN, z1: zS });
  // the curved terrace, one house per facet
  const n = 8, D = C.rBack - C.rFront, H = 4.0 + 3.9 + 3.3 + 3.0;
  const facets = [];
  for (let k = 0; k < n; k++) {
    const pa = -C.phiT + (2 * C.phiT) * k / n, pb = -C.phiT + (2 * C.phiT) * (k + 1) / n, pm = (pa + pb) / 2;
    const A = crescentPt(C.rFront, pa), Bp = crescentPt(C.rFront, pb);
    const len = Math.hypot(Bp[0] - A[0], Bp[1] - A[1]);
    const f = new Frame(A[0], A[1], (Bp[0] - A[0]) / len, (Bp[1] - A[1]) / len, Math.cos(pm), -Math.sin(pm));
    facets.push({ f, len });
    house(ctx, f, 0, len, D, { style: 'stucco', storeys: 4, shop: false, corner: k === 0 || k === n - 1 });
    // a continuous first-floor balcony on brackets, the mark of the Regency crescent
    f.box(acc, 'stone', 0, len, 3.95, 4.1, 0, 1.0, 2, true);
    f.vquad(acc, 'railing', 0, len, 4.1, 5.0, 0.98, 1.0);
  }
  // fill the wedges left between facets at the back
  for (let k = 0; k < n - 1; k++) {
    const a = facets[k], b = facets[k + 1];
    const P = [a.f.x(a.len, 0), a.f.z(a.len, 0)];
    const qa = [a.f.x(a.len, -D), a.f.z(a.len, -D)], qb = [b.f.x(0, -D), b.f.z(0, -D)];
    const ra = [a.f.x(a.len, -3.2), a.f.z(a.len, -3.2)], rb = [b.f.x(0, -3.2), b.f.z(0, -3.2)];
    const up = (key, p0, p1, p2, p3, y) => {
      const pts = [[p0[0], y, p0[1]], [p1[0], y, p1[1]], [p2[0], y, p2[1]], [p3[0], y, p3[1]]];
      const cr = (pts[1][2] - pts[0][2]) * (pts[3][0] - pts[0][0]) - (pts[1][0] - pts[0][0]) * (pts[3][2] - pts[0][2]);
      if (cr > 0) acc.quad(key, ...pts, 2); else acc.quad(key, pts[1], pts[0], pts[3], pts[2], 2);
    };
    up('lead', P, qa, qb, qb, H + 1.0);
    up('slate', ra, qa, qb, rb, H + 3.6);
    // back wall of the wedge
    const w0 = [qa[0], 0, qa[1]], w1 = [qb[0], 0, qb[1]];
    acc.quad('stucco', w0, w1, [qb[0], H + 1.0, qb[1]], [qa[0], H + 1.0, qa[1]], 2);
    acc.quad('stucco', w1, w0, [qa[0], H + 1.0, qa[1]], [qb[0], H + 1.0, qb[1]], 2);
  }
  // low back premises between the crescent and the straight rows, in 2 m strips
  const xb = (d) => C.cx - Math.sqrt(Math.max(0, C.rBack * C.rBack - d * d));
  const endBack = crescentPt(C.rBack, C.phiT), endFront = crescentPt(C.rFront, C.phiT);
  const dEndF = endFront[1] - C.cz, dEndB = endBack[1] - C.cz;
  for (let z = zN; z < zS - 0.01; z += 2) {
    const z1 = Math.min(zS, z + 2), d0 = z < C.cz && z1 > C.cz ? 0 : Math.min(Math.abs(z - C.cz), Math.abs(z1 - C.cz));
    const x1 = Math.min(xb(d0) + 1, endBack[0]);
    acc.box('roofFlat', xW, x1, 0, 6.5, z, z1, 4, false);
    if (Math.round(z) % 10 === 0 && x1 - xW > 8) roofClutter(ctx, xW + 1, x1 - 2, z, z1, 6.5, 1);
  }
  // solids: the terrace and back premises in 1 m strips, never proud of the facade
  const xf = (d) => C.cx - Math.sqrt(Math.max(0, C.rFront * C.rFront - d * d));
  for (let z = zN; z < zS - 0.01; z += 1) {
    const z1 = Math.min(zS, z + 1), d0 = z < C.cz && z1 > C.cz ? 0 : Math.min(Math.abs(z - C.cz), Math.abs(z1 - C.cz));
    let x1;
    if (d0 <= dEndF) x1 = xf(d0) - 0.1;
    else if (d0 <= dEndB) x1 = endFront[0] - (d0 - dEndF) / (dEndB - dEndF) * (endFront[0] - endBack[0]);
    else x1 = endBack[0];
    out.solids.push({ x0: xW, x1, z0: z, z1 });
  }
}

// One rectangle of buildings with a frontage on each side. The 'major' rows run the full length
// (they own the corners); the other two fit between them.
function subBlock(ctx, r, sides, opts = {}) {
  const { acc, out } = ctx;
  out.solids.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1 });
  const W = r.x1 - r.x0, Dz = r.z1 - r.z0;
  const dN = sides.n === 'mews' ? 6 : Math.min(13, Dz / 2);
  const dS = sides.s === 'mews' ? 6 : Math.min(13, Dz / 2);
  const dW = sides.w === 'mews' ? 6 : Math.min(13, W / 2);
  const dE = sides.e === 'mews' ? 6 : Math.min(13, W / 2);
  const major = opts.major || (W >= Dz ? 'x' : 'z');
  if (major === 'x') {
    row(ctx, new Frame(r.x0, r.z0, 1, 0, 0, -1), W, Math.min(dN, Dz), sides.n, 'n', opts);
    row(ctx, new Frame(r.x1, r.z1, -1, 0, 0, 1), W, Math.min(dS, Dz), sides.s, 's', opts);
    const span = Dz - dN - dS;
    if (span > 2) {
      row(ctx, new Frame(r.x0, r.z1 - dS, 0, -1, -1, 0), span, Math.min(dW, W - 1), sides.w, 'w', opts);
      row(ctx, new Frame(r.x1, r.z0 + dN, 0, 1, 1, 0), span, Math.min(dE, W - 1), sides.e, 'e', opts);
    }
  } else {
    row(ctx, new Frame(r.x0, r.z1, 0, -1, -1, 0), Dz, Math.min(dW, W), sides.w, 'w', opts);
    row(ctx, new Frame(r.x1, r.z0, 0, 1, 1, 0), Dz, Math.min(dE, W), sides.e, 'e', opts);
    const span = W - dW - dE;
    if (span > 2) {
      row(ctx, new Frame(r.x0 + dW, r.z0, 1, 0, 0, -1), span, Math.min(dN, Dz - 1), sides.n, 'n', opts);
      row(ctx, new Frame(r.x1 - dE, r.z1, -1, 0, 0, 1), span, Math.min(dS, Dz - 1), sides.s, 's', opts);
    }
  }
  // fill the courtyard with low back extensions
  const ix0 = r.x0 + dW, ix1 = r.x1 - dE, iz0 = r.z0 + dN, iz1 = r.z1 - dS;
  if (ix1 - ix0 > 1 && iz1 - iz0 > 1) {
    acc.box('roofFlat', ix0, ix1, 0, 7.5, iz0, iz1, 4, true);
    roofClutter(ctx, ix0, ix1, iz0, iz1, 7.5);
  }
}

// What you see from above on the backs: skylights (some lit), lantern lights, water tanks, vents.
function roofClutter(ctx, x0, x1, z0, z1, y, max = 6) {
  const { acc, R } = ctx, W = x1 - x0, D = z1 - z0;
  const n = Math.min(max, Math.floor(W * D / 60));
  for (let i = 0; i < n; i++) {
    const w = 1.2 + R() * 1.6, d = 1.0 + R() * 1.4;
    if (W < w + 1 || D < d + 1) continue;
    const x = x0 + 0.5 + R() * (W - w - 1), z = z0 + 0.5 + R() * (D - d - 1), t = R();
    if (t < 0.55) { // a skylight: frame and glass, lit or dark
      acc.box('skyFrame', x - 0.08, x + w + 0.08, y, y + 0.28, z - 0.08, z + d + 0.08, 2, true);
      acc.box(R() < 0.45 ? 'skylight' : 'lead', x, x + w, y + 0.28, y + 0.3, z, z + d, 2, false, 'Y');
      for (let k = 1; k < 3; k++) acc.box('skyFrame', x + w * k / 3 - 0.03, x + w * k / 3 + 0.03, y + 0.3, y + 0.33, z, z + d, 2, false, 'Y');
    } else if (t < 0.8) { // a water tank on legs
      acc.box('tank', x, x + 1.3, y + 0.5, y + 1.6, z, z + 1.1, 2, true);
      for (const [a, b] of [[x, z], [x + 1.2, z], [x, z + 1], [x + 1.2, z + 1]]) acc.box('skyFrame', a, a + 0.1, y, y + 0.5, b, b + 0.1, 2, false);
    } else { // a cowled vent
      acc.cyl('skyFrame', x + 0.3, z + 0.3, 0.18, y, y + 1.1, 8);
      acc.cyl('lead', x + 0.3, z + 0.3, 0.3, y + 1.1, y + 1.35, 8, 0.05);
    }
  }
}

// Find a story place that sits on this frontage.
function placesOn(f, len) {
  const res = [];
  for (const k in PLACES) {
    const p = PLACES[k];
    if (p.face == null) continue;
    // project onto frame
    const du = (p.x - f.ox) * f.tx + (p.z - f.oz) * f.tz;
    const dw = (p.x - f.ox) * f.nx + (p.z - f.oz) * f.nz;
    if (du > 0 && du < len && dw > 0 && dw < 2.2) res.push({ key: k, u: du });
  }
  return res;
}

const SPECIAL_W = { gannets: 20, gossage: 9, hatter: 8, tearooms: 9, pub: 11, flat: 8, uncle: 9 };

function row(ctx, f, len, depth, kind, side, opts) {
  const { R } = ctx;
  if (len < 2) return;
  const specials = placesOn(f, len).map((s) => ({ ...s, w: SPECIAL_W[s.key] || 8 }));
  // carve the row into plots
  const plots = [];
  let u = 0;
  specials.sort((a, b) => a.u - b.u);
  const pushRun = (a, b) => {
    let x = a;
    while (b - x > 0.5) {
      let w = kind === 'mews' ? 5 + R() * 2 : (kind === 'lane' || kind === 'pub') ? 5 + R() * 2 : 6 + R() * 3;
      if (b - x - w < 4.5) w = b - x;
      plots.push({ u0: x, u1: x + w });
      x += w;
    }
  };
  for (const s of specials) {
    const a = Math.max(u, s.u - s.w / 2), b = Math.min(len, s.u + s.w / 2);
    pushRun(u, a);
    plots.push({ u0: a, u1: b, special: s.key });
    u = b;
  }
  pushRun(u, len);
  // street style is chosen per run so a terrace reads as one design
  const styles = ['stucco', 'brickStucco', 'brickStucco', 'redbrick', 'stock'];
  let style = styles[Math.floor(R() * styles.length)];
  let storeys = 3 + Math.floor(R() * 2);
  plots.forEach((p, idx) => {
    if (R() < 0.18) { style = styles[Math.floor(R() * styles.length)]; storeys = 3 + Math.floor(R() * 2); }
    const isCornerEnd = idx === 0 || idx === plots.length - 1;
    if (p.special) return specialPlot(ctx, f, p, depth, p.special);
    if (kind === 'mews') return mewsHouse(ctx, f, p.u0, p.u1, depth);
    const market = opts.market;
    if (kind === 'pub') return marketShop(ctx, f, p.u0, p.u1, depth, idx === 0);
    if (market || kind === 'lane') return marketShop(ctx, f, p.u0, p.u1, depth, false);
    const shop = ctx.shopping && ((ctx.B.i === 3 && side === 'e') || (ctx.B.i === 4 && side === 'w'));
    house(ctx, f, p.u0, p.u1, depth, { style, storeys, shop, corner: isCornerEnd });
  });
}

// ---------------------------------------------------------------- house types
function addWindow(ctx, f, u, y, w, h, wOut, litChance = 0.55) {
  ctx.out.windows.push({ x: f.x(u, wOut), y: y + h / 2, z: f.z(u, wOut), w, h, ry: f.ry(), lit: ctx.R() < litChance });
}

function house(ctx, f, u0, u1, D, o) {
  const { acc, R } = ctx;
  const width = u1 - u0;
  const nb = width < 6.6 ? 2 : 3;
  const bw = width / nb;
  const gH = 4.0;
  const lv = [3.9, 3.3, 3.0, 2.7].slice(0, o.storeys - 1);
  const H = gH + lv.reduce((a, b) => a + b, 0);
  const upper = o.style === 'stucco' ? 'stucco' : o.style === 'redbrick' ? 'brickRed' : o.style === 'stock' ? 'brickStock' : (R() < .5 ? 'brickStock' : 'brickDark');
  const ground = o.style === 'redbrick' ? 'brickRed' : o.style === 'stock' ? 'brickStock' : 'stuccoRust';
  const dress = o.style === 'redbrick' || o.style === 'stock' ? 'stone' : 'trim';
  // body
  f.box(acc, ground, u0, u1, 0, gH, -D, 0, 2, true);
  f.box(acc, upper, u0, u1, gH, H, -D, 0, 2, true);
  // party wall pilaster strips
  f.box(acc, dress, u0, u0 + 0.12, 0, H, 0, 0.05, 2, false);
  // string course and cornice
  f.box(acc, dress, u0, u1, gH - 0.05, gH + 0.22, 0, 0.16, 2, true);
  f.box(acc, dress, u0, u1, H - 0.12, H + 0.22, 0, 0.38, 2, true);
  f.box(acc, upper === 'stucco' ? 'stucco' : upper, u0, u1, H + 0.22, H + 1.0, -0.45, 0.02, 2, true);
  // mansard roof with dormers
  const roofH = 2.6;
  const ra = [f.x(u0, -1.0), H + 1.0, f.z(u0, -1.0)], rb = [f.x(u1, -1.0), H + 1.0, f.z(u1, -1.0)];
  const rc = [f.x(u1, -3.2), H + 1.0 + roofH, f.z(u1, -3.2)], rd = [f.x(u0, -3.2), H + 1.0 + roofH, f.z(u0, -3.2)];
  quadOut(acc, f, 'slate', ra, rb, rc, rd);
  f.box(acc, 'slate', u0, u1, H + 1.0, H + 1.0 + roofH, -D + 0.5, -3.2, 3, true);
  for (let b = 0; b < nb; b++) {
    if (R() < 0.35) continue;
    const uc = u0 + (b + .5) * bw;
    f.box(acc, 'lead', uc - 0.6, uc + 0.6, H + 1.0, H + 2.7, -2.6, -1.3, 2, true);
    addWindow(ctx, f, uc, H + 1.2, 0.7, 1.1, -1.28, 0.35);
  }
  // chimney stack on the party wall
  const cu = u0 + 0.1, cw = -D * 0.45;
  f.box(acc, 'chimney', cu - 0.45, cu + 0.45, H + 1.0, H + 1.0 + roofH + 1.6, cw - 0.8, cw + 0.8, 2, true);
  f.box(acc, 'stone', cu - 0.55, cu + 0.55, H + roofH + 2.55, H + roofH + 2.75, cw - 0.9, cw + 0.9, 2, true);
  const pots = 2 + Math.floor(R() * 3);
  for (let i = 0; i < pots; i++) f.cyl(acc, 'pot', cu, cw - 0.55 + i * (1.1 / Math.max(1, pots - 1)), 0.14, H + roofH + 2.75, H + roofH + 3.3, 7, 0.11);

  // upper windows
  let y = gH;
  lv.forEach((h, li) => {
    const wh = li === 0 ? 2.45 : li === 1 ? 2.0 : 1.6;
    const ww = Math.min(1.15, bw * 0.48);
    for (let b = 0; b < nb; b++) {
      const uc = u0 + (b + .5) * bw;
      const y0 = y + (li === 0 ? 0.55 : 0.6);
      addWindow(ctx, f, uc, y0, ww, wh, 0.02);
      if (dress === 'trim' || upper === 'stucco') {
        // architrave
        f.box(acc, 'trim', uc - ww / 2 - 0.14, uc + ww / 2 + 0.14, y0 + wh, y0 + wh + 0.16, 0, 0.09, 2, false);
        f.box(acc, 'trim', uc - ww / 2 - 0.14, uc - ww / 2, y0, y0 + wh, 0, 0.07, 2, false);
        f.box(acc, 'trim', uc + ww / 2, uc + ww / 2 + 0.14, y0, y0 + wh, 0, 0.07, 2, false);
        if (li === 0) f.box(acc, 'trim', uc - ww / 2 - 0.3, uc + ww / 2 + 0.3, y0 + wh + 0.16, y0 + wh + 0.32, 0, 0.2, 2, true);
      } else {
        f.box(acc, 'stone', uc - ww / 2 - 0.12, uc + ww / 2 + 0.12, y0 + wh, y0 + wh + 0.28, 0, 0.05, 2, false);
      }
      f.box(acc, 'stone', uc - ww / 2 - 0.14, uc + ww / 2 + 0.14, y0 - 0.1, y0, 0, 0.16, 2, false);
      if (li === 0 && (upper === 'stucco' || ground === 'stuccoRust')) {
        // balconette
        f.box(acc, 'stone', uc - ww / 2 - 0.25, uc + ww / 2 + 0.25, y0 - 0.16, y0 - 0.04, 0, 0.55, 2, true);
        f.vquad(acc, 'railing', uc - ww / 2 - 0.25, uc + ww / 2 + 0.25, y0 - 0.04, y0 + 0.9, 0.53, 1.0);
      }
    }
    y += h;
  });

  if (o.shop) return shopFront(ctx, f, u0, u1, gH);
  if (o.noGround) return;

  // ground floor: door bay and windows
  const doorBay = R() < 0.5 ? 0 : nb - 1;
  const ud = u0 + (doorBay + .5) * bw;
  const doorMat = ['doorBlack', 'doorBlack', 'doorGreen', 'doorRed', 'doorBlue', 'doorYellow'][Math.floor(R() * 6)];
  f.box(acc, doorMat, ud - 0.55, ud + 0.55, 0.3, 2.75, 0, 0.05, 2, true);
  f.box(acc, 'fanlight', ud - 0.55, ud + 0.55, 2.8, 3.25, 0, 0.04, 2, false);
  f.box(acc, 'stone', ud - 0.9, ud + 0.9, 0, 0.3, 0, 1.3, 2, true);
  f.box(acc, 'stone', ud - 0.9, ud + 0.9, 0, 0.15, 1.3, 1.6, 2, true);
  if (ground === 'stuccoRust' && R() < 0.75) {
    // pillared porch
    f.cyl(acc, 'trim', ud - 0.85, 1.15, 0.16, 0.3, 3.35, 10);
    f.cyl(acc, 'trim', ud + 0.85, 1.15, 0.16, 0.3, 3.35, 10);
    f.box(acc, 'trim', ud - 1.1, ud + 1.1, 3.35, 3.8, 0, 1.4, 2, true);
  } else {
    f.box(acc, dress, ud - 0.8, ud + 0.8, 3.25, 3.5, 0, 0.25, 2, true);
  }
  for (let b = 0; b < nb; b++) {
    if (b === doorBay) continue;
    const uc = u0 + (b + .5) * bw, ww = Math.min(1.15, bw * 0.48);
    addWindow(ctx, f, uc, 0.95, ww, 2.2, 0.02, 0.45);
    f.box(acc, 'stone', uc - ww / 2 - 0.14, uc + ww / 2 + 0.14, 0.85, 0.95, 0, 0.14, 2, false);
  }
  // the area: a sunken yard behind iron railings
  const aw = 1.3;
  f.hquad(acc, 'area', u0 + 0.05, u1 - 0.05, 0.0, aw, 0.016, 4);
  f.box(acc, 'basement', ud + (doorBay === 0 ? 1.3 : -2.3), ud + (doorBay === 0 ? 2.3 : -1.3), 0.017, 0.02, 0.05, 0.55, 2, false, 'Y');
  if (doorBay === 0) f.vquad(acc, 'railing', ud + 0.95, u1, 0, 1.15, aw, 1.0);
  else f.vquad(acc, 'railing', u0, ud - 0.95, 0, 1.15, aw, 1.0);
  if (doorBay === 0 && ud - 0.95 > u0 + 0.2) f.vquad(acc, 'railing', u0, ud - 0.95, 0, 1.15, aw, 1.0);
  if (doorBay !== 0 && ud + 0.95 < u1 - 0.2) f.vquad(acc, 'railing', ud + 0.95, u1, 0, 1.15, aw, 1.0);
}

function quadOut(acc, f, key, a, b, c, d) {
  // pick winding so the quad faces the street side (+n) / upwards
  const v1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const v2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
  const n = new THREE.Vector3().crossVectors(v1, v2);
  if (n.x * f.nx + n.z * f.nz + n.y * 0.01 > 0) acc.quad(key, a, b, c, d, 2, true);
  else acc.quad(key, b, a, d, c, 2, true);
}

function shopFront(ctx, f, u0, u1, gH, named) {
  const { acc, R, signGroup } = ctx;
  const col = SHOP_COLS[Math.floor(R() * SHOP_COLS.length)];
  const name = named || ctx.nextShop();
  f.box(acc, col, u0, u0 + 0.4, 0, gH - 0.2, 0, 0.3, 2, true);
  f.box(acc, col, u1 - 0.4, u1, 0, gH - 0.2, 0, 0.3, 2, true);
  f.box(acc, col, u0, u1, gH - 1.15, gH - 0.2, 0, 0.35, 2, true);
  f.box(acc, 'gilt', u0, u1, gH - 0.2, gH - 0.08, 0, 0.42, 2, false);
  f.box(acc, col, u0 + 0.4, u1 - 0.4, 0, 0.55, 0, 0.18, 2, true);
  const du = (u1 - u0) > 6 ? u1 - 1.6 : u1 - 1.3;
  f.box(acc, 'shopGlow', u0 + 0.4, du - 0.6, 0.55, gH - 1.2, 0, 0.06, 2, false);
  // glazing bars over the display
  for (let x = u0 + 0.4 + 1.2; x < du - 0.8; x += 1.2) f.box(acc, col, x - 0.04, x + 0.04, 0.55, gH - 1.2, 0, 0.09, 2, false);
  f.box(acc, col, du - 0.6, du + 0.6, 0, 2.8, 0, 0.04, 2, true);
  f.box(acc, 'shopGlow', du - 0.4, du + 0.4, 1.5, 2.6, 0, 0.06, 2, false);
  // sign
  const tex = TX.signTexture(name[0], { sub: name[1], bg: col === 'shopCream' ? '#d7cfb5' : '#151418', fg: col === 'shopCream' ? '#2a2622' : '#e3c77e', border: '#b7934a' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0 - 1.0, 0.8), patchCutout(new THREE.MeshBasicMaterial({ map: tex })));
  sign.position.set(f.x((u0 + u1) / 2, 0.36), gH - 0.68, f.z((u0 + u1) / 2, 0.36));
  sign.rotation.y = f.ry();
  signGroup.add(sign);
  // awning, sometimes
  if (R() < 0.5) {
    const k = R() < .5 ? 'awnGreen' : R() < .5 ? 'awnStripe' : 'awnCream';
    quadOut(acc, f, k, [f.x(u0 + 0.2, 0.4), gH - 1.25, f.z(u0 + 0.2, 0.4)], [f.x(u1 - 0.2, 0.4), gH - 1.25, f.z(u1 - 0.2, 0.4)],
      [f.x(u1 - 0.2, 2.0), gH - 2.0, f.z(u1 - 0.2, 2.0)], [f.x(u0 + 0.2, 2.0), gH - 2.0, f.z(u0 + 0.2, 2.0)]);
  }
  ctx.out.shopWindows.push({ x: f.x((u0 + u1) / 2, 1.2), z: f.z((u0 + u1) / 2, 1.2), ry: f.ry(), name: name[0] });
}

function mewsHouse(ctx, f, u0, u1, D) {
  const { acc, R } = ctx;
  const walls = ['stucco', 'stuccoPink', 'stuccoGreen', 'stuccoBlue', 'brickStock', 'brickRed'][Math.floor(R() * 6)];
  const H = 6.4;
  f.box(acc, walls, u0, u1, 0, H, -D, 0, 2, true);
  f.box(acc, 'stone', u0, u1, H - 0.1, H + 0.15, 0, 0.2, 2, true);
  quadOut(acc, f, 'slate', [f.x(u0, 0.1), H + 0.15, f.z(u0, 0.1)], [f.x(u1, 0.1), H + 0.15, f.z(u1, 0.1)], [f.x(u1, -D / 2), H + 2.2, f.z(u1, -D / 2)], [f.x(u0, -D / 2), H + 2.2, f.z(u0, -D / 2)]);
  const w = u1 - u0;
  const door = R() < .5 ? 'stable' : 'stableBlue';
  f.box(acc, door, u0 + 0.5, u0 + Math.min(3.2, w - 1.4), 0, 2.8, 0, 0.06, 2, true);
  f.box(acc, 'doorBlack', u1 - 1.2, u1 - 0.3, 0, 2.3, 0, 0.06, 2, true);
  addWindow(ctx, f, u0 + w * 0.3, 3.6, 0.9, 1.3, 0.02, 0.5);
  addWindow(ctx, f, u0 + w * 0.72, 3.6, 0.9, 1.3, 0.02, 0.5);
}

function marketShop(ctx, f, u0, u1, D, isPub) {
  const { acc, R } = ctx;
  const H = 9.5;
  const walls = ['brickStock', 'brickRed', 'stucco', 'stuccoPink'][Math.floor(R() * 4)];
  f.box(acc, walls, u0, u1, 0, H, -D, 0, 2, true, 'xXzZ');
  f.box(acc, 'roofFlat', u0, u1, H, H + 0.2, -D, 0, 2, false, 'Y');
  f.box(acc, 'stone', u0, u1, H - 0.1, H + 0.25, 0, 0.3, 2, true);
  quadOut(acc, f, 'slate', [f.x(u0, 0), H + 0.25, f.z(u0, 0)], [f.x(u1, 0), H + 0.25, f.z(u1, 0)], [f.x(u1, -D / 2), H + 3, f.z(u1, -D / 2)], [f.x(u0, -D / 2), H + 3, f.z(u0, -D / 2)]);
  const nb = Math.max(1, Math.round((u1 - u0) / 2.4));
  for (let b = 0; b < nb; b++) {
    const uc = u0 + (b + .5) * (u1 - u0) / nb;
    addWindow(ctx, f, uc, 4.6, 0.9, 1.7, 0.02);
    addWindow(ctx, f, uc, 7.1, 0.9, 1.5, 0.02);
    f.box(acc, 'stone', uc - 0.6, uc + 0.6, 4.5, 4.6, 0, 0.14, 2, false);
  }
  shopFront(ctx, f, u0, u1, 3.7);
}

function specialPlot(ctx, f, p, D, key) {
  const { acc, R, out, signGroup } = ctx;
  const { u0, u1 } = p;
  const uc = (u0 + u1) / 2;
  out.doors[key] = { x: f.x(uc, 1.0), z: f.z(uc, 1.0), ry: f.ry() };
  if (key === 'gannets') {
    // The club: Portland stone, a deep portico, a green awning and a red carpet.
    const H = 17;
    f.box(acc, 'stone', u0, u1, 0, H, -D, 0, 2, true);
    f.box(acc, 'stuccoRust', u0, u1, 0, 4.4, 0, 0.12, 2, true);
    f.box(acc, 'stone', u0, u1, 4.4, 4.75, 0, 0.3, 2, true);
    f.box(acc, 'stone', u0 - 0.2, u1 + 0.2, H - 0.3, H + 0.4, 0, 0.7, 2, true);
    f.vquad(acc, 'railing', u0, u1, H + 0.4, H + 1.3, 0.5, 1.0);
    quadOut(acc, f, 'slate', [f.x(u0, -0.5), H + 0.4, f.z(u0, -0.5)], [f.x(u1, -0.5), H + 0.4, f.z(u1, -0.5)], [f.x(u1, -4), H + 3.4, f.z(u1, -4)], [f.x(u0, -4), H + 3.4, f.z(u0, -4)]);
    const nb = 6, bw = (u1 - u0) / nb;
    for (const [yy, hh] of [[5.3, 2.9], [9.2, 2.4], [12.6, 2.0]]) for (let b = 0; b < nb; b++) {
      const x = u0 + (b + .5) * bw;
      addWindow(ctx, f, x, yy, 1.15, hh, 0.02, 0.92);
      f.box(acc, 'trim', x - 0.75, x + 0.75, yy + hh, yy + hh + 0.3, 0, 0.25, 2, true);
      f.box(acc, 'stone', x - 0.75, x + 0.75, yy - 0.15, yy, 0, 0.3, 2, false);
    }
    for (let b = 0; b < nb; b++) { if (b === 2 || b === 3) continue; const x = u0 + (b + .5) * bw; addWindow(ctx, f, x, 1.0, 1.15, 2.4, 0.14, 0.95); }
    // portico
    for (const du of [-2.2, -0.8, 0.8, 2.2]) f.cyl(acc, 'stone', uc + du, 2.6, 0.26, 0.45, 5.2, 12);
    f.box(acc, 'stone', uc - 2.8, uc + 2.8, 5.2, 6.1, 0, 3.1, 2, true);
    f.box(acc, 'stone', uc - 2.9, uc + 2.9, 0, 0.3, 0, 3.2, 2, true);
    f.box(acc, 'stone', uc - 2.9, uc + 2.9, 0, 0.15, 3.2, 3.6, 2, true);
    f.box(acc, 'doorBlack', uc - 0.8, uc + 0.8, 0.3, 3.4, 0, 0.18, 2, true);
    f.box(acc, 'fanlight', uc - 0.8, uc + 0.8, 3.45, 4.1, 0, 0.16, 2, false);
    f.box(acc, 'carpet', uc - 0.7, uc + 0.7, 0.301, 0.32, 0.2, 3.2, 2, false);
    f.box(acc, 'carpet', uc - 0.7, uc + 0.7, 0.151, 0.165, 3.2, 3.6, 2, false);
    f.box(acc, 'carpet', uc - 0.7, uc + 0.7, 0.005, 0.02, 3.6, 4.8, 2, false);
    quadOut(acc, f, 'awnGreen', [f.x(uc - 1.6, 3.1), 4.9, f.z(uc - 1.6, 3.1)], [f.x(uc + 1.6, 3.1), 4.9, f.z(uc + 1.6, 3.1)], [f.x(uc + 1.6, 5.2), 4.4, f.z(uc + 1.6, 5.2)], [f.x(uc - 1.6, 5.2), 4.4, f.z(uc - 1.6, 5.2)]);
    const tex = TX.signTexture('THE GANNETS', { bg: '#1f3a2a', fg: '#e8cf8a', letter: '6px' });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.55), patchCutout(new THREE.MeshBasicMaterial({ map: tex })));
    s.position.set(f.x(uc, 3.12), 5.65, f.z(uc, 3.12)); s.rotation.y = f.ry(); signGroup.add(s);
    out.lamps.push({ x: f.x(uc - 2.7, 3.3), z: f.z(uc - 2.7, 3.3), y: 3.0, bracket: true }, { x: f.x(uc + 2.7, 3.3), z: f.z(uc + 2.7, 3.3), y: 3.0, bracket: true });
    return;
  }
  if (key === 'pub') {
    const H = 10;
    f.box(acc, 'brickRed', u0, u1, 3.9, H, -D, 0, 2, true);
    f.box(acc, 'pubTile', u0, u1, 0, 3.9, -D, 0.15, 1, true);
    f.box(acc, 'stone', u0, u1, H - 0.1, H + 0.3, 0, 0.35, 2, true);
    quadOut(acc, f, 'slate', [f.x(u0, 0), H + 0.3, f.z(u0, 0)], [f.x(u1, 0), H + 0.3, f.z(u1, 0)], [f.x(u1, -D / 2), H + 3.2, f.z(u1, -D / 2)], [f.x(u0, -D / 2), H + 3.2, f.z(u0, -D / 2)]);
    f.box(acc, 'gilt', u0, u1, 3.1, 3.9, 0.15, 0.4, 2, true);
    const nb = 3, bw = (u1 - u0) / nb;
    for (let b = 0; b < nb; b++) {
      const x = u0 + (b + .5) * bw;
      if (b === 1) { f.box(acc, 'doorRed', x - 0.7, x + 0.7, 0, 2.7, 0.15, 0.2, 2, true); f.box(acc, 'pubGlow', x - 0.5, x + 0.5, 1.3, 2.5, 0.2, 0.22, 2, false); }
      else { f.box(acc, 'pubGlow', x - bw / 2 + 0.4, x + bw / 2 - 0.4, 0.8, 2.8, 0.15, 0.19, 2, false); f.box(acc, 'wood', x - bw / 2 + 0.4, x + bw / 2 - 0.4, 1.75, 1.85, 0.15, 0.22, 2, false); }
      addWindow(ctx, f, x, 5.0, 1.0, 1.9, 0.02, 0.8);
      addWindow(ctx, f, x, 7.6, 1.0, 1.6, 0.02, 0.5);
    }
    const tex = TX.signTexture('THE DOG AND PARTRIDGE', { bg: '#151418', fg: '#e6c472' });
    const s = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0 - 0.6, 0.62), patchCutout(new THREE.MeshBasicMaterial({ map: tex })));
    s.position.set(f.x(uc, 0.42), 3.5, f.z(uc, 0.42)); s.rotation.y = f.ry(); signGroup.add(s);
    // hanging sign on a bracket
    f.box(acc, 'iron', u1 - 0.4, u1 - 0.3, 4.5, 4.6, 0, 1.4, 2, true);
    const hs = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), patchCutout(new THREE.MeshBasicMaterial({ map: TX.signTexture('DOG & PARTRIDGE', { w: 256, h: 256, bg: '#2a1d14', fg: '#e6c472', size: 40 }), side: THREE.DoubleSide })));
    hs.position.set(f.x(u1 - 0.35, 0.95), 3.9, f.z(u1 - 0.35, 0.95)); hs.rotation.y = f.ry() + Math.PI / 2; signGroup.add(hs);
    out.lamps.push({ x: f.x(u0 + 0.6, 0.6), z: f.z(u0 + 0.6, 0.6), y: 3.4, bracket: true });
    out.pubFront = { x: f.x(uc, 1.5), z: f.z(uc, 1.5) };
    return;
  }
  if (key === 'flat' || key === 'uncle') {
    house(ctx, f, u0, u1, D, { style: key === 'flat' ? 'brickStucco' : 'stucco', storeys: 4, shop: false });
    return;
  }
  // shops with story roles
  const names = { gossage: ['GOSSAGE & SON', 'ANTIQUES · SILVER · CURIOS'], hatter: ['PARGETER', 'HATTER · BY APPOINTMENT'], tearooms: ['CORRIGAN’S', 'TEA ROOMS'] };
  house(ctx, f, u0, u1, D, { style: key === 'gossage' ? 'stock' : 'brickStucco', storeys: 4, shop: false, noGround: true });
  // overwrite the ground floor with a shopfront standing slightly proud
  f.box(acc, 'shopBlack', u0 + 0.05, u1 - 0.05, 0, 4.0, 0.0, 1.3, 2, false, 'Y');
  shopFrontProud(ctx, f, u0, u1, 4.0, names[key], key);
}

function shopFrontProud(ctx, f, u0, u1, gH, name, key) {
  // A shopfront built 1.35 m proud of the house so it covers the house's own door and area.
  const { acc, signGroup, out } = ctx;
  const P = 1.35;
  const col = key === 'gossage' ? 'shopGreen' : key === 'hatter' ? 'shopNavy' : 'shopMaroon';
  f.box(acc, col, u0, u1, 0, gH, 0, P, 2, true);
  f.box(acc, 'gilt', u0, u1, gH - 0.2, gH - 0.08, P, P + 0.08, 2, false);
  const du = u1 - 1.4;
  f.box(acc, 'shopGlow', u0 + 0.4, du - 0.7, 0.6, gH - 1.2, P, P + 0.04, 2, false);
  for (let x = u0 + 1.6; x < du - 0.9; x += 1.2) f.box(acc, col, x - 0.04, x + 0.04, 0.6, gH - 1.2, P, P + 0.08, 2, false);
  f.box(acc, 'doorBlack', du - 0.6, du + 0.6, 0, 2.8, P, P + 0.05, 2, true);
  f.box(acc, 'shopGlow', du - 0.4, du + 0.4, 1.5, 2.6, P + 0.05, P + 0.07, 2, false);
  const tex = TX.signTexture(name[0], { sub: name[1], bg: '#121116', fg: '#e3c77e', border: '#b7934a' });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(u1 - u0 - 0.8, 0.85), patchCutout(new THREE.MeshBasicMaterial({ map: tex })));
  sign.position.set(f.x((u0 + u1) / 2, P + 0.02), gH - 0.68, f.z((u0 + u1) / 2, P + 0.02));
  sign.rotation.y = f.ry(); signGroup.add(sign);
  quadOut(acc, f, key === 'gossage' ? 'awnStripe' : 'awnGreen', [f.x(u0 + 0.2, P + 0.1), gH - 1.25, f.z(u0 + 0.2, P + 0.1)], [f.x(u1 - 0.2, P + 0.1), gH - 1.25, f.z(u1 - 0.2, P + 0.1)],
    [f.x(u1 - 0.2, P + 1.5), gH - 1.85, f.z(u1 - 0.2, P + 1.5)], [f.x(u0 + 0.2, P + 1.5), gH - 1.85, f.z(u0 + 0.2, P + 1.5)]);
  out.doors[key] = { x: f.x(du, P + 0.9), z: f.z(du, P + 0.9), ry: f.ry() };
  const win = { x: f.x((u0 + du) / 2 - 0.3, P + 0.05), z: f.z((u0 + du) / 2 - 0.3, P + 0.05), ry: f.ry(), y: 1.3 };
  if (key === 'gossage') out.gossageWindow = win;
  out.solids.push(rectOf(f, u0, u1, 0, P));
}

function rectOf(f, u0, u1, w0, w1) {
  const xs = [f.x(u0, w0), f.x(u1, w1)], zs = [f.z(u0, w0), f.z(u1, w1)];
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

// ---------------------------------------------------------------- windows (instanced)
export function buildWindows(scene, list) {
  const tex = TX.sashTexture();
  const mat = patchCutout(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const LIT = [new THREE.Color(1.5, 1.05, 0.55), new THREE.Color(1.4, 0.9, 0.5), new THREE.Color(1.6, 1.2, 0.7), new THREE.Color(1.2, 0.75, 0.45)];
  const DARK = new THREE.Color(0.07, 0.08, 0.12);
  const R = rng(77);
  list.forEach((w, i) => {
    p.set(w.x, w.y, w.z); e.set(0, w.ry, 0); q.setFromEuler(e); s.set(w.w, w.h, 1);
    m4.compose(p, q, s); mesh.setMatrixAt(i, m4);
    mesh.setColorAt(i, w.lit ? LIT[Math.floor(R() * LIT.length)] : DARK);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  scene.add(mesh);
  // Every so often someone turns a light on or off.
  const c = new THREE.Color();
  mesh.userData.tick = () => {
    for (let k = 0; k < 2; k++) {
      const i = Math.floor(Math.random() * list.length);
      list[i].lit = !list[i].lit;
      mesh.setColorAt(i, list[i].lit ? LIT[i % LIT.length] : DARK);
    }
    mesh.instanceColor.needsUpdate = true;
    return c;
  };
  return mesh;
}

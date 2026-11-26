// The map: a six-by-six block slice of Mayfair, stylised but with real street names.
// x runs east, z runs south. One unit is one metre.

export const XS = [
  { x: -150, name: 'Park Lane', w: 16 },
  { x: -100, name: 'Park Street', w: 10 },
  { x: -50, name: 'South Audley Street', w: 12 },
  { x: 0, name: 'Davies Street', w: 11 },
  { x: 50, name: 'New Bond Street', w: 12 },
  { x: 100, name: 'Dover Street', w: 10 },
  { x: 150, name: 'Albemarle Street', w: 11 },
];
export const ZS = [
  { z: -150, name: 'Brook Street', w: 12 },
  { z: -100, name: 'Grosvenor Street', w: 12 },
  { z: -50, name: 'Mount Street', w: 12 },
  { z: 0, name: 'Charles Street', w: 10 },
  { z: 50, name: 'Hill Street', w: 10 },
  { z: 100, name: 'Curzon Street', w: 12 },
  { z: 150, name: 'Piccadilly', w: 16 },
];
export const PAVE = 3.2;
export const BOUNDS = { x0: -166, x1: 166, z0: -166, z1: 166 };

// Block (i, j) lies between XS[i] and XS[i+1], ZS[j] and ZS[j+1].
export const SPECIAL = {
  '1,1': { kind: 'square', name: 'Grosvenor Square' },
  '3,3': { kind: 'square', name: 'Berkeley Square' },
  '4,5': { kind: 'market', name: 'Shepherd Market' },
  '2,2': { kind: 'mews', name: 'Adams Row', dir: 'x' },
  '1,3': { kind: 'mews', name: 'Reeves Mews', dir: 'z' },
  '5,1': { kind: 'mews', name: 'Bourdon Place', dir: 'z' },
};

// London streets do not run true: a street may jog sideways at a junction, so that its next
// stretch is offset from the last (a dogleg). 'i:j' shifts XS[i] between ZS[j] and ZS[j+1];
// 'j:i' shifts ZS[j] between XS[i] and XS[i+1]. Positive is east / south, in metres.
export const XOFF = { '3:4': 5 };          // Davies Street steps east past Berkeley Square
export const ZOFF = { '2:2': 8, '2:3': 8 }; // Mount Street drops south beyond South Audley Street
// Centre line of XS[i] on its stretch j (between ZS[j] and ZS[j+1]); likewise zAt for ZS[j] on stretch i.
export const xAt = (i, j) => XS[i].x + (XOFF[i + ':' + j] || 0);
export const zAt = (j, i) => ZS[j].z + (ZOFF[j + ':' + i] || 0);

export function blockRect(i, j) {
  const a = XS[i], b = XS[i + 1], c = ZS[j], d = ZS[j + 1];
  const ax = xAt(i, j), bx = xAt(i + 1, j), cz = zAt(j, i), dz = zAt(j + 1, i);
  return {
    i, j,
    // kerb line
    kx0: ax + a.w / 2, kx1: bx - b.w / 2, kz0: cz + c.w / 2, kz1: dz - d.w / 2,
    // building line
    x0: ax + a.w / 2 + PAVE, x1: bx - b.w / 2 - PAVE, z0: cz + c.w / 2 + PAVE, z1: dz - d.w / 2 - PAVE,
    west: a.name, east: b.name, north: c.name, south: d.name,
    special: SPECIAL[i + ',' + j] || null,
  };
}

// London is not a grid. Some streets stop at a T-junction instead of running through.
// 'x:i:j' closes XS[i] between ZS[j] and ZS[j+1]; 'z:j:i' closes ZS[j] between XS[i] and XS[i+1].
export const CLOSED = new Set([
  'z:3:0', // Charles Street ends at Park Street (Dunraven Street was never cut through)
  'z:4:5', // Hill Street stops short of Albemarle Street
  'x:1:5', // Park Street does not reach Piccadilly
  'x:5:0', // Dover Street starts at Grosvenor Street
  'z:2:4', // Mount Street ends at New Bond Street
]);
export const edgeClosed = (axis, idx, k) => CLOSED.has(axis + ':' + idx + ':' + k);
// Is street XS[i] (axis 'x') or ZS[j] (axis 'z') closed at this coordinate along it?
export function closedAt(axis, idx, t) {
  const cross = axis === 'x' ? ZS : XS, at = axis === 'x' ? zAt : xAt;
  for (let k = 0; k < cross.length - 1; k++) {
    if (!edgeClosed(axis, idx, k)) continue;
    const a = Math.max(at(k, idx - 1), at(k, idx)) + cross[k].w / 2, b = Math.min(at(k + 1, idx - 1), at(k + 1, idx)) - cross[k + 1].w / 2;
    if (t > a && t < b) return true;
  }
  return false;
}

// Every open stretch of carriageway as a rectangle. A stretch runs from junction to junction and
// covers the whole junction at each end, doglegs included; the outermost run to the map's edge.
export const SEGS = [];
{
  const span = (cross, at, k, idx) => {
    const lo = k < 0 ? -1e4 : Math.min(at(k, idx - 1), at(k, idx)) - cross[k].w / 2;
    const hi = k >= cross.length - 1 ? 1e4 : Math.max(at(k + 1, idx - 1), at(k + 1, idx)) + cross[k + 1].w / 2;
    return [lo, hi];
  };
  XS.forEach((s, i) => {
    for (let k = -1; k < ZS.length; k++) {
      if (k >= 0 && k < ZS.length - 1 && edgeClosed('x', i, k)) continue;
      const x = xAt(i, k), [z0, z1] = span(ZS, zAt, k, i);
      SEGS.push({ axis: 'x', idx: i, k, name: s.name, w: s.w, c: x, x0: x - s.w / 2, x1: x + s.w / 2, z0, z1 });
    }
  });
  ZS.forEach((s, j) => {
    for (let k = -1; k < XS.length; k++) {
      if (k >= 0 && k < XS.length - 1 && edgeClosed('z', j, k)) continue;
      const z = zAt(j, k), [x0, x1] = span(XS, xAt, k, j);
      SEGS.push({ axis: 'z', idx: j, k, name: s.name, w: s.w, c: z, z0: z - s.w / 2, z1: z + s.w / 2, x0, x1 });
    }
  });
}

// Blocks: single cells, or two cells joined across a closed street.
function mergedRect(i0, j0, i1, j1) {
  const a = blockRect(i0, j0), b = blockRect(i1, j1);
  return { ...a, i1, j1, kx1: b.kx1, kz1: b.kz1, x1: b.x1, z1: b.z1, east: b.east, south: b.south, special: i0 === i1 && j0 === j1 ? a.special : null };
}
export const BLOCKS = [];
{
  const used = new Set();
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
    if (used.has(i + ',' + j)) continue;
    let i1 = i, j1 = j;
    if (edgeClosed('x', i + 1, j) && i < 5) i1 = i + 1;        // street east of the cell is closed here
    else if (edgeClosed('z', j + 1, i) && j < 5) j1 = j + 1;   // street south of the cell is closed here
    for (let a = i; a <= i1; a++) for (let b = j; b <= j1; b++) used.add(a + ',' + b);
    BLOCKS.push(i1 === i && j1 === j ? { ...blockRect(i, j), i1: i, j1: j } : mergedRect(i, j, i1, j1));
  }
}

// Places in the story. Door positions are on the pavement, just outside the building line.
export const PLACES = {
  flat:     { x: -42.6, z: 25, face: -Math.PI / 2, name: '14a South Audley Street', short: 'Your flat' },
  gannets:  { x: 25, z: 91.6, face: 0, name: 'The Gannets Club, Curzon Street', short: 'The Gannets' },
  gossage:  { x: -75, z: -41.6, face: Math.PI, name: 'Gossage & Son, Mount Street', short: 'Gossage & Son' },
  phone:    { x: -63, z: -43.2, name: 'Telephone kiosk, Mount Street', short: 'Telephone' },
  hatter:   { x: 41.6, z: -78, face: Math.PI / 2, name: 'Pargeter, hatter, New Bond Street', short: 'Pargeter, hatter' },
  tearooms: { x: 58.4, z: 18, face: -Math.PI / 2, name: 'Corrigan’s Tea Rooms, New Bond Street', short: 'Tea rooms' },
  pub:      { x: 66, z: 126.2, face: Math.PI, name: 'The Dog and Partridge, Shepherd Market', short: 'The Dog and Partridge' },
  uncle:    { x: -75, z: -108.4, face: 0, name: '9 Grosvenor Street', short: 'Uncle Fennimore' },
  dairy:    { x: -75, z: 25, name: 'Reeves Mews dairy', short: 'Dairy' },
  pigpen:   { x: 75.5, z: 124, name: 'Shepherd Market', short: 'The pig' },
  showring: { x: 25, z: 25, name: 'Berkeley Square', short: 'Berkeley Square' },
  nanny:    { x: -75, z: -75, name: 'Grosvenor Square', short: 'Nursemaid' },
  cabrank:  { x: 25, z: 104.5, name: 'Cab rank, Curzon Street', short: 'Cab rank' },
  church:   { x: 25, z: -7.4, face: 0, name: 'St Anselm’s, Charles Street', short: 'St Anselm’s' },
};

// A Regency crescent bowed into the block between New Bond Street and Dover Street,
// opening onto Dover Street at both ends. Points are x = cx - r cos(phi), z = cz + r sin(phi).
export const CRESCENT = {
  name: 'Pevensey Crescent', bi: 4, bj: 1, cx: 96, cz: -50, mouthX: 95,
  rGarden: 12.5, rIn: 14.5, rOut: 20.5, rFront: 23, rBack: 30, phiT: 74 * Math.PI / 180, gardenX: 92,
};
export const crescentPolar = (x, z) => ({ r: Math.hypot(x - CRESCENT.cx, z - CRESCENT.cz), phi: Math.atan2(z - CRESCENT.cz, CRESCENT.cx - x) });
export const crescentPt = (r, phi) => [CRESCENT.cx - r * Math.cos(phi), CRESCENT.cz + r * Math.sin(phi)];
// The two mouths onto Dover Street, as z ranges along the kerb.
export const CRESCENT_MOUTHS = (() => {
  const C = CRESCENT, d = C.cx - C.mouthX;
  const zo = C.rOut * Math.sin(Math.acos(d / C.rOut)), zi = C.rIn * Math.sin(Math.acos(d / C.rIn));
  return [[C.cz - zo, C.cz - zi], [C.cz + zi, C.cz + zo]];
})();
export function onCrescent(x, z) {
  if (x > CRESCENT.mouthX || x < CRESCENT.cx - CRESCENT.rOut) return false;
  const { r } = crescentPolar(x, z);
  return r > CRESCENT.rIn && r < CRESCENT.rOut;
}

// A street cut through a block on the slant, junction to junction, where an old field path once ran.
// It splits its block into two triangles, each with a right angle at the block's outer corner.
export const DIAGS = [{ name: 'Waverton Street', bi: 1, bj: 4, a: [-100, 50], b: [-50, 100], w: 9 }];
// Signed distance from the centre line (positive on the north-east side) and distance along it.
export function diagLocal(D, x, z) {
  const dx = D.b[0] - D.a[0], dz = D.b[1] - D.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  return { d: (x - D.a[0]) * uz - (z - D.a[1]) * ux, t: (x - D.a[0]) * ux + (z - D.a[1]) * uz, L, ux, uz };
}
export const onDiag = (x, z) => DIAGS.find((D) => { const q = diagLocal(D, x, z); return q.t > 0 && q.t < q.L && Math.abs(q.d) < D.w / 2; });
// The two triangles of the cut block, each as [acute corner 1, right-angle corner, acute corner 2],
// at an offset 'off' metres in from the kerb line (0: kerb, PAVE: building line).
export function diagTriangles(D, off = 0) {
  const B = blockRect(D.bi, D.bj);
  const tri = (qx, qz, e1, e2) => {
    const Q = [qx + (e1[0] + e2[0]) * off, qz + (e1[1] + e2[1]) * off];
    const dq = Math.abs(diagLocal(D, Q[0], Q[1]).d), L = (dq - D.w / 2 - off) * Math.SQRT2;
    return { A1: [Q[0] + e1[0] * L, Q[1] + e1[1] * L], Q, A2: [Q[0] + e2[0] * L, Q[1] + e2[1] * L], L, e1, e2 };
  };
  // north-east: right angle at the block's NE corner, legs running west and south
  // south-west: right angle at the SW corner, legs running east and north
  return [tri(B.kx1, B.kz0, [-1, 0], [0, 1]), tri(B.kx0, B.kz1, [1, 0], [0, -1])];
}
export const pointInPoly = (x, z, P) => {
  let ins = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
};

export function streetAt(x, z) {
  for (const D of DIAGS) {
    const q = diagLocal(D, x, z), B = blockRect(D.bi, D.bj);
    if (Math.abs(q.d) < D.w / 2 + PAVE && x > B.kx0 && x < B.kx1 && z > B.kz0 && z < B.kz1) return D.name;
  }
  if (x < CRESCENT.mouthX) { const { r } = crescentPolar(x, z); if (r < CRESCENT.rFront + 0.5 && x > CRESCENT.cx - CRESCENT.rFront - 1) return CRESCENT.name; }
  for (const g of SEGS) {
    if (g.axis === 'x' ? (x > g.x0 - PAVE && x < g.x1 + PAVE && z > g.z0 && z < g.z1) : (z > g.z0 - PAVE && z < g.z1 + PAVE && x > g.x0 && x < g.x1)) return g.name;
  }
  for (const b of BLOCKS) if (b.special && x > b.kx0 && x < b.kx1 && z > b.kz0 && z < b.kz1) return b.special.name;
  return 'Mayfair';
}

// Is (x,z) on a carriageway?
export function onRoad(x, z) {
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return false;
  if (onCrescent(x, z)) return true;
  if (onDiag(x, z)) return true;
  for (const g of SEGS) if (x > g.x0 && x < g.x1 && z > g.z0 && z < g.z1) return true;
  return false;
}

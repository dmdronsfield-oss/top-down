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

export function blockRect(i, j) {
  const a = XS[i], b = XS[i + 1], c = ZS[j], d = ZS[j + 1];
  return {
    i, j,
    // kerb line
    kx0: a.x + a.w / 2, kx1: b.x - b.w / 2, kz0: c.z + c.w / 2, kz1: d.z - d.w / 2,
    // building line
    x0: a.x + a.w / 2 + PAVE, x1: b.x - b.w / 2 - PAVE, z0: c.z + c.w / 2 + PAVE, z1: d.z - d.w / 2 - PAVE,
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
  const cross = axis === 'x' ? ZS : XS, key = axis === 'x' ? 'z' : 'x';
  for (let k = 0; k < cross.length - 1; k++) {
    if (!edgeClosed(axis, idx, k)) continue;
    const a = cross[k][key] + cross[k].w / 2, b = cross[k + 1][key] - cross[k + 1].w / 2;
    if (t > a && t < b) return true;
  }
  return false;
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

export function streetAt(x, z) {
  if (x < CRESCENT.mouthX) { const { r } = crescentPolar(x, z); if (r < CRESCENT.rFront + 0.5 && x > CRESCENT.cx - CRESCENT.rFront - 1) return CRESCENT.name; }
  for (let i = 0; i < XS.length; i++) { const s = XS[i]; if (Math.abs(x - s.x) < s.w / 2 + PAVE && !closedAt('x', i, z)) return s.name; }
  for (let j = 0; j < ZS.length; j++) { const s = ZS[j]; if (Math.abs(z - s.z) < s.w / 2 + PAVE && !closedAt('z', j, x)) return s.name; }
  for (const b of BLOCKS) if (b.special && x > b.kx0 && x < b.kx1 && z > b.kz0 && z < b.kz1) return b.special.name;
  return 'Mayfair';
}

// Is (x,z) on a carriageway?
export function onRoad(x, z) {
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return false;
  if (onCrescent(x, z)) return true;
  for (let i = 0; i < XS.length; i++) if (Math.abs(x - XS[i].x) < XS[i].w / 2 && !closedAt('x', i, z)) return true;
  for (let j = 0; j < ZS.length; j++) if (Math.abs(z - ZS[j].z) < ZS[j].w / 2 && !closedAt('z', j, x)) return true;
  return false;
}

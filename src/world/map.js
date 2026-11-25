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

export const BLOCKS = [];
for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) BLOCKS.push(blockRect(i, j));

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

export function streetAt(x, z) {
  for (const s of XS) if (Math.abs(x - s.x) < s.w / 2 + PAVE) return s.name;
  for (const s of ZS) if (Math.abs(z - s.z) < s.w / 2 + PAVE) return s.name;
  for (const b of BLOCKS) if (b.special && x > b.kx0 && x < b.kx1 && z > b.kz0 && z < b.kz1) return b.special.name;
  return 'Mayfair';
}

// Is (x,z) on a carriageway?
export function onRoad(x, z) {
  if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) return false;
  for (const s of XS) if (Math.abs(x - s.x) < s.w / 2) return true;
  for (const s of ZS) if (Math.abs(z - s.z) < s.w / 2) return true;
  return false;
}

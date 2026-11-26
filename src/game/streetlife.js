import * as THREE from 'three';
import { CAST } from '../people/cast.js';
import { toon, inked, glow } from '../render/materials.js';
import { patchCutout } from '../render/cutout.js';

// Little scenes that stay put: a coffee stall in Shepherd Market, a flower seller at the corner of
// Berkeley Square, two ladies with a great deal to say on Mount Street, and a sandwich-board man
// walking up and down New Bond Street for Corrigan's Tea Rooms. Each chatters when Teddy is near.

const M = (c) => patchCutout(toon(c));
const box = (w, h, d, mat, x, y, z) => { const m = inked(new THREE.BoxGeometry(w, h, d), mat, 0.012); m.position.set(x, y, z); return m; };

function coffeeStall() {
  const g = new THREE.Group();
  const green = M('#2b4a36'), wood = M('#5a3e28'), cream = M('#d9cfb0'), red = M('#8a2a26');
  g.add(box(1.3, 0.9, 2.2, green, 0, 0.75, 0));                    // the cart
  g.add(box(1.45, 0.06, 2.35, wood, 0, 1.22, 0));                  // counter
  for (const z of [-0.6, 0.6]) { const w = inked(new THREE.TorusGeometry(0.32, 0.05, 6, 14), M('#1b1a20'), 0.01); w.rotation.y = Math.PI / 2; w.position.set(0.68, 0.34, z); g.add(w); }
  for (const z of [-1.05, 1.05]) g.add(box(0.06, 1.3, 0.06, wood, 0.6, 1.9, z));
  // striped awning over the counter
  for (let i = 0; i < 6; i++) g.add(box(1.7, 0.05, 0.42, i % 2 ? cream : red, -0.15, 2.58 - 0.02 * i, -1.05 + i * 0.42));
  // the tea urn, steaming, and a lamp
  const urn = inked(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 12), M('#b8913e'), 0.01); urn.position.set(0.2, 1.53, -0.5); g.add(urn);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.24, 0.18), patchCutout(glow('#ffc37a', 2.2))); lamp.position.set(-0.55, 2.3, 0.6); g.add(lamp);
  for (let i = 0; i < 4; i++) { const c = inked(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 8), cream, 0.006); c.position.set(-0.45 + i * 0.13, 1.3, 0.35 + (i % 2) * 0.1); g.add(c); }
  const sign = box(0.04, 0.32, 1.4, cream, -0.68, 0.95, 0); g.add(sign);
  return g;
}

function flowerBasket() {
  const g = new THREE.Group();
  g.add(box(0.55, 0.4, 0.4, M('#6b4f2e'), 0, 0.35, 0));
  const cols = ['#c9343a', '#e8e2d4', '#d9a43c', '#7a3a8a', '#e07a9a'];
  for (let i = 0; i < 14; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), patchCutout(glow(cols[i % cols.length], 0.85)));
    f.position.set(-0.22 + (i % 5) * 0.11, 0.6 + (i % 3) * 0.04, -0.14 + Math.floor(i / 5) * 0.13); g.add(f);
  }
  g.add(box(0.7, 0.05, 0.5, M('#3a2e22'), 0, 0.12, 0));
  return g;
}

function organ() {
  const g = new THREE.Group();
  const wood = M('#6a3e24'), dark = M('#2a1d16'), gilt = M('#c9a24c'), red = M('#a3201b');
  g.add(box(0.06, 0.75, 0.06, dark, 0, 0.38, 0));                 // the pole it stands on
  g.add(box(0.7, 0.5, 0.38, wood, 0, 0.98, 0));                   // the organ
  g.add(box(0.72, 0.05, 0.4, gilt, 0, 1.25, 0));
  for (let i = 0; i < 5; i++) g.add(box(0.05, 0.28, 0.02, gilt, -0.22 + i * 0.11, 1.0, 0.2)); // pipes painted on the front
  const crank = box(0.04, 0.04, 0.2, dark, 0.38, 1.0, -0.05); g.add(crank);
  // the monkey, sitting on top in a fez
  const body = inked(new THREE.SphereGeometry(0.09, 8, 6), M('#5a3a22'), 0.008); body.scale.set(1, 1.2, 0.9); body.position.set(-0.15, 1.38, 0); g.add(body);
  const head = inked(new THREE.SphereGeometry(0.06, 8, 6), M('#6b4a2e'), 0.008); head.position.set(-0.15, 1.52, 0.02); g.add(head);
  const fez = inked(new THREE.CylinderGeometry(0.03, 0.04, 0.05, 8), red, 0.006); fez.position.set(-0.15, 1.59, 0.02); g.add(fez);
  g.userData.crank = crank;
  return g;
}

function boards() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 384;
  const k = c.getContext('2d');
  k.fillStyle = '#efe6d0'; k.fillRect(0, 0, 256, 384);
  k.strokeStyle = '#1d3b2f'; k.lineWidth = 8; k.strokeRect(10, 10, 236, 364);
  k.fillStyle = '#1d3b2f'; k.textAlign = 'center';
  k.font = '700 30px "Josefin Sans", sans-serif'; k.fillText('TAKE TEA AT', 128, 70);
  k.font = '700 52px "Libre Baskerville", serif'; k.fillText('CORRIGAN’S', 128, 150, 220);
  k.fillStyle = '#8c2b2b'; k.font = 'italic 26px "Libre Baskerville", serif'; k.fillText('New Bond Street', 128, 200);
  k.fillStyle = '#1d3b2f'; k.font = '700 26px "Josefin Sans", sans-serif';
  k.fillText('TEAS 6d', 128, 270); k.fillText('TOASTED TEACAKES', 128, 310);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const mat = patchCutout(new THREE.MeshBasicMaterial({ map: t }));
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.92), mat);
    p.position.set(0, 1.05, s * 0.2); p.rotation.y = s > 0 ? 0 : Math.PI; g.add(p);
    const edge = box(0.64, 0.94, 0.015, M('#2a2018'), 0, 1.05, s * 0.192); g.add(edge);
  }
  for (const x of [-0.22, 0.22]) g.add(box(0.02, 0.02, 0.42, M('#2a2018'), x, 1.52, 0)); // straps over the shoulders
  return g;
}

const LINES = {
  stall: ['Two sugars, Alf.', 'Cold enough for you?', 'Saveloy and a cup of char, ta.', 'He was at the Embassy Club till three, they say.', 'That tea’d strip paint.', 'Seen a pig go by? No? Funny night.', 'Penny bun, guv?'],
  flowers: ['Violets! Lovely violets!', 'Buttonhole, sir? Brightens the evening.', 'Carnations, tuppence!', 'Flowers for the lady, guv?', 'Last of the chrysanths!'],
  ladies: ['My dear, in a taxi! At her age!', 'And the hat! I ask you!', 'They say the Colonel’s sow is loose in Mayfair.', 'One simply does not wear brown in town.', 'Lady Pevensey cut her dead. Dead!', 'Is that the Wrenfield boy? It is!'],
  pub: ['Another half, Bert?', 'My round, is it? Funny how it’s always my round.', 'He’s no gentleman. Not in that hat.', 'Heard a pig went by. Honest.', 'Time, gentlemen, please! No, not yet. Practising.', 'Wet as a haddock out here.'],
  rank: ['Rank’s dead tonight.', 'Fare to Croydon, he wanted. Croydon!', 'Watch young Wrenfield. He borrows motors.', 'Shocking night for it.', 'Tuppence tip. Tuppence!'],
  organ: ['A penny for the monkey, sir?', 'He bites, sir. Only Liberals.', 'Played for the Prince of Wales, I have. Near enough.', 'Lovely tune, that. Wrote it myself. Mostly.', 'Don’t mind the rain, it’s good for the pipes.'],
  board: ['Corrigan’s for teas!', 'Toasted teacakes, fourpence!', 'Finest Darjeeling in the West End!', 'Mind the boards, sir.'],
};

export class StreetLife {
  constructor(G) {
    this.G = G; this.groups = [];
    const w = G.world, scene = G.scene, solids = G.city.solids, lamps = G.props.lamps;
    // Coffee stall in the north lane of Shepherd Market
    {
      const x = 77.2, z = 114, s = coffeeStall(); s.position.set(x, 0.15, z); scene.add(s);
      solids.push({ x0: x - 0.75, x1: x + 0.75, z0: z - 1.15, z1: z + 1.15 });
      lamps.push({ x: x - 0.55, y: 2.4, z: z + 0.6, dim: true });
      const keeper = w.addActor({ ...CAST.cabbie, colours: { ...CAST.cabbie.colours, Suit: '#e2dccb' }, hat: 'cap', hatCol: '#3a3a3a' }, x + 1.0, z, -Math.PI / 2);
      const c1 = w.addActor({ sex: 'm', colours: { Suit: '#3a3a3a', Tie: '#6a5a3c', Hair: '#4a3122', Skin: '#d9a882' }, hat: 'cap', hatCol: '#4a3f33', kind: 'worker' }, x - 1.55, z - 0.5, Math.PI / 2);
      const c2 = w.addActor({ sex: 'm', colours: { Suit: '#1b2236', Tie: '#1b2236', Hair: '#3a2a1c', Skin: '#e8bf9c' }, hat: 'cap', hatCol: '#1b2236', kind: 'worker' }, x - 1.45, z + 0.8, Math.PI / 2 + 0.3);
      this.groups.push({ x, z, members: [keeper, c1, c2], lines: LINES.stall, t: 2 });
    }
    // Flower seller at the north-west corner of Berkeley Square
    {
      const x = 8.1, z = 7.7, b = flowerBasket(); b.position.set(x - 0.5, 0.15, z - 0.5); b.rotation.y = -Math.PI / 4; scene.add(b);
      const f = w.addActor({ sex: 'w', body: 'w_formal', colours: { LimeGreen: '#4a3a2e', Gold: '#7a3a3a', Red: '#1b1a20', Brown: '#5a3c26', Skin: '#e3b893' }, hat: 'cloche', hatCol: '#2a2420' }, x, z, -Math.PI * 0.75);
      solids.push({ x0: x - 0.85, x1: x - 0.15, z0: z - 0.85, z1: z - 0.15, small: true });
      this.groups.push({ x, z, members: [f], lines: LINES.flowers, t: 1 });
    }
    // Two ladies on the south pavement of Mount Street, deep in it
    {
      const x = -84, z = -57.8;
      const a = w.addActor({ sex: 'w', body: 'w_suit', colours: { Black: '#3a2a3a', White: '#e8e2d4', Brown: '#1b1a20', Hair_Brown: '#6b4a2e', Hair_Blond: '#6b4a2e', Skin: '#f0d0b4' }, hat: 'cloche', hatCol: '#5a2a3a', umbrella: true }, x - 0.55, z, Math.PI / 2);
      const b = w.addActor({ sex: 'w', body: 'w_formal', colours: { LimeGreen: '#1f2a4a', Gold: '#c9a24c', Red: '#1b1a20', Brown: '#9a958c', Hair_Brown: '#9a958c', Hair_Blond: '#9a958c', Skin: '#efd2bc' }, hat: 'cloche', hatCol: '#1f2a4a', umbrella: true, scale: 1.04 }, x + 0.55, z, -Math.PI / 2);
      this.groups.push({ x, z, members: [a, b], lines: LINES.ladies, t: 3 });
    }
    // Drinkers outside the Dog and Partridge, pints in hand, in no hurry to go home
    {
      const x = 66, z = 124.6;
      const m = (c, h, hc, dx, dz, ang) => w.addActor({ sex: 'm', colours: { Suit: c, Tie: '#5a2a26', Hair: h, Skin: '#e0b090' }, hat: hc ? 'cap' : 'bowler', hatCol: hc || '#2a2620', kind: 'worker' }, x + dx, z + dz, ang);
      const a = m('#3d3a35', '#4a3122', '#3a332a', -1.6, 0.2, Math.PI / 2 - 0.3);
      const b = m('#2a2c38', '#2a1d14', null, 0.1, -0.5, -0.2);
      const c = m('#4a3f33', '#6b5a48', '#2a2a2a', 1.5, 0.3, -Math.PI / 2 + 0.3);
      for (const d of [a, b, c]) {
        const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.14, 8), patchCutout(glow('#d9a43c', 0.7)));
        glass.position.set(-0.22, 1.02, 0.18); d.fig.group.add(glass);
      }
      this.groups.push({ x, z, members: [a, b, c], lines: LINES.pub, t: 2.5 });
    }
    // Cabbies at the Curzon Street rank, stamping their feet between fares
    {
      const x = 28, z = 107.6;
      const a = w.addActor({ ...CAST.cabbie }, x, z, Math.PI / 2);
      const b = w.addActor({ ...CAST.cabbie, colours: { ...CAST.cabbie.colours, Suit: '#2c2a26' }, extras: ['moustache'] }, x + 1.1, z + 0.2, -Math.PI / 2);
      this.groups.push({ x, z, members: [a, b], lines: LINES.rank, t: 3.5 });
    }
    // An organ grinder by Berkeley Square, with a monkey in a red fez on the organ
    {
      const x = 38, z = 42.2, o = organ(); o.position.set(x, 0.15, z + 0.58); scene.add(o); // backs to the square's railings
      solids.push({ x0: x - 0.4, x1: x + 0.4, z0: z + 0.38, z1: z + 0.78, small: true });
      const a = w.addActor({ sex: 'm', colours: { Suit: '#4a3a30', Tie: '#8a2a26', Hair: '#1d1a18', Skin: '#c99872' }, hat: 'cap', hatCol: '#2a2a2a', kind: 'worker', extras: ['moustache'] }, x, z, 0);
      this.organ = { x, z: z + 0.6, a, t: 0 };
      this.groups.push({ x, z, members: [a], lines: LINES.organ, t: 3 });
    }
    // The sandwich-board man, up and down outside the tea rooms
    {
      const a = w.addActor({ ...CAST.cabbie, colours: { ...CAST.cabbie.colours, Suit: '#5a5046' }, hat: 'bowler', hatCol: '#2a2620', extras: ['moustache'] }, 57.1, 10, 0);
      a.fig.group.add(boards());
      this.board = { a, ends: [[57.1, 8], [57.1, 38]], leg: 1, pause: 0 };
      this.groups.push({ follow: a, members: [a], lines: LINES.board, t: 4 });
    }
  }
  update(dt) {
    const p = this.G.world.player;
    // the board man's beat
    const b = this.board;
    if (b.pause > 0) { b.pause -= dt; b.a.speed = 0; }
    else if (b.a.busy <= 0) {
      const [tx, tz] = b.ends[b.leg];
      if (b.a.stepTo(tx, tz, 0.9, dt) < 0.2) { b.leg = 1 - b.leg; b.pause = 2 + Math.random() * 3; }
    }
    // the grinder turns his handle
    const o = this.organ;
    if (o && Math.hypot(p.x - o.x, p.z - o.z) < 40 && o.a.busy <= 0) { o.t -= dt; if (o.t <= 0) { o.a.oneShot('Interact', 1.2); o.t = 1.3; } }
    for (const g of this.groups) {
      const x = g.follow ? g.follow.x : g.x, z = g.follow ? g.follow.z : g.z;
      if (Math.hypot(p.x - x, p.z - z) > 16) continue;
      g.t -= dt;
      if (g.t > 0) continue;
      g.t = 4.5 + Math.random() * 5;
      const who = g.members[Math.floor(Math.random() * g.members.length)];
      if (who.busy > 0 || who.down > 0) continue;
      // the ladies take turns, and look at each other while they do
      this.G.hud.sayBy(who, g.lines[Math.floor(Math.random() * g.lines.length)]);
    }
  }
}

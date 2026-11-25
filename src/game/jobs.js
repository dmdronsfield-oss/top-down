import * as THREE from 'three';
import { CAST, buildHat, cowCreamer, milkJug, pram, pig as pigModel } from '../people/cast.js';
import { attach, play } from '../people/figures.js';
import { PLACES } from '../world/map.js';
import { groundY } from '../world/ground.js';
import { collide } from '../core/physics.js';
import { sfx } from '../audio/sfx.js';

const d2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };

// ---------------------------------------------------------------- writing
export const TELEGRAMS = {
  helmet: 'OLLERENSHAW WAGERS FIVE POUNDS YOU CANNOT PINCH A CONSTABLES HELMET BEFORE SUPPER STOP DELIVER TO GANNETS STOP AUNT MUST NOT KNOW STOP',
  creamer: 'UNCLE FENNIMORE INSISTS SILVER COW CREAMER AT GOSSAGES MUST NOT FALL TO TRESHAM STOP TRESHAM CALLS AT TEN STOP SECURE IT BY ANY MEANS STOP DELIVER NINE GROSVENOR STREET STOP',
  pig: 'COLONEL FOTHERGILL PYM BEGS ASSISTANCE STOP PRIZE PIG HYACINTH MUST REACH BERKELEY SQUARE FOR FAT STOCK SOIREE BY ELEVEN STOP SHE AWAITS AT SHEPHERD MARKET STOP DO NOT FEED HER STOP',
  done: 'HAVE HEARD EVERYTHING STOP ARRIVING BY THE FIRST TRAIN STOP HESTER',
};
const HINTS = {
  helmet_find: 'PC Plumtree walks Mount Street, sir, and stops at Gossage’s window to admire a silver cow. A gentleman behind him at that moment would find him wholly absorbed.',
  helmet_alt: 'Should the direct approach not appeal, sir: the nursemaid in Grosvenor Square has been known to detain constables with questions. And a motor door, opened briskly, has unseated many a helmet.',
  helmet_have: 'The Gannets is on Curzon Street, sir: the green awning and the red carpet. I would walk rather than run. Running with a helmet is a confession.',
  creamer_find: 'Mr Gossage seldom leaves his doorway, sir. The telephone kiosk on Mount Street is within sight of it. I mention it only as a feature of the street.',
  creamer_alt: 'Corrigan’s Tea Rooms in New Bond Street sell a milk jug of very similar proportions, sir. Mr Gossage’s eyesight is not what it was.',
  creamer_have: 'Nine Grosvenor Street, sir. Your uncle will be in the library, pretending not to wait.',
  pig_find: 'The Colonel is in Shepherd Market with the animal, sir. I should warn you that Hyacinth weighs a little over twenty stone and has opinions.',
  pig_lead: 'A pig on a lead goes at a pig’s pace, sir. A cab would be quicker, if the cabman can be persuaded. The dairy keeps a milk float in Reeves Mews.',
  free: 'Nothing pressing, sir. Your aunt’s telegram suggests that the evening is already over, in the sense that matters.',
  scandal: 'If I may, sir: break the constables’ line of sight and keep still. The Dog and Partridge has a snug, Pargeter will sell you a new hat, and the cab rank on Curzon Street asks no questions.',
};
const TIPS = [
  'Q and R will swing the view about, sir, should you lose your bearings.',
  'Should you be apprehended, the fines are modest. I keep a reserve in the tea caddy.',
  'The pocket atlas is under M, sir. I have marked the places of interest.',
  'A motor may be borrowed, sir, but its owner will seldom see it that way.',
  'The handbrake, sir, is the space bar. The wet setts do the rest.',
];
export const VOICES = {
  goodForm: 'GOOD FORM', appetite: 'APPETITE', hester: 'THE MEMORY OF AUNT HESTER', nerve: 'NERVE', logic: 'LOGIC, SUCH AS IT IS',
};
const LINES = {
  pinchSeen: ['Oi! My ’elmet!', 'Stop that man!', 'Disgraceful!', 'He’s took the bobby’s hat!'],
  carTaken: ['That’s my motor!', 'Come back, you blighter!', 'I say! I say!', 'Thief! Well, borrower!'],
  dive: ['Steady on!', 'Road hog!', 'Good heavens!', 'Mind my spats!', 'Lunatic!'],
  hit: ['Ow!', 'My hat!', 'I shall write to The Times!', 'Ruffian!'],
  idle: ['Filthy night.', 'Did you hear about the Duchess?', 'Taxi!', 'Is that a pig?', 'They say it’ll clear by Thursday.', 'Evening.', 'Mind the puddle, dear.', 'I’m late for the Savoy.'],
  copShout: ['’Ere! You!', 'Stop in the name of the law!', 'I know that boater!', 'Come ’ere, sir!'],
  pig: ['Is that a pig?', 'There’s a pig in Mayfair!', 'Mummy, a pig!', 'What a magnificent sow.', 'She’s winking at me.'],
};
export function line(kind) { const a = LINES[kind]; return a[Math.floor(Math.random() * a.length)]; }

// ---------------------------------------------------------------- the jobs
export class Jobs {
  constructor(G) {
    this.G = G;
    this.done = new Set();
    this.job = null; this.step = null;
    this.tipIdx = 0;
    this.carrying = null; // 'helmet' | 'creamer' | 'jug'
  }

  // Set up the special characters and objects.
  setup() {
    const { world } = this.G;
    // PC Plumtree, on his beat in Mount Street
    this.plum = world.addActor(CAST.plumtree, -90, -43, Math.PI / 2);
    this.plum.name = 'PC Plumtree';
    this.plum.beat = { stops: [{ x: -95, z: -43, p: 3 }, { x: -76.5, z: -43, p: 9, face: 0, window: true }, { x: -56, z: -43, p: 3 }, { x: -73.5, z: -43, p: 7, face: 0, window: true }], i: 0, wait: 0 };
    this.plum.hasHelmet = true;
    this.G.police.adopt(this.plum);
    this.plum.mode = 'beat';
    // Nurse Pollard and her pram in Grosvenor Square
    const n = PLACES.nanny;
    this.nanny = world.addActor(CAST.nanny, n.x + 3, n.z + 6, 0);
    this.nanny.name = 'Nurse Pollard';
    this.pram = pram(); this.G.scene.add(this.pram);
    // Gossage in his doorway
    const gd = this.G.city.doors.gossage || { x: -73, z: -43.7, ry: Math.PI };
    this.gossageDoor = gd;
    this.gossage = world.addActor(CAST.gossage, gd.x, gd.z, gd.ry);
    this.gossage.name = 'Mr Gossage';
    this.gossage.home = { x: gd.x, z: gd.z, ang: gd.ry };
    // the cow creamer in the window
    const gw = this.G.city.gossageWindow;
    this.creamerObj = cowCreamer(); this.creamerObj.scale.setScalar(2.2);
    if (gw) { this.creamerObj.position.set(gw.x, 1.05, gw.z); this.creamerObj.rotation.y = gw.ry + Math.PI / 2; }
    this.G.scene.add(this.creamerObj);
    this.creamerInWindow = true;
    // Fitch on the Gannets steps
    const cd = this.G.city.doors.gannets || PLACES.gannets;
    this.fitch = world.addActor(CAST.fitch, cd.x - 1.6, cd.z + 1.2, 0);
    this.fitch.name = 'Fitch';
    // Mortlake at the flat door
    const fd = PLACES.flat;
    this.mortlake = world.addActor(CAST.mortlake, fd.x + 0.4, fd.z - 1.4, -Math.PI / 2);
    this.mortlake.name = 'Mortlake';
    // the Colonel and Hyacinth in Shepherd Market
    const pm = PLACES.pigpen;
    this.colonel = world.addActor(CAST.colonel, pm.x - 1.5, pm.z + 1, Math.PI / 2);
    this.colonel.name = 'Colonel Fothergill-Pym';
    this.pig = { g: pigModel(), x: pm.x + 1.2, z: pm.z + 1.5, ang: 0, y: 0, mode: 'pen', walk: 0 };
    this.G.scene.add(this.pig.g);
    // Tresham, who arrives at ten
    this.tresham = null;
  }

  start(job) {
    this.job = job; this.step = 'find';
    const G = this.G;
    G.hud.telegram(TELEGRAMS[job] || '', this.goalText());
    this.hint();
    this.markers();
    if (job === 'creamer') this.trT = 0;
    if (job === 'pig') this.deadline = G.clock + 55;
    sfx.ring();
    G.save();
  }
  goalText() {
    const j = this.job, s = this.step;
    if (j === 'helmet') return s === 'have' ? 'Take the helmet to the Gannets, Curzon Street.' : 'Pinch PC Plumtree’s helmet. He patrols Mount Street.';
    if (j === 'creamer') return s === 'have' ? 'Take the cow creamer to 9 Grosvenor Street.' : 'Secure the cow creamer from Gossage & Son, Mount Street, before ten.';
    if (j === 'pig') return s === 'led' || s === 'riding' ? 'Get Hyacinth to Berkeley Square before eleven.' : 'Find Colonel Fothergill-Pym in Shepherd Market.';
    return 'Mayfair is yours, for tonight.';
  }
  hint(next) {
    const j = this.job, s = this.step;
    let key = 'free';
    if (j === 'helmet') key = s === 'have' ? 'helmet_have' : 'helmet_find';
    if (j === 'creamer') key = s === 'have' ? 'creamer_have' : 'creamer_find';
    if (j === 'pig') key = s === 'find' ? 'pig_find' : 'pig_lead';
    if (this.G.police.level > 0) key = 'scandal';
    if (next) {
      const alts = { helmet_find: 'helmet_alt', creamer_find: 'creamer_alt' };
      this.tipIdx++;
      if (alts[key] && this.tipIdx % 2 === 1) key = alts[key];
      else if (this.tipIdx % 3 === 0) { this.G.hud.hint(TIPS[(this.tipIdx / 3) % TIPS.length | 0]); return; }
    }
    this.G.hud.hint(HINTS[key]);
  }
  markers() {
    const G = this.G, j = this.job, s = this.step;
    const m = [];
    if (j === 'helmet') {
      if (s === 'have') m.push({ ...this.G.city.doors.gannets, label: 'THE GANNETS' });
      else if (this.helmetOnGround) m.push({ get: () => this.helmetOnGround.position, label: 'HELMET' });
      else m.push({ get: () => ({ x: this.plum.x, z: this.plum.z, y: 0.6 }), label: 'PC PLUMTREE' });
    }
    if (j === 'creamer') {
      if (s === 'have') m.push({ ...PLACES.uncle, label: '9 GROSVENOR ST' });
      else m.push({ x: this.gossageDoor.x, z: this.gossageDoor.z, label: 'GOSSAGE & SON' });
    }
    if (j === 'pig') {
      if (s === 'find') m.push({ get: () => ({ x: this.colonel.x, z: this.colonel.z }), label: 'THE COLONEL' });
      else { m.push({ ...PLACES.showring, label: 'BERKELEY SQUARE' }); if (this.pig.mode === 'loose') m.push({ get: () => this.pig, label: 'HYACINTH' }); }
    }
    G.hud.setMarkers(m);
    G.markers = m;
  }

  // ---------------------------------------------------------------- per frame
  update(dt) {
    const G = this.G, p = G.world.player;
    this.updatePlumtree(dt);
    this.updateGossage(dt);
    this.updateNanny(dt);
    this.updatePig(dt);
    this.updateTresham(dt);
    // the helmet lying in the road after a car door
    if (this.helmetOnGround && d2(p, this.helmetOnGround.position) < 1.4 && !p.car) this.offer('Pick up the helmet', () => this.takeHelmet(false));
    // deliveries
    if (this.job === 'helmet' && this.step === 'have' && !p.car) {
      const door = G.city.doors.gannets;
      if (door && d2(p, door) < 3.5) this.offer('Hand the helmet to Fitch', () => this.deliverHelmet());
    }
    if (this.job === 'creamer' && this.step === 'have' && !p.car && d2(p, PLACES.uncle) < 3.2) this.offer('Ring at number nine', () => this.deliverCreamer());
    if (this.job === 'pig' && (this.step === 'led' || this.step === 'riding') && d2(this.pig, PLACES.showring) < 7) this.deliverPig();
    if (this.job === 'pig' && this.step !== 'done' && G.clock > this.deadline && !this.lateSaid) this.pigLate();
  }

  // The interaction offered this frame (the closest wins).
  offer(label, fn) { const G = this.G; if (!G.offerFn) { G.offerLabel = label; G.offerFn = fn; } }

  interactables() {
    const G = this.G, p = G.world.player;
    if (p.car) return;
    // PC Plumtree's helmet
    const pl = this.plum;
    if (pl.hasHelmet && pl.mode !== 'down' && d2(p, pl) < 1.5 && this.job === 'helmet') {
      const toMe = Math.atan2(p.x - pl.x, p.z - pl.z);
      const behind = Math.abs(angDiff(toMe, pl.ang)) > 1.9;
      this.offer(behind || pl.distracted > 0 ? 'Pinch the helmet' : 'Pinch the helmet (he is looking)', () => this.pinch(behind || pl.distracted > 0));
    } else if (d2(p, pl) < 1.8 && pl.hasHelmet) this.offer('Pass the time with PC Plumtree', () => this.talkPlumtree());
    if (d2(p, this.nanny) < 2.2 && !this.nannyBusy) this.offer('Speak to Nurse Pollard', () => this.talkNanny());
    if (d2(p, this.gossage) < 2.2 && this.gossage.visible && !this.gossageAway) this.offer('Speak to Mr Gossage', () => this.talkGossage());
    if (this.gossageAway && d2(p, this.gossageDoor) < 2.2 && this.creamerInWindow) this.offer('Slip into Gossage & Son', () => this.lift());
    if (d2(p, PLACES.phone) < 1.8) this.offer('Use the telephone', () => this.phone());
    const td = G.city.doors.tearooms; if (td && d2(p, td) < 2.4) this.offer('Go into Corrigan’s Tea Rooms', () => this.tearooms());
    const hd = G.city.doors.hatter; if (hd && d2(p, hd) < 2.4) this.offer('Go into Pargeter, hatter', () => this.hatter());
    const pd = G.city.doors.pub; if (pd && d2(p, pd) < 2.6) this.offer('Go into The Dog and Partridge', () => this.pub());
    if (d2(p, this.mortlake) < 2.2) this.offer('Speak to Mortlake', () => this.talkMortlake());
    if (d2(p, this.fitch) < 2.2 && !(this.job === 'helmet' && this.step === 'have')) this.offer('Speak to Fitch', () => this.talkFitch());
    if (d2(p, this.colonel) < 2.4) this.offer('Speak to the Colonel', () => this.talkColonel());
    if (this.pig.mode === 'loose' && d2(p, this.pig) < 1.8) this.offer('Take Hyacinth’s lead', () => this.leadPig());
    // cab rank
    for (const c of G.world.cars) if (c.rank && !c.driver && d2(p, c) < 3.2) { this.offer('Hire the cab', () => this.hireCab(c)); break; }
  }

  // ---------------------------------------------------------------- Plumtree
  updatePlumtree(dt) {
    const pl = this.plum;
    if (pl.mode !== 'beat' || pl.busy > 0) return;
    if (pl.distracted > 0) { pl.speed = 0; const n = this.nanny; pl.ang += angDiff(Math.atan2(n.x - pl.x, n.z - pl.z), pl.ang) * Math.min(1, dt * 4); return; }
    const b = pl.beat, s = b.stops[b.i];
    if (b.wait > 0) {
      b.wait -= dt; pl.speed = 0;
      if (s.face != null) pl.ang += angDiff(s.face, pl.ang) * Math.min(1, dt * 4);
      pl.atWindow = !!s.window;
      if (b.wait <= 0) b.i = (b.i + 1) % b.stops.length;
      return;
    }
    pl.atWindow = false;
    if (pl.stepTo(s.x, s.z, 1.15, dt) < 0.2) b.wait = s.p;
    // walk back to the beat after a chase
    if (!pl.hasHelmet && Math.random() < 0.002) this.G.hud.sayBy(pl, 'Where’s my ’elmet?', true);
  }
  talkPlumtree() {
    const G = this.G;
    return G.talk([{ who: 'plumtree', name: 'PC Plumtree', text: 'Evening, sir. Filthy night. You’ll want to keep that boater dry, sir, and yourself out of trouble. In that order.', choices: ['Quite right, constable.', 'Fine helmet you have there.'] }]).then((c) => {
      if (c === 1) G.voice('logic', 'He will now remember you admiring it. Well done.');
    });
  }
  pinch(clean) {
    const G = this.G, pl = this.plum, p = G.world.player;
    if (!clean) {
      pl.ang = Math.atan2(p.x - pl.x, p.z - pl.z);
      G.hud.sayBy(pl, '’Ello, ’ello, ’ello!', true);
      G.voice('nerve', 'He was looking straight at you. Nerve is a virtue. This was not nerve.');
      G.police.raise(1, 'Caught reaching for a helmet');
      return;
    }
    this.takeHelmet(true);
  }
  takeHelmet(fromHead) {
    const G = this.G, pl = this.plum;
    if (fromHead) {
      pl.hasHelmet = false;
      if (pl.fig.props.hat) pl.fig.props.hat.visible = false;
      sfx.pinch();
      G.hud.sayBy(pl, line('pinchSeen'), true);
      G.police.raise(pl.distracted > 0 ? 1 : 2, 'Pinched a constable’s helmet');
      pl.distracted = 0;
      pl.mode = 'chase';
      pl.oneShot('HitRecieve', 1.4); // a moment of outraged astonishment
    } else {
      G.scene.remove(this.helmetOnGround); this.helmetOnGround = null; sfx.pinch();
    }
    this.carrying = 'helmet';
    const h = buildHat('helmet'); h.position.set(0.0, -0.05, 0.15); h.rotation.x = 0.4;
    this.heldProp = attach(G.world.player.fig, 'Wrist.L', h);
    this.step = 'have';
    G.hud.telegram(TELEGRAMS.helmet, this.goalText());
    this.hint(); this.markers();
    G.voice('goodForm', 'A gentleman does not run from a constable. He strolls, very quickly, in a straight line.');
  }
  // the car-door trick: called by main when the player gets out of a car beside him
  doorKnock(x, z) {
    const pl = this.plum;
    if (!pl.hasHelmet || d2({ x, z }, pl) > 2.0) return false;
    pl.knockDown(); pl.mode = 'down';
    pl.hasHelmet = false; if (pl.fig.props.hat) pl.fig.props.hat.visible = false;
    const h = buildHat('helmet'); h.position.set(pl.x + 1.2, groundY(pl.x, pl.z) + 0.15, pl.z + 0.6); h.rotation.z = 1.4;
    this.G.scene.add(h); this.helmetOnGround = h;
    sfx.thump(0.6);
    this.G.hud.sayBy(pl, 'Who opened that door?!', true);
    this.G.police.raise(1, 'A constable floored by a motor door');
    this.markers();
    this.G.voice('logic', 'An accident. Entirely an accident. Pick the helmet up before he finishes lying down.');
    return true;
  }
  deliverHelmet() {
    const G = this.G;
    this.drop();
    G.talk([
      { who: 'fitch', name: 'Fitch', text: 'Good evening, Mr Wrenfield. A helmet, sir. Constabulary pattern. I shall place it with the others.', choices: ['The others?'] },
      { who: 'fitch', name: 'Fitch', text: 'Mr Ollerenshaw has wagered on helmets since 1927, sir. The club has eleven. Yours is the first with the chinstrap still attached.' },
      { who: 'ollerenshaw', name: 'Mr Ollerenshaw', text: 'Wrenfield, you magnificent ass. Five pounds, as promised. I shall tell everyone I put you up to it, which happens to be true.', choices: ['Pleasure doing business.', 'Make it guineas.'] },
    ]).then((c) => {
      G.addMoney(c === 1 ? 1260 : 1200);
      if (c === 1) G.voice('goodForm', 'Guineas. Of course guineas. A pound is for tradesmen.');
      this.finish('helmet', 'THE HELMET', 'Delivered to the Gannets. Five pounds to the good.');
    });
  }

  // ---------------------------------------------------------------- Nurse Pollard
  updateNanny(dt) {
    const n = this.nanny, pr = this.pram;
    if (this.nannyBusy) {
      const pl = this.plum;
      const tx = pl.x + Math.sin(pl.ang) * 1.3, tz = pl.z + Math.cos(pl.ang) * 1.3;
      if (this.nannyBusy === 'going') {
        if (n.stepTo(pl.x + 1.2, pl.z - 0.2, 2.2, dt) < 0.3) { this.nannyBusy = 'talking'; pl.distracted = 25; this.G.hud.sayBy(n, 'Constable, which way is Jermyn Street?'); this.nannyT = 25; this.G.hud.sayBy(pl, 'Well now, madam…', false, 4); }
      } else if (this.nannyBusy === 'talking') {
        n.speed = 0; n.ang = Math.atan2(pl.x - n.x, pl.z - n.z);
        this.nannyT -= dt;
        if (Math.random() < dt * 0.25) this.G.hud.sayBy(Math.random() < .5 ? n : pl, ['And the second left?', 'Past the church, madam.', 'Or is it the third?', 'You’ll want the 14 bus.', 'How very kind.'][Math.floor(Math.random() * 5)], false, 3);
        if (this.nannyT <= 0) { this.nannyBusy = 'back'; pl.distracted = 0; }
      } else if (this.nannyBusy === 'back') {
        const h = PLACES.nanny;
        if (n.stepTo(h.x + 3, h.z + 6, 1.4, dt) < 0.3) this.nannyBusy = null;
      }
    } else n.speed = 0;
    // the pram stays a pace in front of her
    pr.position.set(n.x + Math.sin(n.ang) * 0.9, n.y, n.z + Math.cos(n.ang) * 0.9);
    pr.rotation.y = n.ang;
  }
  talkNanny() {
    const G = this.G;
    const helmet = this.job === 'helmet' && this.step === 'find' && this.plum.hasHelmet;
    const choices = ['Lovely evening for a perambulation.'];
    if (helmet) choices.push('Would you ask the constable on Mount Street the way to Jermyn Street? I am too shy.');
    return G.talk([{ who: 'nanny', name: 'Nurse Pollard', text: 'Good evening, sir. Master Algernon is asleep at last, so I’ll thank you not to sneeze.', choices }]).then((c) => {
      if (c === 1) {
        return G.talk([{ who: 'nanny', name: 'Nurse Pollard', text: 'Too shy? A grown man in a boater? Oh, very well. Constables are always glad of a question. They have so few.', choices: ['You are a brick.'] }]).then(() => {
          this.nannyBusy = 'going';
          G.voice('logic', 'Now get behind him. Quietly. The pram is not a getaway vehicle.');
        });
      }
    });
  }

  // ---------------------------------------------------------------- Gossage and the creamer
  updateGossage(dt) {
    const g = this.gossage, h = g.home;
    if (this.gossageAway) {
      this.awayT -= dt;
      if (this.gossageAway === 'search') {
        // out looking for burglars that do not exist
        if (!g.wx || Math.random() < dt * 0.6) { g.wx = h.x + (Math.random() - .5) * 18; g.wz = h.z - 2 - Math.random() * 3; }
        g.stepTo(g.wx, g.wz, 2.6, dt, true);
        if (Math.random() < dt * 0.4) this.G.hud.sayBy(g, ['Police!', 'Where are they?', 'Burglars!', 'Show yourselves!'][Math.floor(Math.random() * 4)], true, 2);
      }
      if (this.awayT <= 0) {
        if (this.gossageAway === 'inside') { g.g.visible = true; g.visible = true; g.x = h.x; g.z = h.z; }
        this.gossageAway = null;
        if (!this.creamerInWindow && this.carrying === 'creamer' && !this.swapped) {
          this.G.hud.sayBy(g, 'My cow! Thief! Thief!', true);
          const p = this.G.world.player;
          if (d2(p, g) < 25) this.G.police.raise(1, 'Gossage has missed his cow');
        }
      }
      return;
    }
    if (d2(g, h) > 0.3) g.stepTo(h.x, h.z, 1.4, dt); else { g.speed = 0; g.ang += angDiff(h.ang, g.ang) * Math.min(1, dt * 3); }
  }
  talkGossage() {
    const G = this.G;
    if (!this.creamerInWindow) return G.talk([{ who: 'gossage', name: 'Mr Gossage', text: this.swapped ? 'Admiring my cow again, sir? She looks a little… whiter tonight. It is the rain, I expect.' : 'We are closed, sir. Something has happened to the cow. I shall need to sit down.' }]);
    const cr = this.job === 'creamer' && this.step === 'find';
    const ch = ['Just admiring your window.'];
    if (cr) { ch.push('I should like to examine the silver cow.'); ch.push('I’ll buy the cow creamer. Put it on my account.'); }
    return G.talk([{ who: 'gossage', name: 'Mr Gossage', text: 'Gossage & Son, sir. There is no son. There was a son, but he went into insurance. How may I help?', choices: ch }]).then((c) => {
      if (c === 1) {
        const ch2 = ['Exquisite. Put it back.'];
        if (this.carrying === 'jug') ch2.push('(Swap it for the milk jug while he polishes his spectacles.)');
        return G.talk([{ who: 'gossage', name: 'Mr Gossage', text: 'Dutch, sir, about 1770. Note the tail, which forms the handle, and the expression, which is one of contempt. Mr Tresham calls for it at ten.', choices: ch2 }]).then((c2) => {
          if (c2 === 1) {
            this.drop();
            this.swapped = true;
            this.creamerInWindow = false;
            const jug = milkJug(); jug.scale.setScalar(2.2); jug.position.copy(this.creamerObj.position); this.G.scene.add(jug); this.jugInWindow = jug;
            this.G.scene.remove(this.creamerObj);
            this.haveCreamer();
            G.voice('goodForm', 'Deception is very bad form. Getting caught at it is worse. You were not caught.');
          }
        });
      }
      if (c === 2) {
        return G.talk([{ who: 'gossage', name: 'Mr Gossage', text: 'On account, sir? Twenty-five pounds, sir, on account. Your aunt is Lady Hester Wrenfield, I believe? I am sure she will settle.', choices: ['Ah. On reflection, no.', 'Wrap it up.'] }]).then((c2) => {
          if (c2 === 1) {
            this.onAccount = true;
            this.creamerInWindow = false; this.G.scene.remove(this.creamerObj);
            this.haveCreamer();
            G.voice('hester', 'The account will go to your aunt. Your aunt will come to you. It will be like the Somme, but with letters.');
          }
        });
      }
    });
  }
  phone() {
    const G = this.G;
    if (this.gossageAway) return G.talk([{ who: 'teddy', name: 'The telephone', text: 'The line crackles. Somewhere, a lady says “Number, please?” in the tone of one who has heard enough numbers for one night.' }]);
    const cr = this.job === 'creamer' && this.creamerInWindow;
    return G.talk([{ who: 'teddy', name: 'The telephone', text: 'Twopence in the slot. “Number, please?” You could ring Gossage & Son. You can see Mr Gossage from here, which helps.', choices: cr ? ['As Scotland Yard: “Burglars are approaching your shop.”', 'As his mother.', 'As the Inland Revenue.', 'Hang up.'] : ['Hang up.'] }]).then((c) => {
      if (!cr || c === 3) return;
      G.addMoney(-2);
      sfx.ring();
      const g = this.gossage;
      if (c === 0) {
        this.gossageAway = 'search'; this.awayT = 22;
        G.hud.sayBy(g, 'Burglars? Where?!', true);
        G.voice('logic', 'He has left the door open to look for burglars. The burglar would like to thank him.');
      } else if (c === 1) {
        this.gossageAway = 'inside'; this.awayT = 35; g.g.visible = false; g.visible = false;
        G.voice('appetite', 'His mother has a great deal to say. You have about half a minute. Go.');
      } else {
        G.hud.sayBy(g, 'The Revenue? I am shut! Shut!', true);
        G.voice('logic', 'He has bolted the door and drawn the blind. That was the wrong voice.');
        g.oneShot('Interact', 1.2);
      }
    });
  }
  lift() {
    const G = this.G;
    const seen = G.police.anyoneSees(G.world.player.x, G.world.player.z, true);
    this.creamerInWindow = false; G.scene.remove(this.creamerObj);
    sfx.pinch();
    this.haveCreamer();
    if (seen) G.police.raise(2, 'Seen leaving a shop with silver');
    G.voice('nerve', 'In, out, and the bell above the door hardly rang. You are wasted on the idle rich.');
  }
  haveCreamer() {
    const G = this.G;
    this.carrying = 'creamer';
    const c = cowCreamer(); c.scale.setScalar(1.6); c.position.set(0, -0.1, 0.12);
    this.heldProp = attach(G.world.player.fig, 'Wrist.L', c);
    this.step = 'have';
    G.hud.telegram(TELEGRAMS.creamer, this.goalText());
    this.hint(); this.markers();
  }
  tearooms() {
    const G = this.G;
    const want = this.job === 'creamer' && this.carrying !== 'jug' && this.creamerInWindow;
    return G.talk([{ who: 'mortlake', name: 'Corrigan’s Tea Rooms', text: 'Ferns, a pianist who knows four tunes, and a waitress who looks at your boater as though it owed her money.', choices: want ? ['A pot of tea, please. (3d)', 'That milk jug. How much? (1s 6d)', 'Leave.'] : ['A pot of tea, please. (3d)', 'Leave.'] }]).then((c) => {
      if (c === 0) { G.addMoney(-3); G.voice('appetite', 'Tea. And a bun. Two buns. Appetite has been very patient tonight.'); G.police.level > 0 && G.police.raise(G.police.level); }
      if (want && c === 1) {
        G.addMoney(-18); sfx.coin();
        this.carrying = 'jug';
        const j = milkJug(); j.scale.setScalar(1.6); j.position.set(0, -0.08, 0.1);
        this.heldProp = attach(G.world.player.fig, 'Wrist.L', j);
        G.voice('logic', 'A white china jug. Gossage’s cow is silver. His spectacles, however, are thick.');
      }
    });
  }
  updateTresham(dt) {
    if (this.job !== 'creamer' || this.step === 'have') return;
    const G = this.G;
    if (!this.tresham && G.clock >= 22 * 60 - 6) {
      this.tresham = G.world.addActor(CAST.tresham, -95, -43, Math.PI / 2);
      this.tresham.name = 'Mr Tresham';
      G.voice('hester', 'Tresham. Early. Men like Tresham are always early. It is how they get things.');
    }
    if (this.tresham && this.creamerInWindow) {
      const t = this.tresham, gd = this.gossageDoor;
      if (t.stepTo(gd.x - 1, gd.z, 1.5, dt) < 0.4) {
        // he buys it
        this.creamerInWindow = false; G.scene.remove(this.creamerObj);
        G.hud.sayBy(t, 'I’ll take the cow, Gossage.', true);
        G.talk([{ who: 'tresham', name: 'Mr Tresham', text: 'Wrenfield. Too late again. Do give your uncle my regards. I shall put the cow on my mantelpiece, facing his house.', choices: ['Blast.'] }]).then(() => {
          G.voice('hester', 'Your uncle will speak of this at Christmas. Every Christmas.');
          this.creamerInWindow = true; G.scene.add(this.creamerObj);
          G.world.scene.remove(t.g); G.world.actors.splice(G.world.actors.indexOf(t), 1); this.tresham = null;
          G.clock = 21 * 60 + 30; // Mortlake turns back the clocks, metaphorically
          G.hud.toast('TRESHAM GOT IT', 'The evening winds back half an hour. Try again.');
        });
      }
    }
  }
  deliverCreamer() {
    const G = this.G;
    this.drop();
    G.talk([
      { who: 'creamer', name: 'Uncle Fennimore', text: 'Edward! Is that… it is! Look at her tail. Look at her contemptuous little face. Tresham will be sick on his spats.', choices: ['It was nothing, Uncle.'] },
      { who: 'creamer', name: 'Uncle Fennimore', text: this.swapped ? 'Nothing? And Gossage has a milk jug in his window and does not know it. Ha! Ten pounds, my boy, and not a word to Hester.' : 'Nothing, he says. Ten pounds, my boy, and not a word to Hester. She thinks silver cows are vulgar. She is right, of course. That is what makes them irresistible.' },
    ]).then(() => {
      if (this.onAccount) {
        G.voice('hester', 'Uncle Fennimore has noticed the account. He will settle it with Gossage out of your ten pounds, and with you out of your hide.');
      } else G.addMoney(2400);
      this.finish('creamer', 'THE COW CREAMER', this.onAccount ? 'Home at last. The account is settled. So, nearly, are you.' : 'Home at last. Ten pounds from a delighted uncle.');
    });
  }

  // ---------------------------------------------------------------- the pig
  talkColonel() {
    const G = this.G;
    if (this.job !== 'pig' || this.step !== 'find') return G.talk([{ who: 'colonel', name: 'Colonel Fothergill-Pym', text: this.done.has('pig') ? 'Second prize, Wrenfield! Second! The judge was a vegetarian. A plot, sir. A plot.' : 'Don’t touch the pig, young man. She bites, and she is in training.' }]);
    return G.talk([
      { who: 'colonel', name: 'Colonel Fothergill-Pym', text: 'Wrenfield! Thank God. Hyacinth must be shown in Berkeley Square before eleven and my chauffeur has gone to a funeral. His own, he says. I don’t believe him.', choices: ['I’ll take her on a lead.', 'Leave it to me.'] },
      { who: 'pig', name: 'Hyacinth', text: 'Hyacinth regards you for a long moment, then sits on your foot.' },
    ]).then(() => { this.leadPig(); });
  }
  leadPig() {
    this.pig.mode = 'led';
    this.step = 'led';
    sfx.oink();
    this.G.hud.telegram(TELEGRAMS.pig, this.goalText());
    this.hint(); this.markers();
  }
  updatePig(dt) {
    const pig = this.pig, G = this.G, p = G.world.player;
    const g = pig.g;
    let moving = 0;
    if (pig.mode === 'led') {
      if (p.car) {
        const c = p.car;
        if (c.type === 'roadster' || c.type === 'roadsterBlue') {
          // no room: Hyacinth stays put
          if (!this.toldRoadster) { this.toldRoadster = true; G.voice('logic', 'Hyacinth will not fit in a two-seater. Hyacinth would not fit in a cathedral.'); }
          pig.mode = 'loose'; this.markers();
        } else if (d2(pig, c) < 6) {
          pig.mode = 'riding'; this.step = 'riding'; pig.car = c; sfx.oink();
          G.hud.say(c.x, 2.5, c.z, 'Hyacinth climbs aboard.');
        } else { pig.mode = 'loose'; this.markers(); }
      } else {
        const d = d2(pig, p);
        if (d > 14) { pig.mode = 'loose'; G.hud.say(pig.x, 1.5, pig.z, 'The lead slips!', true); sfx.oink(); this.markers(); }
        else if (d > 1.8) {
          const sp = Math.min(3.2, d * 1.1);
          const dx = p.x - pig.x, dz = p.z - pig.z;
          pig.x += dx / d * sp * dt; pig.z += dz / d * sp * dt;
          collide(pig, 0.45);
          pig.ang += angDiff(Math.atan2(dx, dz), pig.ang) * Math.min(1, dt * 5);
          moving = sp;
        }
        if (Math.random() < dt * 0.08) { G.hud.say(pig.x, 1.4, pig.z, 'Oink.'); sfx.oink(); }
      }
    } else if (pig.mode === 'riding') {
      const c = pig.car;
      if (p.car !== c) { pig.mode = 'led'; pig.car = null; pig.x = c.x - c.fx * 2.5; pig.z = c.z - c.fz * 2.5; collide(pig, 0.5); }
      else { pig.x = c.x - c.fx * (c.len * 0.2); pig.z = c.z - c.fz * (c.len * 0.2); pig.ang = c.h; pig.y = 0.55; }
    } else if (pig.mode === 'loose') {
      // wander, attracted by the coffee stall
      if (!pig.wx || Math.random() < dt * 0.3) { pig.wx = pig.x + (Math.random() - .5) * 8; pig.wz = pig.z + (Math.random() - .5) * 8; }
      const dx = pig.wx - pig.x, dz = pig.wz - pig.z, d = Math.hypot(dx, dz);
      if (d > 0.5) { pig.x += dx / d * 0.9 * dt; pig.z += dz / d * 0.9 * dt; collide(pig, 0.45); pig.ang += angDiff(Math.atan2(dx, dz), pig.ang) * dt * 3; moving = 0.9; }
    }
    if (pig.mode !== 'riding') pig.y = groundY(pig.x, pig.z);
    pig.walk += moving * dt * 6;
    const s = Math.sin(pig.walk);
    g.userData.legs.forEach((l, i) => { l.rotation.x = (i % 2 ? s : -s) * 0.5 * Math.min(1, moving); });
    g.position.set(pig.x, pig.y + Math.abs(s) * 0.03 * Math.min(1, moving), pig.z);
    g.rotation.y = pig.ang;
    // bystanders remark on pigs
    if (moving && Math.random() < dt * 0.15) {
      const near = G.world.actors.find((a) => !a.isCop && a.visible && d2(a, pig) < 8 && !a.seated);
      if (near) G.hud.sayBy(near, line('pig'));
    }
  }
  hireCab(c) {
    const G = this.G;
    const withPig = this.job === 'pig' && (this.step === 'led') && d2(this.pig, G.world.player) < 6;
    const scandal = G.police.level > 0;
    const text = withPig ? 'A pig? In my cab? I’ve had a bishop sick in here, guv, and a Member of Parliament who sang, but I draw the line at livestock.' : scandal ? 'Hop in, guv. I never saw a constable in my life, and I’ve got very poor eyesight for blue.' : 'Where to, guv?';
    const ch = withPig ? ['Berkeley Square, and five shillings for your trouble.', 'Never mind.'] : scandal ? ['Home. 14a South Audley Street. (2s 6d)', 'Never mind.'] : ['14a South Audley Street. (1s)', 'The Gannets, Curzon Street. (1s)', 'Never mind.'];
    return G.talk([{ who: 'cabbie', name: 'The cabman', text, choices: ch }]).then((k) => {
      if (withPig && k === 0) {
        G.addMoney(-60);
        return G.fadeTo(() => { const s = PLACES.showring; G.teleport(s.x - 12, s.z - 14); this.pig.x = s.x - 10; this.pig.z = s.z - 13; this.pig.mode = 'led'; }, 'The cab smells of pig for a fortnight. The cabman tells everyone.');
      }
      if (!withPig && scandal && k === 0) { G.addMoney(-30); return G.fadeTo(() => { G.police.clear(); G.teleport(PLACES.flat.x - 1.2, PLACES.flat.z); }, 'The cab rattles home by way of Hampstead, to be safe.'); }
      if (!withPig && !scandal && k < 2) { G.addMoney(-12); const t = k === 0 ? PLACES.flat : PLACES.gannets; return G.fadeTo(() => G.teleport(t.x - (k === 0 ? 1.2 : 0), t.z + (k === 1 ? 2.5 : 0)), null); }
    });
  }
  deliverPig() {
    const G = this.G;
    this.step = 'done';
    if (G.world.player.car) G.world.leaveCar();
    this.pig.mode = 'show';
    const s = PLACES.showring;
    this.pig.x = s.x + 2; this.pig.z = s.z;
    G.talk([
      { who: 'colonel', name: 'Colonel Fothergill-Pym', text: 'You did it, Wrenfield! And with minutes to spare! Look at her. She has not even eaten anybody.', choices: ['She was a perfect lady.'] },
      { who: 'pig', name: 'Hyacinth', text: 'Hyacinth is awarded a rosette, which she eats.' },
      { who: 'colonel', name: 'Colonel Fothergill-Pym', text: 'Eight pounds, my boy, and a ham at Christmas. Not from her. From a colleague.' },
    ]).then(() => { G.addMoney(1920); this.finish('pig', 'THE PIG', 'Hyacinth was shown. Eight pounds and a ham.'); });
  }
  pigLate() {
    const G = this.G;
    this.lateSaid = true;
    G.talk([{ who: 'colonel', name: 'Colonel Fothergill-Pym', text: 'Eleven o’clock, Wrenfield! The judges have gone home to bed. Still, I have bribed one of them to come back. You have a little longer. Don’t dawdle.' }]).then(() => { this.deadline = G.clock + 30; this.lateSaid = false; });
  }

  // ---------------------------------------------------------------- places
  pub() {
    const G = this.G;
    const hide = G.police.level > 0;
    return G.talk([{ who: 'landlord', name: 'The Dog and Partridge', text: hide ? 'The snug is warm, the landlord is deaf when it suits him, and a constable’s helmet goes past the frosted glass twice without stopping.' : 'Sawdust, a piano with three working octaves, and a darts match conducted with great violence by two men from the gasworks.', choices: hide ? ['Lie low over a half of bitter. (4d)'] : ['A half of bitter. (4d)', 'Leave.'] }]).then((c) => {
      if (c === 0) {
        G.addMoney(-4);
        if (hide) return G.fadeTo(() => { G.police.clear(); G.clock += 20; }, 'Twenty minutes later, the street is quiet again.');
        G.voice('appetite', 'Bitter. Warm, flat and brown, like a sermon. Lovely.');
      }
    });
  }
  hatter() {
    const G = this.G;
    const p = G.world.player;
    return G.talk([{ who: 'hatter', name: 'Mr Pargeter', text: G.police.level > 0 ? 'Ah. A gentleman in some haste. A new hat changes a man entirely, sir. Constables look for the hat, never the face. It is a known weakness of the force.' : 'Evening, sir. Your boater is a summer hat, sir, and it is November. I say nothing. I merely observe.', choices: ['A bowler, please. (15s)', 'The boater suits me.'] }]).then((c) => {
      if (c !== 0) return;
      G.addMoney(-180); sfx.coin();
      const f = p.fig;
      if (f.props.hat) f.props.hat.removeFromParent();
      const isBowler = this.hatNow !== 'bowler';
      this.hatNow = isBowler ? 'bowler' : 'boater';
      const h = buildHat(this.hatNow);
      h.position.set(0, f.headTopOffset - 0.06, 0.005);
      f.props.hat = attach(f, 'Head', h);
      if (G.police.level > 0) { G.police.level = Math.max(0, G.police.level - 2); if (G.police.level === 0) G.police.clear(); G.hud.scandal(G.police.level); }
      G.voice('goodForm', isBowler ? 'A bowler. You look like a man who audits things. Nobody suspects such a man of anything.' : 'The boater again. Defiance, in straw.');
    });
  }
  talkMortlake() {
    const G = this.G;
    const lines = {
      helmet: 'I understand from the telegram that you are to remove a policeman’s headgear, sir. I have laid out the dark overcoat. It does not show the mud.',
      creamer: 'Your uncle telephoned, sir. Twice. The second time he was singing.',
      pig: 'A pig, sir. I will not ask. I will run a bath.',
      null: 'Your aunt has telegraphed, sir. I took the liberty of reading it. I took the further liberty of hiding the decanter.',
    };
    return G.talk([{ who: 'mortlake', name: 'Mortlake', text: lines[this.job] || lines.null, choices: ['Any advice, Mortlake?', 'Carry on, Mortlake.'] }]).then((c) => {
      if (c === 0) { this.hint(true); return G.talk([{ who: 'mortlake', name: 'Mortlake', text: document.getElementById('hint-body').textContent }]); }
    });
  }
  talkFitch() {
    return this.G.talk([{ who: 'fitch', name: 'Fitch', text: this.G.police.level > 0 ? 'The front door is for members, sir. Members pursued by the Metropolitan Police may use the area steps. It has been the custom since 1892.' : 'Good evening, Mr Wrenfield. Mr Ollerenshaw is in the bar, sir, laying odds on you. I could not say which way.' }]);
  }

  // ---------------------------------------------------------------- bookkeeping
  drop() { if (this.heldProp) { this.heldProp.removeFromParent(); this.heldProp = null; } this.carrying = null; }
  finish(key, title, sub) {
    const G = this.G;
    this.done.add(key);
    this.step = 'done';
    sfx.success();
    G.hud.toast(title, sub, 4);
    G.hud.setMarkers([]); G.markers = [];
    const order = ['helmet', 'creamer', 'pig'];
    const next = order.find((k) => !this.done.has(k));
    G.save();
    setTimeout(() => {
      if (next) this.start(next);
      else { this.job = null; G.hud.telegram(TELEGRAMS.done, 'Every job done. Mayfair is yours until breakfast.'); this.hint(); G.voice('hester', 'She is coming. By the first train. There is time for one more evening of liberty. Use it badly.', 8); }
    }, 4500);
  }
  // On arrest: confiscate whatever was pinched.
  confiscate() {
    const G = this.G;
    if (this.carrying === 'helmet') {
      this.drop();
      this.plum.hasHelmet = true; if (this.plum.fig.props.hat) this.plum.fig.props.hat.visible = true;
      this.step = 'find';
    }
    if (this.carrying === 'creamer' && !this.swapped && this.job === 'creamer') {
      this.drop();
      this.creamerInWindow = true; G.scene.add(this.creamerObj);
      this.step = 'find';
    }
    if (this.pig.mode === 'led' || this.pig.mode === 'riding') { this.pig.mode = 'loose'; }
    if (this.job) { G.hud.telegram(TELEGRAMS[this.job], this.goalText()); this.markers(); this.hint(); }
  }
  snapshot() { return { done: [...this.done], job: this.job }; }
}

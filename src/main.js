import { Newsboys } from './game/newsboys.js';
import { makeFx, makeMist } from './render/fx.js';
import * as THREE from 'three';
import { createRenderer, placeLights, makeRain } from './render/scene.js';
import { updateCut } from './render/cutout.js';
import { buildCity, buildWindows } from './world/buildings.js';
import { buildGround, buildRailings, groundY } from './world/ground.js';
import { buildProps } from './world/props.js';
import { PLACES, streetAt, onRoad } from './world/map.js';
import { setSolids } from './core/physics.js';
import { input, pollPad } from './core/input.js';
import { loadFigures } from './people/figures.js';
import { World } from './game/world.js';
import { Police, LEVELS } from './game/police.js';
import { Jobs, VOICES, line, TELEGRAMS } from './game/jobs.js';
import { HUD, Dialogue, fmtPurse, fmtClock, drawBigMap, PORT } from './ui/ui.js';
import { initAudio, sfx, updateAudio, toggleMute, setVolume, getVolume } from './audio/sfx.js';

const $ = (id) => document.getElementById(id);
const SAVE_KEY = 'top-down-save-v1';
const SETTINGS_KEY = 'top-down-settings-v1';

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { s = {}; }
  return Object.assign({ quality: 'medium', volume: 0.7, camSpeed: 1 }, s);
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* private mode */ } }
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) { return null; } }

const settings = loadSettings();
const params = new URLSearchParams(location.search);
const quality = params.get('q') || settings.quality;
setVolume(settings.volume);

const G = {
  quality, settings, purse: 600, clock: 21 * 60 + 15, paused: true, mode: 'loading', markers: [],
  offerLabel: null, offerFn: null, busy: false,
};
window.__td = G;

function progress(f, msg) { $('load-bar').style.width = Math.round(f * 100) + '%'; if (msg) $('load-msg').textContent = msg; }
const tick = () => new Promise((r) => setTimeout(r, 0));

async function boot() {
  const canvas = $('game');
  const R = createRenderer(canvas, quality); G.R = R;
  Object.assign(G, R);
  const resize = () => R.resize(innerWidth, innerHeight);
  addEventListener('resize', resize); resize();
  progress(0.05, 'Laying the setts');
  await tick();
  G.city = buildCity(R.scene, quality);
  progress(0.25, 'Painting the stucco');
  await tick();
  const ground = buildGround(R.scene, quality, G.city);
  G.reflector = ground.reflector;
  buildRailings(R.scene, [...(G.city.squareRails || []), ...(G.city.parkRails || [])]);
  G.props = buildProps(R.scene, G.city);
  G.windowsMesh = buildWindows(R.scene, G.city.windows);
  setSolids(G.city.solids);
  G.rain = makeRain(R.scene, quality);
  G.fx = makeFx(R.scene, quality);
  G.mist = makeMist(R.scene, quality);
  progress(0.4, 'Waking the residents');
  await tick();
  await loadFigures((f) => progress(0.4 + f * 0.45, 'Dressing the residents'));
  progress(0.88, 'Fetching the constabulary');
  await tick();
  G.hud = new HUD(R.camera);
  G.dlg = new Dialogue();
  G.world = new World(R.scene, quality, hooks);
  G.world.spawn();
  G.police = new Police(G.world, policeHooks);
  G.police.spawn(quality === 'low' ? 4 : 7);
  G.jobs = new Jobs(G);
  G.jobs.setup();
  G.news = new Newsboys(G);
  progress(1, 'Ready');
  // warm up: compile every material before the first frame the player sees
  G.world.updateCamera(R.camera, 1);
  R.renderer.compile(R.scene, R.camera);
  $('loading').hidden = true;
  titleMenu();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- glue used by the jobs
G.talk = async (cards) => {
  G.busy = true;
  let last = 0;
  for (const c of cards) last = await G.dlg.show(c);
  G.busy = false;
  return last;
};
G.addMoney = (d) => { G.purse += d; if (d > 0) sfx.coin(); G.hud.purse(G.purse); };
G.voice = (k, text, secs) => G.hud.voice(VOICES[k] || k, text, secs || Math.max(5, text.length / 14));
G.fadeTo = (fn, caption) => new Promise((res) => {
  G.busy = true;
  $('fade').classList.add('on');
  setTimeout(() => {
    fn && fn();
    if (caption) G.hud.toast('', caption, 3.2);
    setTimeout(() => { $('fade').classList.remove('on'); G.busy = false; res(); }, 700);
  }, 650);
});
G.teleport = (x, z) => {
  const w = G.world;
  if (w.player.car) w.leaveCar();
  w.player.x = x; w.player.z = z; w.player.sync(1);
  w.cam.x = x; w.cam.z = z;
};
G.save = () => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ purse: G.purse, clock: G.clock, jobs: G.jobs.snapshot(), hat: G.jobs.hatNow || 'boater', t: Date.now() })); } catch (e) { /* private mode */ }
};

// ---------------------------------------------------------------- hooks from the world and the police
const hooks = {
  honk(car) { if (dist(car, G.world.player) < 40) { sfx.horn(car.T.horn); if (Math.random() < .5) G.hud.say(car.x, 2.6, car.z, ['Get out of it!', 'Shift yourself!', 'Some of us work, guv!', 'Toff!'][Math.floor(Math.random() * 4)]); } },
  carHit(car, imp, other) {
    const p = G.world.player;
    if (car === p.car || other === p.car) {
      sfx.thump(imp / 10); G.world.cam.shake = Math.min(0.6, imp / 25);
      if (other && other.police) G.police.raise(G.police.level + 1, 'Rammed a police motor');
      else if (other && other.ai && imp > 6) G.police.crime(1, p.x, p.z, 'Reckless motoring');
      const c = p.car;
      if (c && c.damage > 60 && !c.steamSaid) { c.steamSaid = true; G.voice('logic', 'The radiator is steaming. The motor has views about your driving.'); }
    }
  },
  carTaken(car, owner) {
    const p = G.world.player;
    if (owner) { G.hud.sayBy(owner, line('carTaken'), true); G.police.crime(1, p.x, p.z, 'Borrowed a motor'); }
    else if (car.type !== 'roadster' && Math.random() < 0.5) G.police.crime(1, p.x, p.z, 'Borrowed a motor');
    if (!G.saidBorrow) { G.saidBorrow = true; G.voice('goodForm', 'It is not stealing if you mean to bring it back. You do mean to bring it back. Roughly.'); }
  },
  leftCar(car, x, z) { sfx.door(); G.jobs.doorKnock(x, z); },
  pedHit(car, a) {
    if (car === G.world.player.car) { sfx.thump(0.4); G.hud.sayBy(a, line('hit'), true); G.police.crime(1, a.x, a.z, 'Knocked over a pedestrian'); if (!G.saidHit) { G.saidHit = true; G.voice('hester', 'You have knocked down a person. A person with a hat. A person who very possibly knows your aunt.'); } }
  },
  pedDive(a) { if (Math.random() < .6) G.hud.sayBy(a, line('dive'), true); },
};
const policeHooks = {
  scandal(level, why, cooling) {
    G.hud.scandal(level, !cooling);
    if (!cooling) { sfx.sting(level); if (why) G.hud.toast(LEVELS[level], why, 2.4); }
    if (!cooling && level === 1 && !G.saidScandal) { G.saidScandal = true; G.voice('nerve', 'A constable is cross with you. Break his line of sight and keep calm. Or run. Running is also popular.'); }
    if (level === 0 && cooling) G.voice('logic', 'They have lost interest. You are once again merely a young man in a damp boater.');
    G.jobs.hint();
  },
  copShout(c) { G.hud.sayBy(c, line('copShout'), true); },
  whistle(c) { if (dist(c, G.world.player) < 60) sfx.whistle(); },
  bell(t, key) {
    if (key === 'hester') { sfx.horn('honk'); if (t.passenger) G.hud.sayBy(t.passenger, ['EDWARD!', 'Edward Wrenfield, you stop this instant!', 'I can see that boater!', 'Hobbs, faster!'][Math.floor(Math.random() * 4)], true, 2.5); }
    else sfx.horn('bell');
  },
  motor(key) {
    if (key === 'tender') G.voice('nerve', 'Scotland Yard has sent a motor. With a bell. They mean it.');
    if (key === 'maria') G.voice('logic', 'The Black Maria. It holds twelve. They intend to fill it with you.');
    if (key === 'hester') G.voice('hester', 'Shropshire has heard. She came by the first train and a hired Daimler. God help us all.', 7);
  },
  turnOut(a) { if (Math.random() < .5) G.hud.sayBy(a, 'All stations! Gentleman in a boater!', true); },
  arrest(c) { if (!G.arresting) (c === 'hester' ? hesterCaught() : bust()); },
};
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// Level five: Aunt Hester herself. No court in England can save you.
async function hesterCaught() {
  G.arresting = true;
  $('toast').hidden = true;
  sfx.fail();
  await G.fadeTo(() => {}, null);
  await G.talk([
    { who: 'aunt', name: 'Aunt Hester', text: 'Edward. Helmets. Pigs. Silver cows. The Black Maria. I have had a telegram from the Commissioner, who was at school with your poor father and has never recovered.', choices: ['Hullo, Aunt Hester.', 'I can explain.'] },
    { who: 'aunt', name: 'Aunt Hester', text: 'You can not. You will go home, you will go to bed, and on Monday you will be introduced to a girl from Leominster who breeds Herefords. Your allowance is suspended until Lady Day.', choices: ['Yes, Aunt Hester.'] },
  ]);
  G.addMoney(-Math.min(G.purse, 480));
  G.jobs.confiscate();
  G.police.clear();
  await G.fadeTo(() => { G.teleport(PLACES.flat.x - 1.4, PLACES.flat.z); G.clock += 45; }, 'Mortlake makes cocoa. He says nothing, eloquently.');
  G.voice('hester', 'She has gone to the Ritz for the night. The Ritz is two streets away. Proceed with caution.');
  G.hud.scandal(0);
  G.arresting = false;
}

async function bust() {
  G.arresting = true;
  const lvl = G.police.level;
  const fine = [240, 240, 600, 1200, 2400, 2400][lvl];
  $('toast').hidden = true;
  sfx.fail();
  await G.fadeTo(() => {}, null);
  const quips = [
    'Wrenfield again. The court has seen you more often than your tailor has. One pound, and do try to be duller.',
    'Young man, the Metropolitan Police exist to keep order, not to supply you with hats. Two pounds ten.',
    'I have read the charge sheet twice and laughed once, which is once too often for this court. Five pounds, and go home.',
    'They brought you in the Black Maria, sat between a burglar and a bishop. The bishop has complained. Ten pounds.',
    'Ten pounds, and I am told your aunt is in the building. The court will not detain you. The court is frightened.',
  ];
  await G.talk([{ who: 'magistrate', name: 'Bow Street, the following morning', text: quips[Math.max(0, lvl - 1)] + ' (Fine: ' + fmtPurse(fine) + ')', choices: ['Yes, your worship.'] }]);
  G.addMoney(-fine);
  G.jobs.confiscate();
  G.police.clear();
  await G.fadeTo(() => { G.teleport(PLACES.flat.x - 1.4, PLACES.flat.z); G.clock += 30; }, 'Mortlake has paid the fine out of the tea caddy.');
  G.voice('hester', 'If this reaches Aunt Hester, she will come up from Shropshire with a shotgun and a list.');
  G.hud.scandal(0);
  G.arresting = false;
}

// ---------------------------------------------------------------- menus
function menu(html, onKey) {
  const m = $('menu');
  m.innerHTML = html; m.hidden = false;
  G.menuKey = onKey;
  const btns = [...m.querySelectorAll('button')];
  G.menuSel = 0;
  const mark = () => btns.forEach((b, i) => b.classList.toggle('sel', i === G.menuSel));
  mark();
  G.menuNav = (d) => { if (!btns.length) return; G.menuSel = (G.menuSel + d + btns.length) % btns.length; mark(); };
  G.menuGo = () => btns[G.menuSel] && btns[G.menuSel].click();
  return m;
}
function closeMenu() { $('menu').hidden = true; G.menuKey = null; G.menuNav = null; G.menuGo = null; }

function titleMenu() {
  G.mode = 'title'; G.paused = true;
  G.hud.show(false);
  const save = readSave();
  const m = menu(`<div class="card cover"><div class="masthead"><div class="issue"><span>VOL. I · NO. 1</span><span>NOVEMBER 1934</span><span>ONE SHILLING</span></div><h1>A SPOT OF BOTHER</h1><div class="tag">Mischief in Mayfair, with motors</div></div>
  <div class="body"><div>${PORT.teddy}</div><div><p class="blurb">The Hon. Teddy Wrenfield has five pounds, a borrowed evening, a valet called Mortlake and an aunt in Shropshire who must never hear of any of it.</p>
  <button id="b-new">NEW GAME</button>${save ? '<button id="b-cont">CONTINUE</button>' : ''}<button id="b-set">SETTINGS</button><button id="b-keys">HOW TO PLAY</button><button id="b-cred">CREDITS</button></div></div></div>`);
  m.querySelector('#b-new').onclick = () => { newGame(null); };
  if (save) m.querySelector('#b-cont').onclick = () => newGame(save);
  m.querySelector('#b-set').onclick = () => settingsMenu(titleMenu);
  m.querySelector('#b-keys').onclick = () => keysMenu(titleMenu);
  m.querySelector('#b-cred').onclick = () => creditsMenu(titleMenu);
}
function newGame(save) {
  initAudio();
  closeMenu();
  G.hud.show(true);
  G.mode = 'play'; G.paused = false;
  if (save) {
    G.purse = save.purse; G.clock = save.clock;
    for (const k of save.jobs.done) G.jobs.done.add(k);
    const next = ['helmet', 'creamer', 'pig'].find((k) => !G.jobs.done.has(k));
    if (G.jobs.done.has('helmet')) { G.jobs.plum.hasHelmet = false; if (G.jobs.plum.fig.props.hat) G.jobs.plum.fig.props.hat.visible = false; }
    if (G.jobs.done.has('creamer')) { G.jobs.creamerInWindow = false; G.scene.remove(G.jobs.creamerObj); }
    if (next) G.jobs.start(next); else { G.hud.telegram(TELEGRAMS.done, 'Every job done. Mayfair is yours until breakfast.'); G.jobs.hint(); }
  } else {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* */ }
    G.jobs.start('helmet');
    setTimeout(() => G.voice('hester', 'Somewhere in Shropshire, Aunt Hester has just sneezed. It is a sign. Ignore it.'), 2500);
  }
  G.hud.purse(G.purse); G.hud.scandal(0);
}
function pauseMenu() {
  G.paused = true; G.mode = 'pause';
  const m = menu(`<div class="card menu"><h2>Interval</h2><div class="rule"></div>
  <button id="p-res">RESUME</button><button id="p-map">POCKET ATLAS</button><button id="p-jobs">JOBS</button><button id="p-set">SETTINGS</button><button id="p-keys">HOW TO PLAY</button><button id="p-quit">QUIT TO TITLE</button></div>`);
  m.querySelector('#p-res').onclick = resume;
  m.querySelector('#p-map').onclick = () => { closeMenu(); openMap(); };
  m.querySelector('#p-jobs').onclick = () => jobsMenu();
  m.querySelector('#p-set').onclick = () => settingsMenu(pauseMenu);
  m.querySelector('#p-keys').onclick = () => keysMenu(pauseMenu);
  m.querySelector('#p-quit').onclick = () => { G.save(); location.reload(); };
}
function resume() { closeMenu(); G.paused = false; G.mode = 'play'; }
function jobsMenu() {
  const J = G.jobs;
  const rows = [['THE HELMET', 'helmet', 'PC Plumtree’s helmet, for a wager.'], ['THE COW CREAMER', 'creamer', 'A silver cow for Uncle Fennimore.'], ['THE PIG', 'pig', 'Hyacinth, to Berkeley Square.'], ['THE LETTER', null, 'To come.']];
  const m = menu(`<div class="card menu"><h2>Jobs</h2><div class="rule"></div><table>${rows.map(([t, k, d]) => `<tr><td><b>${t}</b><br><span class="small">${d}</span></td><td>${k && J.done.has(k) ? 'Done' : k && J.job === k ? 'Now' : k ? 'Waiting' : 'Later'}</td></tr>`).join('')}</table><button id="j-back">BACK</button></div>`);
  m.querySelector('#j-back').onclick = pauseMenu;
}
function settingsMenu(back) {
  const s = G.settings;
  const m = menu(`<div class="card menu"><h2>Settings</h2><div class="rule"></div>
  <label>Graphics <select id="s-q"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
  <label>Volume <input id="s-v" type="range" min="0" max="1" step="0.05" value="${s.volume}"></label>
  <label>Camera turning speed <input id="s-c" type="range" min="0.4" max="2" step="0.1" value="${s.camSpeed}"></label>
  <p class="small">A change of graphics quality takes effect when the page reloads.</p>
  <button id="s-apply">APPLY GRAPHICS AND RELOAD</button><button id="s-back">BACK</button></div>`);
  const q = m.querySelector('#s-q'); q.value = quality;
  m.querySelector('#s-v').oninput = (e) => { s.volume = +e.target.value; setVolume(s.volume); saveSettings(s); };
  m.querySelector('#s-c').oninput = (e) => { s.camSpeed = +e.target.value; saveSettings(s); };
  m.querySelector('#s-apply').onclick = () => { s.quality = q.value; saveSettings(s); G.save && G.mode !== 'title' && G.save(); location.href = location.pathname; };
  m.querySelector('#s-back').onclick = back;
}
function keysMenu(back) {
  const rows = [['Arrows or WASD', 'Walk; drive and steer'], ['Shift', 'Run'], ['E or Enter', 'Talk, pinch, pick up, go in'], ['F', 'Get into or out of a motor'], ['Space', 'Handbrake'], ['G', 'Horn'], ['Q and R', 'Turn the view on foot'], ['H', 'Another word from Mortlake'], ['M or Tab', 'Pocket atlas'], ['Esc or P', 'Pause'], ['N', 'Mute'], ['1 to 4', 'Choose a reply']];
  const m = menu(`<div class="card menu"><h2>How to play</h2><div class="rule"></div><table>${rows.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>
  <p>Jobs arrive by telegram. Each has more than one way to be done, and Mortlake will hint at them if asked. Constables who see you misbehave raise your scandal; break their line of sight and it subsides. Hide in the pub, take a cab from the rank or buy a new hat to shake them off.</p><button id="k-back">BACK</button></div>`);
  m.querySelector('#k-back').onclick = back;
}
function creditsMenu(back) {
  const m = menu(`<div class="card menu"><h2>Credits</h2><div class="rule"></div>
  <p>People are built from Quaternius’s Ultimate Modular Men and Women packs (CC0), dressed for 1934 in code. Buildings, motors, sounds, portraits and words were made for this game. Built with three.js.</p>
  <p>Every shop, club, pub and person is invented. The streets are real, and were there first.</p><button id="c-back">BACK</button></div>`);
  m.querySelector('#c-back').onclick = back;
}
function openMap() {
  G.paused = true; G.mode = 'map';
  $('bigmap').hidden = false;
  drawBigMap($('bigmap-c'), G.world.player, G.markers || []);
}
function closeMap() { $('bigmap').hidden = true; G.paused = false; G.mode = 'play'; }

// ---------------------------------------------------------------- the loop
let last = performance.now(), t = 0, chatterT = 4, stepT = 0, lightT = 0, voiceT = 40;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  pollPad();
  handleKeys();
  const w = G.world;
  if (G.dlg.open) G.dlg.update();
  const live = !G.paused && G.mode === 'play';
  if (live) logic(dt);
  if (live) adapt(now);
  // camera, lights, rain, cut-out
  w.updateCamera(G.camera, dt);
  const target = new THREE.Vector3(w.player.x, (w.player.y || 0) + 1.0, w.player.z);
  updateCut(G.camera, target, innerWidth, innerHeight, G.renderer.getPixelRatio(), w.player.car ? 0.38 : 0.3);
  lightT -= dt;
  if (lightT <= 0) { lightT = 0.2; placeLights(G.lights, G.props.lamps, w.cam.x, w.cam.z, t); }
  G.rain.update(dt, w.cam.x, w.cam.z, groundY);
  G.fx.update(dt, w.cars, groundY, w.cam.x, w.cam.z);
  G.mist.update(dt, w.cam.x, w.cam.z);
  if (Math.random() < dt * 0.5) G.windowsMesh.userData.tick();
  G.hud.update(dt, innerWidth, innerHeight, w.player, w.cam.yaw);
  if (live) G.hud.minimap(w.player, w.cam.yaw, G.police.cops, G.police.level > 0);
  const pd = G.city.pubFront ? dist(G.city.pubFront, w.player) : 999;
  updateAudio(dt, { car: !!w.player.car, speed: w.player.car ? w.player.car.speed : 0, quiet: w.player.car && w.player.car.T.quiet, pubDist: pd, indoors: false });
  G.render(t);
  input.endFrame();
}


// Adaptive resolution: if frames run slow for a few seconds, render fewer pixels.
let slowT = 0, prevNow = 0, scale = 0;
function adapt(now) {
  const ft = prevNow ? (now - prevNow) / 1000 : 0; prevNow = now;
  if (!ft || ft > 0.5 || document.hidden) return; // tab switches and hitches
  if (!scale) scale = G.renderer.getPixelRatio();
  slowT = ft > 1 / 40 ? slowT + ft : Math.max(0, slowT - ft * 0.5);
  if (slowT > 3 && scale > 0.75) {
    slowT = 0; scale = Math.max(0.75, scale - 0.25);
    G.R.setScale(scale);
  }
}

// one step of play: everything except drawing
function logic(dt) {
  const w = G.world;
  const ctl = !G.busy && !G.dlg.open;
  G.clock += dt / 2.5;
  w.update(dt, ctl);
  G.police.update(dt);
  G.offerFn = null; G.offerLabel = null;
  G.jobs.update(dt);
  if (ctl) {
    G.jobs.update && G.jobs.interactables();
    if (!w.player.car) {
      const c = w.nearestCar(w.player.x, w.player.z, 2.2, (c) => !c.T.noDrive && !c.police && !c.rank);
      if (c && !G.offerFn) G.carOffer = c; else G.carOffer = c;
    } else G.carOffer = null;
  }
  // prompt
  const bits = [];
  if (G.offerLabel) bits.push(`<kbd>E</kbd>${G.offerLabel}`);
  if (G.carOffer) bits.push(`<kbd>F</kbd>${G.carOffer.ai ? 'Commandeer the motor' : G.carOffer.mine ? 'Get into your two-seater' : 'Borrow the motor'}`);
  G.hud.prompt(ctl && bits.length ? bits.join('&nbsp;&nbsp;&nbsp;') : null);
  if (ctl && input.hit('action') && G.offerFn) G.offerFn();
  if (ctl && input.hit('car')) { if (w.player.car) w.leaveCar(); else if (G.carOffer) { w.enterCar(G.carOffer); sfx.door(); } }
  if (ctl && input.hit('horn') && w.player.car) { sfx.horn(w.player.car.T.horn); scatter(); }
  // camera turning speed setting
  if (!w.player.car && G.settings.camSpeed !== 1) {
    if (input.held('camL')) w.cam.yaw += dt * 1.6 * (G.settings.camSpeed - 1);
    if (input.held('camR')) w.cam.yaw -= dt * 1.6 * (G.settings.camSpeed - 1);
  }
  // footsteps
  const p = w.player;
  if (!p.car && p.speed > 0.5) { stepT -= dt * (p.running ? 2.2 : 1.3); if (stepT <= 0) { stepT = 0.42; sfx.step('stone', 0.8); } }
  // bystander chatter
  chatterT -= dt;
  if (chatterT <= 0) {
    chatterT = 4 + Math.random() * 6;
    const near = w.actors.filter((a) => !a.isCop && !a.seated && a.visible && dist(a, p) < 18 && !a.name);
    const lvl = G.police.level;
    if (near.length) {
      const a = near[Math.floor(Math.random() * near.length)];
      if (lvl > 0 && Math.random() < 0.7) {
        G.hud.sayBy(a, line('gossip' + Math.min(3, lvl)), false, 3);
        a.ang = Math.atan2(p.x - a.x, p.z - a.z); // turns to stare
      } else G.hud.sayBy(a, line('idle'), false, 3);
    }
  }
  crowd(dt);
  G.news.update(dt);
  // the inner voices, now and then
  voiceT -= dt;
  if (voiceT <= 0) { voiceT = 70 + Math.random() * 60; idleVoice(); }
  G.hud.where(p.car ? streetAt(p.x, p.z) : streetAt(p.x, p.z), fmtClock(G.clock));
  G.hud.purse(G.purse);
}

// test hook: run the game forward without drawing
if (import.meta.env.DEV) G.sim = (secs, step = 1 / 30) => { for (let i = 0; i < secs / step; i++) { logic(step); G.world.updateCamera(G.camera, step); input.endFrame(); } };

// Bystanders who notice: a tut when jostled, an arm up for a passing cab.
function crowd(dt) {
  const w = G.world, p = w.player;
  if (!p.car && p.speed > 0.5) {
    for (const a of w.actors) {
      if (a.isCop || a.seated || !a.visible || a.name || (a.tutT || 0) > 0) continue;
      if (Math.abs(a.x - p.x) < 1.1 && Math.abs(a.z - p.z) < 1.1) {
        a.tutT = 8; G.hud.sayBy(a, line('tut'), false, 2.5);
        a.ang = Math.atan2(p.x - a.x, p.z - a.z);
        if (p.running && Math.random() < 0.4) a.oneShot('HitRecieve', 0.8);
      }
    }
  }
  for (const a of w.actors) if (a.tutT > 0) a.tutT -= dt;
  if (Math.random() < dt * 0.5) {
    const cabs = w.drivers.filter((d) => d.car.type === 'taxi');
    for (const wk of w.walkers) {
      const a = wk.a;
      if (!a.visible || a.busy > 0 || dist(a, p) > 30) continue;
      const cab = cabs.find((d) => Math.hypot(d.car.x - a.x, d.car.z - a.z) < 9);
      if (cab && Math.random() < 0.25) { a.oneShot('Wave', 1.6); wk.pause = 1.6; G.hud.sayBy(a, 'Taxi!', false, 2); break; }
    }
  }
}

function scatter() {
  const p = G.world.player;
  for (const a of G.world.actors) if (!a.isCop && !a.seated && dist(a, p) < 9 && a.busy <= 0 && Math.random() < .5) { a.oneShot('HitRecieve', 0.7); if (Math.random() < .4) G.hud.sayBy(a, line('dive'), true); }
}
const IDLE_VOICES = [
  ['appetite', 'There is a coffee stall in Shepherd Market. Appetite mentions it. Appetite will keep mentioning it.'],
  ['goodForm', 'Your tie is crooked. Nobody can see it in the rain. Good Form can.'],
  ['hester', 'Aunt Hester once had a man transported for whistling on a Sunday. It may have been Australia. It may have been Kent.'],
  ['logic', 'You have not eaten since luncheon, and luncheon was a cocktail with an olive in it.'],
  ['nerve', 'Mayfair at night, a motor, five pounds and no supervision. Nerve has never been happier.'],
];
function idleVoice() { const [k, s] = IDLE_VOICES[Math.floor(Math.random() * IDLE_VOICES.length)]; G.voice(k, s); }

function handleKeys() {
  if (input.hit('mute')) { const m = toggleMute(); G.hud && G.hud.toast('', m ? 'Sound off' : 'Sound on', 1.2); }
  if (G.mode === 'title' || G.mode === 'pause') {
    if (input.hit('up')) G.menuNav && G.menuNav(-1);
    if (input.hit('down')) G.menuNav && G.menuNav(1);
    if (input.hit('action')) { G.menuGo && G.menuGo(); return; }
    if (G.mode === 'pause' && input.hit('pause')) resume();
    return;
  }
  if (G.mode === 'map') { if (input.hit('map') || input.hit('pause')) closeMap(); return; }
  if (G.mode !== 'play' || G.dlg.open) return;
  if (input.hit('pause')) return pauseMenu();
  if (input.hit('map')) return openMap();
  if (input.hit('hint')) { G.jobs.hint(true); sfx.card(); }
}

addEventListener('pointerdown', () => initAudio());
addEventListener('keydown', () => initAudio(), { once: true });
boot().catch((e) => { console.error(e); $('load-msg').textContent = 'Something went wrong: ' + e.message; });

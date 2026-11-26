// Every sound is made by the program itself: no recordings.
let ctx = null, master = null, rainGain = null, engine = null, murmur = null, piano = null;
let volume = 0.7, muted = false, musicBus = null, band = null, musicVol = 0.5;
export function setMusic(v) { musicVol = v; if (musicBus) musicBus.gain.value = v; }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ctx.destination);
  // rain: filtered noise, always on
  const noise = noiseBuffer(3);
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
  rainGain = ctx.createGain(); rainGain.gain.value = 0.16;
  src.connect(hp).connect(lp).connect(rainGain).connect(master); src.start();
  // engine: two detuned saws through a low-pass
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
  const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 400;
  const eg = ctx.createGain(); eg.gain.value = 0;
  o1.connect(ef); o2.connect(ef); ef.connect(eg).connect(master); o1.start(); o2.start();
  // a slow throb on the volume, so the engine chugs at low revs
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'sine'; lfo.frequency.value = 9; lg.gain.value = 0;
  lfo.connect(lg).connect(eg.gain); lfo.start();
  engine = { o1, o2, ef, eg, lfo, lg };
  // the wireless: a quiet dance band through a gramophone horn
  const mh = ctx.createBiquadFilter(); mh.type = 'highpass'; mh.frequency.value = 220;
  const ml = ctx.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 2600;
  musicBus = ctx.createGain(); musicBus.gain.value = musicVol;
  musicBus.connect(mh).connect(ml).connect(master);
  band = { next: ctx.currentTime + 1.5, bar: 0 };
  // pub murmur: band-passed noise
  const ms = ctx.createBufferSource(); ms.buffer = noise; ms.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.8;
  const mg = ctx.createGain(); mg.gain.value = 0;
  ms.connect(bp).connect(mg).connect(master); ms.start();
  murmur = mg;
  piano = { t: 0, gain: 0 };
  // tyres: a hiss on the wet setts that rises with speed, and a squeal when they let go
  const ts = ctx.createBufferSource(); ts.buffer = noise; ts.loop = true;
  const tl = ctx.createBiquadFilter(); tl.type = 'bandpass'; tl.frequency.value = 1200; tl.Q.value = 0.6;
  const tg = ctx.createGain(); tg.gain.value = 0;
  ts.connect(tl).connect(tg).connect(master); ts.start();
  const qs = ctx.createBufferSource(); qs.buffer = noise; qs.loop = true;
  const q1 = ctx.createBiquadFilter(); q1.type = 'bandpass'; q1.frequency.value = 1900; q1.Q.value = 14;
  const q2 = ctx.createBiquadFilter(); q2.type = 'bandpass'; q2.frequency.value = 2650; q2.Q.value = 10;
  const qg = ctx.createGain(); qg.gain.value = 0;
  qs.connect(q1).connect(qg); qs.connect(q2).connect(qg); qg.connect(master); qs.start();
  tyres = { tl, tg, q1, qg };
}
let tyres = null;

function noiseBuffer(secs) {
  const b = ctx.createBuffer(1, ctx.sampleRate * secs, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
let NB = null;
function nb() { return NB || (NB = noiseBuffer(1)); }

export function setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; }
export function getVolume() { return volume; }
export function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : volume; return muted; }

function env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function tone(type, f, dur, peak = 0.2, at = 0, dest = master) {
  if (!ctx) return;
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  env(g, t, 0.01, peak, dur); o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
  return o;
}
function burst(freq, q, dur, peak = 0.3, at = 0, type = 'bandpass') {
  if (!ctx) return;
  const t = ctx.currentTime + at, s = ctx.createBufferSource(); s.buffer = nb();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.005, peak, dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur + 0.05);
}

export const sfx = {
  step(surface = 'stone', vol = 1) { burst(surface === 'cobble' ? 900 : 1400, 1.2, 0.06, 0.06 * vol); },
  whistle() {
    if (!ctx) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2700; lfo.frequency.value = 28; lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.03); g.gain.setValueAtTime(0.12, t + 0.35); g.gain.linearRampToValueAtTime(0, t + 0.4);
    g.gain.linearRampToValueAtTime(0.12, t + 0.48); g.gain.setValueAtTime(0.12, t + 0.9); g.gain.linearRampToValueAtTime(0, t + 0.98);
    o.connect(g).connect(master); o.start(t); lfo.start(t); o.stop(t + 1); lfo.stop(t + 1);
  },
  horn(kind = 'honk') {
    if (kind === 'parp') { tone('square', 392, 0.18, 0.08); tone('square', 330, 0.25, 0.08, 0.2); }
    else if (kind === 'bell') { for (let i = 0; i < 4; i++) tone('triangle', 1760, 0.25, 0.08, i * 0.14); }
    else { tone('sawtooth', 220, 0.35, 0.07); tone('sawtooth', 277, 0.35, 0.05); }
  },
  thump(v = 1) { burst(120, 0.7, 0.25, 0.4 * Math.min(1, v), 0, 'lowpass'); burst(2200, 2, 0.08, 0.1 * v); },
  door() { burst(180, 1, 0.18, 0.3, 0, 'lowpass'); burst(900, 3, 0.05, 0.08, 0.05); },
  pinch() { tone('triangle', 880, 0.08, 0.12); tone('triangle', 1320, 0.12, 0.12, 0.08); },
  sting(level = 1) { const base = 196 * Math.pow(1.122, level); [1, 1.26, 1.5].forEach((m, i) => tone('sawtooth', base * m, 0.5, 0.05, i * 0.02)); },
  coin() { tone('triangle', 1568, 0.1, 0.1); tone('triangle', 2093, 0.25, 0.1, 0.09); },
  success() { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0.35, 0.09, i * 0.12)); },
  fail() { [392, 370, 349, 262].forEach((f, i) => tone('triangle', f, 0.4, 0.08, i * 0.16)); },
  oink() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.25); env(g, t, 0.01, 0.12, 0.25); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.3); },
  ring() { for (let i = 0; i < 6; i++) tone('square', i % 2 ? 1400 : 1200, 0.05, 0.05, i * 0.06); for (let i = 0; i < 6; i++) tone('square', i % 2 ? 1400 : 1200, 0.05, 0.05, 0.7 + i * 0.06); },
  card() { burst(3000, 1, 0.06, 0.05); },
  scold() { tone('sawtooth', 160, 0.6, 0.05); tone('sawtooth', 120, 0.8, 0.05, 0.3); },
  splash() { burst(700, 0.5, 0.35, 0.18); },
  // a church bell some streets off: a struck fundamental with its hum and tierce, decaying slowly
  bell(at = 0, vol = 1) {
    if (!ctx) return;
    for (const [m, p, d] of [[1, 0.07, 3.2], [0.5, 0.05, 4], [1.2, 0.035, 2.2], [2, 0.03, 1.6], [2.67, 0.015, 1.1]]) {
      const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(311 * m, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(p * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
    }
  },
  // a small dog objecting: two or three sharp yips
  yap() {
    if (!ctx) return;
    const n = 2 + Math.floor(Math.random() * 2), base = 650 + Math.random() * 350;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.13, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(base * 1.25, t); o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.07);
      f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.1);
    }
  },
};

// Called every frame with what the player is doing.
// Engine character per motor: base pitch, rise with speed, brightness, chug and loudness.
const ENGINES = {
  roadster: [52, 6.2, 520, 0.35, 0.065], roadsterBlue: [50, 6, 500, 0.35, 0.065],
  taxi: [36, 4.6, 300, 0.7, 0.06], saloon: [34, 4.2, 330, 0.25, 0.05], saloonGreen: [34, 4.2, 330, 0.25, 0.05],
  van: [32, 4, 300, 0.6, 0.06], tender: [40, 5, 420, 0.4, 0.06], maria: [30, 3.8, 280, 0.65, 0.065], float: [80, 4, 900, 0, 0.022],
};
export function updateAudio(dt, s) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const e = engine;
  if (s.car) {
    const [base, rise, bright, chug, loud] = ENGINES[s.type] || ENGINES.saloon;
    const sp = Math.abs(s.speed);
    // a crude gearbox: revs climb, then drop as it changes up
    const gear = Math.min(3, Math.floor(sp / 7)), inGear = sp - gear * 7;
    const f = base + inGear * rise + gear * rise * 2.2 + (s.throttle > 0 ? 6 : 0);
    e.o1.frequency.setTargetAtTime(f, now, 0.06); e.o2.frequency.setTargetAtTime(f * 1.505, now, 0.06);
    e.ef.frequency.setTargetAtTime(bright * 0.6 + sp * 30 + (s.throttle > 0 ? bright * 0.4 : 0), now, 0.08);
    e.eg.gain.setTargetAtTime(loud * (s.throttle > 0 ? 1 : 0.7), now, 0.1);
    e.lfo.frequency.setTargetAtTime(f / 4, now, 0.1);
    e.lg.gain.setTargetAtTime(loud * chug * Math.max(0.15, 1 - sp / 12), now, 0.1);
  } else { e.eg.gain.setTargetAtTime(0, now, 0.15); e.lg.gain.setTargetAtTime(0, now, 0.15); }
  if (tyres) {
    const sp = s.car ? Math.abs(s.speed) : 0, sl = s.car ? Math.max(0, (s.slide || 0) - 1.2) : 0;
    tyres.tg.gain.setTargetAtTime(Math.min(0.09, sp * 0.0045), now, 0.12);
    tyres.tl.frequency.setTargetAtTime(700 + sp * 60, now, 0.2);
    tyres.qg.gain.setTargetAtTime(Math.min(0.5, sl * 0.09) * (sp > 3 ? 1 : 0), now, 0.05);
    tyres.q1.frequency.setTargetAtTime(1700 + sl * 60 + Math.random() * 120, now, 0.05);
  }
  murmur.gain.setTargetAtTime(Math.max(0, 1 - s.pubDist / 22) * 0.12, now, 0.2);
  rainGain.gain.setTargetAtTime(s.indoors ? 0.04 : 0.16, now, 0.3);
  // stride piano from the pub: a few notes at random
  piano.t -= dt;
  if (piano.t <= 0 && s.pubDist < 30) {
    piano.t = 0.18 + Math.random() * 0.22;
    const vol = Math.max(0, 1 - s.pubDist / 30) * 0.05;
    const scale = [262, 294, 330, 392, 440, 523, 587, 659];
    tone('triangle', scale[Math.floor(Math.random() * scale.length)], 0.3, vol);
    if (Math.random() < .4) tone('triangle', scale[Math.floor(Math.random() * 3)] / 2, 0.4, vol * .8);
  }
  playBand();
  playOrgan(s.organDist == null ? 999 : s.organDist);
}

// ---------------------------------------------------------------- the barrel organ
// A street organ by Berkeley Square: a little waltz of its own in C, reedy pipes with a wobble,
// oom-pah-pah underneath, louder as you come nearer.
const WALTZ = [
  [4, 7, 12], [11, 7, 4], [5, 9, 14], [12, null, null], [4, 7, 12], [16, 14, 12], [11, 14, 7], [12, null, null],
  [9, 12, 17], [16, 12, 9], [7, 11, 14], [12, 11, 9], [5, 9, 12], [11, 9, 7], [2, 5, 11], [12, null, null],
];
const WBASS = [0, 7, 5, 0, 0, 5, 7, 0, 5, 0, 7, 5, 5, 7, 7, 0];
let organ = null;
function playOrgan(d) {
  if (!ctx) return;
  const vol = Math.max(0, 1 - d / 30) * 0.07;
  if (vol <= 0) { organ = null; return; }
  if (!organ) organ = { next: ctx.currentTime + 0.1, bar: 0 };
  const beat = 60 / 138, C5 = 523.25, f = (n) => C5 * Math.pow(2, n / 12);
  while (organ.next < ctx.currentTime + 0.4) {
    const t0 = organ.next, i = organ.bar % 16, m = WALTZ[i];
    for (let b = 0; b < 3; b++) {
      const t = t0 + b * beat, n = m[b];
      const len = n === null ? 0 : (m[b + 1] === null ? beat * (3 - b) : beat) * 0.92;
      if (n !== null) { note('square', f(n), t, len, vol * 0.5, master); note('sawtooth', f(n) * 1.004, t, len, vol * 0.3, master); }
      const root = WBASS[i];
      if (b === 0) note('triangle', f(root - 24), t, beat * 0.8, vol * 0.9, master);
      else for (const iv of [4, 7]) note('square', f(root - 12 + iv), t, beat * 0.35, vol * 0.18, master);
    }
    organ.next += beat * 3; organ.bar++;
  }
}

// ---------------------------------------------------------------- the dance band
// A twelve-bar in B flat at a foxtrot lick: walking bass, banjo chords on the off-beat,
// a muted trumpet noodling in the blues scale, and the crackle of a worn record.
const BAR = [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7];
const ROOT = 116.54; // B flat
const semi = (n) => ROOT * Math.pow(2, n / 12);
const BLUES = [0, 3, 5, 6, 7, 10, 12, 15];
function note(type, f, at, dur, peak, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.05);
}
function playBand() {
  if (!band || musicVol <= 0) return;
  const beat = 60 / 112;
  while (band.next < ctx.currentTime + 0.4) {
    const t0 = band.next, root = BAR[band.bar % 12];
    for (let b = 0; b < 4; b++) {
      const t = t0 + b * beat;
      // walking bass: root, third, fifth, approach
      const walk = [0, 4, 7, b === 3 ? (BAR[(band.bar + 1) % 12] - 1) : 9][b];
      note('triangle', semi(root + walk) / 2, t, beat * 0.9, 0.16, musicBus);
      // banjo chord on 2 and 4
      if (b % 2 === 1) for (const iv of [0, 4, 7, 10]) note('square', semi(root + iv + 12), t, 0.12, 0.018, musicBus);
      // trumpet: swung quavers, now and then
      if (Math.random() < 0.55) {
        const n = BLUES[Math.floor(Math.random() * BLUES.length)] + 24 + (root === 5 ? 5 : 0);
        note('sawtooth', semi(n), t, beat * 0.55, 0.022, musicBus);
        if (Math.random() < 0.5) note('sawtooth', semi(BLUES[Math.floor(Math.random() * BLUES.length)] + 24), t + beat * 0.66, beat * 0.3, 0.018, musicBus);
      }
      // record crackle
      if (Math.random() < 0.5) { const s = ctx.createBufferSource(); s.buffer = nb(); const g = ctx.createGain(); g.gain.setValueAtTime(0.03, t + Math.random() * beat); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.random() * beat + 0.02); s.connect(g).connect(musicBus); s.start(t); s.stop(t + beat); }
    }
    band.next += beat * 4; band.bar++;
  }
}

// Clipped little voice barks for speech bubbles: a few vowel blips.
export function bark(high = false, gruff = false) {
  if (!ctx) return;
  const n = 2 + Math.floor(Math.random() * 4), base = (high ? 230 : 120) * (gruff ? 0.85 : 1);
  for (let i = 0; i < n; i++) {
    const t = ctx.currentTime + i * 0.085, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.35), t);
    f.type = 'bandpass'; f.frequency.value = [700, 1100, 500, 900][Math.floor(Math.random() * 4)] * (high ? 1.3 : 1); f.Q.value = 4;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 0.1);
  }
}

// Every sound is made by the program itself: no recordings.
let ctx = null, master = null, rainGain = null, engine = null, murmur = null, piano = null;
let volume = 0.7, muted = false;

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
  engine = { o1, o2, ef, eg };
  // pub murmur: band-passed noise
  const ms = ctx.createBufferSource(); ms.buffer = noise; ms.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 450; bp.Q.value = 0.8;
  const mg = ctx.createGain(); mg.gain.value = 0;
  ms.connect(bp).connect(mg).connect(master); ms.start();
  murmur = mg;
  piano = { t: 0, gain: 0 };
}

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
};

// Called every frame with what the player is doing.
export function updateAudio(dt, s) {
  if (!ctx) return;
  const now = ctx.currentTime;
  const e = engine;
  if (s.car) {
    const sp = Math.abs(s.speed);
    const f = (s.quiet ? 70 : 42) + sp * (s.quiet ? 4 : 5.5);
    e.o1.frequency.setTargetAtTime(f, now, 0.05); e.o2.frequency.setTargetAtTime(f * 1.505, now, 0.05);
    e.ef.frequency.setTargetAtTime(280 + sp * 40, now, 0.08);
    e.eg.gain.setTargetAtTime(s.quiet ? 0.025 : 0.06, now, 0.1);
  } else e.eg.gain.setTargetAtTime(0, now, 0.15);
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
}

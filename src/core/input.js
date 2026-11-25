// Keyboard first, gamepad as well.
const down = new Set();
const pressed = new Set();
const BIND = {
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  run: ['ShiftLeft', 'ShiftRight'], action: ['KeyE', 'Enter'], car: ['KeyF'], brake: ['Space'], horn: ['KeyG'],
  camL: ['KeyQ'], camR: ['KeyR'], map: ['KeyM', 'Tab'], pause: ['Escape', 'KeyP'], hint: ['KeyH'], mute: ['KeyN'],
  c1: ['Digit1'], c2: ['Digit2'], c3: ['Digit3'], c4: ['Digit4'],
};
export const input = {
  bind: BIND,
  held(a) { return BIND[a].some((k) => down.has(k)) || pad.held(a); },
  hit(a) { return BIND[a].some((k) => pressed.has(k)) || pad.hit(a); },
  axis() {
    let x = 0, y = 0;
    if (this.held('left')) x -= 1; if (this.held('right')) x += 1;
    if (this.held('up')) y += 1; if (this.held('down')) y -= 1;
    const g = pad.stick();
    if (Math.abs(g.x) > 0.2) x = g.x; if (Math.abs(g.y) > 0.2) y = -g.y;
    return { x, y };
  },
  endFrame() { pressed.clear(); pad.end(); },
  anyKey: false,
};
const GAME_KEYS = new Set(Object.values(BIND).flat());
addEventListener('keydown', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
  if (!down.has(e.code)) pressed.add(e.code);
  down.add(e.code);
  input.anyKey = true;
  if (GAME_KEYS.has(e.code) && e.code !== 'Escape') e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => down.clear());

// Gamepad: A action, B car, X horn, Y hint, RB run, LB brake, Start pause, Back map, bumpers turn camera.
const pad = (() => {
  let prev = [], cur = [];
  const MAP = { action: 0, car: 1, horn: 2, hint: 3, camL: 4, camR: 5, brake: 6, run: 7, map: 8, pause: 9 };
  return {
    poll() {
      const g = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
      prev = cur; cur = g ? g.buttons.map((b) => b.pressed) : [];
      this.g = g;
    },
    held(a) { const i = MAP[a]; if (i == null) { if (!this.g) return false; const ax = this.g.axes; if (a === 'up') return ax[1] < -0.5 || cur[12]; if (a === 'down') return ax[1] > 0.5 || cur[13]; if (a === 'left') return ax[0] < -0.5 || cur[14]; if (a === 'right') return ax[0] > 0.5 || cur[15]; return false; } return !!cur[i]; },
    hit(a) { const i = MAP[a]; return i != null && !!cur[i] && !prev[i]; },
    stick() { return this.g ? { x: this.g.axes[0] || 0, y: this.g.axes[1] || 0 } : { x: 0, y: 0 }; },
    end() {},
  };
})();
export function pollPad() { pad.poll(); }

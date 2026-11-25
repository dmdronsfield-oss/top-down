import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const FOG = 0x1a1e2c;

// A light grain and vignette, to make the frame feel printed rather than rendered.
const PrintShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGrain: { value: 0.045 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uGrain; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - .5; float v = smoothstep(.85, .25, length(d * vec2(1.1, 1.0)));
      c.rgb *= mix(.62, 1.0, v);
      c.rgb += (h(vUv * 800.0) - .5) * uGrain;
      // a faint warm paper cast in the shadows
      c.rgb = mix(c.rgb, c.rgb * vec3(1.04, 1.0, .93) + vec3(.012, .008, 0.), .5);
      gl_FragColor = c;
    }`,
};

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(FOG);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 60, 190);
  scene.background = new THREE.Color(FOG);
  const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.5, 400);

  const hemi = new THREE.HemisphereLight(0x9aa4cc, 0x3a3038, 1.9);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa8b2e0, 1.5);
  moon.position.set(-40, 80, 30);
  scene.add(moon);

  let composer = null, bloom = null, print = null;
  if (quality !== 'low') {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), quality === 'high' ? 0.75 : 0.6, 0.5, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    print = new ShaderPass(PrintShader);
    composer.addPass(print);
  }
  // A pool of real lights, moved each frame to the lamps nearest the camera target.
  const lights = [];
  const n = quality === 'high' ? 10 : quality === 'medium' ? 7 : 4;
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(0xffb060, 0, 16, 1.6);
    scene.add(l);
    lights.push(l);
  }
  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(w, h);
  }
  function render(t) {
    if (composer) { print.uniforms.uTime.value = t % 10; composer.render(); }
    else renderer.render(scene, camera);
  }
  return { renderer, scene, camera, composer, bloom, lights, resize, render, hemi, moon };
}

// Move the light pool to the nearest lamps.
const _cand = [];
export function placeLights(lights, lamps, cx, cz, t) {
  _cand.length = 0;
  for (const l of lamps) {
    if (l.dim) continue;
    const d = (l.x - cx) ** 2 + (l.z - cz) ** 2;
    if (d < 3600) _cand.push([d, l]);
  }
  _cand.sort((a, b) => a[0] - b[0]);
  lights.forEach((L, i) => {
    const c = _cand[i];
    if (!c) { L.intensity = 0; return; }
    const l = c[1];
    L.position.set(l.x, l.y - 0.3, l.z);
    const flick = 0.94 + Math.sin(t * 7 + i * 1.7) * 0.03 + Math.sin(t * 13.1 + i) * 0.03;
    L.intensity = 26 * flick;
    L.color.setHex(l.red ? 0xff5030 : 0xffb060);
  });
}

// Rain: line segments recycled round the camera target.
export function makeRain(scene, quality) {
  const N = quality === 'high' ? 4200 : quality === 'medium' ? 2800 : 1400;
  const pos = new Float32Array(N * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x9fb0d0, transparent: true, opacity: 0.38, depthWrite: false, fog: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  scene.add(lines);
  const reset = (i, any, cx, cz) => {
    const x = cx + (Math.random() - .5) * 80, z = cz + (Math.random() - .5) * 80, y = any ? Math.random() * 32 : 28 + Math.random() * 6;
    const o = i * 6;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = x + .05; pos[o + 4] = y + .8; pos[o + 5] = z + .03;
  };
  for (let i = 0; i < N; i++) reset(i, true, 0, 0);
  // ripples on the ground
  const rg = new THREE.RingGeometry(0.05, 0.075, 12); rg.rotateX(-Math.PI / 2);
  const RN = quality === 'low' ? 0 : 160;
  const rmat = new THREE.MeshBasicMaterial({ color: 0xaab8d8, transparent: true, opacity: .35, depthWrite: false });
  const ripples = new THREE.InstancedMesh(rg, rmat, Math.max(RN, 1));
  ripples.count = RN;
  ripples.frustumCulled = false;
  scene.add(ripples);
  const rip = Array.from({ length: RN }, () => ({ x: 0, z: 0, y: 0, t: Math.random() }));
  const m4 = new THREE.Matrix4();
  return {
    lines,
    update(dt, cx, cz, groundY) {
      for (let i = 0; i < N; i++) {
        const o = i * 6;
        pos[o + 1] -= 30 * dt; pos[o + 4] -= 30 * dt; pos[o] -= 1.2 * dt; pos[o + 3] -= 1.2 * dt;
        if (pos[o + 1] < 0 || Math.abs(pos[o] - cx) > 42 || Math.abs(pos[o + 2] - cz) > 42) reset(i, false, cx, cz);
      }
      geo.attributes.position.needsUpdate = true;
      for (let i = 0; i < RN; i++) {
        const r = rip[i];
        r.t += dt * 1.6;
        if (r.t > 1) { r.t = 0; r.x = cx + (Math.random() - .5) * 40; r.z = cz + (Math.random() - .5) * 34; r.y = groundY(r.x, r.z) + 0.02; }
        const s = 0.3 + r.t * 1.6;
        m4.makeScale(s, 1, s); m4.setPosition(r.x, r.y, r.z);
        ripples.setMatrixAt(i, m4);
      }
      ripples.instanceMatrix.needsUpdate = true;
      rmat.opacity = 0.18;
    },
  };
}

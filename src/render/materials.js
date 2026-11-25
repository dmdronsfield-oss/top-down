import * as THREE from 'three';

// Three-step ramp: the flat, inked look of a 1930s magazine plate.
const ramp = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
export const gradientMap = new THREE.DataTexture(ramp, 3, 1, THREE.RGBAFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

const toonCache = new Map();
export function toon(color, extra) {
  const key = extra ? null : String(color);
  if (key && toonCache.has(key)) return toonCache.get(key);
  const m = new THREE.MeshToonMaterial(Object.assign({ color, gradientMap }, extra || {}));
  if (key) toonCache.set(key, m);
  return m;
}

export const INK = 0x14111a;

// Inverted-hull outline. Works for plain, instanced and skinned meshes.
const inkCache = new Map();
export function inkMat(thickness = 0.03) {
  const k = thickness.toFixed(4);
  if (inkCache.has(k)) return inkCache.get(k);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.inkT = { value: thickness };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float inkT;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifndef USE_SKINNING\ntransformed += normalize(normal) * inkT;\n#endif')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n#ifdef USE_SKINNING\ntransformed += normalize(objectNormal) * inkT;\n#endif');
    // MeshBasicMaterial only computes objectNormal for skinning/envmap; make sure it exists for skinned meshes.
  };
  m.customProgramCacheKey = () => 'ink' + k;
  inkCache.set(k, m);
  return m;
}

export function inked(geo, mat, t = 0.03) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = false;
  if (t) {
    const o = new THREE.Mesh(geo, inkMat(t));
    o.userData.ink = true;
    o.raycast = () => {};
    m.add(o);
  }
  return m;
}

export function glow(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false });
}

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTex(c, repeat, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

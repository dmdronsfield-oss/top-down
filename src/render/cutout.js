import * as THREE from 'three';

// Buildings between the camera and Teddy dissolve in a soft dithered circle,
// so the street is never hidden. Shared uniforms are updated once a frame.
export const cut = {
  uCutPos: { value: new THREE.Vector2(-9999, -9999) },
  uCutR: { value: 0 },
  uCutDepth: { value: 0 },
};

const _v = new THREE.Vector3();
export function updateCut(camera, target, width, height, pixelRatio, scale = 0.3) {
  camera.updateMatrixWorld();
  _v.copy(target).project(camera);
  cut.uCutPos.value.set((_v.x * 0.5 + 0.5) * width * pixelRatio, (_v.y * 0.5 + 0.5) * height * pixelRatio);
  cut.uCutDepth.value = _v.z * 0.5 + 0.5;
  // ease the radius so it grows smoothly when you climb into a motor
  const want = Math.min(width, height) * pixelRatio * scale;
  cut.uCutR.value += (want - cut.uCutR.value) * (cut.uCutR.value ? 0.1 : 1);
}

export function patchCutout(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (s, r) => {
    prev && prev(s, r);
    Object.assign(s.uniforms, cut);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec2 uCutPos; uniform float uCutR; uniform float uCutDepth;
float cutBayer(vec2 p){ vec2 q = mod(floor(p), 4.0); int i = int(q.x) + int(q.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[i] + .5) / 16.; }`)
      .replace('void main() {', `void main() {
  { float d = distance(gl_FragCoord.xy, uCutPos) / max(uCutR, 1.0);
    if (d < 1.0 && gl_FragCoord.z < uCutDepth - 0.0004) {
      float a = smoothstep(1.0, 0.6, d) * 0.95;
      if (cutBayer(gl_FragCoord.xy) < a) discard;
    } }`);
  };
  const key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.customProgramCacheKey = () => key() + '|cut';
  return mat;
}

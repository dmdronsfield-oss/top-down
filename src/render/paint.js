import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// A painterly finish laid over the finished frame: watercolour. Washes wobble and bleed a little,
// pigment pools darker along every edge, and the cold-pressed paper shows through.

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
  float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

const SOBEL = `
  float edge(sampler2D t, vec2 uv, vec2 px){
    float tl = lum(texture2D(t, uv + px*vec2(-1,-1)).rgb), tc = lum(texture2D(t, uv + px*vec2(0,-1)).rgb), tr = lum(texture2D(t, uv + px*vec2(1,-1)).rgb);
    float ml = lum(texture2D(t, uv + px*vec2(-1, 0)).rgb),                                               mr = lum(texture2D(t, uv + px*vec2(1, 0)).rgb);
    float bl = lum(texture2D(t, uv + px*vec2(-1, 1)).rgb), bc = lum(texture2D(t, uv + px*vec2(0, 1)).rgb), br = lum(texture2D(t, uv + px*vec2(1, 1)).rgb);
    float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br, gy = -tl - 2.0*tc - tr + bl + 2.0*bc + br;
    return length(vec2(gx, gy));
  }
`;

const SHADERS = {
  watercolour: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    ${NOISE} ${SOBEL}
    void main(){
      vec2 px = 1.0 / uRes;
      vec2 wob = (vec2(fbm(vUv * 14.0), fbm(vUv * 14.0 + 3.1)) - 0.5) * px * 9.0;
      vec2 uv = vUv + wob;
      // a soft wash: average a small disc, so detail bleeds a little
      vec3 c = vec3(0.0);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) c += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * px * 2.2).rgb;
      c /= 9.0;
      vec3 sharp = texture2D(tDiffuse, uv).rgb;
      c = mix(c, sharp, 0.35);
      // pigment pools and dries darker along the edge of every wash
      float e = edge(tDiffuse, uv, px * 2.0);
      c *= 1.0 - clamp(e * 1.3, 0.0, 0.45);
      // the paper: lifts the washes, and the pigment settles in its pits (granulation)
      vec2 g = vUv * uRes;
      float paper = fbm(g * 0.08), pits = fbm(g * 0.6);
      float l = lum(c);
      c = mix(c, vec3(0.93, 0.9, 0.83), 0.1 * (1.0 - l));          // washes never quite opaque
      c *= 0.9 + 0.14 * paper;
      c -= (pits - 0.5) * 0.08 * (1.0 - l);
      // unpainted margins: the wash thins out towards the edge of the sheet
      float m = fbm(vUv * 5.0) * 0.08;
      float edgeFade = smoothstep(0.0, 0.025 + m * 0.5, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
      c = mix(vec3(0.9, 0.87, 0.8) * (0.92 + 0.08 * paper), c, edgeFade);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export const PAINT_STYLES = Object.keys(SHADERS);

export function makePaintPass(style, w, h) {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(w, h) } },
    vertexShader: VERT,
    fragmentShader: SHADERS[style],
  });
}

// Adds (or swaps, or with null removes) a paint pass, just before the final print grain.
export function setPaint(R, style) {
  const c = R.composer;
  if (!c) return false;
  if (R.paint) { c.removePass(R.paint); R.paint = null; }
  if (!style || !SHADERS[style]) return true;
  const sz = new THREE.Vector2(); R.renderer.getDrawingBufferSize(sz);
  R.paint = makePaintPass(style, sz.x, sz.y);
  c.insertPass(R.paint, c.passes.length - 1);
  return true;
}

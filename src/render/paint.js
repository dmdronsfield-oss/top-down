import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Painterly finishes, laid over the finished frame. Three trials:
//   oil        - Kuwahara smoothing into flat brush patches, on a canvas weave
//   watercolour- wobbled washes, pigment pooled at the edges, cold-pressed paper
//   gouache    - flat poster colour in a few values, a dry ink line, matt paper (the Apparel Arts plate)

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }';

const NOISE = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
  float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
`;

// Generalised Kuwahara (Kyprianidis's polynomial sector weights): eight soft, overlapping sectors
// round each pixel; it takes a blend of the sector means, favouring the least varied, so detail
// melts into rounded brush patches while edges hold.
const KUWAHARA = (R) => `
  vec3 kuwahara(sampler2D t, vec2 uv, vec2 px){
    vec4 m[8]; vec3 s[8];
    for (int k = 0; k < 8; k++){ m[k] = vec4(0.0); s[k] = vec3(0.0); }
    float zeta = 2.0 / float(${R}), zc = 0.58, sz = sin(zc), eta = (zeta + cos(zc)) / (sz * sz);
    for (int j = -${R}; j <= ${R}; j++) for (int i = -${R}; i <= ${R}; i++){
      vec2 v = vec2(float(i), float(j)) / float(${R});
      if (dot(v, v) > 1.0) continue;
      vec3 c = texture2D(t, uv + vec2(float(i), float(j)) * px).rgb;
      float w[8], sum = 0.0, z;
      vec2 vxx = zeta - eta * v * v, vyy = zeta - eta * v.yx * v.yx;
      z = max(0.0,  v.y + vxx.x); w[0] = z*z; sum += w[0];
      z = max(0.0, -v.x + vyy.x); w[2] = z*z; sum += w[2];
      z = max(0.0, -v.y + vxx.y); w[4] = z*z; sum += w[4];
      z = max(0.0,  v.x + vyy.y); w[6] = z*z; sum += w[6];
      vec2 r = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
      vxx = zeta - eta * r * r; vyy = zeta - eta * r.yx * r.yx;
      z = max(0.0,  r.y + vxx.x); w[1] = z*z; sum += w[1];
      z = max(0.0, -r.x + vyy.x); w[3] = z*z; sum += w[3];
      z = max(0.0, -r.y + vxx.y); w[5] = z*z; sum += w[5];
      z = max(0.0,  r.x + vyy.y); w[7] = z*z; sum += w[7];
      float g = exp(-3.125 * dot(v, v)) / max(sum, 1e-5);
      for (int k = 0; k < 8; k++){ float wk = w[k] * g; m[k] += vec4(c * wk, wk); s[k] += c * c * wk; }
    }
    vec4 o = vec4(0.0);
    for (int k = 0; k < 8; k++){
      if (m[k].w <= 0.0) continue;
      vec3 mu = m[k].rgb / m[k].w; vec3 v = abs(s[k] / m[k].w - mu * mu);
      float sig = sqrt(v.r) + sqrt(v.g) + sqrt(v.b);
      float w = 1.0 / (1.0 + pow(min(255.0 * sig, 1e4), 4.0));
      o += vec4(mu * w, w);
    }
    return o.rgb / max(o.w, 1e-6);
  }
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
  oil: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    ${NOISE} ${KUWAHARA(5)}
    void main(){
      vec2 px = 1.0 / uRes;
      // strokes follow a slow swirl, so the patches are not all square
      vec2 w = (vec2(fbm(vUv * 9.0), fbm(vUv * 9.0 + 7.3)) - 0.5) * px * 3.0;
      vec3 c = kuwahara(tDiffuse, vUv + w, px * 1.3);
      float l = lum(c); c = mix(vec3(l), c, 1.15);                 // a touch richer
      vec2 g = vUv * uRes;                                          // canvas weave
      float weave = 0.5 + 0.5 * sin(g.x * 1.9) * sin(g.y * 1.9);
      float tooth = fbm(g * 0.35);
      c *= 0.94 + 0.06 * weave + 0.06 * (tooth - 0.5);
      // impasto: light catches the ridges of the paint
      float ridge = vnoise(g * 0.18 + w * 400.0);
      c += (ridge - 0.5) * 0.035 * smoothstep(0.15, 0.6, l);
      gl_FragColor = vec4(c, 1.0);
    }`,
  watercolour: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    ${NOISE} ${SOBEL}
    void main(){
      vec2 px = 1.0 / uRes;
      vec2 wob = (vec2(fbm(vUv * 14.0), fbm(vUv * 14.0 + 3.1)) - 0.5) * px * 9.0;
      vec2 uv = vUv + wob;
      // a soft wash: average a small disc, so detail bleeds a little
      vec3 c = vec3(0.0);
      for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) c += texture2D(tDiffuse, uv + vec2(float(i), float(j)) * px * 1.5).rgb;
      c /= 25.0;
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
  gouache: `uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    ${NOISE} ${KUWAHARA(3)} ${SOBEL}
    void main(){
      vec2 px = 1.0 / uRes;
      vec3 c = kuwahara(tDiffuse, vUv, px);
      // flat poster values: keep the hue, step the value into a few bands with a soft shoulder
      float l = lum(c), bands = 6.0;
      float q = (floor(l * bands) + smoothstep(0.35, 0.65, fract(l * bands))) / bands;
      c = c * (q / max(l, 1e-3));
      c = mix(vec3(lum(c)), c, 1.1);
      // a dry ink line where the colour breaks, broken up by the paper
      vec2 g = vUv * uRes;
      float e = edge(tDiffuse, vUv, px * 1.2);
      float dry = smoothstep(0.25, 0.75, vnoise(g * 0.5));
      float ink = smoothstep(0.45, 0.9, e) * (0.45 + 0.55 * dry);
      c = mix(c, vec3(0.08, 0.07, 0.1), ink * 0.85);
      // matt paper tooth and a warm cast
      float tooth = fbm(g * 0.25);
      c = c * (0.95 + 0.1 * tooth) + vec3(0.015, 0.01, 0.0);
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
  if (!style) return true;
  const sz = new THREE.Vector2(); R.renderer.getDrawingBufferSize(sz);
  R.paint = makePaintPass(style, sz.x, sz.y);
  c.insertPass(R.paint, c.passes.length - 1);
  return true;
}

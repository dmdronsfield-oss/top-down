import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toon, inkMat } from '../render/materials.js';

// Quaternius Ultimate Modular Men / Women (CC0). Every model shares one skeleton,
// and each is split into Head, Body, Legs and Feet, so parts can be mixed freely.
export const MODEL_FILES = ['m_suit', 'w_formal', 'w_suit', 'w_casual'];
const models = {};       // file -> { scene, parts: {Head,Body,Legs,Feet} }
export const clipSets = { m: {}, w: {} };

export async function loadFigures(onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let done = 0;
  await Promise.all(MODEL_FILES.map(async (f) => {
    const g = await loader.loadAsync(import.meta.env.BASE_URL + 'models/' + f + '.glb');
    const parts = {};
    g.scene.traverse((o) => {
      if (o.isSkinnedMesh) {
        const n = o.name + ' ' + (o.parent ? o.parent.name : '');
        const key = /Head/.test(n) ? 'Head' : /Body/.test(n) ? 'Body' : /Legs/.test(n) ? 'Legs' : /Feet/.test(n) ? 'Feet' : 'Other';
        (parts[key] = parts[key] || []).push(o);
      }
    });
    models[f] = { scene: g.scene, parts };
    if (f === 'm_suit') for (const a of g.animations) clipSets.m[a.name] = a;
    if (f === 'w_formal') for (const a of g.animations) clipSets.w[a.name] = a;
    const set = f === 'm_suit' ? clipSets.m : f === 'w_formal' ? clipSets.w : null;
    if (set) {
      set.Sit = poseClip(set.Idle, 'Sit', aimBones(g.scene, set.Idle, SIT));
      set.Drive = poseClip(set.Idle, 'Drive', aimBones(g.scene, set.Idle, { ...SIT, ...DRIVE }));
    }
    onProgress && onProgress(++done / MODEL_FILES.length);
  }));
}

// Seated poses, made from the idle clip. The rig has no sitting animation of its own, so each
// listed bone is turned until it points along a direction given in the figure's own space
// (+z forward, +y up, the right side at -x). Bones run along their local +y.
const SIT = {
  UpperLegR: [0, -0.12, 1], UpperLegL: [0, -0.12, 1],
  LowerLegR: [0, -1, 0.12], LowerLegL: [0, -1, 0.12],
  UpperArmR: [-0.12, -1, 0.3], UpperArmL: [0.12, -1, 0.3],
  LowerArmR: [0.35, -0.3, 1], LowerArmL: [-0.35, -0.3, 1],
};
const DRIVE = {
  UpperArmR: [-0.08, -0.8, 0.6], UpperArmL: [0.08, -0.8, 0.6],
  LowerArmR: [0.3, 0.05, 1], LowerArmL: [-0.3, 0.05, 1],
};
const ORDER = ['UpperLegR', 'UpperLegL', 'LowerLegR', 'LowerLegL', 'UpperArmR', 'UpperArmL', 'LowerArmR', 'LowerArmL'];
function aimBones(scene, idle, aims) {
  const bones = {};
  scene.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  const saved = new Map();
  for (const n in bones) saved.set(n, bones[n].quaternion.clone());
  // pose the template at the first frame of the idle clip
  for (const t of idle.tracks) {
    const dot = t.name.lastIndexOf('.'), b = bones[t.name.slice(0, dot)];
    if (b && t.name.slice(dot + 1) === 'quaternion') b.quaternion.fromArray(t.values, 0);
  }
  scene.updateMatrixWorld(true);
  const rootQ = scene.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rots = {}, wq = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  for (const n of ORDER) {
    const b = bones[n];
    if (!b || !aims[n]) continue;
    const D = new THREE.Vector3().fromArray(aims[n]).normalize();
    b.getWorldQuaternion(wq); wq.premultiply(rootQ);           // bone orientation in figure space
    const local = D.applyQuaternion(wq.clone().invert());       // target direction in the bone's own frame
    const r = new THREE.Quaternion().setFromUnitVectors(Y, local);
    rots[n] = r;
    b.quaternion.multiply(r);
    scene.updateMatrixWorld(true);
  }
  for (const n in bones) bones[n].quaternion.copy(saved.get(n));
  scene.updateMatrixWorld(true);
  return rots;
}
function poseClip(base, name, rots) {
  const clip = base.clone(); clip.name = name;
  const q = new THREE.Quaternion();
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.'), r = rots[t.name.slice(0, dot)];
    if (!r || t.name.slice(dot + 1) !== 'quaternion') continue;
    const v = t.values = t.values.slice();
    for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i).multiply(r); q.toArray(v, i); }
  }
  return clip;
}

// Outline hull needs smooth normals, or the flat-shaded seams split open.
const smoothCache = new WeakMap();
function outlineGeometry(geo) {
  if (smoothCache.has(geo)) return smoothCache.get(geo);
  const pos = geo.attributes.position, nrm = geo.attributes.normal;
  const map = new Map(), out = new Float32Array(pos.count * 3);
  const key = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    let a = map.get(k); if (!a) map.set(k, a = [0, 0, 0]);
    a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i);
  }
  for (let i = 0; i < pos.count; i++) {
    const a = map.get(key(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', pos);
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  g.setAttribute('skinIndex', geo.attributes.skinIndex);
  g.setAttribute('skinWeight', geo.attributes.skinWeight);
  g.setIndex(geo.index);
  g.groups = [];
  smoothCache.set(geo, g);
  return g;
}

function dress(mats, colours) {
  const list = Array.isArray(mats) ? mats : [mats];
  const out = list.map((m) => toon((colours && colours[m.name]) || ('#' + m.color.getHexString())));
  return Array.isArray(mats) ? out : out[0];
}

/**
 * spec: { sex:'m'|'w', head, body, legs, feet (model file names), colours: {matName: css}, ink, scale }
 */
export function makeFigure(spec) {
  const baseFile = spec.body || (spec.sex === 'w' ? 'w_formal' : 'm_suit');
  const base = models[baseFile];
  const root = SkeletonUtils.clone(base.scene);
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name] = o; });
  // Remove all meshes from the clone; we add the chosen parts back.
  const strip = [];
  root.traverse((o) => { if (o.isSkinnedMesh) strip.push(o); });
  const host = root;
  for (const o of strip) o.parent.remove(o);

  const slots = { Head: spec.head || baseFile, Body: baseFile, Legs: spec.legs || baseFile, Feet: spec.feet || spec.legs || baseFile };
  const meshes = [];
  for (const slot in slots) {
    const m = models[slots[slot]];
    if (!m || !m.parts[slot]) continue;
    for (const srcMesh of m.parts[slot]) {
      const sk = srcMesh.skeleton;
      const skel = new THREE.Skeleton(sk.bones.map((b) => bones[b.name]), sk.boneInverses);
      const mesh = new THREE.SkinnedMesh(srcMesh.geometry, dress(srcMesh.material, spec.colours));
      mesh.name = slot + ':' + srcMesh.name;
      mesh.userData.slot = slot;
      mesh.bind(skel, srcMesh.bindMatrix);
      mesh.frustumCulled = false;
      host.add(mesh);
      meshes.push(mesh);
      if (spec.ink !== 0) {
        const ol = new THREE.SkinnedMesh(outlineGeometry(srcMesh.geometry), inkMat(spec.ink || 0.012));
        ol.bind(skel, srcMesh.bindMatrix);
        ol.frustumCulled = false;
        ol.raycast = () => {};
        ol.userData.ink = true;
        host.add(ol);
      }
    }
  }
  const holder = new THREE.Group();
  root.scale.setScalar(spec.scale || 1);
  holder.add(root);
  const mixer = new THREE.AnimationMixer(root);
  const set = clipSets[spec.sex === 'w' ? 'w' : 'm'];
  const actions = {};
  for (const k in set) actions[k] = mixer.clipAction(set[k]);
  const fig = { group: holder, root, bones, meshes, mixer, actions, current: null, spec, props: {} };
  play(fig, 'Idle', 0);
  return fig;
}

export function play(fig, name, fade = 0.2, timeScale = 1, once = false) {
  const a = fig.actions[name];
  if (!a) return;
  a.timeScale = timeScale;
  if (fig.current === name) return;
  const prev = fig.current && fig.actions[fig.current];
  a.reset();
  a.enabled = true;
  a.setEffectiveWeight(1);
  if (once) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } else a.setLoop(THREE.LoopRepeat, Infinity);
  a.play();
  if (prev && fade > 0) prev.crossFadeTo(a, fade, false); else if (prev) prev.stop();
  fig.current = name;
}

// Attach a prop to a bone so that the prop is authored in metres, whatever the bone's scale.
const _s = new THREE.Vector3();
export function attach(fig, boneName, obj) {
  const b = fig.bones[boneName];
  if (!b) return null;
  fig.group.updateMatrixWorld(true);
  const hs = new THREE.Vector3(); fig.group.getWorldScale(hs);
  b.getWorldScale(_s);
  const wrap = new THREE.Group();
  wrap.scale.set(hs.x / _s.x, hs.y / _s.y, hs.z / _s.z);
  // Undo the bone's world rotation at bind time so props are authored upright, facing +z.
  const q = new THREE.Quaternion(); b.getWorldQuaternion(q);
  const hq = new THREE.Quaternion(); fig.group.getWorldQuaternion(hq);
  wrap.quaternion.copy(q.invert().multiply(hq));
  wrap.add(obj);
  b.add(wrap);
  return wrap;
}

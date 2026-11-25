import * as THREE from 'three';

// Accumulates axis-aligned boxes, cylinders and free quads per material,
// then merges them into a handful of meshes. UVs are in metres / tile size,
// so tiled brick and stucco textures keep a constant scale everywhere.
export class Acc {
  constructor() { this.buf = new Map(); this.edges = []; }
  _b(key) {
    let b = this.buf.get(key);
    if (!b) this.buf.set(key, b = { p: [], n: [], uv: [] });
    return b;
  }
  _quad(b, a, bb, c, d, nx, ny, nz, uva, uvb, uvc, uvd) {
    b.p.push(...a, ...bb, ...c, ...a, ...c, ...d);
    for (let i = 0; i < 6; i++) b.n.push(nx, ny, nz);
    b.uv.push(...uva, ...uvb, ...uvc, ...uva, ...uvc, ...uvd);
  }
  // Box with optional ink edges. faces: string of which faces to emit (default all but bottom).
  box(key, x0, x1, y0, y1, z0, z1, tile = 2, edges = true, faces = 'xXzZY') {
    const b = this._b(key), T = 1 / tile;
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    if (faces.includes('X')) this._quad(b, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, [-z1 * T, y0 * T], [-z0 * T, y0 * T], [-z0 * T, y1 * T], [-z1 * T, y1 * T]);
    if (faces.includes('x')) this._quad(b, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, [z0 * T, y0 * T], [z1 * T, y0 * T], [z1 * T, y1 * T], [z0 * T, y1 * T]);
    if (faces.includes('Z')) this._quad(b, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, [x0 * T, y0 * T], [x1 * T, y0 * T], [x1 * T, y1 * T], [x0 * T, y1 * T]);
    if (faces.includes('z')) this._quad(b, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, [-x1 * T, y0 * T], [-x0 * T, y0 * T], [-x0 * T, y1 * T], [-x1 * T, y1 * T]);
    if (faces.includes('Y')) this._quad(b, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, [x0 * T, -z1 * T], [x1 * T, -z1 * T], [x1 * T, -z0 * T], [x0 * T, -z0 * T]);
    if (faces.includes('y')) this._quad(b, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, [x0 * T, z0 * T], [x1 * T, z0 * T], [x1 * T, z1 * T], [x0 * T, z1 * T]);
    if (edges) {
      const e = this.edges;
      // vertical edges + top rectangle + bottom rectangle (skip bottom if at ground)
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) e.push(x, y0, z, x, y1, z);
      e.push(x0, y1, z0, x1, y1, z0, x1, y1, z0, x1, y1, z1, x1, y1, z1, x0, y1, z1, x0, y1, z1, x0, y1, z0);
      if (y0 > 0.05) e.push(x0, y0, z0, x1, y0, z0, x1, y0, z0, x1, y0, z1, x1, y0, z1, x0, y0, z1, x0, y0, z1, x0, y0, z0);
    }
  }
  // Vertical cylinder.
  cyl(key, x, z, r, y0, y1, seg = 10, r1) {
    const b = this._b(key);
    const rt = r1 == null ? r : r1;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const nx = Math.cos((a0 + a1) / 2), nz = Math.sin((a0 + a1) / 2);
      this._quad(b, [x + c0 * r, y0, z + s0 * r], [x + c0 * rt, y1, z + s0 * rt], [x + c1 * rt, y1, z + s1 * rt], [x + c1 * r, y0, z + s1 * r], nx, 0, nz,
        [i / seg, 0], [i / seg, 1], [(i + 1) / seg, 1], [(i + 1) / seg, 0]);
      // top cap
      b.p.push(x, y1, z, x + c1 * rt, y1, z + s1 * rt, x + c0 * rt, y1, z + s0 * rt);
      b.n.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      b.uv.push(0, 0, 0, 0, 0, 0);
    }
  }
  // A free quad (four corners, counter-clockwise seen from the front). uvs in metres / tile along its edges.
  quad(key, a, b2, c, d, tile = 2, edges = false) {
    const b = this._b(key);
    const v1 = new THREE.Vector3().fromArray(b2).sub(new THREE.Vector3().fromArray(a));
    const v2 = new THREE.Vector3().fromArray(d).sub(new THREE.Vector3().fromArray(a));
    const n = new THREE.Vector3().crossVectors(v1, v2).normalize();
    const L = v1.length() / tile, H = v2.length() / tile;
    this._quad(b, a, b2, c, d, n.x, n.y, n.z, [0, 0], [L, 0], [L, H], [0, H]);
    if (edges) this.edges.push(...a, ...b2, ...b2, ...c, ...c, ...d, ...d, ...a);
  }
  build(materials, edgeMat, name = 'chunk') {
    const g = new THREE.Group();
    g.name = name;
    for (const [key, b] of this.buf) {
      if (!b.p.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.computeBoundingSphere();
      const mat = materials[key];
      if (!mat) { console.warn('no material', key); continue; }
      const m = new THREE.Mesh(geo, mat);
      m.name = key;
      g.add(m);
    }
    if (this.edges.length && edgeMat) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(this.edges, 3));
      geo.computeBoundingSphere();
      const l = new THREE.LineSegments(geo, edgeMat);
      l.raycast = () => {};
      g.add(l);
    }
    return g;
  }
}

// Frame for building along a frontage. u runs along the street, w points out to the street, y up.
export class Frame {
  constructor(ox, oz, tx, tz, nx, nz) { Object.assign(this, { ox, oz, tx, tz, nx, nz }); }
  x(u, w) { return this.ox + this.tx * u + this.nx * w; }
  z(u, w) { return this.oz + this.tz * u + this.nz * w; }
  box(acc, key, u0, u1, y0, y1, w0, w1, tile, edges, faces) {
    acc.box(key, this.x(u0, w0), this.x(u1, w1), y0, y1, this.z(u0, w0), this.z(u1, w1), tile, edges, faces);
  }
  cyl(acc, key, u, w, r, y0, y1, seg, r1) { acc.cyl(key, this.x(u, w), this.z(u, w), r, y0, y1, seg, r1); }
  // A vertical quad facing outwards (+w), spanning u0..u1, y0..y1 at depth w.
  vquad(acc, key, u0, u1, y0, y1, w, tile, edges) {
    const a = [this.x(u0, w), y0, this.z(u0, w)], b = [this.x(u1, w), y0, this.z(u1, w)];
    const c = [this.x(u1, w), y1, this.z(u1, w)], d = [this.x(u0, w), y1, this.z(u0, w)];
    // t x up = (-tz, 0, tx); if that already points along n, a-b-c-d winds towards the street.
    if (-this.tz * this.nx + this.tx * this.nz > 0) acc.quad(key, a, b, c, d, tile, edges);
    else acc.quad(key, b, a, d, c, tile, edges);
  }
  ry() { return Math.atan2(this.nx, this.nz); }
}

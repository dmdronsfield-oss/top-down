// Converts Quaternius "Ultimate Modular Men" and "Ultimate Modular Women" characters (CC0)
// into compact .glb files. Two models keep their animation clips (one male set, one female set);
// all the others share them, because the whole range uses one skeleton.
// Usage: node tools/prepare-models.mjs <sourceDir>
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import path from 'node:path';

const src = process.argv[2];
const KEEP_ANIMS = new Set(['M_Suit', 'W_Formal']);
const MODELS = ['M_Suit', 'W_Formal', 'W_Suit', 'W_Casual'];
const DROP = /^(Pistol|Sword)$/;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
for (const name of MODELS) {
  const doc = await io.read(path.join(src, name + '.gltf'));
  const root = doc.getRoot();
  if (!KEEP_ANIMS.has(name)) for (const a of root.listAnimations()) a.dispose();
  for (const n of root.listNodes()) if (DROP.test(n.getName())) { n.getMesh() && n.getMesh().dispose(); n.dispose(); }
  await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const out = `public/models/${name.toLowerCase()}.glb`;
  await io.write(out, doc);
  console.log(out);
}

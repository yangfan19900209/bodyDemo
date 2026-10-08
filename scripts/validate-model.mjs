// Asset pipeline verification: validates actual exported buffers and full-body
// coverage rather than assuming successful exporter execution implies validity.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelDir = path.join(root, 'public/models');
const bytes = await fs.readFile(path.join(modelDir, 'anatomy.glb'));
const metadata = JSON.parse(await fs.readFile(path.join(modelDir, 'anatomy.json'), 'utf8'));
if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB header/length');
const jsonLength = bytes.readUInt32LE(12);
const glb = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
for (const view of glb.bufferViews) if ((view.byteOffset ?? 0) + view.byteLength > glb.buffers[0].byteLength) throw new Error('Out-of-range GLB bufferView');
const loaded = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const structures = new Map(metadata.structures.map(item => [item.id, item]));
const meshes = new Map();
let triangleCount = 0;
loaded.scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  const id = mesh.userData.structureId;
  if (!structures.has(id) || meshes.has(id)) throw new Error('Missing/duplicate structure ID: ' + id);
  meshes.set(id, mesh);
  const position = mesh.geometry.getAttribute('position');
  const normal = mesh.geometry.getAttribute('normal');
  if ([...position.array, ...normal.array].some(value => !Number.isFinite(value))) throw new Error('Non-finite geometry: ' + id);
  const indices = mesh.geometry.index.array;
  if (indices.some(index => index >= position.count)) throw new Error('Invalid triangle index: ' + id);
  triangleCount += indices.length / 3;
});
if (triangleCount !== metadata.stats.triangles || meshes.size !== metadata.stats.meshes) throw new Error('Manifest statistics do not match GLB');
for (const system of ['bones','arteries','veins','organs','skin']) if (!metadata.structures.some(x => x.system === system)) throw new Error('Missing system ' + system);
for (const name of [/frontal bone/i, /mandible/i, /femur/i, /tibia/i, /calcaneus/i]) {
  const structure = metadata.structures.find(x => name.test(x.nameEn));
  if (!structure || !meshes.has(structure.id)) throw new Error('Missing full-body coverage: ' + name);
}
for (const id of ['brain','left-lung','right-lung','heart','liver','stomach','spleen','pancreas','left-kidney','right-kidney','small-intestine','large-intestine','bladder','skin']) if (!meshes.has(id)) throw new Error('Missing organ/skin: ' + id);
const skinBounds = new Box3().setFromObject(meshes.get('skin'));
const bodyBounds = new Box3().setFromObject(loaded.scene);
const skinHeight = skinBounds.getSize(new Vector3()).y;
const bodyHeight = bodyBounds.getSize(new Vector3()).y;
if (skinHeight / bodyHeight < 0.96) throw new Error('Skin does not cover the full body height');
console.log(JSON.stringify({ meshes: meshes.size, triangles: triangleCount, glbBytes: bytes.length, skinHeightRatio: skinHeight / bodyHeight, systems: metadata.stats.systems }, null, 2));

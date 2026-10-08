/**
 * Offline BodyParts3D OBJ -> GLB build.
 * Mesh adaptations: full-body subset, orientation/units, local materials, bilingual
 * labels, common named-vessel grouping. See ASSETS.md for CC BY-SA 2.1 Japan.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(project, 'scripts/source');
const output = path.join(project, 'public/models');
const selected = JSON.parse((await fs.readFile(path.join(source, 'selected-full-body.json'), 'utf8')).replace(/^\uFEFF/, ''));
const materials = {
  bones: new THREE.MeshStandardMaterial({ color: 0xd5d1c7, roughness: 0.67, metalness: 0.04, name: 'Ivory bone' }),
  arteries: new THREE.MeshStandardMaterial({ color: 0xbe2335, roughness: 0.39, metalness: 0.07, name: 'Arterial red' }),
  veins: new THREE.MeshStandardMaterial({ color: 0x215caf, roughness: 0.36, metalness: 0.1, name: 'Venous blue' }),
  skin: new THREE.MeshStandardMaterial({ color: 0xd9b8a4, roughness: 0.72, metalness: 0, name: 'Translucent skin', transparent: true, opacity: 0.12, depthWrite: false }),
};
const organDefinitions = {
  brain: ['脑', 'Brain', 0xcaa89b],
  heart: ['心脏', 'Heart', 0xad3b40],
  'left-lung': ['左肺', 'Left lung', 0xbd7085],
  'right-lung': ['右肺', 'Right lung', 0xbd7085],
  liver: ['肝脏', 'Liver', 0x873f48],
  gallbladder: ['胆囊', 'Gallbladder', 0x718e63],
  stomach: ['胃', 'Stomach', 0xd99479],
  spleen: ['脾脏', 'Spleen', 0x813c62],
  pancreas: ['胰腺', 'Pancreas', 0xd9ac77],
  'left-kidney': ['左肾', 'Left kidney', 0x9e4b49],
  'right-kidney': ['右肾', 'Right kidney', 0x9e4b49],
  bladder: ['膀胱', 'Urinary bladder', 0xd8b282],
  duodenum: ['十二指肠', 'Duodenum', 0xd9a185],
  'small-intestine': ['小肠', 'Small intestine', 0xc18c7d],
  'large-intestine': ['大肠', 'Large intestine', 0xb48177],
  trachea: ['气管', 'Trachea', 0xb6b6af],
};
for (const [id, [nameZh, nameEn, color]] of Object.entries(organDefinitions)) {
  materials[id] = new THREE.MeshStandardMaterial({ color, roughness: 0.61, metalness: 0.02, name: nameEn, transparent: true, opacity: 0.8, depthWrite: false });
}
const explicit = [
  ['ascending-aorta', '升主动脉', 'Ascending aorta', 'arteries', ['FJ3413']],
  ['aortic-arch', '主动脉弓', 'Aortic arch', 'arteries', ['FJ3411']],
  ['thoracic-aorta', '胸主动脉', 'Descending thoracic aorta', 'arteries', ['FJ1931', 'FJ3427']],
  ['abdominal-aorta', '腹主动脉', 'Abdominal aorta', 'arteries', ['FJ1932']],
  ['splenic-artery', '脾动脉', 'Splenic artery', 'arteries', ['FJ2562', 'FJ3420', 'FJ3544', 'FJ3640']],
  ['superior-vena-cava', '上腔静脉', 'Superior vena cava', 'veins', ['FJ3645']],
  ['inferior-vena-cava', '下腔静脉', 'Inferior vena cava', 'veins', ['FJ3441', 'FJ3659']],
  ['brachiocephalic-artery', '头臂干', 'Brachiocephalic artery', 'arteries', ['FJ3417']],
  ['celiac-trunk', '腹腔干', 'Celiac trunk', 'arteries', ['FJ3421']],
];
const explicitMap = new Map();
for (const [id, nameZh, nameEn, system, files] of explicit) for (const file of files) explicitMap.set(file, { id, nameZh, nameEn, system });
const groups = new Map();
const loader = new OBJLoader();
const errors = [];
await MeshoptSimplifier.ready;
let inputTriangles = 0;
let componentCount = 0;

for (const item of selected) {
  let text;
  try { text = await fs.readFile(path.join(source, item.id + '.obj'), 'utf8'); }
  catch { errors.push(item.id); continue; }
  const system = item.system;
  let structure = explicitMap.get(item.id) ?? { id: item.id, nameZh: item.nameCn, nameEn: item.nameEn, system };
  if (item.group && organDefinitions[item.group]) {
    const [nameZh, nameEn] = organDefinitions[item.group];
    structure = { id: item.group, nameZh, nameEn, system: 'organs', materialKey: item.group, defaultOpacity: 0.8 };
  } else if (system === 'skin') {
    structure = { id: 'skin', nameZh: '皮肤', nameEn: 'Skin', system, defaultOpacity: 0.12 };
  }
  const object = loader.parse(text);
  const geoms = [];
  object.traverse(obj => {
    if (!obj.isMesh) return;
    const original = obj.geometry;
    inputTriangles += (original.index?.count ?? original.getAttribute('position').count) / 3;
    // Keep the complete native head, hands, lower legs, feet and skin surface.
    original.deleteAttribute('uv');
    let welded = mergeVertices(original, 0.0001);
    original.dispose();
    const indices = new Uint32Array(welded.index.array);
    const triangleCount = indices.length / 3;
    const ratio = system === 'bones' ? 0.16 : system === 'skin' ? 0.08 : system === 'organs' ? 0.14 : 0.28;
    const target = Math.max(64, Math.floor(triangleCount * ratio)) * 3;
    if (target < indices.length) {
      // An absolute deviation bound (in original millimeters) retains small
      // vessel branches. No prune flag: tiny disconnected tubes remain intact.
      const [reduced] = MeshoptSimplifier.simplify(indices, welded.attributes.position.array, 3,
        target, system === 'bones' ? 0.8 : system === 'skin' ? 0.8 : system === 'organs' ? 0.6 : 0.18, ['ErrorAbsolute', 'Permissive']);
      const [remap, vertexCount] = MeshoptSimplifier.compactMesh(reduced);
      const compact = new THREE.BufferGeometry();
      for (const name of ['position', 'normal']) {
        const attribute = welded.getAttribute(name);
        const buffer = new Float32Array(vertexCount * 3);
        for (let j = 0; j < Math.min(attribute.count, remap.length); j++) if (remap[j] !== 0xffffffff && remap[j] < vertexCount) {
          buffer.set(attribute.array.subarray(j * 3, j * 3 + 3), remap[j] * 3);
        }
        compact.setAttribute(name, new THREE.BufferAttribute(buffer, 3));
      }
      if (reduced.some(index => index >= vertexCount)) throw new Error('Invalid compacted index in ' + item.id);
      compact.setIndex(Array.from(reduced));
      compact.normalizeNormals();
      welded.dispose();
      welded = compact;
    }
    // Original x = subject-left, y = posterior, z = superior, mm. New coordinates
    // keep anatomical left on the screen's right, y up and positive z anterior.
    welded.rotateX(-Math.PI / 2);
    welded.scale(0.0147, 0.0147, 0.0147);
    geoms.push(welded);
  });
  if (!geoms.length) continue;
  componentCount++;
  const record = groups.get(structure.id) ?? { ...structure, geometries: [], sourceComponents: [] };
  record.geometries.push(...geoms);
  record.sourceComponents.push(item.id);
  groups.set(structure.id, record);
}
if (errors.length) throw new Error('Source components are missing: ' + errors.join(', '));

const scene = new THREE.Scene();
scene.name = 'BodyParts3D full body anatomy study';
const structures = [];
for (const record of groups.values()) {
  const merged = mergeGeometries(record.geometries);
  if (!merged) throw new Error('Could not merge ' + record.id);
  for (const g of record.geometries) g.dispose();
  const mesh = new THREE.Mesh(merged, materials[record.materialKey ?? record.system]);
  mesh.name = record.id;
  mesh.userData = { structureId: record.id, sourceComponents: record.sourceComponents, system: record.system };
  scene.add(mesh);
  structures.push({ id: record.id, nameZh: record.nameZh, nameEn: record.nameEn, system: record.system,
    description: 'BodyParts3D 全身数据子集。颜色与分类为演示表达，中文名称未经医学专家校订。',
    defaultVisible: true, defaultOpacity: record.defaultOpacity ?? 1,
    sourceComponents: record.sourceComponents });
}
const bounds = new THREE.Box3().setFromObject(scene);
const center = bounds.getCenter(new THREE.Vector3());
scene.children.forEach(mesh => { mesh.geometry.translate(-center.x, -center.y, -center.z); });
let triangles = 0, vertices = 0;
scene.traverse(obj => { if (obj.isMesh) { vertices += obj.geometry.attributes.position.count; triangles += (obj.geometry.index?.count ?? obj.geometry.attributes.position.count) / 3; } });

// The exporter uses the standard FileReader API to serialize its binary buffers.
globalThis.FileReader ??= class {
  async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
  async readAsDataURL(blob) { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64'); this.onloadend?.(); }
};
const binary = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false });
await fs.mkdir(output, { recursive: true });
// Skip an unchanged binary, avoiding unnecessary hot-reloads and file locks.
const finalPath = path.join(output, 'anatomy.glb');
const tempPath = path.join(output, 'anatomy.glb.tmp');
const finalBuffer = Buffer.from(binary);
let previous;
try { previous = await fs.readFile(finalPath); } catch { /* First generation. */ }
if (!previous?.equals(finalBuffer)) {
  // Write and rename so a live preview never reads a partial GLB. Windows may
  // briefly lock a served file; bounded retries cover an in-flight HTTP read.
  await fs.writeFile(tempPath, finalBuffer);
  let replaced = false;
  for (let retry = 0; retry < 15; retry++) {
    try { await fs.rename(tempPath, finalPath); replaced = true; break; }
    catch (error) { if (!['EPERM', 'EBUSY'].includes(error.code)) throw error; }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!replaced) throw new Error('Windows locked anatomy.glb. Close its preview/server and rerun generate:model.');
} else {
  await fs.unlink(tempPath).catch(() => {});
}
const manifest = {
  label: 'BodyParts3D 全身解剖', source: 'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan', schematic: false,
  license: 'CC BY-SA 2.1 Japan',
  attribution: 'BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan',
  limitations: '来自公开人体数据的简化网格；全身骨骼、主要血管、部分内脏与皮肤；未覆盖所有组织、血管和器官；中文名称及分类未经医学专家审核，仅供交互演示。',
  structures,
  stats: { structures: structures.length, sourceComponents: componentCount, meshes: scene.children.length,
    triangles, vertices, inputTriangles, glbBytes: binary.byteLength,
    dimensions: bounds.getSize(new THREE.Vector3()).toArray(), systems: Object.fromEntries(['bones','arteries','veins','organs','skin'].map(s => [s, structures.filter(x => x.system === s).length])) },
};
await fs.writeFile(path.join(output, 'anatomy.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify(manifest.stats, null, 2));
console.log('Wrote public/models/anatomy.glb and anatomy.json');
scene.traverse(obj => { if (obj.isMesh) obj.geometry.dispose(); });
Object.values(materials).forEach(m => m.dispose());

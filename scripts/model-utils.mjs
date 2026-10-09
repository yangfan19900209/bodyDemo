import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
export { THREE };
export const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const source = path.join(project, 'scripts/source');
export const output = path.join(project, 'public/models');
export const CORE_HASH = '1732bb2d918ef48c49498cc2fb5d9ab388a3bf7200e1dc83bc2fdbf0e98f4463';
export const readJson = async file => JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export async function assertCore() {
  const bytes = await fs.readFile(path.join(output, 'anatomy.glb'));
  if (sha256(bytes) !== CORE_HASH) throw new Error('The protected V1 core GLB changed. Restore the verified core before generating additions.');
  return bytes;
}
export async function readSource(item) {
  const bytes = await fs.readFile(path.join(source, item.filename));
  const geometries = [];
  let header;
  if (item.filename.endsWith('.stl')) {
    geometries.push(new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
    // STL's facet normals are rebuilt after position welding for smooth surfaces.
    geometries[0].deleteAttribute('normal');
    header = { version: '3.0', nameEn: item.nameEn, fmaId: item.id, verification: 'STL filename matched the primary BodyParts3D 3.0 parts_list_e.txt ontology name' };
  } else {
    const text = bytes.toString('utf8');
    if (/^version https:\/\/git-lfs/.test(text)) throw new Error('Source is an LFS pointer, not geometry');
    const extract = label => text.match(new RegExp('^# ' + label + '\\s*:\\s*(.+)$', 'm'))?.[1]?.trim();
    header = { version: extract('Compatibility version'), nameEn: extract('English name'), fmaId: extract('Concept ID'), bpId: extract('Representation ID'), fileId: extract('File ID'),
      historicalLicenseHeader: text.includes('Creative Commons Attribution-Share Alike 2.1 Japan') };
    if (header.fileId !== item.id || !header.nameEn || !header.fmaId) throw new Error('Source identity header could not be verified for ' + item.id);
    const object = new OBJLoader().parse(text);
    object.traverse(mesh => { if (mesh.isMesh) geometries.push(mesh.geometry); });
  }
  if (!geometries.length || geometries.some(g => !g.attributes.position?.count)) throw new Error('Source has no actual mesh');
  const sourceBounds = new THREE.Box3();
  for (const geometry of geometries) { geometry.computeBoundingBox(); sourceBounds.union(geometry.boundingBox); }
  return { geometries, header, sourceBounds, sourceBytes: bytes.length, sourceSha256: sha256(bytes) };
}
export async function simplify(geometry, ratio, errorMm) {
  await MeshoptSimplifier.ready;
  geometry.deleteAttribute('uv');
  let welded = mergeVertices(geometry, 0.0001);
  geometry.dispose();
  if (!welded.attributes.normal) welded.computeVertexNormals();
  const indices = new Uint32Array(welded.index.array);
  const target = Math.max(64, Math.floor(indices.length / 3 * ratio)) * 3;
  if (target >= indices.length) return welded;
  const [reduced] = MeshoptSimplifier.simplify(indices, welded.attributes.position.array, 3, target, errorMm, ['ErrorAbsolute', 'Permissive']);
  const [remap, vertexCount] = MeshoptSimplifier.compactMesh(reduced);
  const compact = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) {
    const attribute = welded.getAttribute(name), buffer = new Float32Array(vertexCount * 3);
    for (let j = 0; j < Math.min(attribute.count, remap.length); j++) if (remap[j] !== 0xffffffff && remap[j] < vertexCount) buffer.set(attribute.array.subarray(j * 3, j * 3 + 3), remap[j] * 3);
    compact.setAttribute(name, new THREE.BufferAttribute(buffer, 3));
  }
  if (reduced.some(index => index >= vertexCount)) throw new Error('Invalid meshoptimizer compact remap');
  compact.setIndex(Array.from(reduced));
  compact.normalizeNormals();
  welded.dispose();
  return compact;
}
export function applySharedFrame(geometry, frame) {
  geometry.rotateX(frame.rotationX);
  geometry.scale(frame.sourceScale, frame.sourceScale, frame.sourceScale);
  geometry.translate(-frame.center[0], -frame.center[1], -frame.center[2]);
  return geometry;
}
export function merge(items) {
  const merged = mergeGeometries(items);
  if (!merged) throw new Error('Could not merge source component geometries');
  for (const item of items) item.dispose();
  return merged;
}
export async function exportAsset(scene, filename) {
  globalThis.FileReader ??= class {
    async readAsArrayBuffer(blob) { this.result = await blob.arrayBuffer(); this.onloadend?.(); }
    async readAsDataURL(blob) { this.result = 'data:' + blob.type + ';base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64'); this.onloadend?.(); }
  };
  const bytes = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: false }));
  const target = path.join(output, filename), temporary = target + '.tmp';
  let previous;
  try { previous = await fs.readFile(target); } catch { /* first output */ }
  if (!previous?.equals(bytes)) { await fs.writeFile(temporary, bytes); await fs.rename(temporary, target); }
  let triangles = 0, vertices = 0, structures = 0;
  scene.traverse(mesh => { if (mesh.isMesh) { structures++; vertices += mesh.geometry.attributes.position.count; triangles += mesh.geometry.index.count / 3; } });
  return { triangles, vertices, bytes: bytes.length, structures, sha256: sha256(bytes) };
}

import { Box3, Group, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AnatomyStructure, ModelManifest } from '../data/anatomy';

export interface LoadedAnatomy {
  root: Group;
  manifest: ModelManifest;
  meshes: Map<string, Mesh[]>;
}

export async function loadAnatomy(onProgress: (progress: number, message: string) => void): Promise<LoadedAnatomy> {
  onProgress(0.03, '正在读取本地图谱…');
  const response = await fetch(`${import.meta.env.BASE_URL}models/anatomy.json`);
  if (!response.ok) throw new Error(`结构目录加载失败 (${response.status})`);
  const manifest = await response.json() as ModelManifest;
  if (!Array.isArray(manifest.structures) || !manifest.structures.length) throw new Error('模型结构目录为空');
  const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/anatomy.glb`, (event) => {
    onProgress(event.total ? 0.1 + event.loaded / event.total * 0.78 : 0.4, '正在加载全身骨骼、血管、内脏和皮肤…');
  });
  const root = gltf.scene;
  const metadata = new Map<string, AnatomyStructure>(manifest.structures.map((item) => [item.id, item]));
  const meshes = new Map<string, Mesh[]>();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const id = object.userData.structureId as string;
    if (!metadata.has(id)) return;
    const structure = metadata.get(id)!;
    object.receiveShadow = true;
    object.userData.boneShadow = structure.system === 'bones';
    // Own each material: shared GLB materials must never couple opacity or highlight.
    const sources = Array.isArray(object.material) ? object.material : [object.material];
    const copies = sources.map((material) => {
      const copy = material.clone() as MeshStandardMaterial;
      copy.roughness = structure.system === 'bones' ? 0.64 : structure.system === 'skin' ? 0.78 : structure.system === 'organs' ? 0.58 : 0.38;
      copy.metalness = structure.system === 'skin' || structure.system === 'organs' ? 0 : 0.04;
      return copy;
    });
    object.material = Array.isArray(object.material) ? copies : copies[0]!;
    if (!(gltf.scene.userData.sourceMaterials instanceof Set)) gltf.scene.userData.sourceMaterials = new Set();
    for (const material of sources) (gltf.scene.userData.sourceMaterials as Set<unknown>).add(material);
    const list = meshes.get(id) ?? [];
    list.push(object);
    meshes.set(id, list);
  });
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  if (!meshes.size || !Number.isFinite(size.y) || size.y <= 0) {
    disposeModel(root);
    throw new Error('模型没有可识别的三维结构');
  }
  // One coordinate convention for original assets and future Android WebView imports.
  const center = box.getCenter(new Vector3());
  root.position.sub(center);
  const scale = 12.6 / size.y;
  root.position.multiplyScalar(scale);
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);
  onProgress(0.95, `正在准备 ${meshes.size} 个可交互结构…`);
  return { root, manifest, meshes };
}

export function disposeModel(root: Group): void {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    if (!geometries.has(object.geometry)) { object.geometry.dispose(); geometries.add(object.geometry); }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (materials.has(material)) continue;
      for (const value of Object.values(material)) {
        if (value instanceof Texture && !textures.has(value)) {
          value.dispose();
          textures.add(value);
        }
      }
      material.dispose();
      materials.add(material);
    }
  });
  const originals = root.userData.sourceMaterials as Set<{ dispose: () => void }> | undefined;
  originals?.forEach((material) => material.dispose());
  root.clear();
}

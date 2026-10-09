import { Box3, Group, LoadingManager, Mesh, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AnatomyStructure, AssetState, ModelAsset, ModelManifest, SystemId } from '../data/anatomy';

export interface LoadedAsset {
  scene: Group;
  meshes: Map<string, Mesh[]>;
  triangleCount: number;
}

/** All GLBs attach to ONE transform, derived only from the unchanged V1 core. */
export class AnatomyModelLoader {
  readonly root = new Group();
  readonly meshes = new Map<string, Mesh[]>();
  readonly states = new Map<string, AssetState>();
  readonly loaded = new Map<string, LoadedAsset>();
  manifest?: ModelManifest;
  private readonly pending = new Map<string, Promise<LoadedAsset>>();
  private readonly abort = new AbortController();
  private readonly loadingManager = new LoadingManager();
  private normalized = false;
  private disposed = false;

  constructor(private readonly changed: () => void) { this.root.name = 'Shared anatomy coordinate frame'; }

  async loadManifest(): Promise<ModelManifest> {
    const response = await fetch(`${import.meta.env.BASE_URL}models/anatomy.json`, { signal: this.abort.signal });
    if (!response.ok) throw new Error(`结构目录加载失败 (${response.status})`);
    const manifest = await response.json() as ModelManifest;
    if (!Array.isArray(manifest.structures) || !manifest.structures.length) throw new Error('模型结构目录为空');
    if (new Set(manifest.structures.map((s) => s.id)).size !== manifest.structures.length) throw new Error('模型结构 ID 重复');
    manifest.assets ??= [{ id: 'core', file: 'anatomy.glb', initial: true, structureIds: manifest.structures.map((s) => s.id) }];
    for (const structure of manifest.structures) {
      structure.assetId ??= manifest.assets.find((asset) => asset.structureIds.includes(structure.id))?.id ?? 'core';
    }
    for (const asset of manifest.assets) {
      asset.systemIds ??= [...new Set(manifest.structures.filter((s) => s.assetId === asset.id).map((s) => s.system))];
      this.states.set(asset.id, { status: asset.file && asset.structureIds.length ? 'unloaded' : 'unavailable', progress: 0, loadTimeMs: 0 });
    }
    if (!manifest.assets.some((asset) => asset.id === 'core' && asset.initial)) throw new Error('资源目录缺少原有核心模型');
    this.manifest = manifest;
    this.changed();
    return manifest;
  }

  assetsForSystem(system: SystemId): ModelAsset[] {
    return this.manifest?.assets?.filter((asset) => asset.systemIds?.includes(system)) ?? [];
  }

  async ensureSystem(system: SystemId): Promise<void> {
    await Promise.all(this.assetsForSystem(system).map((asset) => this.loadAsset(asset.id)));
  }

  loadAsset(id: string): Promise<LoadedAsset> {
    const cached = this.loaded.get(id);
    if (cached) return Promise.resolve(cached);
    const active = this.pending.get(id);
    if (active) return active;
    const asset = this.manifest?.assets?.find((item) => item.id === id);
    const state = this.states.get(id);
    if (!asset || !state || state.status === 'unavailable') return Promise.reject(new Error('该系统没有已取得的三维资源'));
    if (!this.normalized && id !== 'core') return Promise.reject(new Error('请等待核心图谱加载完成'));
    const promise = this.readAsset(asset, state);
    this.pending.set(id, promise);
    const cleanup = (): void => { this.pending.delete(id); };
    void promise.then(cleanup, cleanup);
    return promise;
  }

  private async readAsset(asset: ModelAsset, state: AssetState): Promise<LoadedAsset> {
    if (this.disposed) throw new Error('查看器已关闭');
    if (!/^[\w.-]+\.glb$/.test(asset.file)) throw new Error('模型文件必须为本地 GLB');
    const started = performance.now();
    state.status = 'loading'; state.progress = 0; delete state.error;
    this.changed();
    let scene: Group | undefined;
    try {
      const gltf = await new GLTFLoader(this.loadingManager).loadAsync(`${import.meta.env.BASE_URL}models/${asset.file}`, (event) => {
        state.progress = event.total ? Math.min(0.94, event.loaded / event.total * 0.94) : 0.45;
        if (!this.disposed) this.changed();
      });
      scene = gltf.scene;
      if (this.disposed) throw new Error('查看器已关闭');
      const metadata = new Map<string, AnatomyStructure>(this.manifest!.structures.map((s) => [s.id, s]));
      const expected = new Set(asset.structureIds);
      const meshes = new Map<string, Mesh[]>();
      const bounded = new Set();
      const originals = new Set<{ dispose(): void }>();
      scene.userData.sourceMaterials = originals;
      let triangleCount = 0;
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        const id = object.userData.structureId as string;
        const structure = metadata.get(id);
        if (!expected.has(id) || !structure || structure.assetId !== asset.id) throw new Error(`资源 ${asset.id} 包含未知结构 ${id}`);
        // Measure real vertex buffers once, rather than trusting cached accessor bounds.
        if (!bounded.has(object.geometry)) {
          object.geometry.computeBoundingBox(); object.geometry.computeBoundingSphere();
          bounded.add(object.geometry);
        }
        object.receiveShadow = true;
        object.userData.shadowCaster = structure.system === 'bones' || structure.system === 'muscles';
        object.userData.boneShadow = structure.system === 'bones';
        const sources = Array.isArray(object.material) ? object.material : [object.material];
        const copies = sources.map((material) => {
          originals.add(material);
          const copy = material.clone() as MeshStandardMaterial;
          copy.roughness = structure.system === 'skin' ? 0.78 : ['bones', 'muscles', 'connective'].includes(structure.system) ? 0.64 : structure.system === 'organs' ? 0.58 : 0.38;
          copy.metalness = ['skin', 'organs', 'muscles', 'nerves', 'connective'].includes(structure.system) ? 0 : 0.04;
          return copy;
        });
        object.material = Array.isArray(object.material) ? copies : copies[0]!;
        const list = meshes.get(id) ?? [];
        list.push(object); meshes.set(id, list);
        triangleCount += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      });
      if (!meshes.size || [...expected].some((id) => !meshes.has(id))) throw new Error(`资源 ${asset.id} 缺少已登记的三维结构`);
      if (asset.id === 'core') {
        const bounds = new Box3().setFromObject(scene);
        const height = bounds.getSize(new Vector3()).y;
        if (!Number.isFinite(height) || height <= 0) throw new Error('核心模型尺寸无效');
        const scale = 12.6 / height;
        this.root.position.copy(bounds.getCenter(new Vector3())).multiplyScalar(-scale);
        this.root.scale.setScalar(scale);
        this.normalized = true;
      }
      // No centering or normalization here for extra resources.
      this.root.add(scene);
      this.root.updateMatrixWorld(true);
      const loaded = { scene, meshes, triangleCount };
      meshes.forEach((list, id) => this.meshes.set(id, list));
      this.loaded.set(asset.id, loaded);
      state.status = 'loaded'; state.progress = 1; state.loadTimeMs = performance.now() - started;
      this.changed();
      return loaded;
    } catch (error) {
      if (scene) { this.root.remove(scene); disposeModel(scene); }
      state.status = 'error'; state.error = error instanceof Error ? error.message : '模型加载失败';
      state.loadTimeMs = performance.now() - started;
      if (!this.disposed) this.changed();
      throw error;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.abort.abort();
    this.loadingManager.abort();
    this.loaded.forEach((asset) => disposeModel(asset.scene));
    this.loaded.clear(); this.meshes.clear(); this.root.clear();
  }
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
        if (value instanceof Texture && !textures.has(value)) { value.dispose(); textures.add(value); }
      }
      material.dispose(); materials.add(material);
    }
  });
  (root.userData.sourceMaterials as Set<{ dispose(): void }> | undefined)?.forEach((material) => material.dispose());
  root.clear();
}

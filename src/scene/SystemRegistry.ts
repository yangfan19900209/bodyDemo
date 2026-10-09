import { SYSTEMS } from '../data/anatomy';
import type { ModelManifest, SystemDefinition, SystemId, SystemState } from '../data/anatomy';
import type { AnatomyModelLoader } from './ModelLoader';
import type { SelectionManager } from './SelectionManager';

/** Systems are registered from real structure/asset membership, never index candidates. */
export class SystemRegistry {
  readonly definitions: SystemDefinition[];
  private readonly members = new Map<SystemId, string[]>();

  constructor(manifest: ModelManifest) {
    this.definitions = SYSTEMS.map((definition) => ({ ...definition, ...manifest.systems?.find((s) => s.id === definition.id) }));
    for (const structure of manifest.structures) {
      const ids = this.members.get(structure.system) ?? [];
      ids.push(structure.id); this.members.set(structure.system, ids);
    }
  }

  available(system: SystemId): boolean { return !!this.members.get(system)?.length; }

  describe(system: SystemId, loader: AnatomyModelLoader, selection?: SelectionManager): SystemState {
    const ids = this.members.get(system) ?? [];
    const assets = loader.assetsForSystem(system).map((asset) => loader.states.get(asset.id)!);
    const loadedCount = ids.filter((id) => selection?.isLoaded(id)).length;
    const count = ids.filter((id) => selection?.isLoaded(id) && selection.states.get(id)?.visible).length;
    const status = !ids.length || !assets.length || assets.every((asset) => asset.status === 'unavailable') ? 'unavailable'
      : assets.some((asset) => asset.status === 'error') ? 'error'
      : assets.some((asset) => asset.status === 'loading') ? 'loading'
      : assets.every((asset) => asset.status === 'loaded') ? 'loaded' : 'unloaded';
    return {
      visible: ids.some((id) => selection?.states.get(id)?.visible), count,
      opacity: selection?.getOpacity(system) ?? 1, totalCount: ids.length, loadedCount,
      status, progress: assets.length ? assets.reduce((sum, asset) => sum + asset.progress, 0) / assets.length : 0,
      error: assets.find((asset) => asset.error)?.error,
    };
  }
}

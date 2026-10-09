import { Box3, Color, Mesh, MeshStandardMaterial } from 'three';
import { LAYER_PRESETS } from '../data/anatomy';
import type { AnatomyStructure, LayerPreset, SystemId } from '../data/anatomy';

interface StructureState { visible: boolean; opacity: number }
interface Snapshot { states: Map<string, StructureState>; selected: Set<string>; isolation?: Map<string, boolean> }

/** Desired state exists before a resource arrives; registering meshes never overrides it. */
export class SelectionManager {
  readonly selected = new Set<string>();
  readonly states = new Map<string, StructureState>();
  readonly metadata: Map<string, AnatomyStructure>;
  readonly systemIds = new Map<SystemId, string[]>();
  private readonly boxes = new Map<string, Box3>();
  private readonly registered = new Set<string>();
  private readonly dirty = new Set<string>();
  private readonly originalGlow = new WeakMap<MeshStandardMaterial, { color: Color; intensity: number }>();
  private history: Snapshot[] = [];
  private isolation?: Map<string, boolean>;
  multiSelect = false;
  shadowRevision = 0;

  constructor(readonly meshes: Map<string, Mesh[]>, readonly structures: AnatomyStructure[], private changed: (appearance: boolean) => void) {
    this.metadata = new Map(structures.map((s) => [s.id, s]));
    for (const structure of structures) {
      this.states.set(structure.id, this.presetState(structure, 'all'));
      const list = this.systemIds.get(structure.system) ?? [];
      list.push(structure.id); this.systemIds.set(structure.system, list);
    }
    this.registerMeshes();
  }

  registerMeshes(): void {
    let added = false;
    this.meshes.forEach((list, id) => {
      if (this.registered.has(id)) return;
      const box = new Box3();
      list.forEach((mesh) => box.expandByObject(mesh));
      this.boxes.set(id, box); this.registered.add(id); this.dirty.add(id); added = true;
    });
    if (added) this.apply();
  }

  isLoaded(id: string): boolean { return this.registered.has(id); }
  get isolated(): boolean { return !!this.isolation; }
  get canUndo(): boolean { return this.history.length > 0; }
  get preset(): LayerPreset | 'custom' {
    if (this.isolated) return 'custom';
    return LAYER_PRESETS.find((preset) => [...this.states].every(([id, state]) => {
      const expected = this.presetState(this.metadata.get(id)!, preset);
      return state.visible === expected.visible && Math.abs(state.opacity - expected.opacity) < 0.001;
    })) ?? 'custom';
  }

  private presetState(structure: AnatomyStructure, preset: LayerPreset): StructureState {
    const initial = { visible: structure.defaultVisible ?? true, opacity: structure.defaultOpacity ?? 1 };
    if (preset === 'all') return initial;
    const system = structure.system;
    if (preset === 'muscles' || preset === 'nerves') {
      return { visible: system === preset || system === 'bones', opacity: system === preset ? 1 : system === 'bones' ? 0.2 : initial.opacity };
    }
    const visible = preset === 'vascular' ? ['bones', 'arteries', 'veins'].includes(system) : system === preset;
    return { visible, opacity: visible ? 1 : initial.opacity };
  }

  private setState(id: string, next: StructureState): void {
    const state = this.states.get(id);
    if (!state || (state.visible === next.visible && Math.abs(state.opacity - next.opacity) < 0.00001)) return;
    Object.assign(state, next); this.dirty.add(id);
  }

  setPreset(preset: LayerPreset): void {
    this.save();
    this.states.forEach((_state, id) => this.setState(id, this.presetState(this.metadata.get(id)!, preset)));
    this.clearSelected(); this.isolation = undefined; this.apply();
  }

  select(id: string, toggle = true): void {
    if (!this.states.has(id)) return;
    if (!this.states.get(id)!.visible) {
      this.save();
      if (this.isolation) {
        this.isolation.forEach((visible, oldId) => this.setState(oldId, { ...this.states.get(oldId)!, visible }));
        this.isolation = undefined;
      }
      this.setState(id, { ...this.states.get(id)!, visible: true });
    }
    if (!this.multiSelect) this.clearSelected();
    if (this.multiSelect && toggle && this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.dirty.add(id); this.apply();
  }

  private clearSelected(): void {
    this.selected.forEach((id) => this.dirty.add(id)); this.selected.clear();
  }
  clear(): void { this.clearSelected(); this.apply(); }
  setMultiSelect(enabled: boolean): void {
    this.multiSelect = enabled;
    if (!enabled && this.selected.size > 1) {
      const last = [...this.selected].at(-1)!;
      this.clearSelected(); this.selected.add(last); this.dirty.add(last);
    }
    this.apply();
  }

  private save(): void {
    this.history.push({ states: new Map([...this.states].map(([id, state]) => [id, { ...state }])), selected: new Set(this.selected), isolation: this.isolation ? new Map(this.isolation) : undefined });
    if (this.history.length > 30) this.history.shift();
  }

  hideSelected(): void {
    if (!this.selected.size) return;
    this.save();
    this.selected.forEach((id) => this.setState(id, { ...this.states.get(id)!, visible: false }));
    this.clearSelected(); this.apply();
  }

  restoreSelected(): void {
    if (!this.selected.size) return;
    this.save();
    this.selected.forEach((id) => this.setState(id, { visible: true, opacity: this.metadata.get(id)!.defaultOpacity ?? 1 }));
    this.apply();
  }

  toggleSystem(system: SystemId): boolean {
    const ids = this.systemIds.get(system) ?? [];
    const show = !ids.some((id) => this.states.get(id)!.visible);
    if (!ids.length) return false;
    this.save(); this.isolation = undefined;
    ids.forEach((id) => {
      this.setState(id, { ...this.states.get(id)!, visible: show });
      if (!show && this.selected.delete(id)) this.dirty.add(id);
    });
    this.apply(); return show;
  }

  isolate(): void {
    if (this.isolation) {
      this.save();
      const previous = this.isolation; this.isolation = undefined;
      previous.forEach((visible, id) => this.setState(id, { ...this.states.get(id)!, visible }));
    } else {
      if (!this.selected.size) return;
      this.save(); this.isolation = new Map([...this.states].map(([id, state]) => [id, state.visible]));
      this.states.forEach((state, id) => this.setState(id, { ...state, visible: this.selected.has(id) }));
    }
    this.apply();
  }

  undo(): void {
    const snapshot = this.history.pop();
    if (!snapshot) return;
    snapshot.states.forEach((state, id) => this.setState(id, state));
    this.clearSelected(); snapshot.selected.forEach((id) => { this.selected.add(id); this.dirty.add(id); });
    this.isolation = snapshot.isolation; this.apply();
  }

  setOpacity(target: SystemId | 'selection', opacity: number): void {
    const ids = target === 'selection' ? [...this.selected] : this.systemIds.get(target) ?? [];
    ids.forEach((id) => this.setState(id, { ...this.states.get(id)!, opacity: Math.max(0.05, Math.min(1, opacity)) }));
    this.apply();
  }
  getOpacity(target: SystemId | 'selection'): number {
    const ids = target === 'selection' ? [...this.selected] : this.systemIds.get(target) ?? [];
    return ids.length ? ids.reduce((sum, id) => sum + this.states.get(id)!.opacity, 0) / ids.length : 1;
  }

  reset(): void {
    this.states.forEach((_state, id) => this.setState(id, this.presetState(this.metadata.get(id)!, 'all')));
    this.clearSelected(); this.isolation = undefined; this.history = []; this.multiSelect = false; this.apply();
  }

  bounds(ids?: Iterable<string>): Box3 {
    const box = new Box3();
    for (const id of ids ?? this.states.keys()) {
      if (this.states.get(id)?.visible && this.boxes.has(id)) box.union(this.boxes.get(id)!);
    }
    return box;
  }
  structureBounds(id: string): Box3 | null { return this.boxes.get(id)?.clone() ?? null; }
  pickable(): Mesh[] {
    return [...this.meshes].flatMap(([id, meshes]) => this.states.get(id)?.visible ? meshes : []);
  }
  isGhost(id: string): boolean {
    return ['skin', 'organs', 'muscles'].includes(this.metadata.get(id)?.system ?? '') && (this.states.get(id)?.opacity ?? 1) <= 0.25;
  }

  private apply(): void {
    const glow = new Color('#ddae54');
    const ids = [...this.dirty]; this.dirty.clear();
    ids.forEach((id) => {
      const state = this.states.get(id)!;
      this.meshes.get(id)?.forEach((mesh) => {
        const shadow = mesh.userData.shadowCaster === true && state.visible && state.opacity > 0.9;
        if (mesh.castShadow !== shadow || (mesh.userData.shadowCaster && mesh.visible !== state.visible)) this.shadowRevision++;
        mesh.visible = state.visible; mesh.castShadow = shadow;
        mesh.renderOrder = this.metadata.get(id)?.system === 'skin' && state.opacity < 1 ? 3 : state.opacity < 1 ? 1 : 0;
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
        materials.forEach((material) => {
          if (!this.originalGlow.has(material)) this.originalGlow.set(material, { color: material.emissive.clone(), intensity: material.emissiveIntensity });
          const original = this.originalGlow.get(material)!;
          const transparent = state.opacity < 0.99;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          material.opacity = state.opacity; material.depthWrite = !transparent;
          material.emissive.copy(this.selected.has(id) ? glow : original.color);
          material.emissiveIntensity = this.selected.has(id) ? 0.35 : original.intensity;
        });
      });
    });
    this.changed(ids.some((id) => this.registered.has(id)));
  }
}

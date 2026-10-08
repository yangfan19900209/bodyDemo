import { Box3, Color, Mesh, MeshStandardMaterial } from 'three';
import type { AnatomyStructure, LayerPreset, SystemId } from '../data/anatomy';

interface StructureState { visible: boolean; opacity: number }
interface Snapshot { states: Map<string, StructureState>; selected: Set<string>; isolation?: Map<string, boolean> }

export class SelectionManager {
  readonly selected = new Set<string>();
  readonly states = new Map<string, StructureState>();
  private history: Snapshot[] = [];
  private isolation?: Map<string, boolean>;
  private readonly metadata: Map<string, AnatomyStructure>;
  private readonly boxes = new Map<string, Box3>();
  multiSelect = false;

  constructor(readonly meshes: Map<string, Mesh[]>, readonly structures: AnatomyStructure[], private changed: () => void) {
    this.metadata = new Map(structures.map((structure) => [structure.id, structure]));
    meshes.forEach((list, id) => {
      this.states.set(id, this.presetState(this.metadata.get(id)!, 'all'));
      const box = new Box3();
      list.forEach((mesh) => box.expandByObject(mesh));
      this.boxes.set(id, box);
    });
    this.apply();
  }

  get isolated(): boolean { return !!this.isolation; }
  get canUndo(): boolean { return this.history.length > 0; }
  get preset(): LayerPreset | 'custom' {
    if (this.isolated) return 'custom';
    for (const preset of ['all', 'vascular', 'organs', 'skin'] as const) {
      const matches = [...this.states].every(([id, state]) => {
        const expected = this.presetState(this.metadata.get(id)!, preset);
        return state.visible === expected.visible && Math.abs(state.opacity - expected.opacity) < 0.001;
      });
      if (matches) return preset;
    }
    return 'custom';
  }

  private presetState(structure: AnatomyStructure, preset: LayerPreset): StructureState {
    const initial = { visible: structure.defaultVisible ?? true, opacity: structure.defaultOpacity ?? 1 };
    if (preset === 'all') return initial;
    const visible = preset === 'vascular'
      ? ['bones', 'arteries', 'veins'].includes(structure.system)
      : structure.system === preset;
    return { visible, opacity: visible ? 1 : initial.opacity };
  }

  setPreset(preset: LayerPreset): void {
    this.save();
    this.states.forEach((state, id) => Object.assign(state, this.presetState(this.metadata.get(id)!, preset)));
    this.selected.clear();
    this.isolation = undefined;
    this.apply();
  }

  select(id: string, toggle = true): void {
    if (!this.states.has(id)) return;
    if (!this.states.get(id)!.visible) {
      this.save();
      if (this.isolation) {
        this.isolation.forEach((visible, previousId) => { this.states.get(previousId)!.visible = visible; });
        this.isolation = undefined;
      }
      this.states.get(id)!.visible = true;
    }
    if (!this.multiSelect) this.selected.clear();
    if (this.multiSelect && toggle && this.selected.has(id)) this.selected.delete(id);
    else this.selected.add(id);
    this.apply();
  }

  clear(): void { this.selected.clear(); this.apply(); }
  setMultiSelect(enabled: boolean): void {
    this.multiSelect = enabled;
    if (!enabled && this.selected.size > 1) {
      const last = [...this.selected].at(-1)!;
      this.selected.clear(); this.selected.add(last);
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
    this.selected.forEach((id) => { this.states.get(id)!.visible = false; });
    this.selected.clear();
    this.apply();
  }

  toggleSystem(system: SystemId): void {
    const ids = this.structures.filter((item) => item.system === system && this.states.has(item.id)).map((item) => item.id);
    const show = !ids.some((id) => this.states.get(id)!.visible);
    this.save();
    // Editing visibility exits isolation while preserving exactly the current visible scene.
    this.isolation = undefined;
    ids.forEach((id) => {
      this.states.get(id)!.visible = show;
      if (!show) this.selected.delete(id);
    });
    this.apply();
  }

  isolate(): void {
    if (this.isolation) {
      this.save();
      const previous = this.isolation;
      this.isolation = undefined;
      previous.forEach((visible, id) => { this.states.get(id)!.visible = visible; });
    } else {
      if (!this.selected.size) return;
      this.save();
      this.isolation = new Map([...this.states].map(([id, state]) => [id, state.visible]));
      this.states.forEach((state, id) => { state.visible = this.selected.has(id); });
    }
    this.apply();
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) return;
    this.states.clear(); previous.states.forEach((state, id) => this.states.set(id, state));
    this.selected.clear(); previous.selected.forEach((id) => this.selected.add(id));
    this.isolation = previous.isolation;
    this.apply();
  }

  setOpacity(target: SystemId | 'selection', opacity: number): void {
    const ids = target === 'selection' ? [...this.selected] : this.structures.filter((s) => s.system === target).map((s) => s.id);
    ids.forEach((id) => {
      const state = this.states.get(id);
      if (state) state.opacity = Math.max(0.05, Math.min(1, opacity));
    });
    this.apply();
  }

  getOpacity(target: SystemId | 'selection'): number {
    const ids = target === 'selection' ? [...this.selected] : this.structures.filter((s) => s.system === target).map((s) => s.id);
    const values = ids.flatMap((id) => this.states.has(id) ? [this.states.get(id)!.opacity] : []);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1;
  }

  reset(): void {
    this.states.forEach((state, id) => Object.assign(state, this.presetState(this.metadata.get(id)!, 'all')));
    this.selected.clear(); this.isolation = undefined; this.history = []; this.multiSelect = false;
    this.apply();
  }

  bounds(ids?: Iterable<string>): Box3 {
    const box = new Box3();
    for (const id of ids ?? this.states.keys()) {
      if (!this.states.get(id)?.visible) continue;
      const structureBox = this.boxes.get(id);
      if (structureBox) box.union(structureBox);
    }
    return box;
  }

  pickable(): Mesh[] {
    return [...this.meshes].flatMap(([id, meshes]) => {
      const state = this.states.get(id);
      if (!state?.visible) return [];
      const system = this.metadata.get(id)?.system;
      // A faint outer layer should reveal and allow picking the anatomy inside.
      // Isolated ghost structures remain directly selectable.
      const ghost = (system === 'skin' || system === 'organs') && state.opacity <= 0.25;
      if (ghost && !(this.isolated && this.selected.has(id))) return [];
      return meshes;
    });
  }

  structureBounds(id: string): Box3 { return this.boxes.get(id)?.clone() ?? new Box3(); }

  private apply(): void {
    const glow = new Color('#ddae54');
    this.meshes.forEach((meshes, id) => {
      const state = this.states.get(id)!;
      meshes.forEach((mesh) => {
        mesh.visible = state.visible;
        mesh.castShadow = mesh.userData.boneShadow === true && state.opacity > 0.9;
        mesh.renderOrder = this.metadata.get(id)?.system === 'skin' && state.opacity < 1 ? 3 : state.opacity < 1 ? 1 : 0;
        const materials = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
        for (const material of materials) {
          const transparent = state.opacity < 0.99;
          if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
          material.opacity = state.opacity;
          material.depthWrite = !transparent;
          material.emissive.copy(this.selected.has(id) ? glow : new Color(0));
          material.emissiveIntensity = this.selected.has(id) ? 0.42 : 0;
        }
      });
    });
    this.changed();
  }
}

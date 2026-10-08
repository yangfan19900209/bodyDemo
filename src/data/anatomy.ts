export type SystemId = 'bones' | 'arteries' | 'veins' | 'organs' | 'skin';
export type LayerPreset = 'all' | 'vascular' | 'organs' | 'skin';

export interface AnatomyStructure {
  id: string;
  nameZh: string;
  nameEn: string;
  system: SystemId;
  description: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
}

export interface ModelManifest {
  label: string;
  source: string;
  schematic: boolean;
  structures: AnatomyStructure[];
  stats?: Record<string, number>;
}

export const SYSTEMS: { id: SystemId; name: string; english: string; color: string }[] = [
  { id: 'bones', name: '骨骼系统', english: 'Skeletal system', color: '#d5cebb' },
  { id: 'arteries', name: '动脉系统', english: 'Arterial system', color: '#df535e' },
  { id: 'veins', name: '静脉系统', english: 'Venous system', color: '#548ede' },
  { id: 'organs', name: '内脏层', english: 'Internal organs', color: '#bc877a' },
  { id: 'skin', name: '皮肤层', english: 'Skin surface', color: '#d3ae91' },
];

export interface ViewerState {
  ready: boolean;
  selection: string[];
  multiSelect: boolean;
  isolated: boolean;
  canUndo: boolean;
  systems: Record<SystemId, { visible: boolean; count: number; opacity: number }>;
  visibleCount: number;
  totalCount: number;
  view: 'front' | 'back' | 'left' | 'right';
  preset: LayerPreset | 'custom';
}

export interface ViewerActions {
  select(id: string, focus?: boolean): void;
  clearSelection(): void;
  setMultiSelect(enabled: boolean): void;
  toggleSystem(system: SystemId): void;
  setOpacity(target: SystemId | 'selection', opacity: number): void;
  getOpacity(target: SystemId | 'selection'): number;
  center(): void;
  isolate(): void;
  hideSelected(): void;
  undo(): void;
  reset(): void;
  setView(view: ViewerState['view']): void;
  setAutoRotate(enabled: boolean): void;
  setQuality(high: boolean): void;
  setPreset(preset: LayerPreset): void;
}

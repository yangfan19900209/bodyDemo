export type SystemId = 'bones' | 'arteries' | 'veins' | 'organs' | 'skin' | 'muscles' | 'nerves' | 'connective';
export type LayerPreset = 'all' | 'vascular' | 'organs' | 'skin' | 'bones' | 'muscles' | 'nerves';
export type LoadStatus = 'unloaded' | 'loading' | 'loaded' | 'error' | 'unavailable';
export type TissueType = 'bone' | 'cartilage' | 'muscle' | 'nerve' | 'neural' | 'ganglion' | 'tendon' | 'ligament' | 'fascia' | 'artery' | 'vein' | 'organ' | 'skin';

export interface AnatomyStructure {
  id: string;
  nameZh: string;
  nameEn: string;
  system: SystemId;
  description: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  assetId?: string;
  bodyRegion?: string;
  sourceIds?: string[];
  sourceComponents?: string[];
  tissueType?: TissueType;
  organSystem?: string;
  neuralType?: string;
  anatomicalDescription?: string;
}

export interface ModelStats {
  structures?: number;
  meshes?: number;
  triangles?: number;
  vertices?: number;
  glbBytes?: number;
  bytes?: number;
  dimensions?: number[];
  systems?: Partial<Record<SystemId, number>>;
  [key: string]: unknown;
}

export interface ModelAsset {
  id: string;
  file: string;
  initial: boolean;
  structureIds: string[];
  systemIds?: SystemId[];
  stats?: ModelStats;
  source?: string;
  license?: string;
}

export interface AssetState {
  status: LoadStatus;
  progress: number;
  loadTimeMs: number;
  error?: string;
}

export interface SystemDefinition {
  id: SystemId;
  name: string;
  english: string;
  color: string;
  coverage?: string;
}

export interface ModelManifest {
  label: string;
  source: string;
  schematic: boolean;
  structures: AnatomyStructure[];
  stats?: ModelStats;
  assets?: ModelAsset[];
  systems?: SystemDefinition[];
  schemaVersion?: number;
  frame?: Record<string, unknown>;
}

export const SYSTEMS: SystemDefinition[] = [
  { id: 'bones', name: '骨骼系统', english: 'Skeletal system', color: '#d5cebb' },
  { id: 'muscles', name: '肌肉系统', english: 'Muscular system', color: '#ab6861' },
  { id: 'arteries', name: '动脉系统', english: 'Arterial system', color: '#df535e' },
  { id: 'veins', name: '静脉系统', english: 'Venous system', color: '#548ede' },
  { id: 'nerves', name: '神经系统', english: 'Nervous system', color: '#d3b46f' },
  { id: 'connective', name: '肌腱与韧带', english: 'Connective tissue', color: '#bacbd0' },
  { id: 'organs', name: '内脏层', english: 'Internal organs', color: '#bc877a' },
  { id: 'skin', name: '皮肤层', english: 'Skin surface', color: '#d3ae91' },
];

export const LAYER_PRESETS: LayerPreset[] = ['all', 'bones', 'muscles', 'vascular', 'nerves', 'organs', 'skin'];

export interface SystemState {
  visible: boolean;
  count: number;
  opacity: number;
  status: LoadStatus;
  totalCount: number;
  loadedCount: number;
  progress: number;
  error?: string;
}

/** Browser render counts and CPU submission time, never a device/GPU benchmark. */
export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  loadedAssets: number;
  loadTimeMs: number;
  frameTimeMs: number;
  quality: 'high' | 'low';
  idle: boolean;
  assetLoadTimes: Record<string, number>;
}

export interface ViewerState {
  ready: boolean;
  selection: string[];
  multiSelect: boolean;
  isolated: boolean;
  canUndo: boolean;
  systems: Record<SystemId, SystemState>;
  visibleCount: number;
  totalCount: number;
  view: 'front' | 'back' | 'left' | 'right';
  preset: LayerPreset | 'custom';
  activeSystem: 'all' | SystemId;
  hitCandidates: string[];
  performance: PerformanceStats;
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
  retrySystem(system: SystemId): void;
  setActiveSystem(system: 'all' | SystemId): void;
  chooseHit(id: string): void;
  restoreSelected(): void;
}

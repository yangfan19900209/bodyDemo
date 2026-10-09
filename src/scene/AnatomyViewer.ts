import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, HemisphereLight, PCFSoftShadowMap, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { CameraController } from './CameraController';
import { AnatomyModelLoader } from './ModelLoader';
import { SelectionManager } from './SelectionManager';
import { SystemRegistry } from './SystemRegistry';
import { SYSTEMS } from '../data/anatomy';
import type { LayerPreset, ModelManifest, PerformanceStats, SystemId, ViewerActions, ViewerState } from '../data/anatomy';

interface ViewerEvents {
  state: (state: ViewerState) => void;
  loaded: (manifest: ModelManifest) => void;
  progress: (progress: number, message: string) => void;
  error: (message: string) => void;
  toast: (message: string) => void;
  performance?: (stats: PerformanceStats) => void;
}

export class AnatomyViewer implements ViewerActions {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController: CameraController;
  private readonly raycaster = new Raycaster();
  private readonly observer: ResizeObserver;
  private readonly abort = new AbortController();
  private readonly loader = new AnatomyModelLoader(() => this.resourcesChanged());
  private registry?: SystemRegistry;
  private selection?: SelectionManager;
  private coreReady = false;
  private activeSystem: 'all' | SystemId = 'all';
  private hitCandidates: string[] = [];
  private intent = 0;
  private lastShadowRevision = -1;
  private performanceClock = performance.now();
  private renderedFrames = 0;
  private cpuTime = 0;
  private readonly perf: PerformanceStats = { fps: 0, drawCalls: 0, triangles: 0, loadedAssets: 0, loadTimeMs: 0, frameTimeMs: 0, quality: 'high', idle: true, assetLoadTimes: {} };
  private disposed = false;
  private loading = false;
  private highQuality = true;
  private frame = 0;
  private needsRender = true;
  private pointers = new Set<number>();
  private press?: { x: number; y: number; id: number; moved: boolean; time: number };

  constructor(private readonly container: HTMLElement, private readonly events: ViewerEvents) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // The anatomy and lights are static: regenerate only when visibility changes.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.setClearColor('#05070a', 0);
    this.renderer.domElement.setAttribute('aria-label', '交互式三维人体解剖模型');
    this.renderer.domElement.style.touchAction = 'none';
    container.append(this.renderer.domElement);
    this.cameraController = new CameraController(this.renderer.domElement);
    this.cameraController.controls.addEventListener('change', () => { this.needsRender = true; });

    this.scene.add(new HemisphereLight('#e1eaff', '#73614e', 1.15), new AmbientLight('#ffffff', 0.2));
    const key = new DirectionalLight('#fff1db', 3.1); key.position.set(-6, 9, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 40 });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.bias = -0.00025;
    key.shadow.normalBias = 0.022;
    const fill = new DirectionalLight('#bfd3ff', 0.8); fill.position.set(7, 3, 5);
    const rim = new DirectionalLight('#99b6f4', 1.4); rim.position.set(0, 5, -8);
    this.scene.add(key, fill, rim);
    this.scene.add(this.loader.root);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.bindPointers();
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.events.error('三维渲染上下文已中断，请重新加载页面。');
    }, { signal: this.abort.signal });
    // requestAnimationFrame is throttled by the browser in background tabs.
    // Embedded WebViews may report document.hidden while their surface is visible.
    this.animate();
  }

  async load(): Promise<void> {
    if (this.loading || this.disposed) return;
    this.loading = true;
    try {
      this.events.progress(0.03, '正在读取本地图谱目录…');
      const manifest = await this.loader.loadManifest();
      if (this.disposed) return;
      this.registry = new SystemRegistry(manifest);
      this.events.loaded(manifest);
      this.selection = new SelectionManager(this.loader.meshes, manifest.structures, (appearance) => this.emitState(appearance));
      await this.loader.loadAsset('core');
      if (this.disposed) return;
      this.selection.registerMeshes();
      this.coreReady = true;
      this.cameraController.initialize(new Box3().setFromObject(this.loader.root));
      this.events.progress(1, '本地图谱已准备就绪');
      this.emitState();
      this.needsRender = true;
    } catch (error) {
      if (!this.disposed) this.events.error(error instanceof Error ? error.message : '模型加载失败，请检查本地资源是否完整。');
    } finally { this.loading = false; }
  }

  private resourcesChanged(): void {
    if (this.disposed) return;
    this.selection?.registerMeshes();
    this.perf.loadedAssets = this.loader.loaded.size;
    this.perf.assetLoadTimes = Object.fromEntries([...this.loader.states].map(([id, state]) => [id, state.loadTimeMs]));
    this.perf.loadTimeMs = Object.values(this.perf.assetLoadTimes).reduce((sum, time) => sum + time, 0);
    if (!this.coreReady && this.loading) this.events.progress(0.1 + (this.loader.states.get('core')?.progress ?? 0) * 0.85, '正在加载原有全身图谱…');
    this.emitState(false);
  }

  private resize(): void {
    const { width, height } = this.container.getBoundingClientRect();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.highQuality ? (width < 700 ? 1.5 : 2) : 1));
    this.renderer.setSize(width, height, false);
    this.cameraController.resize(width, height);
    this.needsRender = true;
  }

  private animate = (): void => {
    if (this.disposed) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(this.animate);
    if (this.cameraController.update() || this.needsRender) {
      if (this.lastShadowRevision !== this.selection?.shadowRevision) {
        this.renderer.shadowMap.needsUpdate = true;
        this.lastShadowRevision = this.selection?.shadowRevision ?? -1;
      }
      const started = performance.now();
      this.renderer.render(this.scene, this.cameraController.camera);
      this.cpuTime += performance.now() - started;
      this.renderedFrames++;
      this.perf.drawCalls = this.renderer.info.render.calls;
      this.perf.triangles = this.renderer.info.render.triangles;
      this.needsRender = false;
    }
    const elapsed = performance.now() - this.performanceClock;
    if (elapsed >= 1000) {
      this.perf.fps = this.renderedFrames * 1000 / elapsed;
      this.perf.idle = this.renderedFrames === 0;
      this.perf.frameTimeMs = this.renderedFrames ? this.cpuTime / this.renderedFrames : 0;
      this.events.performance?.({ ...this.perf });
      this.renderedFrames = 0; this.cpuTime = 0; this.performanceClock = performance.now();
    }
  };

  private bindPointers(): void {
    const canvas = this.renderer.domElement;
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', (event) => {
      this.pointers.add(event.pointerId);
      if (this.pointers.size === 1 && event.button === 0) this.press = { x: event.clientX, y: event.clientY, id: event.pointerId, moved: false, time: performance.now() };
      else if (this.press) this.press.moved = true;
    }, options);
    canvas.addEventListener('pointermove', (event) => {
      if (this.press && Math.hypot(event.clientX - this.press.x, event.clientY - this.press.y) > 6) this.press.moved = true;
    }, options);
    const release = (event: PointerEvent): void => {
      this.pointers.delete(event.pointerId);
      if (event.type === 'pointerup' && this.press?.id === event.pointerId && !this.press.moved && performance.now() - this.press.time < 700 && this.pointers.size === 0) {
        this.intent++;
        this.hitCandidates = this.readHitCandidates(event.clientX, event.clientY);
        const hit = this.hitCandidates[0];
        if (hit) this.selection?.select(hit);
        else this.selection?.clear();
      }
      if (!this.pointers.size || this.press?.id === event.pointerId) this.press = undefined;
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
  }

  private pick(x: number, y: number): string | undefined {
    return this.readHitCandidates(x, y)[0];
  }

  readHitCandidates(x: number, y: number): string[] {
    if (!this.selection || !this.coreReady) return [];
    this.scene.updateMatrixWorld(true);
    this.cameraController.camera.updateMatrixWorld(true);
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.cameraController.camera);
    const seen = new Set<string>();
    const hits = this.raycaster.intersectObjects(this.selection.pickable(), false).flatMap((hit) => {
      const id = hit.object.userData.structureId as string;
      if (seen.has(id)) return [];
      seen.add(id);
      return [{ id, distance: hit.distance, preferred: this.activeSystem !== 'all' && this.selection!.metadata.get(id)?.system === this.activeSystem, ghost: this.selection!.isGhost(id) }];
    });
    hits.sort((a, b) => Number(b.preferred) - Number(a.preferred) || Number(a.ghost) - Number(b.ghost) || a.distance - b.distance);
    return hits.slice(0, 12).map((hit) => hit.id);
  }

  select(id: string, focus = false): void {
    if (!this.coreReady || !this.selection?.metadata.has(id)) return;
    const intent = ++this.intent;
    this.hitCandidates = [];
    this.selection?.select(id, !focus);
    const assetId = this.selection.metadata.get(id)!.assetId ?? 'core';
    void this.loader.loadAsset(assetId).then(() => {
      if (!this.disposed && intent === this.intent && focus && this.selection?.selected.has(id)) this.cameraController.fit(this.selection.bounds([id]));
    }).catch((error: unknown) => this.resourceError(error));
  }
  clearSelection(): void { this.intent++; this.hitCandidates = []; this.selection?.clear(); }
  setMultiSelect(enabled: boolean): void { this.selection?.setMultiSelect(enabled); }
  toggleSystem(system: SystemId): void {
    if (!this.coreReady) return;
    if (!this.registry?.available(system)) { this.events.toast('该系统暂无可核查的三维资源'); return; }
    this.intent++; this.hitCandidates = [];
    if (this.selection?.toggleSystem(system)) void this.loader.ensureSystem(system).catch((error: unknown) => this.resourceError(error));
  }
  retrySystem(system: SystemId): void {
    if (!this.coreReady || !this.registry?.available(system)) return;
    const intent = this.intent;
    void this.loader.ensureSystem(system).then(() => {
      if (!this.disposed && intent === this.intent && this.selection?.selected.size) this.center();
    }).catch((error: unknown) => this.resourceError(error));
  }
  private resourceError(error: unknown): void {
    if (!this.disposed) this.events.toast(`${error instanceof Error ? error.message : '系统加载失败'}，可在图层面板重试`);
  }
  setActiveSystem(system: 'all' | SystemId): void {
    if (system !== 'all' && !this.registry?.available(system)) return;
    this.activeSystem = system; this.hitCandidates = []; this.emitState();
  }
  chooseHit(id: string): void {
    if (!this.hitCandidates.includes(id) || !this.selection?.isLoaded(id) || !this.selection.states.get(id)?.visible) return;
    this.intent++; this.selection.select(id);
  }
  restoreSelected(): void { this.intent++; this.selection?.restoreSelected(); }
  setPreset(preset: LayerPreset): void {
    if (!this.coreReady) return;
    if (['muscles', 'nerves'].includes(preset) && !this.registry?.available(preset as SystemId)) {
      this.events.toast('该观察模式暂无实际三维数据'); return;
    }
    const intent = ++this.intent;
    this.activeSystem = 'all'; this.hitCandidates = [];
    this.selection?.setPreset(preset);
    const required = this.loader.manifest?.assets?.filter((asset) => asset.structureIds.some((id) => this.selection?.states.get(id)?.visible)) ?? [];
    void Promise.all(required.map((asset) => this.loader.loadAsset(asset.id))).then(() => {
      if (!this.disposed && intent === this.intent) this.fitVisible();
    }).catch((error: unknown) => this.resourceError(error));
  }
  setOpacity(target: SystemId | 'selection', opacity: number): void { this.selection?.setOpacity(target, opacity); }
  getOpacity(target: SystemId | 'selection'): number { return this.selection?.getOpacity(target) ?? 1; }
  center(): void {
    this.intent++;
    this.fitVisible();
  }
  private fitVisible(): void {
    if (!this.selection) return;
    const box = this.selection.bounds(this.selection.selected.size ? this.selection.selected : undefined);
    if (box.isEmpty()) { this.events.toast('所有结构已隐藏，请开启一个系统或重置视图'); return; }
    this.cameraController.fit(box);
  }
  isolate(): void {
    if (!this.selection?.selected.size && !this.selection?.isolated) { this.events.toast('请先点选或搜索一个结构'); return; }
    this.intent++; this.hitCandidates = []; this.selection?.isolate();
  }
  hideSelected(): void {
    if (!this.selection?.selected.size) { this.events.toast('请先点选需要隐藏的结构'); return; }
    const count = this.selection.selected.size;
    this.intent++; this.hitCandidates = [];
    this.selection.hideSelected();
    this.events.toast(`已隐藏 ${count} 个结构，可撤销恢复`);
  }
  undo(): void { this.intent++; this.hitCandidates = []; this.selection?.undo(); }
  reset(): void {
    this.intent++; this.hitCandidates = []; this.activeSystem = 'all';
    this.selection?.reset(); this.cameraController.reset(); this.emitState();
    this.events.toast('已恢复初始视图和全部结构');
  }
  setView(view: ViewerState['view']): void {
    this.intent++;
    if (!this.selection) return;
    const box = this.selection.bounds();
    if (box.isEmpty()) { this.events.toast('请先开启一个系统'); return; }
    this.cameraController.setView(view, box); this.emitState();
  }
  setAutoRotate(enabled: boolean): void { this.cameraController.controls.autoRotate = enabled; }
  setQuality(high: boolean): void {
    this.highQuality = high;
    this.perf.quality = high ? 'high' : 'low';
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  private state(): ViewerState {
    const systems = Object.fromEntries(SYSTEMS.map(({ id }) => {
      return [id, this.registry?.describe(id, this.loader, this.selection) ?? { visible: false, count: 0, opacity: 1, status: 'unavailable', totalCount: 0, loadedCount: 0, progress: 0 }];
    })) as ViewerState['systems'];
    return {
      ready: this.coreReady, selection: [...this.selection?.selected ?? []], multiSelect: this.selection?.multiSelect ?? false,
      isolated: this.selection?.isolated ?? false, canUndo: this.selection?.canUndo ?? false, systems,
      visibleCount: [...this.selection?.states ?? []].filter(([id, state]) => state.visible && this.selection?.isLoaded(id)).length,
      totalCount: this.selection?.states.size ?? 0, view: this.cameraController.view, preset: this.selection?.preset ?? 'all',
      activeSystem: this.activeSystem, hitCandidates: [...this.hitCandidates], performance: { ...this.perf },
    };
  }
  private emitState(appearance = true): void {
    if (this.disposed) return;
    if (appearance) this.needsRender = true;
    this.events.state(this.state());
  }

  /** Read-only inspection for reproducible scene validation. No UI bypass commands. */
  debugSnapshot(): object {
    const transform = { position: this.loader.root.position.toArray(), scale: this.loader.root.scale.toArray() };
    const meshes = [...this.loader.meshes.values()].flat();
    return {
      state: this.state(),
      camera: { position: this.cameraController.camera.position.toArray(), target: this.cameraController.controls.target.toArray() },
      structures: Object.fromEntries(this.loader.manifest?.structures.map((s) => {
        const box = this.selection?.structureBounds(s.id);
        return [s.id, { ...this.selection?.states.get(s.id), system: s.system, loaded: this.selection?.isLoaded(s.id) ?? false, assetId: s.assetId ?? 'core', bounds: box ? { min: box.min.toArray(), max: box.max.toArray() } : null }];
      }) ?? []),
      assets: Object.fromEntries(this.loader.manifest?.assets?.map((asset) => [asset.id, { ...this.loader.states.get(asset.id), path: `models/${asset.file}`, file: asset.file, systemIds: asset.systemIds, structureIds: asset.structureIds, transform }]) ?? []),
      sharedTransform: transform, performance: { ...this.perf },
      model: { meshCount: meshes.length, triangleCount: [...this.loader.loaded.values()].reduce((sum, asset) => sum + asset.triangleCount, 0) },
    };
  }
  debugManifest(): ModelManifest | undefined { return this.loader.manifest ? structuredClone(this.loader.manifest) : undefined; }

  projectStructure(id: string): { x: number; y: number } | null {
    if (!this.selection?.isLoaded(id) || !this.selection.states.get(id)?.visible) return null;
    this.scene.updateMatrixWorld(true);
    this.cameraController.camera.updateMatrixWorld(true);
    const rect = this.renderer.domElement.getBoundingClientRect();
    for (const mesh of this.loader.meshes.get(id) ?? []) {
      const attr = mesh.geometry.getAttribute('position');
      const index = mesh.geometry.index;
      const count = index?.count ?? attr.count;
      const step = Math.max(1, Math.floor(count / 3 / 300)) * 3;
      for (let i = 0; i + 2 < count; i += step) {
        const point = new Vector3();
        for (let j = 0; j < 3; j++) point.add(new Vector3().fromBufferAttribute(attr, index ? index.getX(i + j) : i + j));
        point.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld).project(this.cameraController.camera);
        if (Math.abs(point.x) > 0.9 || Math.abs(point.y) > 0.8 || point.z > 1) continue;
        const x = rect.left + (point.x + 1) / 2 * rect.width;
        const y = rect.top + (1 - point.y) / 2 * rect.height;
        if (document.elementFromPoint(x, y) !== this.renderer.domElement) continue;
        if (this.pick(x, y) === id) return { x, y };
      }
    }
    return null;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort(); this.observer.disconnect(); this.cameraController.dispose();
    this.loader.dispose();
    this.scene.traverse((object) => { if (object instanceof DirectionalLight) object.shadow.dispose(); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

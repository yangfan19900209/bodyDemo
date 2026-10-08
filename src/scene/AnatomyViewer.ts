import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, HemisphereLight, PCFSoftShadowMap, Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { CameraController } from './CameraController';
import { disposeModel, loadAnatomy } from './ModelLoader';
import type { LoadedAnatomy } from './ModelLoader';
import { SelectionManager } from './SelectionManager';
import { SYSTEMS } from '../data/anatomy';
import type { LayerPreset, ModelManifest, SystemId, ViewerActions, ViewerState } from '../data/anatomy';

interface ViewerEvents {
  state: (state: ViewerState) => void;
  loaded: (manifest: ModelManifest) => void;
  progress: (progress: number, message: string) => void;
  error: (message: string) => void;
  toast: (message: string) => void;
}

export class AnatomyViewer implements ViewerActions {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly cameraController: CameraController;
  private readonly raycaster = new Raycaster();
  private readonly observer: ResizeObserver;
  private readonly abort = new AbortController();
  private loaded?: LoadedAnatomy;
  private selection?: SelectionManager;
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
      const model = await loadAnatomy(this.events.progress);
      if (this.disposed) { disposeModel(model.root); return; }
      if (this.loaded) { this.scene.remove(this.loaded.root); disposeModel(this.loaded.root); }
      this.loaded = model;
      this.scene.add(model.root);
      this.selection = new SelectionManager(model.meshes, model.manifest.structures, () => this.emitState());
      this.cameraController.initialize(new Box3().setFromObject(model.root));
      this.events.loaded(model.manifest);
      this.events.progress(1, '本地图谱已准备就绪');
      this.emitState();
      this.renderer.render(this.scene, this.cameraController.camera);
    } catch (error) {
      this.events.error(error instanceof Error ? error.message : '模型加载失败，请检查本地资源是否完整。');
    } finally { this.loading = false; }
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
      this.renderer.render(this.scene, this.cameraController.camera);
      this.needsRender = false;
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
        const hit = this.pick(event.clientX, event.clientY);
        if (hit) this.selection?.select(hit);
        else this.selection?.clear();
      }
      if (!this.pointers.size || this.press?.id === event.pointerId) this.press = undefined;
    };
    canvas.addEventListener('pointerup', release, options);
    canvas.addEventListener('pointercancel', release, options);
  }

  private pick(x: number, y: number): string | undefined {
    if (!this.selection) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.raycaster.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.cameraController.camera);
    const hit = this.raycaster.intersectObjects(this.selection.pickable(), false)[0];
    return hit?.object.userData.structureId as string | undefined;
  }

  select(id: string, focus = false): void {
    this.selection?.select(id, !focus);
    if (focus) this.cameraController.fit(this.selection!.bounds([id]));
  }
  clearSelection(): void { this.selection?.clear(); }
  setMultiSelect(enabled: boolean): void { this.selection?.setMultiSelect(enabled); }
  toggleSystem(system: SystemId): void { this.selection?.toggleSystem(system); }
  setPreset(preset: LayerPreset): void {
    this.selection?.setPreset(preset);
    this.center();
  }
  setOpacity(target: SystemId | 'selection', opacity: number): void { this.selection?.setOpacity(target, opacity); }
  getOpacity(target: SystemId | 'selection'): number { return this.selection?.getOpacity(target) ?? 1; }
  center(): void {
    if (!this.selection) return;
    const box = this.selection.bounds(this.selection.selected.size ? this.selection.selected : undefined);
    if (box.isEmpty()) { this.events.toast('所有结构已隐藏，请开启一个系统或重置视图'); return; }
    this.cameraController.fit(box);
  }
  isolate(): void {
    if (!this.selection?.selected.size && !this.selection?.isolated) { this.events.toast('请先点选或搜索一个结构'); return; }
    this.selection?.isolate();
  }
  hideSelected(): void {
    if (!this.selection?.selected.size) { this.events.toast('请先点选需要隐藏的结构'); return; }
    const count = this.selection.selected.size;
    this.selection.hideSelected();
    this.events.toast(`已隐藏 ${count} 个结构，可撤销恢复`);
  }
  undo(): void { this.selection?.undo(); }
  reset(): void {
    this.selection?.reset(); this.cameraController.reset(); this.emitState();
    this.events.toast('已恢复初始视图和全部结构');
  }
  setView(view: ViewerState['view']): void {
    if (!this.selection) return;
    const box = this.selection.bounds();
    if (box.isEmpty()) { this.events.toast('请先开启一个系统'); return; }
    this.cameraController.setView(view, box); this.emitState();
  }
  setAutoRotate(enabled: boolean): void { this.cameraController.controls.autoRotate = enabled; }
  setQuality(high: boolean): void {
    this.highQuality = high;
    this.renderer.shadowMap.enabled = high;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }

  private state(): ViewerState {
    const systems = Object.fromEntries(SYSTEMS.map(({ id }) => {
      const ids = this.loaded?.manifest.structures.filter((s) => s.system === id).map((s) => s.id) ?? [];
      const count = ids.filter((id) => this.selection?.states.get(id)?.visible).length;
      return [id, { visible: count > 0, count, opacity: this.getOpacity(id) }];
    })) as ViewerState['systems'];
    return { ready: !!this.loaded, selection: [...this.selection?.selected ?? []], multiSelect: this.selection?.multiSelect ?? false, isolated: this.selection?.isolated ?? false, canUndo: this.selection?.canUndo ?? false, systems, visibleCount: [...this.selection?.states.values() ?? []].filter((s) => s.visible).length, totalCount: this.selection?.states.size ?? 0, view: this.cameraController.view, preset: this.selection?.preset ?? 'all' };
  }
  private emitState(): void {
    this.renderer.shadowMap.needsUpdate = true;
    this.needsRender = true;
    this.events.state(this.state());
  }

  /** Read-only inspection for reproducible scene validation. No UI bypass commands. */
  debugSnapshot(): object {
    const meshes = [...this.loaded?.meshes.values() ?? []].flat();
    return {
      state: this.state(),
      camera: { position: this.cameraController.camera.position.toArray(), target: this.cameraController.controls.target.toArray() },
      structures: Object.fromEntries(this.loaded?.manifest.structures.map((s) => {
        const box = this.selection!.structureBounds(s.id);
        return [s.id, { ...this.selection?.states.get(s.id), system: s.system, bounds: { min: box.min.toArray(), max: box.max.toArray() } }];
      }) ?? []),
      model: { meshCount: meshes.length, triangleCount: meshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0) },
    };
  }
  debugManifest(): ModelManifest | undefined { return this.loaded?.manifest; }

  projectStructure(id: string): { x: number; y: number } | null {
    if (!this.selection?.states.get(id)?.visible) return null;
    this.scene.updateMatrixWorld(true);
    this.cameraController.camera.updateMatrixWorld(true);
    const rect = this.renderer.domElement.getBoundingClientRect();
    for (const mesh of this.loaded?.meshes.get(id) ?? []) {
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
        if (this.pick(x, y) === id) return { x, y };
      }
    }
    return null;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.abort.abort(); this.observer.disconnect(); this.cameraController.dispose();
    if (this.loaded) disposeModel(this.loaded.root);
    this.scene.traverse((object) => { if (object instanceof DirectionalLight) object.shadow.dispose(); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

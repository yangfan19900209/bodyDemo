import './styles/main.css';
import { AnatomyViewer } from './scene/AnatomyViewer';
import { AnatomyUI } from './ui/AnatomyUI';
import type { ViewerActions } from './data/anatomy';

let viewer: AnatomyViewer | undefined;
// UI can be ready while assets load; actions have one owner in the scene layer.
const actions: ViewerActions = {
  select: (id, focus) => viewer?.select(id, focus),
  clearSelection: () => viewer?.clearSelection(),
  setMultiSelect: (enabled) => viewer?.setMultiSelect(enabled),
  toggleSystem: (system) => viewer?.toggleSystem(system),
  setOpacity: (target, opacity) => viewer?.setOpacity(target, opacity),
  getOpacity: (target) => viewer?.getOpacity(target) ?? 1,
  center: () => viewer?.center(),
  isolate: () => viewer?.isolate(),
  hideSelected: () => viewer?.hideSelected(),
  undo: () => viewer?.undo(),
  reset: () => viewer?.reset(),
  setView: (view) => viewer?.setView(view),
  setAutoRotate: (enabled) => viewer?.setAutoRotate(enabled),
  setQuality: (high) => viewer?.setQuality(high),
  setPreset: (preset) => viewer?.setPreset(preset),
};
const ui = new AnatomyUI(document.querySelector<HTMLElement>('#app')!, actions);

function initialize(): void {
  viewer?.dispose();
  viewer = undefined;
  ui.setLoading(0, '正在初始化三维渲染…');
  try {
    viewer = new AnatomyViewer(document.querySelector<HTMLElement>('#viewport')!, {
      state: (state) => ui.update(state),
      loaded: (manifest) => ui.mount(manifest),
      progress: (progress, message) => ui.setLoading(progress, message),
      error: (message) => ui.setError(message, initialize),
      toast: (message) => ui.toast(message),
    });
    void viewer.load();
  } catch (error) {
    ui.setError(`无法启动三维渲染。${error instanceof Error ? error.message : '请使用支持 WebGL 的浏览器。'}`, initialize);
  }
}
initialize();

if (import.meta.env.DEV) {
  Object.defineProperty(window, '__anatomyDebug', { value: Object.freeze({
    snapshot: () => viewer?.debugSnapshot(),
    manifest: () => viewer?.debugManifest(),
    projectStructure: (id: string) => viewer?.projectStructure(id) ?? null,
  }), configurable: true });
}
window.addEventListener('pagehide', (event) => { if (!event.persisted) { viewer?.dispose(); ui.dispose(); } });
if (import.meta.hot) import.meta.hot.dispose(() => { viewer?.dispose(); ui.dispose(); });

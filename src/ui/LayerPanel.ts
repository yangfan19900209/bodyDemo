import { SYSTEMS, type LayerPreset, type ViewerState } from '../data/anatomy';
import { icon } from './icons';

export const PRESETS: { id: LayerPreset; name: string; icon: string; description: string }[] = [
  { id: 'all', name: '全层透视', icon: 'layers', description: '恢复初始透视组合，保留器官与皮肤的半透明效果' },
  { id: 'bones', name: '骨骼模式', icon: 'bone', description: '只观察全身骨骼' },
  { id: 'muscles', name: '肌肉模式', icon: 'muscle', description: '载入真实肌肉，并以骨骼作为参照' },
  { id: 'vascular', name: '骨骼血管', icon: 'opacity', description: '观察动静脉与骨骼，隐藏遮挡的肌肉' },
  { id: 'nerves', name: '神经模式', icon: 'nerve', description: '载入真实神经，以半透明骨骼作为参照' },
  { id: 'organs', name: '内脏', icon: 'organs', description: '只显示内脏器官' },
  { id: 'skin', name: '外观', icon: 'skin', description: '只显示完整皮肤表面' },
];

const SYSTEM_ICONS: Record<string, string> = {
  bones: 'bone', arteries: 'opacity', veins: 'opacity', organs: 'organs',
  skin: 'skin', muscles: 'muscle', nerves: 'nerve', connective: 'connective',
};

export function layerPanelContent(): string {
  return `
    <p class="panel-intro">切换观察模式，或逐层探索。新增图层在首次打开时载入。</p>
    <div class="layer-presets" aria-label="图层观察模式">${PRESETS.map(preset => `
      <button class="layer-preset" data-preset="${preset.id}" aria-label="${preset.name}"
        aria-pressed="false" title="${preset.description}">${icon(preset.icon)}<span>${preset.name}</span></button>
    `).join('')}</div>
    <label class="layer-filter-label" for="active-system">优先拾取图层</label>
    <select class="panel-select" id="active-system" data-active-system aria-label="优先拾取图层">
      <option value="all">自动 · 所有可见图层</option>
      ${SYSTEMS.map(system => `<option value="${system.id}">${system.name}</option>`).join('')}
    </select>
    <div class="layer-list-heading"><span>图层显示 / 资源状态</span><span>不透明度</span></div>
    <div class="system-list">${SYSTEMS.map(system => `
      <div class="layer-item" data-layer-item="${system.id}">
        <div class="system-row">
          <button class="system-toggle" data-system="${system.id}" aria-label="${system.name}"
            aria-pressed="false" style="--system-color:${system.color}">
            <span class="system-swatch">${icon(SYSTEM_ICONS[system.id] ?? 'layers')}</span>
            <span class="system-name"><strong>${system.name}</strong><span data-system-count>等待图谱加载</span></span>
            <span class="switch-track"><span></span></span>
          </button>
          <button class="layer-opacity" data-layer-opacity="${system.id}" aria-label="${system.name}透明度"
            title="调整${system.name}透明度"><span data-system-opacity="${system.id}">100%</span>${icon('opacity')}</button>
        </div>
        <div class="layer-loading" data-layer-progress="${system.id}" role="progressbar"
          aria-label="${system.name}加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" hidden><span></span></div>
        <div class="layer-error" data-layer-error="${system.id}" hidden>
          <span data-layer-error-text></span>
          <button data-retry-system="${system.id}" aria-label="重试${system.name}">${icon('reset')}重试</button>
        </div>
      </div>
    `).join('')}</div>
    <p class="panel-footnote">点击图层开关显示或隐藏，点击百分比调整透明度。已载入的模型会缓存；关闭图层不会重复下载。</p>`;
}

/** Keep the actual resource state distinct from visibility and desired preset. */
export function updateLayerPanel(root: HTMLElement, state: ViewerState): void {
  for (const system of SYSTEMS) {
    const resource = state.systems[system.id];
    const toggle = root.querySelector<HTMLButtonElement>(`[data-system="${system.id}"]`)!;
    const unavailable = resource.status === 'unavailable';
    toggle.setAttribute('aria-pressed', String(resource.visible));
    toggle.setAttribute('aria-busy', String(resource.status === 'loading'));
    toggle.classList.toggle('is-on', resource.visible);
    toggle.disabled = !state.ready || unavailable;
    const statusText = resource.status === 'loaded' ? `${resource.loadedCount} 个结构 · 已载入`
      : resource.status === 'loading' ? `正在载入 ${Math.round(resource.progress * 100)}% · ${resource.totalCount} 个结构`
      : resource.status === 'error' ? `${resource.totalCount} 个结构 · 载入失败`
      : unavailable ? '暂无可用三维资源'
      : resource.loadedCount > 0 ? `${resource.loadedCount}/${resource.totalCount} 已载入 · 显示 ${resource.count}`
      : `${resource.totalCount} 个结构 · 点击载入`;
    toggle.querySelector<HTMLElement>('[data-system-count]')!.textContent = statusText;
    root.querySelector<HTMLElement>(`[data-system-opacity="${system.id}"]`)!.textContent = `${Math.round(resource.opacity * 100)}%`;
    root.querySelector<HTMLButtonElement>(`[data-layer-opacity="${system.id}"]`)!.disabled = !state.ready || unavailable;
    const item = root.querySelector<HTMLElement>(`[data-layer-item="${system.id}"]`)!;
    item.dataset.status = resource.status;
    const progress = root.querySelector<HTMLElement>(`[data-layer-progress="${system.id}"]`)!;
    progress.hidden = resource.status !== 'loading';
    const percent = Math.max(0, Math.min(100, Math.round(resource.progress * 100)));
    progress.setAttribute('aria-valuenow', String(percent));
    progress.querySelector<HTMLElement>('span')!.style.width = `${percent}%`;
    const error = root.querySelector<HTMLElement>(`[data-layer-error="${system.id}"]`)!;
    error.hidden = resource.status !== 'error';
    error.querySelector<HTMLElement>('[data-layer-error-text]')!.textContent = resource.error ?? '资源载入失败，请重试。';
    error.querySelector<HTMLButtonElement>('button')!.disabled = !state.ready;
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    const preset = PRESETS.find(item => item.id === button.dataset.preset)!;
    const active = state.preset === preset.id;
    button.setAttribute('aria-pressed', String(active));
    button.classList.toggle('is-active', active);
    const resource = preset.id === 'muscles' || preset.id === 'nerves' ? state.systems[preset.id] : undefined;
    button.disabled = !state.ready || resource?.status === 'unavailable';
    const loading = resource?.status === 'loading';
    button.setAttribute('aria-busy', String(loading));
    button.classList.toggle('is-loading', loading);
    button.querySelector<HTMLElement>('span')!.textContent = loading ? `${preset.name} · 载入中` : preset.name;
  }
  root.querySelector<HTMLSelectElement>('[data-active-system]')!.value = state.activeSystem;
}

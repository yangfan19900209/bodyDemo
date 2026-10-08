import { SYSTEMS, type LayerPreset, type ModelManifest, type SystemId, type ViewerActions, type ViewerState } from '../data/anatomy';
import { icon } from './icons';

type PanelName = 'search' | 'systems' | 'settings' | 'help' | 'view' | 'opacity';
const VIEW_NAMES = { front: '前视图', back: '后视图', left: '左侧视图', right: '右侧视图' };
const PRESETS = [
  { id: 'all', name: '全层透视', icon: 'layers', description: '显示全部图层，皮肤与器官保持半透明' },
  { id: 'vascular', name: '骨骼血管', icon: 'opacity', description: '只显示骨骼、动脉和静脉' },
  { id: 'organs', name: '内脏', icon: 'organs', description: '只显示内脏器官' },
  { id: 'skin', name: '外观', icon: 'skin', description: '只显示完整皮肤表面' },
] as const;

/** DOM presentation only. Scene state and mutations remain owned by AnatomyViewer. */
export class AnatomyUI {
  private readonly root: HTMLElement;
  private manifest: ModelManifest | null = null;
  private state: ViewerState | null = null;
  private activePanel: PanelName | null = null;
  private opacityTarget: SystemId | 'selection' = 'selection';
  private toastTimer: number | undefined;
  private listeners = new AbortController();
  private loadingSettled = false;

  constructor(container: HTMLElement, private readonly actions: ViewerActions) {
    this.root = container;
    container.innerHTML = this.shell();
    this.bind();
  }

  mount(manifest: ModelManifest): void {
    this.manifest = manifest;
    this.el('[data-model-label]').textContent = manifest.schematic ? '3D 解剖示意模型' : 'BodyParts3D · 教学演示';
    this.el('[data-source]').textContent = manifest.source;
    this.el('[data-model-description]').textContent = manifest.schematic
      ? '本 Demo 使用真正可交互的三维解剖示意模型。结构与位置经过简化，供交互演示，不代表医学级解剖精度。'
      : '本 Demo 使用 BodyParts3D 公开解剖模型，展示包含头部、四肢和双脚的全身骨骼、动静脉、内脏与皮肤。模型用于教学与交互演示，未进行医学用途验证。';
    this.el('[data-disclaimer-label]').textContent = manifest.schematic ? '示意展示 · 非医学诊断用途' : '教学演示 · 非医学诊断用途';
    this.renderSearch('');
    this.el('[data-structure-total]').textContent = String(manifest.structures.length);
  }

  update(state: ViewerState): void {
    this.state = state;
    const selected = this.manifest?.structures.filter(item => state.selection.includes(item.id)) ?? [];
    this.root.classList.toggle('has-selection', selected.length > 0);
    this.root.classList.toggle('is-ready', state.ready);
    this.el('[data-info-eyebrow]').textContent = selected.length > 1 ? `已选择 ${selected.length} 个结构` : selected.length ? '已选中结构' : '演示信息 · 未选择结构';
    this.el('[data-info-title]').textContent = selected[0]?.nameZh ?? '脾动脉';
    this.el('[data-info-english]').textContent = selected[0]?.nameEn ?? 'Splenic artery';
    this.el('[data-info-description]').textContent = selected.length > 1
      ? selected.map(item => item.nameZh).join('、')
      : selected[0]?.description ?? '点击模型中的骨骼、血管或器官，探索对应结构。';
    const tag = this.el('[data-info-system]');
    const system = SYSTEMS.find(item => item.id === selected[0]?.system);
    tag.textContent = system?.name.replace('系统', '') ?? '结构预览';
    tag.style.setProperty('--tag-color', system?.color ?? '#79808b');
    this.button('[data-action="clear"]').hidden = selected.length === 0;
    this.el('[data-visible-count]').textContent = String(state.visibleCount);
    this.el('[data-total-count]').textContent = String(state.totalCount);
    this.el('[data-current-view]').textContent = VIEW_NAMES[state.view];
    this.el('[data-selection-count]').textContent = selected.length ? `${selected.length} 个已选中` : '点击结构以选择';
    this.el('[data-selection-count]').classList.toggle('selected', selected.length > 0);

    for (const item of SYSTEMS) {
      const toggle = this.button(`[data-system="${item.id}"]`);
      toggle.setAttribute('aria-pressed', String(state.systems[item.id].visible));
      toggle.classList.toggle('is-on', state.systems[item.id].visible);
      const count = toggle.querySelector('[data-system-count]');
      if (count) count.textContent = `${state.systems[item.id].count} 个结构`;
      toggle.disabled = !state.ready;
      const opacity = this.el(`[data-system-opacity="${item.id}"]`);
      opacity.textContent = `${Math.round(state.systems[item.id].opacity * 100)}%`;
      this.button(`[data-layer-opacity="${item.id}"]`).disabled = !state.ready;
      this.el(`[data-legend-system="${item.id}"]`).classList.toggle('is-hidden', !state.systems[item.id].visible);
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      const active = button.dataset.preset === state.preset;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = !state.ready;
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      const active = button.dataset.view === state.view;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      button.disabled = !state.ready;
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-requires-ready]')) button.disabled = !state.ready;
    this.button('[data-action="hide"]').disabled = !state.ready || !selected.length;
    this.button('[data-action="isolate"]').disabled = !state.ready || (!selected.length && !state.isolated);
    this.button('[data-action="undo"]').disabled = !state.ready || !state.canUndo;
    this.setPressed('multi', state.multiSelect);
    this.setPressed('isolate', state.isolated);
    this.el('[data-isolate-label]').textContent = state.isolated ? '退出隔离' : '隔离';
    this.el('[data-mode-badge]').hidden = !state.multiSelect && !state.isolated;
    this.el('[data-mode-badge]').textContent = state.isolated ? '隔离视图' : '多选模式';
    const selectionOption = this.root.querySelector<HTMLOptionElement>('[data-opacity-target] option[value="selection"]')!;
    selectionOption.disabled = !selected.length;
    if (!selected.length && this.opacityTarget === 'selection') this.opacityTarget = 'bones';
    this.root.querySelector<HTMLSelectElement>('[data-opacity-target]')!.value = this.opacityTarget;
    this.syncOpacity();
    this.root.querySelector<HTMLInputElement>('[data-search-input]')!.disabled = !state.ready;
    if (state.ready && !this.loadingSettled) this.setLoading(1, '模型已就绪');
  }

  setLoading(progress: number, message: string): void {
    const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
    this.el('[data-load-message]').textContent = message;
    this.el('[data-load-percent]').textContent = `${percent}%`;
    this.el('[data-load-bar]').style.width = `${percent}%`;
    this.el('[data-loader]').setAttribute('aria-valuenow', String(percent));
    if (progress >= 1) {
      this.loadingSettled = true;
      this.el('[data-loader]').classList.add('is-complete');
      window.setTimeout(() => { if (this.loadingSettled) this.el('[data-loader]').hidden = true; }, 400);
    } else {
      this.loadingSettled = false;
      this.el('[data-loader]').hidden = false;
      this.el('[data-loader]').classList.remove('is-complete');
      this.el('[data-error]').hidden = true;
    }
  }

  setError(message: string, retry: () => void): void {
    this.loadingSettled = true;
    this.el('[data-loader]').hidden = true;
    this.el('[data-error]').hidden = false;
    this.el('[data-error-message]').textContent = message;
    this.button('[data-retry]').onclick = retry;
  }

  toast(message: string): void {
    const toast = this.el('[data-toast]');
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2700);
  }

  dispose(): void {
    this.listeners.abort();
    window.clearTimeout(this.toastTimer);
  }

  private el(selector: string): HTMLElement { return this.root.querySelector<HTMLElement>(selector)!; }
  private button(selector: string): HTMLButtonElement { return this.root.querySelector<HTMLButtonElement>(selector)!; }
  private setPressed(action: string, pressed: boolean): void {
    const button = this.button(`[data-action="${action}"]`);
    button.classList.toggle('is-active', pressed);
    button.setAttribute('aria-pressed', String(pressed));
  }

  private bind(): void {
    const signal = this.listeners.signal;
    this.root.addEventListener('click', event => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!target || target.disabled) return;
      if (target.dataset.panel) this.togglePanel(target.dataset.panel as PanelName);
      if (target.dataset.closePanel !== undefined) this.closePanels();
      if (target.dataset.view) {
        this.actions.setView(target.dataset.view as ViewerState['view']);
        this.closePanels();
      }
      if (target.dataset.system) this.actions.toggleSystem(target.dataset.system as SystemId);
      if (target.dataset.preset) {
        this.actions.setPreset(target.dataset.preset as LayerPreset);
      }
      if (target.dataset.layerOpacity) {
        this.togglePanel('opacity');
        this.opacityTarget = target.dataset.layerOpacity as SystemId;
        this.root.querySelector<HTMLSelectElement>('[data-opacity-target]')!.value = this.opacityTarget;
        this.syncOpacity();
      }
      if (target.dataset.structure) {
        this.actions.select(target.dataset.structure, true);
        this.closePanels();
      }
      switch (target.dataset.action) {
        case 'clear': this.actions.clearSelection(); break;
        case 'center': this.actions.center(); this.toast('视图已居中'); break;
        case 'isolate': this.actions.isolate(); break;
        case 'multi': this.actions.setMultiSelect(!this.state?.multiSelect); break;
        case 'hide': this.actions.hideSelected(); break;
        case 'undo': this.actions.undo(); break;
        case 'reset':
          this.actions.reset();
          this.root.querySelector<HTMLInputElement>('[data-auto-rotate]')!.checked = false;
          this.closePanels();
          this.toast('已恢复初始视图');
          break;
      }
    }, { signal });
    const input = this.root.querySelector<HTMLInputElement>('[data-search-input]')!;
    input.addEventListener('input', () => this.renderSearch(input.value), { signal });
    const opacityTarget = this.root.querySelector<HTMLSelectElement>('[data-opacity-target]')!;
    opacityTarget.addEventListener('change', () => {
      this.opacityTarget = opacityTarget.value as SystemId | 'selection';
      this.syncOpacity();
    }, { signal });
    const slider = this.root.querySelector<HTMLInputElement>('[data-opacity-slider]')!;
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      this.actions.setOpacity(this.opacityTarget, value / 100);
      this.el('[data-opacity-value]').textContent = `${value}%`;
      slider.style.setProperty('--range-progress', `${value}%`);
    }, { signal });
    this.root.querySelector<HTMLInputElement>('[data-auto-rotate]')!.addEventListener('change', event => {
      this.actions.setAutoRotate((event.target as HTMLInputElement).checked);
    }, { signal });
    this.root.querySelector<HTMLInputElement>('[data-high-quality]')!.addEventListener('change', event => {
      this.actions.setQuality((event.target as HTMLInputElement).checked);
    }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.closePanels();
    }, { signal });
    this.el('#viewport').addEventListener('pointerdown', () => this.closePanels(), { signal });
  }

  private togglePanel(name: PanelName): void {
    if (this.activePanel === name) { this.closePanels(); return; }
    this.closePanels();
    this.activePanel = name;
    this.el(`[data-panel-content="${name}"]`).hidden = false;
    this.button(`[data-panel="${name}"]`).classList.add('is-active');
    this.button(`[data-panel="${name}"]`).setAttribute('aria-expanded', 'true');
    if (name === 'search') window.setTimeout(() => this.root.querySelector<HTMLInputElement>('[data-search-input]')!.focus(), 40);
    if (name === 'opacity') {
      if (this.state?.selection.length) this.opacityTarget = 'selection';
      this.root.querySelector<HTMLSelectElement>('[data-opacity-target]')!.value = this.opacityTarget;
      this.syncOpacity();
    }
  }

  private closePanels(): void {
    for (const panel of this.root.querySelectorAll<HTMLElement>('[data-panel-content]')) panel.hidden = true;
    for (const button of this.root.querySelectorAll<HTMLElement>('[data-panel]')) {
      button.classList.remove('is-active');
      button.setAttribute('aria-expanded', 'false');
    }
    this.activePanel = null;
  }

  private syncOpacity(): void {
    if (!this.state?.ready) return;
    const value = Math.round(this.actions.getOpacity(this.opacityTarget) * 100);
    const slider = this.root.querySelector<HTMLInputElement>('[data-opacity-slider]')!;
    slider.value = String(value);
    slider.style.setProperty('--range-progress', `${value}%`);
    this.el('[data-opacity-value]').textContent = `${value}%`;
    this.el('[data-opacity-caption]').textContent = this.opacityTarget === 'selection' ? '对当前选中的结构调整不透明度' : '对该系统全部结构调整不透明度';
  }

  private renderSearch(query: string): void {
    const results = this.el('[data-search-results]');
    results.replaceChildren();
    const needle = query.trim().toLocaleLowerCase();
    const items = this.manifest?.structures.filter(item => `${item.nameZh} ${item.nameEn}`.toLocaleLowerCase().includes(needle)) ?? [];
    this.el('[data-result-count]').textContent = needle ? `${items.length} 个匹配结果` : '全部结构';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = this.manifest ? '没有找到相关结构，试试“肋骨”或“aorta”。' : '模型加载完成后即可检索结构。';
      results.append(empty);
      return;
    }
    for (const item of items) {
      const result = document.createElement('button');
      result.className = 'search-result';
      result.dataset.structure = item.id;
      const dot = document.createElement('span');
      dot.className = 'system-dot';
      dot.style.background = SYSTEMS.find(system => system.id === item.system)!.color;
      const names = document.createElement('span');
      names.className = 'result-names';
      const chinese = document.createElement('strong');
      chinese.textContent = item.nameZh;
      const english = document.createElement('span');
      english.textContent = item.nameEn;
      names.append(chinese, english);
      const arrow = document.createElement('span');
      arrow.className = 'result-arrow';
      arrow.innerHTML = icon('chevron');
      result.append(dot, names, arrow);
      results.append(result);
    }
  }

  private panel(name: PanelName, title: string, eyebrow: string, body: string, className = ''): string {
    return `<section class="floating-panel ${className}" data-panel-content="${name}" role="dialog" aria-label="${title}" hidden><div class="panel-heading"><div><div class="panel-eyebrow">${eyebrow}</div><h2>${title}</h2></div><button class="icon-button panel-close" data-close-panel aria-label="关闭${title}">${icon('close')}</button></div>${body}</section>`;
  }

  private shell(): string {
    const rail = (name: PanelName, label: string, iconName: string) => `<button class="rail-button" data-panel="${name}" aria-label="${label}" aria-expanded="false" title="${label}">${icon(iconName)}<span>${label}</span></button>`;
    const tool = (action: string, label: string, iconName: string, extra = '') => `<button class="tool-button" data-action="${action}" data-requires-ready ${extra} disabled aria-label="${action === 'center' ? '视图居中' : label}" title="${label}">${icon(iconName)}<span${action === 'isolate' ? ' data-isolate-label' : ''}>${label}</span></button>`;
    const views = Object.entries(VIEW_NAMES).map(([view, label]) => `<button class="view-option" data-view="${view}" aria-pressed="false"><span class="view-mini view-mini-${view}"><span></span></span><span>${label}</span></button>`).join('');
    return `
      <div class="viewer-shell">
        <div id="viewport" aria-label="交互式三维人体解剖场景"></div>
        <div class="scene-vignette" aria-hidden="true"></div>
        <header class="app-header">
          <a class="brand" href="./" aria-label="人体解剖图谱首页"><span class="brand-mark"><svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M16 2 29 10v16l-13 8-13-8V10L16 2Z" stroke="currentColor" stroke-width="1.2"/><path d="M16 8v20M10 12l6 3 6-3M8 18l8 4 8-4M11 25l5-3 5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span><span class="brand-text"><strong>ANATOMY<span class="brand-dot">.</span></strong><span>人体解剖图谱</span></span></a>
          <div class="project-label"><span class="status-dot"></span><span data-model-label>3D 解剖示意模型</span><span class="version-tag">DEMO 01</span></div>
        </header>
        <div class="section-label"><span class="eyebrow-line"></span><span>HUMAN ANATOMY</span><span class="section-divider">/</span><span>全身解剖</span></div>
        <article class="info-card" aria-live="polite" aria-atomic="true">
          <div class="info-card-top"><span class="info-eyebrow" data-info-eyebrow>演示信息 · 未选择结构</span><button class="icon-button info-clear" data-action="clear" aria-label="取消选中" title="取消选中" hidden>${icon('close')}</button></div>
          <div class="info-title-row"><h1 data-info-title>脾动脉</h1><span class="structure-tag" data-info-system>结构预览</span></div>
          <p class="info-english" data-info-english>Splenic artery</p>
          <p class="info-description" data-info-description>点击模型中的骨骼、血管或器官，探索对应结构。</p>
          <div class="info-card-accent" aria-hidden="true"></div>
        </article>
        <nav class="side-rail" aria-label="解剖图谱功能">${rail('search', '搜索', 'search')}${rail('systems', '解剖系统', 'layers')}<span class="rail-divider"></span>${rail('settings', '设置', 'settings')}${rail('help', '说明', 'help')}</nav>
        <div class="orientation"><span class="orientation-title">方向</span><div class="orientation-control"><button class="orientation-button orientation-top" data-view="front" aria-label="切换前视图">前</button><button class="orientation-button orientation-left" data-view="left" aria-label="切换左侧视图">左</button><span class="orientation-core">${icon('focus')}</span><button class="orientation-button orientation-right" data-view="right" aria-label="切换右侧视图">右</button><button class="orientation-button orientation-bottom" data-view="back" aria-label="切换后视图">后</button></div><span class="orientation-label" data-current-view>前视图</span></div>
        <div class="system-legend" aria-label="模型系统颜色">${SYSTEMS.map(system => `<span data-legend-system="${system.id}"><i style="--legend-color:${system.color}"></i>${system.name.replace('系统', '').replace('图层', '').replace('器官', '').replace('层', '')}</span>`).join('')}</div>
        <div class="scene-status"><span class="status-line"></span><span><strong data-visible-count>0</strong> / <span data-total-count>0</span> 个可见结构</span><span class="mode-badge" data-mode-badge hidden></span></div>
        <div class="gesture-hint">${icon('rotate')}<span class="desktop-hint">拖动旋转<span> · </span>滚轮缩放<span> · </span>点击探索</span><span class="mobile-hint">单指旋转<span> · </span>双指缩放<span> · </span>轻触探索</span></div>
        <div class="toolbar-wrap"><div class="toolbar-topline"><span class="toolbar-title">探索工具</span><span data-selection-count>点击结构以选择</span></div><nav class="toolbar" aria-label="模型操作工具"><button class="tool-button" data-panel="view" data-requires-ready aria-expanded="false" aria-label="视图" disabled>${icon('view')}<span>视图</span></button><button class="tool-button" data-panel="opacity" data-requires-ready aria-expanded="false" aria-label="透明度" disabled>${icon('opacity')}<span>透明度</span></button>${tool('center', '居中', 'center')}${tool('isolate', '隔离', 'isolate', 'aria-pressed="false"')}${tool('multi', '多选', 'multi', 'aria-pressed="false"')}${tool('hide', '隐藏', 'hide')}${tool('undo', '撤销', 'undo')}${tool('reset', '重置', 'reset')}</nav></div>
        <div class="bottom-note"><span class="note-dot"></span><span data-disclaimer-label>示意展示 · 非医学诊断用途</span></div>
        ${this.panel('search', '查找结构', 'STRUCTURE SEARCH', `<label class="search-field">${icon('search')}<input data-search-input type="search" placeholder="输入中文或英文名称" aria-label="搜索解剖结构" autocomplete="off" spellcheck="false" disabled></label><div class="results-heading"><span data-result-count>全部结构</span><span><span data-structure-total>0</span> 个结构</span></div><div class="search-results" data-search-results><div class="search-empty">模型加载完成后即可检索结构。</div></div>`, 'panel-side panel-search')}
        ${this.panel('systems', '解剖系统', 'SYSTEMS & LAYERS', `<p class="panel-intro">切换观察模式，或独立控制每个解剖图层。</p><div class="layer-presets" aria-label="图层观察模式">${PRESETS.map(preset => `<button class="layer-preset" data-preset="${preset.id}" aria-label="${preset.name}" aria-pressed="false" title="${preset.description}">${icon(preset.icon)}<span>${preset.name}</span></button>`).join('')}</div><div class="layer-list-heading"><span>图层显示</span><span>不透明度</span></div><div class="system-list">${SYSTEMS.map(system => `<div class="system-row"><button class="system-toggle is-on" data-system="${system.id}" aria-label="${system.name}" aria-pressed="true" style="--system-color:${system.color}"><span class="system-swatch">${icon(system.id === 'bones' ? 'layers' : system.id === 'organs' ? 'organs' : system.id === 'skin' ? 'skin' : 'opacity')}</span><span class="system-name"><strong>${system.name}</strong><span data-system-count>加载中</span></span><span class="switch-track"><span></span></span></button><button class="layer-opacity" data-layer-opacity="${system.id}" aria-label="${system.name}透明度" title="调整${system.name}透明度"><span data-system-opacity="${system.id}">100%</span>${icon('opacity')}</button></div>`).join('')}</div><p class="panel-footnote">点击开关显示或隐藏，点击百分比调整该层透明度。全层透视保留器官与皮肤的半透明效果。</p>`, 'panel-side panel-systems')}
        ${this.panel('settings', '显示设置', 'DISPLAY SETTINGS', `<label class="setting-row"><span><strong>自动旋转</strong><small>缓慢环绕，观察空间结构</small></span><input type="checkbox" data-auto-rotate data-requires-ready><span class="switch-track"><span></span></span></label><label class="setting-row"><span><strong>高清渲染</strong><small>提高像素比，低性能设备可关闭</small></span><input type="checkbox" data-high-quality data-requires-ready checked><span class="switch-track"><span></span></span></label><div class="settings-model"><span class="status-dot"></span><div><strong>本地资源 · 无需后端</strong><p>全部模型与图标随项目加载。</p></div></div>`, 'panel-side')}
        ${this.panel('help', '探索指南', 'EXPLORATION GUIDE', `<div class="help-steps"><div>${icon('rotate')}<span><strong>旋转与平移</strong><small>鼠标左键 / 单指旋转；右键 / 双指平移。</small></span></div><div>${icon('zoom')}<span><strong>缩放与聚焦</strong><small>滚轮 / 双指捏合缩放；搜索结构后自动聚焦。</small></span></div><div>${icon('layers')}<span><strong>全身图层</strong><small>解剖系统面板可切换骨骼血管、内脏、外观或全层透视；各层支持独立开关与透明度。</small></span></div><div>${icon('multi')}<span><strong>选择与整理</strong><small>点击高亮，空白处取消；打开多选后可统一隐藏或隔离。</small></span></div></div><div class="model-disclaimer"><strong>关于此模型</strong><p data-model-description>本 Demo 使用真正可交互的三维解剖模型，供教学与交互演示。</p><p class="model-source" data-source>本地人体解剖模型。</p></div>`, 'panel-side panel-help')}
        ${this.panel('view', '观察方向', 'VIEW PRESETS', `<div class="view-grid">${views}</div><p class="panel-footnote">选择预设方向，或直接拖动模型自由旋转。</p>`, 'panel-bottom panel-view')}
        ${this.panel('opacity', '结构透明度', 'TRANSPARENCY', `<label class="opacity-target-label" for="opacity-target">调整范围</label><select id="opacity-target" data-opacity-target aria-label="透明度作用对象"><option value="selection" disabled>当前选中结构</option>${SYSTEMS.map(item => `<option value="${item.id}">${item.name}</option>`).join('')}</select><div class="range-value-row"><span>不透明度</span><strong data-opacity-value>100%</strong></div><input class="opacity-slider" data-opacity-slider type="range" min="5" max="100" step="1" value="100" aria-label="透明度"><div class="range-labels"><span>5% · 透明</span><span>100% · 不透明</span></div><p class="panel-footnote" data-opacity-caption>对该系统全部结构调整不透明度</p>`, 'panel-bottom panel-opacity')}
        <div class="model-loader" data-loader role="progressbar" aria-label="加载三维解剖模型" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="loader-ring"><span></span>${icon('layers')}</div><h2>正在构建你的 3D 图谱</h2><p data-load-message>载入本地解剖模型…</p><div class="load-progress"><span data-load-bar></span></div><span class="load-percent" data-load-percent>0%</span></div>
        <div class="model-error" data-error role="alert" hidden>${icon('warning')}<h2>模型暂时无法显示</h2><p data-error-message></p><button class="retry-button" data-retry>${icon('reset')}重新加载</button></div>
        <div class="toast" data-toast role="status" aria-live="polite" hidden></div>
      </div>`;
  }
}

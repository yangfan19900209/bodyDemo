import { SYSTEMS, type AnatomyStructure, type ModelManifest, type SystemId, type ViewerState } from '../data/anatomy';
import { icon } from './icons';

/** Query and metadata changes rebuild results; performance ticks only update badges. */
export class SearchResults {
  private manifest: ModelManifest | null = null;
  private state: ViewerState | null = null;
  private filter: SystemId | 'all' = 'all';
  private query = '';
  private items: AnatomyStructure[] = [];
  private lastResourceKey = '';

  constructor(private readonly root: HTMLElement) {}

  mount(manifest: ModelManifest): void {
    this.manifest = manifest;
    this.rebuild();
  }

  update(state: ViewerState): void {
    this.state = state;
    const key = `${state.ready}:${SYSTEMS.map(system => state.systems[system.id]?.status).join(',')}`;
    if (key === this.lastResourceKey) return;
    this.lastResourceKey = key;
    for (const item of this.items) {
      const result = this.root.querySelector<HTMLButtonElement>(`[data-structure="${item.id}"]`);
      if (!result) continue;
      const status = state.systems[item.system]?.status;
      const badge = result.querySelector<HTMLElement>('[data-result-status]')!;
      badge.hidden = !status || status === 'loaded';
      badge.textContent = status === 'loading' ? '载入中' : status === 'error' ? '可重试' : status === 'unavailable' ? '不可用' : '按需载入';
      badge.dataset.status = status;
      result.disabled = status === 'unavailable' || !state.ready;
      result.setAttribute('aria-busy', String(status === 'loading'));
    }
  }

  search(query: string): void { this.query = query; this.rebuild(); }
  setFilter(filter: SystemId | 'all'): void { this.filter = filter; this.rebuild(); }

  private rebuild(): void {
    this.lastResourceKey = '';
    const results = this.root.querySelector<HTMLElement>('[data-search-results]')!;
    results.replaceChildren();
    const needle = this.query.trim().toLocaleLowerCase();
    this.items = this.manifest?.structures.filter(item =>
      (this.filter === 'all' || item.system === this.filter)
      && `${item.nameZh} ${item.nameEn}`.toLocaleLowerCase().includes(needle)) ?? [];
    this.root.querySelector<HTMLElement>('[data-result-count]')!.textContent = needle || this.filter !== 'all' ? `${this.items.length} 个匹配结果` : '全部结构';
    if (!this.items.length) {
      const empty = document.createElement('div');
      empty.className = 'search-empty';
      empty.textContent = this.manifest ? '没有找到已注册结构，试试“肋骨”或“biceps”。' : '模型目录载入后即可搜索。';
      results.append(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of this.items) {
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
      const status = document.createElement('span');
      status.className = 'result-status';
      status.dataset.resultStatus = '';
      status.hidden = true;
      const arrow = document.createElement('span');
      arrow.className = 'result-arrow';
      arrow.innerHTML = icon('chevron');
      result.append(dot, names, status, arrow);
      fragment.append(result);
    }
    results.append(fragment);
    if (this.state) this.update(this.state);
  }
}

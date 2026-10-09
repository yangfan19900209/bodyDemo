import { SYSTEMS, type AnatomyStructure } from '../data/anatomy';
import { icon } from './icons';

const TISSUE_NAMES: Record<string, string> = {
  bone: '骨', muscle: '肌肉', tendon: '肌腱', ligament: '韧带', fascia: '筋膜',
  nerve: '神经', neural: '神经组织', ganglion: '神经节', cartilage: '软骨', connective: '连接组织', organ: '器官', skin: '皮肤',
  artery: '动脉', vein: '静脉', vessel: '血管', other: '其他组织',
};

export function structureDetailsContent(): string {
  const action = (name: string, label: string, symbol: string) => `<button class="structure-action" data-detail-action="${name}" aria-label="${label}">${icon(symbol)}<span>${label}</span></button>`;
  return `<div class="detail-identity"><strong data-detail-name></strong><span data-detail-english></span></div>
    <dl class="structure-metadata">
      <div><dt>所属系统</dt><dd data-detail-system></dd></div>
      <div><dt>解剖部位</dt><dd data-detail-region></dd></div>
      <div><dt>组织类型</dt><dd data-detail-tissue></dd></div>
      <div><dt>来源结构 ID</dt><dd class="source-ids" data-detail-source></dd></div>
    </dl>
    <p class="detail-description" data-detail-anatomy></p>
    <div class="detail-source-note" data-detail-source-note><span>数据说明</span><p data-detail-description></p></div>
    <div class="structure-actions">${action('center', '聚焦选中结构', 'center')}${action('isolate', '隔离选中结构', 'isolate')}${action('hide', '隐藏选中结构', 'hide')}${action('opacity', '选中结构透明度', 'opacity')}${action('restore', '恢复选中结构', 'reset')}</div>
    <p class="panel-footnote">来源 ID 对应实际模型部件。中文名称及部位分类供图谱检索，未经过医学专家审校。</p>`;
}

export function updateStructureDetails(root: HTMLElement, structure: AnatomyStructure | undefined): void {
  const set = (name: string, value: string) => { root.querySelector<HTMLElement>(`[data-detail-${name}]`)!.textContent = value; };
  set('name', structure?.nameZh ?? '未选择结构');
  set('english', structure?.nameEn ?? '');
  set('system', SYSTEMS.find(system => system.id === structure?.system)?.name ?? '—');
  set('region', structure?.bodyRegion || '源数据未标注');
  set('tissue', structure?.tissueType ? TISSUE_NAMES[structure.tissueType] ?? structure.tissueType : '源数据未标注');
  set('source', structure?.sourceIds?.length ? structure.sourceIds.join(' · ') : '源数据未标注');
  set('description', structure?.description ?? '');
  set('anatomy', structure?.anatomicalDescription ?? '');
  root.querySelector<HTMLElement>('[data-detail-anatomy]')!.hidden = !structure?.anatomicalDescription;
  root.querySelector<HTMLElement>('[data-detail-source-note]')!.hidden = !structure?.description;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-detail-action]')) button.disabled = !structure;
}

export function hitPickerContent(): string {
  return `<section class="hit-picker" data-hit-picker role="dialog" aria-label="重叠结构" hidden>
    <div class="hit-heading"><span>${icon('layers')}<strong>此处的重叠结构</strong></span><button class="icon-button" data-dismiss-hits aria-label="关闭重叠结构">${icon('close')}</button></div>
    <p>从实际命中的三维结构中切换选择。</p>
    <div class="hit-list" data-hit-list></div>
  </section>`;
}

/** Candidate IDs only come from the real scene Raycaster; never manufacture hits. */
export function renderHitCandidates(root: HTMLElement, candidates: AnatomyStructure[], selectedIds: string[]): void {
  const list = root.querySelector<HTMLElement>('[data-hit-list]')!;
  list.replaceChildren();
  for (const structure of candidates) {
    const button = document.createElement('button');
    button.className = 'hit-candidate';
    button.dataset.hitId = structure.id;
    button.setAttribute('aria-label', structure.nameZh);
    button.setAttribute('aria-pressed', String(selectedIds.includes(structure.id)));
    const dot = document.createElement('i');
    dot.style.background = SYSTEMS.find(system => system.id === structure.system)?.color ?? '#a9a39b';
    const names = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = structure.nameZh;
    const english = document.createElement('small');
    english.textContent = structure.nameEn;
    names.append(title, english);
    button.append(dot, names);
    list.append(button);
  }
}

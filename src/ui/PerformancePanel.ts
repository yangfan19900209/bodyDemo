import type { PerformanceStats } from '../data/anatomy';

export function performanceContent(): string {
  return `<section class="performance-panel" aria-label="浏览器性能统计">
    <div class="performance-heading"><strong>浏览器性能统计</strong><span>${import.meta.env.DEV ? 'DEV' : 'LOCAL'} · <span data-perf-quality>HIGH</span></span></div>
    <dl class="performance-grid">
      <div><dt>FPS</dt><dd data-perf-fps>—</dd></div>
      <div><dt>Draw calls</dt><dd data-perf-draw>—</dd></div>
      <div><dt>三角面</dt><dd data-perf-triangles>—</dd></div>
      <div><dt>已载入资产</dt><dd data-perf-assets>—</dd></div>
      <div><dt>加载耗时</dt><dd data-perf-load>—</dd></div>
      <div><dt>CPU 提交耗时</dt><dd data-perf-frame>—</dd></div>
    </dl><div class="performance-idle" data-perf-idle></div><div class="asset-load-times" data-perf-asset-times></div><p>当前浏览器渲染计数及 CPU 提交耗时。静止时按需渲染，FPS 可能降低；此读数不代表 GPU 或 Android 真机表现。</p>
  </section>`;
}

export function updatePerformance(root: HTMLElement, performance: PerformanceStats): void {
  const set = (name: string, value: string) => { root.querySelector<HTMLElement>(`[data-perf-${name}]`)!.textContent = value; };
  set('fps', Number.isFinite(performance.fps) ? performance.fps.toFixed(0) : '—');
  set('draw', performance.drawCalls.toLocaleString());
  set('triangles', performance.triangles.toLocaleString());
  set('assets', String(performance.loadedAssets));
  set('load', `${(performance.loadTimeMs / 1000).toFixed(2)} s`);
  set('frame', `${performance.frameTimeMs.toFixed(1)} ms`);
  set('quality', performance.quality.toUpperCase());
  set('idle', performance.idle ? '静止 · 按需渲染' : '交互渲染');
  set('asset-times', Object.entries(performance.assetLoadTimes).map(([name, time]) => `${name}  ${(time / 1000).toFixed(2)} s`).join('\n'));
}

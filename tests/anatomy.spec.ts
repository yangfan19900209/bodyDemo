import { expect, test, type Page } from '@playwright/test';
import type { AnatomyStructure, LayerPreset, ModelManifest, SystemId, ViewerState } from '../src/data/anatomy';

interface Bounds { min: number[]; max: number[] }

interface Snapshot {
  state: ViewerState;
  camera: { position: number[]; target: number[] };
  structures: Record<string, { visible: boolean; opacity: number; system: SystemId; bounds: Bounds }>;
  model: { meshCount: number; triangleCount: number };
}

interface DebugApi {
  snapshot(): Snapshot;
  manifest(): ModelManifest;
  projectStructure(id: string): { x: number; y: number } | null;
}

declare global { interface Window { __anatomyDebug?: DebugApi } }

const snapshot = (page: Page) => page.evaluate(() => window.__anatomyDebug!.snapshot());
const distance = (camera: Snapshot['camera']) => Math.hypot(...camera.position.map((v, i) => v - camera.target[i]!));
const difference = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]!));
const SYSTEM_NAMES: Record<SystemId, string> = { bones: '骨骼系统', arteries: '动脉系统', veins: '静脉系统', organs: '内脏层', skin: '皮肤层' };
const PRESET_NAMES: Record<LayerPreset, string> = { all: '全层透视', vascular: '骨骼血管', organs: '内脏', skin: '外观' };

function expectDefaults(state: Snapshot, manifest: ModelManifest): void {
  for (const structure of manifest.structures) {
    expect(state.structures[structure.id]!.visible, `${structure.nameEn} default visibility`).toBe(structure.defaultVisible ?? true);
    expect(state.structures[structure.id]!.opacity, `${structure.nameEn} default opacity`).toBeCloseTo(structure.defaultOpacity ?? 1, 6);
  }
  expect(state.state.visibleCount).toBe(manifest.structures.filter((s) => s.defaultVisible ?? true).length);
}

async function ready(page: Page): Promise<Snapshot> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__anatomyDebug?.snapshot().state.ready ?? false)).toBe(true);
  await expect(page.getByRole('progressbar', { name: '加载三维解剖模型' })).toBeHidden();
  return snapshot(page);
}

async function saveScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `outputs/${name}.png` });
}

async function pickVisibleStructure(page: Page, system?: SystemId): Promise<{ structure: AnatomyStructure; point: { x: number; y: number } }> {
  const candidate = await page.evaluate((system) => {
    const debug = window.__anatomyDebug!;
    const candidates = debug.manifest().structures.filter((s) => !system || s.system === system).sort((a, b) => Number(b.nameZh.includes('胸骨')) - Number(a.nameZh.includes('胸骨')));
    for (const structure of candidates) {
      const point = debug.projectStructure(structure.id);
      // Prefer central rendered anatomy, clear of the toolbar and side controls.
      if (point && point.x > innerWidth * 0.24 && point.x < innerWidth * 0.8 && point.y > 190 && point.y < innerHeight - 190) return { structure, point };
    }
    return null;
  }, system);
  expect(candidate, 'A visible triangle must be hittable with the real Raycaster').not.toBeNull();
  await page.mouse.click(candidate!.point.x, candidate!.point.y);
  await expect.poll(async () => (await snapshot(page)).state.selection).toContain(candidate!.structure.id);
  return candidate!;
}

async function searchSelect(page: Page, structure: AnatomyStructure): Promise<void> {
  const input = page.getByRole('searchbox', { name: '搜索解剖结构' });
  if (!await input.isVisible()) await page.getByRole('button', { name: '搜索', exact: true }).click();
  await input.fill(structure.nameEn);
  await page.getByRole('dialog', { name: '查找结构', exact: true }).locator(`button[data-structure="${structure.id}"]`).click();
  await expect.poll(async () => (await snapshot(page)).state.selection).toContain(structure.id);
  await page.waitForTimeout(650); // Allow the documented camera transition to finish.
}

async function clickProjectedStructure(page: Page, structure: AnatomyStructure): Promise<void> {
  const point = await page.evaluate((id) => window.__anatomyDebug!.projectStructure(id), structure.id);
  expect(point, `${structure.nameEn} must have an actually hittable triangle`).not.toBeNull();
  const isCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point!);
  expect(isCanvas, `${structure.nameEn} must be clear of the floating UI`).toBe(true);
  await page.mouse.click(point!.x, point!.y);
  await expect.poll(async () => (await snapshot(page)).state.selection).toEqual([structure.id]);
}

async function openSystems(page: Page): Promise<void> {
  if (!await page.getByRole('dialog', { name: '解剖系统', exact: true }).isVisible()) await page.getByRole('button', { name: '解剖系统', exact: true }).click();
}

async function setPreset(page: Page, preset: LayerPreset): Promise<void> {
  await openSystems(page);
  await page.getByRole('button', { name: PRESET_NAMES[preset], exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).state.preset).toBe(preset);
}

test('desktop: local GLB, real picking, camera gestures and all structure operations', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome');
  const errors: string[] = [];
  const externalRequests: string[] = [];
  let loadedGlb = false;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:/.test(url) && !url.startsWith('http://127.0.0.1:5173/')) externalRequests.push(url);
  });
  page.on('response', (response) => {
    if (/\.glb(?:\?|$)/.test(response.url()) && response.status() === 200) loadedGlb = true;
  });
  const initial = await ready(page);
  expect(loadedGlb, 'GLTFLoader must load an actual local GLB').toBe(true);
  expect(initial.model.meshCount).toBeGreaterThan(50);
  expect(initial.model.triangleCount).toBeGreaterThan(10_000);
  expect(initial.state.selection).toEqual([]);
  expect(initial.state.totalCount).toBeGreaterThan(50);
  await saveScreenshot(page, 'desktop');

  const picked = await pickVisibleStructure(page);
  await expect(page.getByText(picked.structure.nameZh, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(picked.structure.nameEn, { exact: true }).first()).toBeVisible();

  const beforeDrag = await snapshot(page);
  await page.mouse.move(picked.point.x, picked.point.y);
  await page.mouse.down();
  await page.mouse.move(picked.point.x + 105, picked.point.y + 45, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(650);
  const afterDrag = await snapshot(page);
  expect(difference(beforeDrag.camera.position, afterDrag.camera.position)).toBeGreaterThan(0.5);
  expect(afterDrag.state.selection, 'A drag must preserve selection instead of creating a click').toEqual(beforeDrag.state.selection);

  const beforeZoom = distance(afterDrag.camera);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(650);
  expect(distance((await snapshot(page)).camera)).toBeLessThan(beforeZoom);
  const beforeCenter = await snapshot(page);
  await page.getByRole('button', { name: '视图居中', exact: true }).click();
  await page.waitForTimeout(650);
  const afterCenter = await snapshot(page);
  expect(difference(beforeCenter.camera.target, afterCenter.camera.target)).toBeGreaterThan(0.01);
  expect(afterCenter.state.selection).toEqual(beforeCenter.state.selection);

  const hiddenIds = (await snapshot(page)).state.selection;
  await page.getByRole('button', { name: '隐藏', exact: true }).click();
  let state = await snapshot(page);
  hiddenIds.forEach((id) => expect(state.structures[id]!.visible).toBe(false));
  expect(state.state.canUndo).toBe(true);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  state = await snapshot(page);
  hiddenIds.forEach((id) => expect(state.structures[id]!.visible).toBe(true));

  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '视图', exact: true }).click();
  await page.getByRole('button', { name: '后视图', exact: true }).click();
  await page.waitForTimeout(650);
  state = await snapshot(page);
  expect(state.state.view).toBe('back');
  expect(state.camera.position[2]).toBeLessThan(state.camera.target[2]!);
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.waitForTimeout(650);
  const manifest = await page.evaluate(() => window.__anatomyDebug!.manifest());
  const artery = manifest.structures.find((s) => /splenic artery/i.test(s.nameEn)) ?? manifest.structures.find((s) => s.system === 'arteries')!;
  const bone = manifest.structures.find((s) => /sternum/i.test(s.nameEn)) ?? manifest.structures.find((s) => s.system === 'bones')!;
  const initialTarget = (await snapshot(page)).camera.target;
  await searchSelect(page, artery);
  expect(difference(initialTarget, (await snapshot(page)).camera.target), 'Search result should move the camera target to its actual bounds').toBeGreaterThan(0.01);
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  expect((await snapshot(page)).state.visibleCount).toBe(1);
  await page.getByRole('button', { name: '视图居中', exact: true }).click();
  await page.waitForTimeout(650);
  await saveScreenshot(page, 'splenic-isolated');
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  await page.getByRole('button', { name: '多选', exact: true }).click();
  await searchSelect(page, bone);
  await expect.poll(async () => (await snapshot(page)).state.selection.length).toBe(2);
  expect((await snapshot(page)).state.multiSelect).toBe(true);
  await page.getByRole('button', { name: '隐藏', exact: true }).click();
  state = await snapshot(page);
  expect(state.structures[artery.id]!.visible).toBe(false);
  expect(state.structures[bone.id]!.visible).toBe(false);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  state = await snapshot(page);
  expect(state.structures[artery.id]!.visible).toBe(true);
  expect(state.structures[bone.id]!.visible).toBe(true);
  expect(state.state.selection).toHaveLength(2);

  await page.getByRole('button', { name: '隔离', exact: true }).click();
  state = await snapshot(page);
  expect(state.state.isolated).toBe(true);
  expect(state.state.visibleCount).toBe(2);
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  expect((await snapshot(page)).state.isolated).toBe(false);
  expect((await snapshot(page)).state.visibleCount).toBe(initial.state.visibleCount);
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  expect((await snapshot(page)).state.isolated).toBe(false);

  await page.getByRole('button', { name: '透明度', exact: true }).click();
  await page.getByLabel('透明度作用对象').selectOption('arteries');
  const opacity = page.getByRole('slider', { name: '透明度', exact: true });
  await opacity.focus();
  await opacity.press('Home');
  for (let i = 0; i < 30; i++) await opacity.press('ArrowRight');
  state = await snapshot(page);
  const arteryOpacities = Object.values(state.structures).filter((s) => s.system === 'arteries').map((s) => s.opacity);
  expect(arteryOpacities.length).toBeGreaterThan(0);
  arteryOpacities.forEach((value) => expect(value).toBeGreaterThan(0.05));
  arteryOpacities.forEach((value) => expect(value).toBeLessThan(0.8));

  await page.getByRole('button', { name: '解剖系统', exact: true }).click();
  const bonesToggle = page.getByRole('button', { name: '骨骼系统', exact: true });
  await bonesToggle.click();
  await expect(bonesToggle).toHaveAttribute('aria-pressed', 'false');
  state = await snapshot(page);
  Object.values(state.structures).filter((s) => s.system === 'bones').forEach((s) => expect(s.visible).toBe(false));
  await bonesToggle.click();
  await expect(bonesToggle).toHaveAttribute('aria-pressed', 'true');
  expect((await snapshot(page)).state.systems.bones.visible).toBe(true);

  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.waitForTimeout(650);
  state = await snapshot(page);
  expect(state.state.selection).toEqual([]);
  expect(state.state.multiSelect).toBe(false);
  expect(state.state.isolated).toBe(false);
  expect(state.state.canUndo).toBe(false);
  expectDefaults(state, manifest);
  expect(state.state.preset).toBe('all');
  expect(difference(initial.camera.position, state.camera.position)).toBeLessThan(0.1);
  expect(difference(initial.camera.target, state.camera.target)).toBeLessThan(0.1);
  await pickVisibleStructure(page);
  await page.mouse.click(220, 220);
  expect((await snapshot(page)).state.selection).toEqual([]);
  expect(errors).toEqual([]);
  expect(externalRequests, 'All runtime assets must be local; no CDN requests').toEqual([]);
  await saveScreenshot(page, 'desktop');
});

test('desktop: full-body head, leg and foot bounds contain real selectable meshes', async ({ page }) => {
  const initial = await ready(page);
  const manifest = await page.evaluate(() => window.__anatomyDebug!.manifest());
  const bones = manifest.structures.filter((s) => s.system === 'bones');
  const head = bones.find((s) => /frontal bone|parietal bone|skull|cranium|mandible/i.test(s.nameEn));
  const leg = bones.find((s) => /tibia|femur/i.test(s.nameEn));
  const foot = bones.find((s) => /calcaneus|talus/i.test(s.nameEn)) ?? bones.find((s) => /metatarsal|foot|toe/i.test(s.nameEn));
  expect(head, 'The full body must include a named cranial mesh').toBeDefined();
  expect(leg, 'The full body must include a named leg bone').toBeDefined();
  expect(foot, 'The full body must include a named foot bone').toBeDefined();
  const allBounds = Object.values(initial.structures).map((s) => s.bounds);
  expect(allBounds.every((b) => b && b.min.length === 3 && b.max.length === 3)).toBe(true);
  const bottom = Math.min(...allBounds.map((b) => b.min[1]!));
  const top = Math.max(...allBounds.map((b) => b.max[1]!));
  const height = top - bottom;
  expect(height).toBeGreaterThan(10);
  const relativeHeight = (structure: AnatomyStructure) => {
    const bounds = initial.structures[structure.id]!.bounds;
    return ((bounds.min[1]! + bounds.max[1]!) / 2 - bottom) / height;
  };
  expect(relativeHeight(head!)).toBeGreaterThan(0.7);
  expect(relativeHeight(leg!)).toBeGreaterThan(0.15);
  expect(relativeHeight(leg!)).toBeLessThan(0.65);
  expect(relativeHeight(foot!)).toBeLessThan(0.2);
  await saveScreenshot(page, 'fullbody-desktop');

  for (const structure of [head!, leg!, foot!]) {
    await searchSelect(page, structure);
    await page.getByRole('button', { name: '隔离', exact: true }).click();
    await page.getByRole('button', { name: '视图居中', exact: true }).click();
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: '取消选中', exact: true }).click();
    expect((await snapshot(page)).state.selection).toEqual([]);
    await clickProjectedStructure(page, structure);
    await expect(page.getByText(structure.nameZh, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: '隔离', exact: true }).click();
  }
});

test('desktop: five tissue layers, four undoable presets and translucent skin picking', async ({ page }) => {
  const initial = await ready(page);
  const manifest = await page.evaluate(() => window.__anatomyDebug!.manifest());
  const systems = Object.keys(SYSTEM_NAMES) as SystemId[];
  expectDefaults(initial, manifest);
  expect(Object.keys(initial.state.systems).sort()).toEqual([...systems].sort());
  for (const system of systems) expect(manifest.structures.some((s) => s.system === system), `${system} must contain real structures`).toBe(true);
  const skin = manifest.structures.find((s) => s.system === 'skin')!;
  const organ = manifest.structures.find((s) => s.system === 'organs' && /liver|heart|lung/i.test(s.nameEn)) ?? manifest.structures.find((s) => s.system === 'organs')!;
  expect(initial.structures[skin.id]!.visible).toBe(true);
  expect(initial.structures[skin.id]!.opacity).toBeCloseTo(0.12);
  expect(initial.structures[organ.id]!.opacity).toBeCloseTo(organ.defaultOpacity ?? 1, 6);
  expect(initial.structures[organ.id]!.opacity).toBeGreaterThan(0);
  expect(initial.structures[organ.id]!.opacity).toBeLessThan(1);
  const bonePick = await pickVisibleStructure(page, 'bones');
  expect(bonePick.structure.system, 'Low-opacity skin must allow a real surface click to reach underlying bones').toBe('bones');
  await page.getByRole('button', { name: '透明度', exact: true }).click();
  await page.getByLabel('透明度作用对象').selectOption('selection');
  const selectionSlider = page.getByRole('slider', { name: '透明度', exact: true });
  await selectionSlider.focus();
  await selectionSlider.press('End');
  for (let i = 0; i < 20; i++) await selectionSlider.press('ArrowLeft');
  expect((await snapshot(page)).structures[bonePick.structure.id]!.opacity).toBeCloseTo(0.8, 6);

  await openSystems(page);
  for (const system of systems) {
    const toggle = page.getByRole('button', { name: SYSTEM_NAMES[system], exact: true });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    let state = await snapshot(page);
    Object.values(state.structures).filter((s) => s.system === system).forEach((s) => expect(s.visible).toBe(false));
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    state = await snapshot(page);
    Object.values(state.structures).filter((s) => s.system === system).forEach((s) => expect(s.visible).toBe(true));
  }
  await page.getByRole('button', { name: '透明度', exact: true }).click();
  const slider = page.getByRole('slider', { name: '透明度', exact: true });
  for (const system of systems) {
    await page.getByLabel('透明度作用对象').selectOption(system);
    await slider.focus();
    await slider.press('Home');
    for (let i = 0; i < 25; i++) await slider.press('ArrowRight');
    const state = await snapshot(page);
    Object.values(state.structures).filter((s) => s.system === system).forEach((s) => expect(s.opacity).toBeCloseTo(0.3, 6));
  }
  await setPreset(page, 'all');
  expectDefaults(await snapshot(page), manifest);

  for (const preset of ['vascular', 'organs', 'skin'] as const) {
    const before = await snapshot(page);
    await setPreset(page, preset);
    const state = await snapshot(page);
    for (const structure of manifest.structures) {
      const visible = preset === 'vascular' ? ['bones', 'arteries', 'veins'].includes(structure.system) : structure.system === preset;
      expect(state.structures[structure.id]!.visible, `${preset}: ${structure.nameEn}`).toBe(visible);
      if (visible) expect(state.structures[structure.id]!.opacity).toBe(1);
    }
    expect(state.state.canUndo).toBe(true);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    const restored = await snapshot(page);
    expect(restored.state.preset).toBe('all');
    expect(restored.structures).toEqual(before.structures);
  }

  for (const [preset, structure] of [['organs', organ], ['skin', skin]] as const) {
    await setPreset(page, preset);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(650);
    await saveScreenshot(page, `${preset}-layer`);
    await searchSelect(page, structure);
    await page.getByRole('button', { name: '隔离', exact: true }).click();
    await page.getByRole('button', { name: '视图居中', exact: true }).click();
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: '取消选中', exact: true }).click();
    await clickProjectedStructure(page, structure);
    await page.getByRole('button', { name: '重置', exact: true }).click();
    await page.waitForTimeout(650);
  }
  expectDefaults(await snapshot(page), manifest);
});

test('phone portrait: layout, real picking, one-finger orbit and two-finger pinch', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome');
  const initial = await ready(page);
  expect(initial.state.totalCount).toBeGreaterThan(50);
  await saveScreenshot(page, 'mobile');
  const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, height: innerHeight }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width);
  const canvas = page.locator('canvas');
  const rect = await canvas.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.width).toBe(metrics.width);
  expect(rect!.height).toBe(metrics.height);
  const reset = page.getByRole('button', { name: '重置', exact: true });
  await expect(reset).toBeVisible();
  const resetRect = await reset.boundingBox();
  expect(resetRect!.x).toBeGreaterThanOrEqual(0);
  expect(resetRect!.x + resetRect!.width).toBeLessThanOrEqual(metrics.width + 1);
  expect(resetRect!.y + resetRect!.height).toBeLessThanOrEqual(metrics.height + 1);

  const picked = await pickVisibleStructure(page);
  const cdp = await context.newCDPSession(page);
  const start = await snapshot(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: picked.point.x, y: picked.point.y, id: 1 }] });
  for (let step = 1; step <= 8; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: picked.point.x + step * 9, y: picked.point.y + step * 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(650);
  let state = await snapshot(page);
  expect(difference(start.camera.position, state.camera.position)).toBeGreaterThan(0.1);
  expect(state.state.selection).toEqual(start.state.selection);

  const beforePinch = distance(state.camera);
  const cy = 420;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 155, y: cy, id: 1 }, { x: 235, y: cy, id: 2 }] });
  for (let step = 1; step <= 6; step++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 155 - step * 8, y: cy, id: 1 }, { x: 235 + step * 8, y: cy, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(650);
  state = await snapshot(page);
  expect(distance(state.camera)).toBeLessThan(beforePinch);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  const quality = page.getByRole('checkbox', { name: /高清渲染/ });
  await quality.uncheck();
  const physicalWidth = await canvas.evaluate((element) => (element as HTMLCanvasElement).width);
  expect(physicalWidth).toBe(metrics.width);
  await quality.check();
  const autoRotate = page.getByRole('checkbox', { name: /自动旋转/ });
  await autoRotate.check();
  const beforeAutoRotate = (await snapshot(page)).camera.position;
  await page.waitForTimeout(650);
  expect(difference(beforeAutoRotate, (await snapshot(page)).camera.position)).toBeGreaterThan(0.01);
  await reset.click();
  await page.waitForTimeout(650);
  expect((await snapshot(page)).state.selection).toEqual([]);
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(autoRotate).not.toBeChecked();
  await page.getByRole('button', { name: '关闭显示设置', exact: true }).click();
  await saveScreenshot(page, 'mobile');
});

test('desktop: failed local GLB shows an error and retry restores the scene', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chrome');
  await page.route('**/models/anatomy.glb', (route) => route.abort('failed'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('模型暂时无法显示');
  expect((await snapshot(page)).state.ready).toBe(false);
  await page.unroute('**/models/anatomy.glb');
  await page.getByRole('button', { name: '重新加载', exact: true }).click();
  await expect.poll(async () => (await snapshot(page)).state.ready).toBe(true);
  await expect(page.getByRole('alert')).toBeHidden();
  expect((await snapshot(page)).model.triangleCount).toBeGreaterThan(10_000);
  await page.screenshot({ path: testInfo.outputPath('recovered.png') });
});

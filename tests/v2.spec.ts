import { expect, test, type Page, type Response } from '@playwright/test';
import { SYSTEMS, type AnatomyStructure, type LayerPreset, type SystemId } from '../src/data/anatomy';
import { V1_CORE } from './fixtures/v1-core';
import { applySharedTransform, rawStructureBounds } from './support/glb';
import { clickProjectedStructure, difference, expectDefaults, openSystems, pickVisibleStructure, ready, saveScreenshot, searchSelect, setPreset, snapshot, type Snapshot } from './support/anatomy';

const manifest = (page: Page) => page.evaluate(() => window.__anatomyDebug!.manifest());
const forSystem = (state: Snapshot, system: SystemId) => Object.entries(state.structures).filter(([, item]) => item.system === system);
const assetFor = (state: Snapshot, system: SystemId) => Object.entries(state.assets).find(([, asset]) => asset.systemIds.includes(system) && !asset.path.endsWith('/anatomy.glb'));
const muscleChoice = (items: AnatomyStructure[]) => items.find((s) => s.system === 'muscles' && /sternocostal.+pectoralis major/i.test(s.nameEn)) ?? items.find((s) => s.system === 'muscles' && /pectoralis major/i.test(s.nameEn)) ?? items.find((s) => s.system === 'muscles' && /deltoid/i.test(s.nameEn)) ?? items.find((s) => s.system === 'muscles')!;

async function waitSystem(page: Page, system: SystemId): Promise<void> {
  await expect.poll(async () => (await snapshot(page)).state.systems[system].status).toBe('loaded');
}

async function toggleLayer(page: Page, system: SystemId): Promise<void> {
  await openSystems(page);
  await page.locator(`button[data-system="${system}"]`).click();
}

async function setOpacity(page: Page, target: SystemId, percent: number): Promise<void> {
  const select = page.getByLabel('透明度作用对象');
  if (!await select.isVisible()) await page.getByRole('button', { name: '透明度', exact: true }).click();
  await select.selectOption(target);
  const slider = page.getByRole('slider', { name: '透明度', exact: true });
  await slider.focus();
  await slider.press('Home');
  for (let i = 5; i < percent; i++) await slider.press('ArrowRight');
}

async function selectResultWithoutWaiting(page: Page, structure: AnatomyStructure): Promise<void> {
  const input = page.getByRole('searchbox', { name: '搜索解剖结构' });
  if (!await input.isVisible()) await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByLabel('搜索所属系统').selectOption(structure.system);
  await input.fill(structure.nameEn);
  await page.locator(`button[data-structure="${structure.id}"]`).click();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('desktop: V2 preserves the byte-identical 640 core and fetches a lazy system only once', async ({ page }, testInfo) => {
  const requests: string[] = [];
  let coreResponse: Response | undefined;
  page.on('request', (request) => { if (/\.glb(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  page.on('response', (response) => { if (response.url().endsWith('/models/anatomy.glb')) coreResponse = response; });
  const initial = await ready(page);
  const data = await manifest(page);
  expect(data.structures.map((s) => s.id).length).toBe(new Set(data.structures.map((s) => s.id)).size);
  expect(data.structures.map((s) => s.id)).toEqual(expect.arrayContaining([...V1_CORE.ids]));
  for (const id of V1_CORE.ids) {
    expect(initial.structures[id]!.loaded, `${id} must remain in the actual core scene`).toBe(true);
    expect(initial.structures[id]!.bounds).not.toBeNull();
  }
  expect(Object.values(initial.structures).filter((s) => s.loaded)).toHaveLength(640);
  expect(initial.model.meshCount).toBe(V1_CORE.meshCount);
  expect(initial.model.triangleCount).toBe(V1_CORE.triangleCount);
  expect(initial.state.visibleCount).toBe(640);
  expect(requests).toEqual([expect.stringContaining('/models/anatomy.glb')]);
  expect(coreResponse).toBeDefined();
  const binary = await coreResponse!.body();
  expect(binary.length).toBe(V1_CORE.glbBytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(binary)));
  expect([...digest].map((n) => n.toString(16).padStart(2, '0')).join('')).toBe(V1_CORE.coreSha256);
  const unloaded = forSystem(initial, 'muscles');
  expect(unloaded.length).toBeGreaterThan(0);
  unloaded.forEach(([, structure]) => { expect(structure.loaded).toBe(false); expect(structure.visible).toBe(false); expect(structure.bounds).toBeNull(); });
  expect(initial.state.systems.muscles.status).toBe('unloaded');

  await toggleLayer(page, 'muscles');
  await waitSystem(page, 'muscles');
  const loaded = await snapshot(page);
  expect(forSystem(loaded, 'muscles').every(([, s]) => s.loaded && s.visible && s.bounds !== null)).toBe(true);
  expect(loaded.model.triangleCount).toBeGreaterThan(initial.model.triangleCount);
  for (let i = 0; i < 4; i++) await toggleLayer(page, 'muscles');
  expect(requests.filter((url) => url.endsWith('/models/muscles.glb'))).toHaveLength(1);
  expect(assetFor(await snapshot(page), 'muscles')![1].status).toBe('loaded');
  const performance = (await snapshot(page)).performance;
  for (const value of [performance.fps, performance.drawCalls, performance.triangles, performance.frameTimeMs, performance.loadTimeMs]) expect(Number.isFinite(value)).toBe(true);
  expect(performance.loadedAssets).toBe(2);
  expect(Object.values(performance.assetLoadTimes).every((ms) => Number.isFinite(ms) && ms >= 0)).toBe(true);
  await testInfo.attach('v2-browser-performance', { body: JSON.stringify({ context: 'Local headless Chrome, 1440x1000; browser counters only, no Android device benchmark', ...performance }, null, 2), contentType: 'application/json' });
  await page.keyboard.press('Escape');
  await saveScreenshot(page, 'v2-muscles');
});

test('desktop: lazy muscle search uses real geometry and the exact common coordinate transform', async ({ page, request }) => {
  const initial = await ready(page);
  const data = await manifest(page);
  const muscle = muscleChoice(data.structures);
  expect(muscle).toBeDefined();
  expect(muscle.tissueType).toBe('muscle');
  expect(muscle.sourceIds?.length ?? muscle.sourceComponents?.length ?? 0).toBeGreaterThan(0);
  expect(muscle.bodyRegion?.length ?? 0).toBeGreaterThan(0);
  await selectResultWithoutWaiting(page, muscle);
  await waitSystem(page, 'muscles');
  await expect.poll(async () => (await snapshot(page)).state.selection).toEqual([muscle.id]);
  await page.waitForTimeout(650);
  const state = await snapshot(page);
  expect(difference(initial.camera.target, state.camera.target)).toBeGreaterThan(0.01);
  const loadedAssets = Object.entries(state.assets).filter(([, asset]) => asset.status === 'loaded');
  expect(loadedAssets).toHaveLength(2);
  state.sharedTransform.scale.forEach((value) => expect(value).toBeGreaterThan(0));
  for (const [, asset] of loadedAssets) {
    expect(asset.transform).toEqual(state.sharedTransform);
    const response = await request.get(`/${asset.path}`);
    expect(response.ok()).toBe(true);
    const raw = rawStructureBounds(await response.body());
    for (const id of asset.structureIds) {
      expect(raw.has(id), `${id} must exist in the actual GLB`).toBe(true);
      const expected = applySharedTransform(raw.get(id)!, state.sharedTransform);
      const actual = state.structures[id]!.bounds!;
      for (const edge of ['min', 'max'] as const) for (let axis = 0; axis < 3; axis++) expect(actual[edge][axis]!).toBeCloseTo(expected[edge][axis]!, 4);
    }
  }
  const skin = data.structures.find((s) => s.system === 'skin')!;
  const outer = state.structures[skin.id]!.bounds!;
  const selected = state.structures[muscle.id]!.bounds!;
  for (let axis = 0; axis < 3; axis++) {
    expect(selected.min[axis]!).toBeGreaterThanOrEqual(outer.min[axis]! - 0.05);
    expect(selected.max[axis]!).toBeLessThanOrEqual(outer.max[axis]! + 0.05);
  }
  const sternum = data.structures.find((s) => s.system === 'bones' && /body of sternum/i.test(s.nameEn))!;
  const chest = state.structures[sternum.id]!.bounds!;
  if (/pectoralis major/i.test(muscle.nameEn)) expect(Math.min(selected.max[1]!, chest.max[1]!) - Math.max(selected.min[1]!, chest.min[1]!), 'Chest muscle and sternum must actually occupy the same vertical region').toBeGreaterThan(0);
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  await page.getByRole('button', { name: '视图居中', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '取消选中', exact: true }).click();
  await clickProjectedStructure(page, muscle);
  await page.getByRole('button', { name: '结构详情', exact: true }).click();
  const details = page.getByRole('dialog', { name: '结构详情', exact: true });
  await expect(details).toContainText(muscle.nameEn);
  await expect(details).toContainText((muscle.sourceIds ?? muscle.sourceComponents)![0]!);
  await expect(details).toContainText(muscle.bodyRegion!);
  await page.keyboard.press('Escape');
  await saveScreenshot(page, 'v2-muscle-selected');
});

test('desktop: all eight registered systems expose only real available tissue and meaningful modes', async ({ page }) => {
  await ready(page);
  const data = await manifest(page);
  expect(SYSTEMS).toHaveLength(8);
  expect(Object.keys((await snapshot(page)).state.systems).sort()).toEqual(SYSTEMS.map((s) => s.id).sort());
  for (const system of ['muscles', 'nerves', 'connective'] as const) {
    const records = data.structures.filter((s) => s.system === system);
    const current = (await snapshot(page)).state.systems[system];
    if (current.status === 'unavailable') {
      expect(records).toHaveLength(0);
      await openSystems(page);
      await expect(page.locator(`button[data-system="${system}"] [data-system-count]`)).toContainText('暂无可用三维资源');
      expect((current.error ?? data.systems?.find((s) => s.id === system)?.coverage ?? '').length).toBeGreaterThan(0);
      continue;
    }
    expect(records.length).toBeGreaterThan(0);
    records.forEach((record) => {
      expect(record.sourceIds?.length ?? record.sourceComponents?.length ?? 0).toBeGreaterThan(0);
      if (system === 'connective') expect(['tendon', 'ligament', 'fascia']).toContain(record.tissueType);
      if (system === 'nerves') expect(['nerve', 'neural', 'ganglion']).toContain(record.tissueType);
    });
    if (system === 'nerves') expect(records.some((s) => /spinal cord|nerve|plexus|ganglion/i.test(s.nameEn))).toBe(true);
    if (current.status === 'unloaded' && current.visible) await toggleLayer(page, system);
    if (!(await snapshot(page)).state.systems[system].visible) await toggleLayer(page, system);
    await waitSystem(page, system);
    await setOpacity(page, system, 30);
    forSystem(await snapshot(page), system).forEach(([, item]) => expect(item.opacity).toBeCloseTo(0.3, 6));
    await toggleLayer(page, system);
    forSystem(await snapshot(page), system).forEach(([, item]) => expect(item.visible).toBe(false));
    await toggleLayer(page, system);
    forSystem(await snapshot(page), system).forEach(([, item]) => expect(item.visible).toBe(true));
    const target = system === 'muscles' ? muscleChoice(records) : system === 'nerves'
      ? records.find((s) => /spinal cord/i.test(s.nameEn)) ?? records.find((s) => /nerve|plexus|ganglion/i.test(s.nameEn))!
      : records.find((s) => s.assetId === 'connective' && /calcaneal tendon|achilles|patellar/i.test(s.nameEn)) ?? records.find((s) => s.assetId === 'connective')!;
    expect(target.assetId).toBe(system);
    await searchSelect(page, target);
    await page.getByRole('button', { name: '隔离', exact: true }).click();
    await page.getByRole('button', { name: '视图居中', exact: true }).click();
    await page.waitForTimeout(650);
    await page.getByRole('button', { name: '取消选中', exact: true }).click();
    await clickProjectedStructure(page, target);
    await page.getByRole('button', { name: '隐藏', exact: true }).click();
    expect((await snapshot(page)).structures[target.id]!.visible).toBe(false);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    expect((await snapshot(page)).structures[target.id]!.visible).toBe(true);
    await page.getByRole('button', { name: '重置', exact: true }).click();
  }
  for (const preset of ['bones', 'muscles', 'vascular', 'nerves'] as LayerPreset[]) {
    if (preset === 'nerves' && (await snapshot(page)).state.systems.nerves.status === 'unavailable') continue;
    await setPreset(page, preset);
    if (preset === 'muscles') await waitSystem(page, 'muscles');
    if (preset === 'nerves') await waitSystem(page, 'nerves');
    const state = await snapshot(page);
    const expectedSystem = preset === 'vascular' ? ['bones', 'arteries', 'veins'] : preset === 'bones' ? ['bones'] : ['bones', preset];
    for (const item of Object.values(state.structures)) expect(item.visible).toBe(expectedSystem.includes(item.system));
    if (preset === 'muscles' || preset === 'nerves') expect(state.state.systems.bones.opacity).toBeLessThan(1);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    expectDefaults(await snapshot(page), data);
  }
});

test('desktop: ghost outer layers never steal a preferred deep target and overlap candidates switch selection', async ({ page }) => {
  await ready(page);
  await toggleLayer(page, 'muscles');
  await waitSystem(page, 'muscles');
  await setOpacity(page, 'muscles', 20);
  await setOpacity(page, 'skin', 12);
  await openSystems(page);
  await page.getByLabel('优先拾取图层').selectOption('bones');
  await page.keyboard.press('Escape');
  const picked = await pickVisibleStructure(page, 'bones');
  expect((await snapshot(page)).state.activeSystem).toBe('bones');
  expect((await snapshot(page)).state.selection).toEqual([picked.structure.id]);

  await openSystems(page);
  await page.getByLabel('优先拾取图层').selectOption('all');
  await page.keyboard.press('Escape');
  const overlapping = await page.evaluate(() => {
    const debug = window.__anatomyDebug!;
    const candidates = debug.manifest().structures.filter((s) => s.system === 'bones').sort((a, b) => Number(/sternum/i.test(b.nameEn)) - Number(/sternum/i.test(a.nameEn)));
    for (const candidate of candidates) {
      const point = debug.projectStructure(candidate.id);
      if (!point) continue;
      const ids = debug.hitCandidates(point.x, point.y);
      if (ids.length > 1) return { point, ids };
    }
    return null;
  });
  expect(overlapping, 'The genuine multilayer scene must expose an overlap hit list').not.toBeNull();
  await page.mouse.click(overlapping!.point.x, overlapping!.point.y);
  const choices = page.getByRole('dialog', { name: '重叠结构', exact: true });
  await expect(choices).toBeVisible();
  const selected = (await snapshot(page)).state.selection;
  const alternate = overlapping!.ids.find((id) => !selected.includes(id));
  // Select a different actual ray hit through the displayed UI, never by debug mutation.
  expect(alternate).toBeDefined();
  await choices.locator(`button[data-hit-id="${alternate}"]`).click();
  expect((await snapshot(page)).state.selection).toEqual([alternate!]);
  await saveScreenshot(page, 'v2-overlap');
});

for (const operation of ['undo', 'reset'] as const) test(`desktop: ${operation} wins over a delayed lazy load without corrupting core history`, async ({ page }) => {
  await ready(page);
  const data = await manifest(page);
  const picked = await pickVisibleStructure(page, 'bones');
  await page.getByRole('button', { name: '隐藏', exact: true }).click();
  expect((await snapshot(page)).structures[picked.structure.id]!.visible).toBe(false);
  const started = deferred();
  const release = deferred();
  await page.route('**/models/muscles.glb', async (route) => { started.resolve(); await release.promise; await route.continue(); });
  if (operation === 'reset') await selectResultWithoutWaiting(page, muscleChoice(data.structures));
  else await toggleLayer(page, 'muscles');
  await started.promise;
  await expect.poll(async () => (await snapshot(page)).state.systems.muscles.status).toBe('loading');
  await page.getByRole('button', { name: operation === 'undo' ? '撤销' : '重置', exact: true }).click();
  await page.waitForTimeout(650);
  const intended = await snapshot(page);
  release.resolve();
  await waitSystem(page, 'muscles');
  const completed = await snapshot(page);
  for (const id of V1_CORE.ids) {
    expect(completed.structures[id]!.visible).toBe(intended.structures[id]!.visible);
    expect(completed.structures[id]!.opacity).toBe(intended.structures[id]!.opacity);
  }
  forSystem(completed, 'muscles').forEach(([, item]) => { expect(item.loaded).toBe(true); expect(item.visible).toBe(false); });
  expect(completed.state.selection).toEqual(intended.state.selection);
  expect(completed.state.isolated).toBe(intended.state.isolated);
  expect(difference(completed.camera.target, intended.camera.target)).toBeLessThan(0.01);
  if (operation === 'undo') {
    expect(completed.state.canUndo).toBe(true);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    expect((await snapshot(page)).structures[picked.structure.id]!.visible).toBe(true);
  } else {
    expect(completed.state.canUndo).toBe(false);
    expectDefaults(completed, data);
  }
});

test('desktop: an optional asset failure is visible and retry loads the real mesh without breaking core', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await ready(page);
  await page.route('**/models/muscles.glb', (route) => route.abort('failed'));
  await toggleLayer(page, 'muscles');
  await expect.poll(async () => (await snapshot(page)).state.systems.muscles.status).toBe('error');
  await expect(page.locator('[data-layer-error="muscles"]')).toBeVisible();
  expect((await snapshot(page)).state.ready).toBe(true);
  const core = await snapshot(page);
  for (const id of V1_CORE.ids) expect(core.structures[id]!.loaded).toBe(true);
  await page.unroute('**/models/muscles.glb');
  await page.locator('button[data-retry-system="muscles"]').click();
  await waitSystem(page, 'muscles');
  await expect(page.locator('[data-layer-error="muscles"]')).toBeHidden();
  await page.keyboard.press('Escape');
  const muscle = muscleChoice((await manifest(page)).structures);
  await searchSelect(page, muscle);
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  await page.getByRole('button', { name: '视图居中', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '取消选中', exact: true }).click();
  await clickProjectedStructure(page, muscle);
  expect(failures).toEqual([]);
});

test('desktop: an unavailable catalog entry is explained and never offers unrenderable search results', async ({ page }) => {
  const nerveRequests: string[] = [];
  page.on('request', (request) => { if (request.url().endsWith('/models/nerves.glb')) nerveRequests.push(request.url()); });
  await page.route('**/models/anatomy.json', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    catalog.structures = catalog.structures.filter((s: AnatomyStructure) => s.system !== 'nerves');
    const asset = catalog.assets.find((item: { id: string }) => item.id === 'nerves');
    asset.file = ''; asset.structureIds = [];
    catalog.systems ??= SYSTEMS.map((system) => ({ ...system }));
    const nerveSystem = catalog.systems.find((s: { id: string }) => s.id === 'nerves');
    nerveSystem.coverage = '此验收资源清单未提供可用神经三维模型';
    await route.fulfill({ response, json: catalog });
  });
  const initial = await ready(page);
  expect(initial.state.systems.nerves.status).toBe('unavailable');
  expect(initial.state.systems.nerves.totalCount).toBe(0);
  expect(initial.state.visibleCount).toBe(640);
  await openSystems(page);
  await expect(page.locator('button[data-system="nerves"]')).toBeDisabled();
  await expect(page.locator('button[data-system="nerves"] [data-system-count]')).toContainText('暂无可用三维资源');
  const mode = page.locator('button[data-preset="nerves"]');
  if (await mode.isEnabled()) await mode.click();
  expect((await snapshot(page)).state.visibleCount).toBe(640);
  expect((await snapshot(page)).state.preset).toBe('all');
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByLabel('搜索所属系统').selectOption('nerves');
  await page.getByRole('searchbox', { name: '搜索解剖结构' }).fill('nerve');
  await expect(page.locator('button[data-structure]')).toHaveCount(0);
  expect(nerveRequests).toEqual([]);
  expect((await snapshot(page)).state.ready).toBe(true);
});

test('phone portrait: V2 eight-layer drawer and lazy muscle gestures remain usable without horizontal overflow', async ({ page, context }) => {
  await ready(page);
  await openSystems(page);
  await expect(page.locator('button[data-system]')).toHaveCount(8);
  await page.locator('button[data-system="muscles"]').scrollIntoViewIfNeeded();
  await page.locator('button[data-system="muscles"]').click();
  await waitSystem(page, 'muscles');
  await setPreset(page, 'muscles');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(650);
  await saveScreenshot(page, 'v2-mobile-fullbody');
  const muscle = muscleChoice((await manifest(page)).structures);
  await searchSelect(page, muscle);
  await page.getByRole('button', { name: '隔离', exact: true }).click();
  await page.getByRole('button', { name: '视图居中', exact: true }).click();
  await page.waitForTimeout(650);
  await page.getByRole('button', { name: '取消选中', exact: true }).click();
  const point = await page.evaluate((id) => window.__anatomyDebug!.projectStructure(id), muscle.id);
  expect(point).not.toBeNull();
  await page.touchscreen.tap(point!.x, point!.y);
  expect((await snapshot(page)).state.selection).toEqual([muscle.id]);
  const cdp = await context.newCDPSession(page);
  const before = await snapshot(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point!.x, y: point!.y, id: 1 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point!.x + i * 7, y: point!.y + i * 2, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(650);
  const after = await snapshot(page);
  expect(difference(before.camera.position, after.camera.position)).toBeGreaterThan(0.1);
  expect(after.state.selection).toEqual(before.state.selection);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await saveScreenshot(page, 'v2-mobile-muscle');
});

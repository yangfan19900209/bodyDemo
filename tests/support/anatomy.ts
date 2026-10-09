import { expect, type Page } from '@playwright/test';
import type { AnatomyStructure, LayerPreset, ModelManifest, SystemId, ViewerState } from '../../src/data/anatomy';

export interface Bounds { min: number[]; max: number[] }
export type LegacySystemId = 'bones' | 'arteries' | 'veins' | 'organs' | 'skin';
export interface AssetSnapshot {
  status: string;
  path: string;
  file: string;
  systemIds: SystemId[];
  structureIds: string[];
  loadTimeMs: number;
  progress: number;
  error?: string;
  transform?: { position: number[]; scale: number[] };
}

export interface Snapshot {
  state: ViewerState & { activeSystem: 'all' | SystemId; hitCandidates: string[] };
  camera: { position: number[]; target: number[] };
  structures: Record<string, { visible: boolean; opacity: number; system: SystemId; loaded: boolean; assetId: string; bounds: Bounds | null }>;
  assets: Record<string, AssetSnapshot>;
  sharedTransform: { position: number[]; scale: number[] };
  model: { meshCount: number; triangleCount: number };
  performance: { fps: number; drawCalls: number; triangles: number; loadedAssets: number; loadTimeMs: number; frameTimeMs: number; quality: 'high' | 'low'; idle: boolean; assetLoadTimes: Record<string, number> };
}

export interface DebugApi {
  snapshot(): Snapshot;
  manifest(): ModelManifest;
  projectStructure(id: string): { x: number; y: number } | null;
  hitCandidates(x: number, y: number): string[];
}

declare global { interface Window { __anatomyDebug?: DebugApi } }

export const snapshot = (page: Page) => page.evaluate(() => window.__anatomyDebug!.snapshot());
export const distance = (camera: Snapshot['camera']) => Math.hypot(...camera.position.map((v, i) => v - camera.target[i]!));
export const difference = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]!));
export const SYSTEM_NAMES: Record<LegacySystemId, string> = { bones: '骨骼系统', arteries: '动脉系统', veins: '静脉系统', organs: '内脏层', skin: '皮肤层' };
export const PRESET_NAMES: Partial<Record<LayerPreset, string>> = { all: '全层透视', vascular: '骨骼血管', organs: '内脏', skin: '外观' };

export function expectDefaults(state: Snapshot, manifest: ModelManifest): void {
  for (const structure of manifest.structures) {
    expect(state.structures[structure.id]!.visible, `${structure.nameEn} default visibility`).toBe(structure.defaultVisible ?? true);
    expect(state.structures[structure.id]!.opacity, `${structure.nameEn} default opacity`).toBeCloseTo(structure.defaultOpacity ?? 1, 6);
  }
  expect(state.state.visibleCount).toBe(manifest.structures.filter((s) => (s.defaultVisible ?? true) && state.structures[s.id]!.loaded).length);
}

export async function ready(page: Page): Promise<Snapshot> {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.__anatomyDebug?.snapshot().state.ready ?? false)).toBe(true);
  await expect(page.getByRole('progressbar', { name: '加载三维解剖模型' })).toBeHidden();
  return snapshot(page);
}

export async function saveScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `outputs/${name}.png` });
}

export async function pickVisibleStructure(page: Page, system?: SystemId): Promise<{ structure: AnatomyStructure; point: { x: number; y: number } }> {
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

export async function searchSelect(page: Page, structure: AnatomyStructure): Promise<void> {
  const input = page.getByRole('searchbox', { name: '搜索解剖结构' });
  if (!await input.isVisible()) await page.getByRole('button', { name: '搜索', exact: true }).click();
  await input.fill(structure.nameEn);
  await page.getByRole('dialog', { name: '查找结构', exact: true }).locator(`button[data-structure="${structure.id}"]`).click();
  await expect.poll(async () => (await snapshot(page)).state.selection).toContain(structure.id);
  await page.waitForTimeout(650); // Allow the documented camera transition to finish.
}

export async function clickProjectedStructure(page: Page, structure: AnatomyStructure): Promise<void> {
  const point = await page.evaluate((id) => window.__anatomyDebug!.projectStructure(id), structure.id);
  expect(point, `${structure.nameEn} must have an actually hittable triangle`).not.toBeNull();
  const isCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', point!);
  expect(isCanvas, `${structure.nameEn} must be clear of the floating UI`).toBe(true);
  await page.mouse.click(point!.x, point!.y);
  await expect.poll(async () => (await snapshot(page)).state.selection).toEqual([structure.id]);
}

export async function openSystems(page: Page): Promise<void> {
  if (!await page.getByRole('dialog', { name: '解剖系统', exact: true }).isVisible()) await page.getByRole('button', { name: '解剖系统', exact: true }).click();
}

export async function setPreset(page: Page, preset: LayerPreset): Promise<void> {
  await openSystems(page);
  await page.locator(`button[data-preset="${preset}"]`).click();
  await expect.poll(async () => (await snapshot(page)).state.preset).toBe(preset);
}

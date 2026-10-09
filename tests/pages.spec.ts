import { expect, test } from '@playwright/test';
import { V1_CORE } from './fixtures/v1-core';

test('pages: actual production assets and lazy GLB load under /bodyDemo/', async ({ page }) => {
  const failed: string[] = [];
  const modelRequests: string[] = [];
  const responses: { url: string; status: number }[] = [];
  page.on('pageerror', (error) => failed.push(error.message));
  page.on('request', (request) => {
    if (/\/models\//.test(request.url())) modelRequests.push(request.url());
  });
  page.on('response', (response) => {
    if (/\/models\//.test(response.url())) responses.push({ url: response.url(), status: response.status() });
  });
  await page.goto('./');
  await expect(page.getByRole('progressbar', { name: '加载三维解剖模型' })).toBeHidden();
  await expect(page.getByRole('alert')).toBeHidden();
  expect(await page.evaluate(() => '__anatomyDebug' in window)).toBe(false);
  expect(modelRequests.every((url) => url.startsWith('http://127.0.0.1:4174/bodyDemo/models/'))).toBe(true);
  expect(responses.filter((response) => /\.glb(?:\?|$)/.test(response.url))).toHaveLength(1);
  expect(responses.every((response) => response.status === 200)).toBe(true);
  await expect(page.locator('[data-visible-count]')).toHaveText(String(V1_CORE.meshCount));

  // Search selects a real core mesh, then a physical canvas click exercises picking.
  await page.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索解剖结构' }).fill('body of sternum');
  await page.locator('button[data-structure]').first().click();
  await expect(page.locator('[data-info-eyebrow]')).toHaveText('已选中结构');
  await page.getByRole('button', { name: '取消选中', exact: true }).click();
  await page.waitForTimeout(650);
  let picked = false;
  for (const [x, y] of [[720, 500], [700, 480], [740, 520], [690, 530]]) {
    await page.mouse.click(x!, y!);
    if (await page.locator('[data-info-eyebrow]').textContent() === '已选中结构') { picked = true; break; }
  }
  expect(picked, 'A production scene under the Pages path must render and accept actual surface clicks').toBe(true);
  await page.getByRole('button', { name: '重置', exact: true }).click();
  await page.getByRole('button', { name: '解剖系统', exact: true }).click();
  await page.locator('button[data-system="muscles"]').click();
  await expect.poll(() => responses.filter((response) => /muscle.*\.glb(?:\?|$)/i.test(response.url)).length).toBe(1);
  await expect(page.locator('button[data-system="muscles"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await page.locator('[data-visible-count]').textContent())).toBeGreaterThan(V1_CORE.meshCount);
  expect(modelRequests.every((url) => url.startsWith('http://127.0.0.1:4174/bodyDemo/models/'))).toBe(true);
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(failed).toEqual([]);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'outputs/v2-pages.png' });
});

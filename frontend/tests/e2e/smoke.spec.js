import { test, expect } from '@playwright/test';
import { stubBackend } from './_helpers';

test.describe('smoke', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page);
  });


  test('backend health endpoint returns ok', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('grid renders at least one item', async ({ page }) => {
    await page.goto('/?r=pics');
    const firstCard = page.locator('.beeg-card:not(.skeleton-card)').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const count = await page.locator('.beeg-card:not(.skeleton-card)').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

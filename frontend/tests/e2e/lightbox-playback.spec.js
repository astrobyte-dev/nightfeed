import { test, expect } from '@playwright/test';
import { stubBackend } from './_helpers';

const GRID_ITEM = '.beeg-card:not(.skeleton-card)';
const LIGHTBOX = '[role="dialog"]';
const LIGHTBOX_NEXT = '[aria-label="Next post"]';
const REDGIFS_STREAM_RE = /\/api\/external\/redgifs\/[^/]+\/stream/;
const REDGIFS_PROBE_MS = 3_000;
const REDGIFS_THRESHOLD = 10;
const MAX_ITEMS_TO_SCAN = 30;

async function waitForGrid(page) {
  await expect(page.locator(GRID_ITEM).first()).toBeVisible({ timeout: 20_000 });
  const count = await page.locator(GRID_ITEM).count();
  expect(count, 'precondition: grid must have at least one item').toBeGreaterThan(0);
  return count;
}

async function openFirstItem(page) {
  await page.locator(GRID_ITEM).first().click();
  await expect(page.locator(LIGHTBOX)).toBeVisible({ timeout: 10_000 });
}

test.describe('lightbox playback', () => {
  test.beforeEach(async ({ page }) => {
    await stubBackend(page);
  });

  test('opening a RedGIFs item does not trigger an effect loop', async ({ page }) => {
    let streamRequestCount = 0;
    page.on('request', (req) => {
      if (REDGIFS_STREAM_RE.test(req.url())) streamRequestCount += 1;
    });

    await page.goto('/?r=pics');
    const gridCount = await waitForGrid(page);
    await openFirstItem(page);

    let foundRedgifs = streamRequestCount > 0;
    const scanLimit = Math.min(gridCount, MAX_ITEMS_TO_SCAN);
    let scanned = 1;
    while (!foundRedgifs && scanned < scanLimit) {
      await page.locator(LIGHTBOX_NEXT).click();
      await page.waitForTimeout(400);
      scanned += 1;
      if (streamRequestCount > 0) foundRedgifs = true;
    }

    if (!foundRedgifs) {
      test.skip(true, `no RedGIFs item found in first ${scanned} grid items; bug not exercisable today`);
    }

    streamRequestCount = 0;
    await page.waitForTimeout(REDGIFS_PROBE_MS);

    expect(
      streamRequestCount,
      `RedGIFs stream requests in ${REDGIFS_PROBE_MS}ms must stay under ${REDGIFS_THRESHOLD}; saw ${streamRequestCount}`
    ).toBeLessThan(REDGIFS_THRESHOLD);
  });

  test('lightbox video reaches HAVE_CURRENT_DATA without firing an error', async ({ page }) => {
    await page.goto('/?r=pics');
    const gridCount = await waitForGrid(page);
    await openFirstItem(page);

    async function hasRealVideo() {
      return await page.locator(`${LIGHTBOX} video`).evaluateAll(
        (els) => els.some((v) => v.src && !/\/api\/external\/redgifs\//.test(v.src))
      );
    }

    const scanLimit = Math.min(gridCount, MAX_ITEMS_TO_SCAN);
    let scanned = 1;
    let found = await hasRealVideo();
    while (!found && scanned < scanLimit) {
      await page.locator(LIGHTBOX_NEXT).click();
      await page.waitForTimeout(400);
      scanned += 1;
      found = await hasRealVideo();
    }

    if (!found) {
      test.skip(true, `no native-video item found in first ${scanned} grid items (fixture is image-only with one stubbed RedGIFs)`);
    }

    const realVideo = page.locator(`${LIGHTBOX} video`).filter({
      hasNot: page.locator('[src*="/api/external/redgifs/"]')
    }).first();

    await realVideo.evaluate((v) => {
      v.dataset.e2eError = '0';
      v.addEventListener('error', () => { v.dataset.e2eError = '1'; }, { once: true });
    });

    await page.waitForFunction(
      () => {
        const videos = Array.from(document.querySelectorAll('[role="dialog"] video'));
        return videos.some((v) => v.readyState >= 2 && v.src && !/\/api\/external\/redgifs\//.test(v.src));
      },
      undefined,
      { timeout: 15_000 }
    );

    const errored = await realVideo.evaluate((v) => v.dataset.e2eError);
    expect(errored, 'video must not fire an error event before reaching HAVE_CURRENT_DATA').toBe('0');
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

const here = path.dirname(fileURLToPath(import.meta.url));
const subredditFixturePath = path.join(here, 'fixtures', 'subreddit-pics.json');
const subredditFixture = JSON.parse(fs.readFileSync(subredditFixturePath, 'utf-8'));

const MINIMAL_MP4_BODY = Buffer.alloc(0);

export async function stubBackend(page) {
  await page.route('**/api/subreddit/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(subredditFixture)
    });
  });

  await page.route('**/api/external/redgifs/*', async (route) => {
    if (route.request().url().includes('/stream')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, mp4Url: null, hlsUrl: null })
    });
  });

  await page.route('**/api/external/redgifs/*/stream', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      body: MINIMAL_MP4_BODY
    });
  });
}

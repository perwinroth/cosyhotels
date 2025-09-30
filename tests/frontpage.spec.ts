import { test, expect } from '@playwright/test';

test('front page shows 9 cosy≥7 tiles with seal', async ({ page }) => {
  await page.goto('/en/hotels');
  // Wait for grid to render
  await page.waitForSelector('.brand-border');
  const tiles = await page.$$('.brand-border');
  expect(tiles.length).toBe(9);
  for (const tile of tiles) {
    const cosyAttr = await tile.getAttribute('data-cosy');
    expect(cosyAttr).toBeTruthy();
    const cosy = parseFloat(String(cosyAttr));
    expect(cosy).toBeGreaterThanOrEqual(7.0);
  }
});


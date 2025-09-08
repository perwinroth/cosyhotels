import { test, expect } from '@playwright/test';

const BASE = process.env.TARGET_URL || 'http://localhost:3000';

test('home: top cosy grid renders images', async ({ page }) => {
  await page.goto(new URL('/en', BASE).toString(), { waitUntil: 'networkidle' });
  const cards = page.locator('a[aria-label*="cosy score"], a[href*="/en/hotels/"]');
  await expect(cards.first()).toBeVisible();
  const imgs = page.locator('img, picture img');
  await expect(imgs.first()).toBeVisible();
});

test('listings: grouped by cosy, filters update URL and results', async ({ page }) => {
  await page.goto(new URL('/en/hotels?sort=cosy-desc', BASE).toString(), { waitUntil: 'networkidle' });
  await expect(page.getByText('High cosy')).toBeVisible();
  const before = await page.locator('[aria-live="polite"]').innerText();
  // click first amenity chip
  const chip = page.locator('button[aria-pressed]').first();
  await chip.click();
  await page.waitForTimeout(300); // wait for router update
  await expect(page).toHaveURL(/amenity=/);
  const after = await page.locator('[aria-live="polite"]').innerText();
  expect(before).not.toEqual(after);
});

test('shortlist: save -> toast -> page shows item', async ({ page }) => {
  await page.goto(new URL('/en/hotels?sort=cosy-desc', BASE).toString(), { waitUntil: 'networkidle' });
  const saveBtn = page.getByRole('button', { name: /save to shortlist/i }).first();
  await saveBtn.click();
  // toast appears
  await expect(page.getByText(/Saved to Shortlist/i)).toBeVisible();
  // navigate to shortlist
  await page.getByRole('link', { name: /View/ }).click();
  await expect(page).toHaveURL(/\/shortlists\//);
  // at least one card exists
  const cards = page.locator('a[href*="/en/hotels/"]');
  await expect(cards.first()).toBeVisible();
});

test('tiles: details and visit site actions work', async ({ page, context }) => {
  await page.goto(new URL('/en/hotels?sort=cosy-desc', BASE).toString(), { waitUntil: 'networkidle' });
  // Prefer a curated tile (has price and Visit site button)
  const visitBtn = page.getByRole('link', { name: /visit site/i }).first();
  await expect(visitBtn).toBeVisible();
  const [popup] = await Promise.all([
    context.waitForEvent('page'),
    visitBtn.click(),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  // Should go to partner.example (sample data) or Google domain fallback
  const href = popup.url();
  expect(/partner\.example|google\./.test(href)).toBeTruthy();
});

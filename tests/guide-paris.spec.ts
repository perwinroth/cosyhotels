import { test, expect } from '@playwright/test';

test.skip(!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY, 'Supabase not configured');

test('paris guide shows 9 cosy picks', async ({ page }) => {
  await page.goto('/en/guides/paris-cosy-hotel');
  // Wait for list to render
  await page.waitForSelector('ol li');
  const items = await page.$$('ol li');
  expect(items.length).toBe(9);
});


import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE = process.env.TARGET_URL || process.env.BASE_URL || 'http://localhost:3000';
const routes = [
  '/',
  '/en',
  '/en/hotels?sort=cosy-desc',
  '/en/collections',
  '/en/privacy',
  '/shortlists',
];

function safe(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

test('capture UI snapshots', async ({ page }) => {
  const outDir = path.resolve('screenshots');
  fs.mkdirSync(outDir, { recursive: true });

  for (const r of routes) {
    const url = new URL(r, BASE).toString();
    await page.goto(url, { waitUntil: 'networkidle' });
    // small settle time for fonts/images
    await page.waitForTimeout(500);
    const name = safe(r || 'home') || 'home';
    await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: true });
    const html = await page.content();
    fs.writeFileSync(path.join(outDir, `${name}.html`), html, 'utf8');
  }
});


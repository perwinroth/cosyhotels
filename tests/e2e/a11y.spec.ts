import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.TARGET_URL || 'http://localhost:3000';
const routes = ['/', '/en', '/en/hotels?sort=cosy-desc', '/en/privacy', '/shortlists'];

for (const r of routes) {
  test(`a11y: ${r}`, async ({ page }) => {
    await page.goto(new URL(r, BASE).toString(), { waitUntil: 'networkidle' });
    const a11yScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const severe = a11yScanResults.violations.filter(v => ['serious','critical'].includes(v.impact || ''));
    expect(severe, `Accessibility issues on ${r}:\n${JSON.stringify(severe, null, 2)}`).toEqual([]);
  });
}


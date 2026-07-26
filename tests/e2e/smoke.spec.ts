import { test, expect } from '@playwright/test';

test.describe('PromtGen V4 Smoke Tests', () => {
  test('loads the application shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PromtGen/);
  });

  test('renders the main app container', async ({ page }) => {
    await page.goto('/');
    const app = page.locator('#root');
    await expect(app).toBeVisible();
  });

  test('has no console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors).toEqual([]);
  });
});

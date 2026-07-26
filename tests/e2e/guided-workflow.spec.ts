import { test, expect } from '@playwright/test';

test.describe('PromtGen guided production workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('promtgen-v4');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => resolve();
      });
    });
    await page.reload();
  });

  test('short idea remains in the expansion phase and survives reload', async ({ page }) => {
    await page.getByLabel('Ne yapmak istiyorsun?').fill('S&box içinde at sistemi yapmak istiyorum');
    await page.getByRole('button', { name: 'Fikri analiz et' }).click();

    await expect(page.getByText('AŞAMA 1: FİKİR BÜYÜTÜCÜ')).toBeVisible();
    await expect(page.getByText('Canonical Plan', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /Projelerin \(1\)/ })).toBeVisible();
  });

  test('AI settings button opens the real provider dialog', async ({ page }) => {
    const trigger = page.getByRole('button', { name: /AI:/ });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  for (const width of [320, 375, 768, 1024, 1440]) {
    test(`start screen has no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('#main-content')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });
  }

  test('language selection updates the visible onboarding copy', async ({ page }) => {
    await page.getByLabel('Çıktı dili').selectOption('en');
    await expect(page.getByRole('heading', { name: /Share your idea/ })).toBeVisible();
    await expect(page.getByLabel('What do you want to build?')).toBeVisible();
  });

  test('skip link and keyboard focus expose the primary task', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: 'Ana içeriğe geç' });
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#idea-input')).toBeFocused();
  });
});

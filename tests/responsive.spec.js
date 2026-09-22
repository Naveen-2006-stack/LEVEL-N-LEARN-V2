import { test, expect } from '@playwright/test';

test.describe('LevelNLearn Responsive Viewport Matrix Audit', () => {
  const viewports = [
    { name: 'Mobile (390x844)', width: 390, height: 844 },
    { name: 'Tablet (768x1024)', width: 768, height: 1024 },
    { name: 'Laptop (1280x720)', width: 1280, height: 720 },
    { name: 'Desktop (1440x900)', width: 1440, height: 900 },
    { name: 'FHD (1920x1080)', width: 1920, height: 1080 },
  ];

  for (const vp of viewports) {
    test(`Renders Landing Page cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Verify no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 2px tolerance for subpixel rendering

      // Verify headline is visible
      await expect(page.locator('text=Learn. Quiz.')).toBeVisible();

      // Verify Room PIN input is visible and usable
      const pinInput = page.locator('input[placeholder="ENTER 6-DIGIT PIN"]');
      await expect(pinInput).toBeVisible();
    });

    test(`Renders Dashboard cleanly at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');

      // Sign in
      await page.click('button:has-text("Sign In")');
      await page.fill('input[type="email"]', 'responsiveuser@srmist.edu.in');
      await page.fill('input[type="password"]', 'pass123');
      await page.click('button:has-text("Sign In & Continue")');
      await page.waitForURL('**/dashboard');

      // Verify dashboard elements
      await expect(page.locator('text=Multi-LLM Quiz Studio')).toBeVisible();
      await expect(page.locator('text=Campus Quiz Bank')).toBeVisible();

      // Check no horizontal scroll overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    });
  }
});

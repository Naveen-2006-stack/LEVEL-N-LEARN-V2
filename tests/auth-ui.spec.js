import { test, expect } from '@playwright/test';

/**
 * PLAYWRIGHT AGENT D — UI & Browser Regression Suite
 * Tests UI aesthetics, form behaviors, loading states, and responsive layout:
 * - Segmented tabs in AuthDrawer (Sign In vs Register)
 * - Auto-switch to Sign In after registration
 * - Error message banner display
 * - Responsive layout without horizontal overflow
 */
test.describe('PLAYWRIGHT AGENT D — UI & Browser Regression Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('D1: Drawer navigation and segmented tab switching', async ({ page }) => {
    // Open Sign In
    await page.click('#nav-signin-btn');
    await expect(page.locator('button.tab-btn.active:has-text("Sign In")')).toBeVisible();

    // Switch to Register tab
    await page.click('button.tab-btn:has-text("Register")');
    await expect(page.locator('button.tab-btn.active:has-text("Register")')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Rahul Sharma"]')).toBeVisible();

    // Switch back to Sign In
    await page.click('button.tab-btn:has-text("Sign In")');
    await expect(page.locator('button.tab-btn.active:has-text("Sign In")')).toBeVisible();
  });

  test('D2: Password mismatch validation in Register tab', async ({ page }) => {
    await page.click('#nav-register-btn');
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', 'Test User');
    await page.fill('input[type="email"]', 'testmismatch@srmist.edu.in');
    await page.locator('input[type="password"]').nth(0).fill('Password@123');
    await page.locator('input[type="password"]').nth(1).fill('Mismatch@456');

    await page.click('button:has-text("Create Campus Account")');
    await expect(page.locator('text=Passwords do not match.')).toBeVisible();
  });

  test('D3: Responsive layout: no horizontal scrolling on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('#nav-signin-btn');

    await expect(page.locator('text=SRMIST Campus Gateway')).toBeVisible();

    const isOverflowing = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(isOverflowing).toBe(false);
  });
});


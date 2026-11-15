import { test, expect } from '@playwright/test';

/**
 * PLAYWRIGHT AGENT A — Account Persistence & Multi-Context Lifecycle Suite
 * Verifies that registered accounts genuinely persist across:
 * - Browser closure (isolated browser contexts)
 * - Sign out / sign in cycles
 * - Page refreshes
 * - Server process continuity
 */
test.describe('PLAYWRIGHT AGENT A — Account Persistence & Multi-Context Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Existing registered account remains valid and authenticates across fresh browser context', async ({ browser }) => {
    // Context 1: Registration
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('/');

    const ts = Date.now();
    const testEmail = `scholar_${ts}@srmist.edu.in`;
    const testPassword = 'CampusPassword@2026';
    const testFullName = 'Persistence Scholar';

    // Verify registration tab in drawer
    await page1.click('#nav-register-btn');
    await page1.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');

    await page1.fill('input[placeholder="e.g. Rahul Sharma"]', testFullName);
    await page1.fill('input[type="email"]', testEmail);
    await page1.locator('input[type="password"]').nth(0).fill(testPassword);
    await page1.locator('input[type="password"]').nth(1).fill(testPassword);

    await page1.click('button:has-text("Create Campus Account")');

    // Confirm registration succeeded
    await expect(page1.locator('text=Campus account created!')).toBeVisible({ timeout: 10000 });

    // Strict decoupling check: registration must NOT automatically log in
    expect(page1.url()).not.toContain('/dashboard');
    const storedBeforeLogin = await page1.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(storedBeforeLogin).toBeNull();

    // Close Context 1 completely (simulating browser closure)
    await context1.close();

    // Context 2: Fresh browser context reopening site
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');

    // Sign in with the registered credentials
    await page2.click('#nav-signin-btn');
    await page2.waitForSelector('input[type="email"]');

    await page2.fill('input[type="email"]', testEmail);
    await page2.fill('input[type="password"]', testPassword);
    await page2.click('button:has-text("Sign In & Continue")');

    // Should successfully navigate to dashboard
    await page2.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page2.locator('text=Welcome back')).toBeVisible();

    // Verify session token is present in localStorage
    const storedUser = await page2.evaluate(() => {
      const data = localStorage.getItem('levelnlearn_srmist_user');
      return data ? JSON.parse(data) : null;
    });
    expect(storedUser).not.toBeNull();
    expect(storedUser.email).toBe(testEmail.toLowerCase());
    expect(storedUser.token).toBeDefined();

    // Logout and log in again
    await page2.locator('button:has-text("Sign Out")').first().click();
    await page2.waitForURL('**/');

    const storedAfterLogout = await page2.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(storedAfterLogout).toBeNull();

    // Second login attempt in same context
    await page2.click('#nav-signin-btn');
    await page2.fill('input[type="email"]', testEmail);
    await page2.fill('input[type="password"]', testPassword);
    await page2.click('button:has-text("Sign In & Continue")');

    await page2.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page2.locator('text=Welcome back')).toBeVisible();

    await context2.close();
  });

  test('Page refresh on dashboard preserves session token and identity', async ({ page }) => {
    // Sign in with known seeded scholar
    await page.goto('/');
    await page.click('#nav-signin-btn');
    await page.fill('input[type="email"]', 'scholar@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // Refresh page
    await page.reload();
    await expect(page.locator('text=Welcome back')).toBeVisible();
    expect(page.url()).toContain('/dashboard');
  });
});


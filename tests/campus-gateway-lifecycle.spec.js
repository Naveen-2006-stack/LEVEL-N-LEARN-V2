import { test, expect } from '@playwright/test';

test.describe('SRMIST Campus Gateway — Complete Existing Account & Lifecycle Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
  });

  test('Section 1 & 21: Register -> Login on FIRST attempt -> Logout -> Login again -> Duplicate Registration Blocked', async ({ page }) => {
    const testEmail = `test-gateway-${Date.now()}@srmist.edu.in`;
    const testPassword = 'TestPassword@123';
    const testFullName = 'Campus Gateway Tester';

    // 1. Open Auth Drawer / Modal
    await page.click('#nav-register-btn');
    await page.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');

    // 2. Fill Register Form
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', testFullName);
    await page.fill('input[type="email"]', testEmail);
    await page.locator('input[type="password"]').nth(0).fill(testPassword);
    await page.locator('input[type="password"]').nth(1).fill(testPassword);

    // 3. Submit Registration
    await page.click('button:has-text("Create Campus Account")');

    // 4. Verify Success Banner and Automatic Switch to Sign In Tab
    await expect(page.locator('text=Campus account created!')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');

    // 5. Fill Password on Sign In tab and authenticate (FIRST LOGIN)
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Sign In & Continue")');

    // 6. Verify Dashboard Loaded Immediately on First Login
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // 7. Log Out
    await page.locator('button:has-text("Sign Out")').first().click();
    await page.waitForURL('**/');
    await expect(page.locator('text=Learn. Quiz.')).toBeVisible();

    // 8. Returning User Login using exactly same credentials
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Sign In & Continue")');

    // 9. Verify Returning User Logs In Immediately
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();

    // 10. Logout again
    await page.locator('button:has-text("Sign Out")').first().click();
    await page.waitForURL('**/');

    // 11. Attempt to Register the same email a second time
    await page.click('#nav-register-btn');
    await page.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');
    await page.fill('input[placeholder="e.g. Rahul Sharma"]', testFullName);
    await page.fill('input[type="email"]', testEmail);
    await page.locator('input[type="password"]').nth(0).fill('SomeOtherPassword@999');
    await page.locator('input[type="password"]').nth(1).fill('SomeOtherPassword@999');
    await page.click('button:has-text("Create Campus Account")');

    // 12. Must be REJECTED as an existing account
    await expect(page.locator('text=An account with this campus email already exists. Please sign in.')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');
  });

  test('Section 1 test account with example.com test domain', async ({ page }) => {
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword@123';

    await page.click('#nav-register-btn');
    await page.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');

    await page.fill('input[placeholder="e.g. Rahul Sharma"]', 'Example Tester');
    await page.fill('input[type="email"]', testEmail);
    await page.locator('input[type="password"]').nth(0).fill(testPassword);
    await page.locator('input[type="password"]').nth(1).fill(testPassword);
    await page.click('button:has-text("Create Campus Account")');

    await expect(page.locator('text=Campus account created!')).toBeVisible();

    await page.fill('input[type="password"]', testPassword);
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });
});

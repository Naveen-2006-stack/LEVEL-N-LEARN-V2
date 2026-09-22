import { test, expect } from '@playwright/test';

test.describe('LevelNLearn SRMIST Campus Authentication Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
  });

  test('Rejects non-SRMIST email addresses and shows domain validation warning', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');

    // Fill non-campus email (e.g. gmail.com)
    await page.fill('input[type="email"]', 'student@gmail.com');
    await page.fill('input[type="password"]', 'secret123');

    // Verify warning badge appears
    await expect(page.locator('text=Must be an official @srmist.edu.in address')).toBeVisible();

    // Verify submit button is disabled
    const submitBtn = page.locator('button:has-text("Sign In & Continue")');
    await expect(submitBtn).toBeDisabled();
  });

  test('Rejects valid email with INCORRECT password and NEVER logs in', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');

    // Fill known valid SRMIST email with deliberately wrong password
    await page.fill('input[type="email"]', 'student123@srmist.edu.in');
    await page.fill('input[type="password"]', 'completely_wrong_password_999');

    // Submit form
    await page.click('button:has-text("Sign In & Continue")');

    // Verify error alert appears
    await expect(page.locator('text=Invalid email or password.')).toBeVisible();

    // Verify dashboard is NOT displayed and URL remains on landing page
    expect(page.url()).not.toContain('/dashboard');

    // Verify no authenticated user state is stored in localStorage
    const storedUser = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(storedUser).toBeNull();
  });

  test('Rejects UNKNOWN email with any password and NEVER logs in', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');

    // Fill unknown campus email
    await page.fill('input[type="email"]', 'nonexistent_scholar_9999@srmist.edu.in');
    await page.fill('input[type="password"]', 'anypassword123');

    await page.click('button:has-text("Sign In & Continue")');

    // Verify error alert appears
    await expect(page.locator('text=Invalid email or password.')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');
  });

  test('Accepts official @srmist.edu.in email with CORRECT password and logs in', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');

    // Fill valid SRMIST credentials
    await page.fill('input[type="email"]', 'student123@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass1234');

    // Verify verified badge appears
    await expect(page.locator('text=Verified Campus Credential')).toBeVisible();

    // Submit form
    await page.click('button:has-text("Sign In & Continue")');

    // Should navigate to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.getByText('student123@srmist.edu.in').first()).toBeVisible();

    // Verify token exists in localStorage
    const stored = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored);
    expect(parsed.token).toBeDefined();
  });

  test('Super Admin account can access Super Admin Console', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');

    await page.fill('input[type="email"]', 'quizsrm@gmail.com');
    await page.fill('input[type="password"]', 'adminpass');
    await page.click('button:has-text("Sign In & Continue")');

    // Should navigate to admin console
    await page.waitForURL('**/admin-console');
    await expect(page.locator('text=Super Admin Console')).toBeVisible();
    await expect(page.locator('text=System Metrics')).toBeVisible();
  });

  test('User registration creates account, prompts for login, and does NOT auto-login', async ({ page }) => {
    await page.click('#nav-register-btn');
    await page.waitForSelector('input[placeholder="e.g. Rahul Sharma"]');

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const testEmail = `scholar_${randomSuffix}@srmist.edu.in`;

    await page.fill('input[placeholder="e.g. Rahul Sharma"]', 'Test Scholar');
    await page.fill('input[type="email"]', testEmail);
    await page.locator('input[type="password"]').nth(0).fill('strongpassword123');
    await page.locator('input[type="password"]').nth(1).fill('strongpassword123');

    await page.click('button:has-text("Create Campus Account")');

    // Verify success banner appears and tab switches to Sign In (does not auto-redirect to /dashboard)
    await expect(page.locator('text=Campus account created!')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');

    // Verify localStorage has NOT been populated with an unauthenticated session
    const stored = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(stored).toBeNull();

    // Now sign in with the registered credentials
    await page.fill('input[type="password"]', 'strongpassword123');
    await page.click('button:has-text("Sign In & Continue")');

    // Successfully navigates to dashboard after proper sign in
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('User can sign out cleanly and return to landing page', async ({ page }) => {
    await page.click('#nav-signin-btn');
    await page.fill('input[type="email"]', 'scholar@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Sign Out')).toBeVisible();

    // Click Sign Out
    await page.locator('button:has-text("Sign Out")').first().click();

    // Redirects to landing page
    await page.waitForURL('**/');
    await expect(page.locator('text=Learn. Quiz.')).toBeVisible();
  });
});

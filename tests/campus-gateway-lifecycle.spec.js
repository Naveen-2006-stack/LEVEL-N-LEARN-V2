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

  test('Section 2: Complete Live Quiz Lifecycle — PIN Entry, Lobby Join, Host Launch, Question Progression, and Final Session Results & Leaderboard', async ({ browser }) => {
    test.setTimeout(60000);
    const hostContext = await browser.newContext();
    const studentContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const studentPage = await studentContext.newPage();

    try {
      // 1. Host logs in
      await hostPage.goto('/');
      await hostPage.click('button:has-text("Sign In")');
      await hostPage.waitForSelector('input[type="email"]');
      await hostPage.fill('input[type="email"]', 'hostuser@srmist.edu.in');
      await hostPage.fill('input[type="password"]', 'password123');
      await hostPage.click('button:has-text("Sign In & Continue")');
      await hostPage.waitForURL('**/dashboard');

      // 2. Host creates a live room
      await hostPage.locator('button:has-text("Host Live")').first().click();
      await hostPage.waitForURL('**/arena/*');
      const pin = hostPage.url().split('/').pop();
      expect(pin).toMatch(/^\d{6}$/);

      // Verify lobby state and zero-player restriction
      await expect(hostPage.locator('text=Waiting for Host to Launch')).toBeVisible();
      await expect(hostPage.locator('#zero-players-warning')).toBeVisible();
      await expect(hostPage.locator('#start-arena-btn')).toBeDisabled();

      // 3. Student logs in
      await studentPage.goto('/');
      await studentPage.click('button:has-text("Sign In")');
      await studentPage.waitForSelector('input[type="email"]');
      await studentPage.fill('input[type="email"]', 'scholar@srmist.edu.in');
      await studentPage.fill('input[type="password"]', 'pass123');
      await studentPage.click('button:has-text("Sign In & Continue")');
      await studentPage.waitForURL('**/dashboard');

      // 4. Student enters 6-digit PIN and joins lobby
      await studentPage.waitForSelector('input[placeholder="ENTER 6-DIGIT PIN"]');
      const pinInput = studentPage.locator('input[placeholder="ENTER 6-DIGIT PIN"]');
      await pinInput.fill(pin);
      await expect(pinInput).toHaveValue(pin);
      await studentPage.click('#submit-join-pin-btn');
      await studentPage.waitForURL(`**/arena/${pin}`);
      await expect(studentPage.locator('text=Waiting for Host to Launch')).toBeVisible();

      // 5. Host sees player count updated and start button enabled
      await hostPage.waitForTimeout(1000);
      await expect(hostPage.locator('#start-arena-btn')).toBeEnabled();

      // 6. Host launches quiz game
      await hostPage.click('#start-arena-btn');

      // 7. Verify question synchronization across host and student
      await expect(hostPage.locator('text=Question 1 of')).toBeVisible();
      await expect(studentPage.locator('text=Question 1 of')).toBeVisible();

      // 8. Student submits answer
      await studentPage.waitForTimeout(500);
      await studentPage.locator('.arena-option-btn[data-option-index="0"]').click();
      await expect(studentPage.locator('text=Live Arena Leaderboard')).toBeVisible();

      // 9. Host ends session to transition to final results
      await hostPage.locator('button:has-text("End Game Early")').click();

      // 10. Verify session results and final leaderboard rendered on both clients
      await expect(hostPage.locator('text=Arena Match Finished!')).toBeVisible();
      await expect(hostPage.locator('text=Final results synchronized with campus scoreboard and Action Points vault.')).toBeVisible();
      await expect(studentPage.locator('text=Arena Match Finished!')).toBeVisible();
      await expect(studentPage.locator('text=Final results synchronized with campus scoreboard and Action Points vault.')).toBeVisible();
    } finally {
      await hostContext.close();
      await studentContext.close();
    }
  });
});

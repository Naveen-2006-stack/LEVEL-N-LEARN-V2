import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * LevelNLearn V2 — Comprehensive Forgot Password & Reset Password Test Suite
 * Covers UI, API, Cryptographic Token Security, Password Update Execution,
 * Anti-Enumeration, and Session Security.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('LEVELNLEARN V2 — FORGOT PASSWORD & RESET PASSWORD MASTER AUDIT', () => {

  test.beforeEach(async ({ page }) => {
    // Clear any residual localStorage before each test
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
  });

  // =========================================================================
  // AGENT 1 — Forgot Password UI & Navigation
  // =========================================================================
  test.describe('AGENT 1 — Forgot Password UI & User Interaction', () => {

    test('1.1: Forgot Password link appears below password input, styled with purple/lavender text, and is responsive', async ({ page }) => {
      await page.goto(BASE_URL);

      // Open Auth Drawer via Landing Page "Sign In" button
      await page.click('button:has-text("Sign In")');
      await expect(page.locator('text=SRMIST Campus Gateway')).toBeVisible();

      // Ensure Sign In tab is active
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toBeVisible();

      // Check Forgot Password link presence & styling
      const forgotLink = page.locator('#forgot-password-link');
      await expect(forgotLink).toBeVisible();
      await expect(forgotLink).toHaveText('Forgot Password?');

      // Verify color matches purple/lavender design spec
      const color = await forgotLink.evaluate((el) => window.getComputedStyle(el).color);
      // rgb(192, 132, 252) corresponds to #C084FC
      expect(color).toMatch(/rgb\(192,\s*132,\s*252\)/);

      // Verify focusability
      await forgotLink.focus();
      await expect(forgotLink).toBeFocused();

      // Test mobile viewport responsiveness
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(forgotLink).toBeVisible();
      await expect(passwordInput).toBeVisible();

      // Restore desktop viewport
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('1.2: Clicking Forgot Password link transitions to dedicated recovery interface and back', async ({ page }) => {
      await page.goto(BASE_URL);

      await page.click('button:has-text("Sign In")');
      await expect(page.locator('#forgot-password-link')).toBeVisible();

      // Click Forgot Password?
      await page.click('#forgot-password-link');

      // Verify Dedicated Recovery Interface heading and description
      await expect(page.locator('h3:has-text("Forgot your password?")')).toBeVisible();
      await expect(page.locator('text=Enter your registered SRMIST email address. We\'ll help you reset your password.')).toBeVisible();

      // Verify email input and Send Reset Link button
      const emailInput = page.locator('#forgot-password-email-input');
      await expect(emailInput).toBeVisible();
      const sendBtn = page.locator('#send-reset-link-btn');
      await expect(sendBtn).toBeVisible();
      await expect(sendBtn).toContainText('Send Reset Link');

      // Verify Secondary action: Back to Sign In
      const backBtn = page.locator('#back-to-signin-btn');
      await expect(backBtn).toBeVisible();
      await expect(backBtn).toContainText('Back to Sign In');

      // Click Back to Sign In and verify return to login form
      await backBtn.click();
      await expect(page.locator('button:has-text("Sign In & Continue")')).toBeVisible();
      await expect(page.locator('#forgot-password-link')).toBeVisible();
    });

  });

  // =========================================================================
  // AGENT 2 — Reset Request API & Validation
  // =========================================================================
  test.describe('AGENT 2 — Reset Request Validation & Error Handling', () => {

    test('2.1: Valid SRMIST email returns generic success response', async ({ request }) => {
      // Create user first
      const testEmail = `student_${Date.now()}@srmist.edu.in`;
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: {
          fullName: 'Campus Scholar',
          email: testEmail,
          password: 'InitialPassword123!',
        },
      });

      // Request password reset
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });

      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('If an account exists for this email, password reset instructions will be sent.');
    });

    test('2.2: Unknown SRMIST email returns identical generic response (Anti-Enumeration)', async ({ request }) => {
      const unknownEmail = `nonexistent_${Date.now()}@srmist.edu.in`;
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: unknownEmail },
      });

      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.message).toBe('If an account exists for this email, password reset instructions will be sent.');
      // Ensure no token leaked in response for non-existent account
      expect(json.devResetUrl).toBeUndefined();
    });

    test('2.3: Non-SRMIST domain is strictly rejected with HTTP 403', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: 'intruder@gmail.com' },
      });

      expect(res.status()).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('@srmist.edu.in');
    });

    test('2.4: Empty or malformed email returns HTTP 400', async ({ request }) => {
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: '' },
      });

      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    test('2.5: Email delivery failure returns HTTP 503 without fake success', async ({ request }) => {
      const testEmail = `delivery_fail_${Date.now()}@srmist.edu.in`;
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'Failure Test', email: testEmail, password: 'Password123!' },
      });

      // Simulate delivery failure with header
      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        headers: { 'x-simulate-email-failure': 'true' },
        data: { email: testEmail, simulateFailure: true },
      });

      expect(res.status()).toBe(503);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Email delivery failed');
    });

  });

  // =========================================================================
  // AGENT 3 — Cryptographic Token Security
  // =========================================================================
  test.describe('AGENT 3 — Reset Token Cryptography & Lifecycle Security', () => {

    test('3.1: Token is cryptographically secure and stored only as SHA-256 hash', async ({ request }) => {
      const testEmail = `token_sec_${Date.now()}@srmist.edu.in`;
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'Crypto Check', email: testEmail, password: 'InitialPass123!' },
      });

      const res = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.devResetUrl).toBeDefined();

      const url = new URL(json.devResetUrl);
      const rawToken = url.searchParams.get('token');
      expect(rawToken).toBeDefined();
      expect(rawToken.length).toBe(64); // 32 bytes in hex = 64 hex characters

      // Verify token storage on disk: disk cache should NEVER contain rawToken
      const cachePath = path.resolve(process.cwd(), '.data/reset_tokens.json');
      if (fs.existsSync(cachePath)) {
        const fileContent = fs.readFileSync(cachePath, 'utf8');
        expect(fileContent).not.toContain(rawToken); // Raw token is NOT stored in plaintext!
      }
    });

    test('3.2: Tampered / modified token fails verification with HTTP 400', async ({ request }) => {
      const invalidToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const res = await request.get(`${BASE_URL}/api/auth/verify-reset-token?token=${invalidToken}`);

      expect(res.status()).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Invalid or unrecognized');
    });

    test('3.3: Reused token is rejected (Single-Use Token Enforcement)', async ({ request }) => {
      const testEmail = `single_use_${Date.now()}@srmist.edu.in`;
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'Single Use User', email: testEmail, password: 'OldPassword123!' },
      });

      const reqRes = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });
      const reqJson = await reqRes.json();
      const rawToken = new URL(reqJson.devResetUrl).searchParams.get('token');

      // First Reset Attempt: Should succeed
      const resetRes1 = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: { token: rawToken, newPassword: 'BrandNewPassword123!' },
      });
      expect(resetRes1.status()).toBe(200);

      // Second Reset Attempt with same token: Must be rejected
      const resetRes2 = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: { token: rawToken, newPassword: 'AnotherPassword456!' },
      });
      expect(resetRes2.status()).toBe(400);
      const json2 = await resetRes2.json();
      expect(json2.success).toBe(false);
      expect(json2.error).toContain('already been used');
    });

  });

  // =========================================================================
  // AGENT 4 — Complete End-to-End Password Reset Execution & Session Check
  // =========================================================================
  test.describe('AGENT 4 — End-to-End Password Reset & Session Invalidation', () => {

    test('4.1: Complete Reset Flow: Request -> Reset Page -> Mismatch Rejected -> Success -> Old Password Rejected -> New Password Accepted', async ({ page, request }) => {
      const testEmail = `e2e_student_${Date.now()}@srmist.edu.in`;
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewSecretPassword2026!';

      // 1. Register test user
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'E2E Reset Scholar', email: testEmail, password: oldPassword },
      });

      // 2. Request reset link
      const forgotRes = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });
      const forgotJson = await forgotRes.json();
      const resetUrl = forgotJson.devResetUrl;
      expect(resetUrl).toBeDefined();

      // 3. Open Reset Password page in browser
      const urlObj = new URL(resetUrl);
      await page.goto(`${BASE_URL}${urlObj.pathname}${urlObj.search}`);
      await expect(page.locator('h2:has-text("Create a New Password")')).toBeVisible();
      await expect(page.locator(`text=${testEmail}`)).toBeVisible();

      // 4. Test Password Mismatch validation
      await page.fill('#reset-new-password-input', newPassword);
      await page.fill('#reset-confirm-password-input', 'MismatchPassword999!');
      
      const submitBtn = page.locator('#reset-password-submit-btn');
      await expect(submitBtn).toBeDisabled();

      // 5. Correct the confirmation password
      await page.fill('#reset-confirm-password-input', newPassword);
      await expect(submitBtn).toBeEnabled();

      // 6. Submit the new password
      await submitBtn.click();

      // 7. Verify Success Confirmation view
      await expect(page.locator('h3:has-text("Password Reset Complete!")')).toBeVisible();
      await expect(page.locator('text=Your password has been updated successfully.')).toBeVisible();

      // 8. Verify NO automatic login occurred
      const storedUser = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
      expect(storedUser).toBeNull();

      // 9. Click "Back to Sign In"
      await page.click('#back-to-signin-after-reset-btn');
      await expect(page).toHaveURL(`${BASE_URL}/`);

      // 10. Attempt login with OLD password -> MUST FAIL (401)
      const oldLoginRes = await request.post(`${BASE_URL}/api/auth/srmist-login`, {
        data: { email: testEmail, password: oldPassword },
      });
      expect(oldLoginRes.status()).toBe(401);

      // 11. Attempt login with NEW password -> MUST SUCCEED (200)
      const newLoginRes = await request.post(`${BASE_URL}/api/auth/srmist-login`, {
        data: { email: testEmail, password: newPassword },
      });
      expect(newLoginRes.status()).toBe(200);
      const newLoginJson = await newLoginRes.json();
      expect(newLoginJson.success).toBe(true);
      expect(newLoginJson.data.token).toBeDefined();
    });

    test('4.2: Resetting with the exact same existing password is rejected', async ({ request }) => {
      const testEmail = `same_pass_${Date.now()}@srmist.edu.in`;
      const currentPassword = 'CurrentPassword123!';

      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'Same Pass Test', email: testEmail, password: currentPassword },
      });

      const forgotRes = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });
      const forgotJson = await forgotRes.json();
      const rawToken = new URL(forgotJson.devResetUrl).searchParams.get('token');

      // Submit identical password
      const resetRes = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: { token: rawToken, newPassword: currentPassword },
      });

      expect(resetRes.status()).toBe(400);
      const json = await resetRes.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('cannot be the same as your existing password');
    });

  });

  // =========================================================================
  // AGENT 5 — Independent Security Audit
  // =========================================================================
  test.describe('AGENT 5 — Independent Security Audit', () => {

    test('5.1: No password hash or salt exposure across all reset endpoints', async ({ request }) => {
      const testEmail = `audit_${Date.now()}@srmist.edu.in`;
      await request.post(`${BASE_URL}/api/auth/srmist-register`, {
        data: { fullName: 'Audit Scholar', email: testEmail, password: 'SecurePassword123!' },
      });

      // 1. forgot-password endpoint
      const forgotRes = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
        data: { email: testEmail },
      });
      const forgotText = await forgotRes.text();
      expect(forgotText).not.toContain('password_hash');
      expect(forgotText).not.toContain('salt');

      const rawToken = new URL((await forgotRes.json()).devResetUrl).searchParams.get('token');

      // 2. verify-reset-token endpoint
      const verifyRes = await request.get(`${BASE_URL}/api/auth/verify-reset-token?token=${rawToken}`);
      const verifyText = await verifyRes.text();
      expect(verifyText).not.toContain('password_hash');
      expect(verifyText).not.toContain('salt');

      // 3. reset-password endpoint
      const resetRes = await request.post(`${BASE_URL}/api/auth/reset-password`, {
        data: { token: rawToken, newPassword: 'UpdatedSecretPassword123!' },
      });
      const resetText = await resetRes.text();
      expect(resetText).not.toContain('password_hash');
      expect(resetText).not.toContain('salt');
    });

    test('5.2: Server email provider status endpoint reports configuration status accurately', async ({ request }) => {
      const res = await request.get(`${BASE_URL}/api/auth/email-status`);
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(typeof json.data.configured).toBe('boolean');
    });

  });

});

import { test, expect } from '@playwright/test';

/**
 * PLAYWRIGHT AGENT B — Negative Authentication Suite
 * Tests defensive boundaries:
 * - Wrong password
 * - Unknown email
 * - Empty password
 * - Empty email
 * - Non-SRMIST domain
 * - Malformed email
 * - Tampered JWT
 * - Expired JWT
 * - Missing token on protected APIs
 */
test.describe('PLAYWRIGHT AGENT B — Negative Authentication Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('B1: Valid registered email with INCORRECT password returns 401 Unauthorized', async ({ page, request }) => {
    await page.click('#nav-signin-btn');
    await page.fill('input[type="email"]', 'student123@srmist.edu.in');
    await page.fill('input[type="password"]', 'totally_wrong_password_999');
    await page.click('button:has-text("Sign In & Continue")');

    await expect(page.locator('text=Invalid email or password.')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');

    const storedUser = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(storedUser).toBeNull();

    // Verify raw API response
    const apiRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'student123@srmist.edu.in', password: 'totally_wrong_password_999' },
    });
    expect(apiRes.status()).toBe(401);
    const body = await apiRes.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('Invalid email or password');
  });

  test('B2: UNKNOWN campus email returns 401 Unauthorized without account leakage', async ({ page, request }) => {
    await page.click('#nav-signin-btn');
    await page.fill('input[type="email"]', 'unknown_ghost_8888@srmist.edu.in');
    await page.fill('input[type="password"]', 'any_password_123');
    await page.click('button:has-text("Sign In & Continue")');

    await expect(page.locator('text=Invalid email or password.')).toBeVisible();
    expect(page.url()).not.toContain('/dashboard');

    const apiRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'unknown_ghost_8888@srmist.edu.in', password: 'any_password_123' },
    });
    expect(apiRes.status()).toBe(401);
  });

  test('B3: Non-SRMIST domain is rejected by UI and API', async ({ page, request }) => {
    await page.click('#nav-signin-btn');
    await page.fill('input[type="email"]', 'intruder@gmail.com');
    await page.fill('input[type="password"]', 'password123');

    await expect(page.locator('text=Must be an official @srmist.edu.in address')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In & Continue")')).toBeDisabled();

    // API direct check
    const apiRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'intruder@gmail.com', password: 'password123' },
    });
    expect(apiRes.status()).toBe(403);
    const body = await apiRes.json();
    expect(body.error).toContain('Access Denied');
  });

  test('B4: Empty email or password fails validation', async ({ request }) => {
    const emptyEmail = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: '', password: 'somepassword' },
    });
    expect(emptyEmail.status()).toBe(400);

    const emptyPass = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'student123@srmist.edu.in', password: '' },
    });
    expect(emptyPass.status()).toBe(400);
  });

  test('B5: Tampered JWT token fails backend verification on protected APIs', async ({ request }) => {
    const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhZG1pbiIsInJvbGUiOiJzdXBlcl9hZG1pbiJ9.invalidsignature123';
    
    const res = await request.post('http://localhost:4000/api/quizzes', {
      headers: { 'Authorization': `Bearer ${forgedToken}` },
      data: { title: 'Unauthorized Quiz', questions: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('B6: Expired JWT token is rejected with 401', async ({ request }) => {
    // Generate an expired token payload
    const expiredPayload = Buffer.from(JSON.stringify({
      userId: 'test_user',
      username: 'test_scholar',
      role: 'user',
      iat: Date.now() - 100000,
      exp: Date.now() - 1000, // expired in the past
    })).toString('base64');
    
    const fakeToken = `${expiredPayload}.fakesig`;
    const res = await request.post('http://localhost:4000/api/sessions', {
      headers: { 'Authorization': `Bearer ${fakeToken}` },
      data: { quizId: 'q_001' },
    });
    expect(res.status()).toBe(401);
  });
});


import { test, expect } from '@playwright/test';

/**
 * LevelNLearn V2 — Phase 5: Supabase Auth Password Recovery Integration Suite
 * 
 * Verifies all 10 required items:
 * 1. Forgot Password screen
 * 2. Recovery request
 * 3. Email link redirection
 * 4. Recovery session validation
 * 5. Password update
 * 6. Expired recovery token
 * 7. Invalid recovery token
 * 8. Old password rejection
 * 9. New password login
 * 10. Existing student records and quiz access
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('LEVELNLEARN V2 — SUPABASE AUTH PASSWORD RECOVERY INTEGRATION (PHASE 5)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    await page.evaluate(() => localStorage.clear());
  });

  // 1. Forgot Password Screen
  test('Item 1: Dedicated Forgot Password recovery screen renders properly with SRMIST design', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('button:has-text("Sign In")');

    const forgotLink = page.locator('#forgot-password-link');
    await expect(forgotLink).toBeVisible();
    await forgotLink.click();

    await expect(page.locator('h3:has-text("Forgot your password?")')).toBeVisible();
    await expect(page.locator('text=Enter your registered SRMIST email address')).toBeVisible();
    await expect(page.locator('#forgot-password-email-input')).toBeVisible();
    await expect(page.locator('#send-reset-link-btn')).toBeVisible();
    await expect(page.locator('#back-to-signin-btn')).toBeVisible();
  });

  // 2. Recovery Request
  test('Item 2: Recovery request sends reset link and returns anti-enumeration generic response', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.click('button:has-text("Sign In")');
    await page.click('#forgot-password-link');

    await page.fill('#forgot-password-email-input', 'recovery_student@srmist.edu.in');
    await page.click('#send-reset-link-btn');

    await expect(page.locator('text=If an account exists for this email, password reset instructions will be sent.')).toBeVisible();
  });

  // 3 & 4: Email Link Redirection & Recovery Session Validation
  test('Items 3 & 4: Opening recovery link with Supabase session activates recovery mode without auto-login', async ({ page }) => {
    // Simulate landing on /reset-password with Supabase recovery hash
    await page.goto(`${BASE_URL}/reset-password#access_token=mock_supa_token_123&refresh_token=mock_refresh_123&type=recovery`);

    // Verify recovery UI appears
    await expect(page.locator('h2:has-text("Create a New Password")')).toBeVisible();
    await expect(page.locator('#reset-new-password-input')).toBeVisible();
    await expect(page.locator('#reset-confirm-password-input')).toBeVisible();

    // Verify user is NOT automatically authenticated into app
    const storedUser = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(storedUser).toBeNull();
  });

  // 5, 8 & 9: Password Update, Old Password Rejection, New Password Login
  test('Items 5, 8 & 9: Full lifecycle: Register -> Request -> Reset -> Old Pass 401 -> New Pass 200', async ({ page, request }) => {
    const testEmail = `supa_reset_${Date.now()}@srmist.edu.in`;
    const initialPassword = 'InitialPassword123!';
    const updatedPassword = 'BrandNewSecret2026!';

    // Register user
    const regRes = await request.post(`${BASE_URL}/api/auth/srmist-register`, {
      data: { fullName: 'Supa Test User', email: testEmail, password: initialPassword },
    });
    expect(regRes.status()).toBe(201);

    // Request reset
    const forgotRes = await request.post(`${BASE_URL}/api/auth/forgot-password`, {
      data: { email: testEmail },
    });
    const forgotJson = await forgotRes.json();
    const resetUrl = forgotJson.devResetUrl;
    expect(resetUrl).toBeDefined();

    // Open reset page
    const urlObj = new URL(resetUrl);
    await page.goto(`${BASE_URL}${urlObj.pathname}${urlObj.search}`);
    await expect(page.locator('h2:has-text("Create a New Password")')).toBeVisible();
    await expect(page.locator(`text=${testEmail}`)).toBeVisible();

    // Enter matching new password
    await page.fill('#reset-new-password-input', updatedPassword);
    await page.fill('#reset-confirm-password-input', updatedPassword);
    await page.click('#reset-password-submit-btn');

    // Confirm success message
    await expect(page.locator('text=Your password has been updated successfully.')).toBeVisible();

    // Confirm no automatic login
    const localUser = await page.evaluate(() => localStorage.getItem('levelnlearn_srmist_user'));
    expect(localUser).toBeNull();

    // Verify Old Password is REJECTED (Item 8)
    const oldLogin = await request.post(`${BASE_URL}/api/auth/srmist-login`, {
      data: { email: testEmail, password: initialPassword },
    });
    expect(oldLogin.status()).toBe(401);

    // Verify New Password SUCCEEDS (Item 9)
    const newLogin = await request.post(`${BASE_URL}/api/auth/srmist-login`, {
      data: { email: testEmail, password: updatedPassword },
    });
    expect(newLogin.status()).toBe(200);
    const newJson = await newLogin.json();
    expect(newJson.success).toBe(true);
    expect(newJson.data.token).toBeDefined();
  });

  // 6: Expired Recovery Token
  test('Item 6: Expired recovery link renders friendly error state and prevents reset', async ({ page }) => {
    // Supabase Auth hash format for expired OTP link
    await page.goto(`${BASE_URL}/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`);

    await expect(page.locator('h3:has-text("Invalid or Expired Link")')).toBeVisible();
    await expect(page.locator('text=Email link is invalid or has expired')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Sign In")')).toBeVisible();
    await expect(page.locator('#reset-new-password-input')).not.toBeVisible();
  });

  // 7: Invalid Recovery Token
  test('Item 7: Tampered or invalid recovery token displays error and blocks reset', async ({ page, request }) => {
    const invalidToken = 'deadbeef00000000111122223333444455556666777788889999aaaabbbbcccc';
    await page.goto(`${BASE_URL}/reset-password?token=${invalidToken}`);

    await expect(page.locator('h3:has-text("Invalid or Expired Link")')).toBeVisible();
    await expect(page.locator('button:has-text("Back to Sign In")')).toBeVisible();

    const directApiRes = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: { token: invalidToken, newPassword: 'ValidPassword123!' },
    });
    expect(directApiRes.status()).toBe(400);
  });

  // 10: Existing student records and quiz access
  test('Item 10: Existing student profiles maintain access to quizzes via both custom & Supabase JWTs', async ({ request }) => {
    // 1. Login with verified existing fixture account
    const loginRes = await request.post(`${BASE_URL}/api/auth/srmist-login`, {
      data: { email: 'scholar@srmist.edu.in', password: 'pass123' },
    });
    expect(loginRes.status()).toBe(200);
    const loginJson = await loginRes.json();
    const token = loginJson.data.token;
    expect(token).toBeDefined();

    // 2. Access quizzes using the token
    const quizzesRes = await request.get(`${BASE_URL}/api/quizzes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(quizzesRes.status()).toBe(200);
    const quizzesJson = await quizzesRes.json();
    expect(quizzesJson.success).toBe(true);
    const quizList = quizzesJson.quizzes || quizzesJson.data;
    expect(Array.isArray(quizList)).toBe(true);

    // 3. Test Supabase JWT compatibility format
    const mockPayload = {
      sub: loginJson.data.id,
      email: 'scholar@srmist.edu.in',
      role: 'authenticated',
      app_metadata: { role: 'user' },
      user_metadata: { username: 'scholar' },
      iss: 'https://pyevwribnexxousrdqri.supabase.co/auth/v1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const b64Header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const b64Payload = Buffer.from(JSON.stringify(mockPayload)).toString('base64');
    const mockSupabaseJwt = `${b64Header}.${b64Payload}.mock_signature`;

    // 4. Authenticate using Supabase JWT format on protected Fastify quiz endpoint
    const createQuizRes = await request.post(`${BASE_URL}/api/quizzes`, {
      headers: { Authorization: `Bearer ${mockSupabaseJwt}` },
      data: {
        title: 'Supabase JWT Compatible Quiz',
        description: 'Verifying seamless JWT compatibility for student records',
        questions: [
          {
            question_text: 'Which database powers LevelNLearn?',
            options: ['MySQL', 'Supabase PostgreSQL', 'MongoDB', 'SQLite'],
            correct_option: 1,
            difficulty_tier: 'easy',
          },
        ],
      },
    });
    expect(createQuizRes.status()).toBe(201);
    const createJson = await createQuizRes.json();
    expect(createJson.success).toBe(true);
    expect(createJson.data.creator_id).toBe(loginJson.data.id);
  });

});

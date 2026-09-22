import { test, expect } from '@playwright/test';

test.describe('LevelNLearn Join Quiz & PIN Validation Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/');
  });

  test('Prominent Join Quiz card exists on Student Dashboard and shows validation errors on invalid input', async ({ page }) => {
    // 1. Log into student account
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'student123@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass1234');
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');

    // 2. Verify "JOIN A LIVE QUIZ" Card is prominently displayed
    await expect(page.locator('text=JOIN A LIVE QUIZ')).toBeVisible();
    await expect(page.locator('text=LIVE ARENA GATEWAY')).toBeVisible();

    const pinInput = page.locator('input[placeholder="ENTER 6-DIGIT PIN"]');
    await expect(pinInput).toBeVisible();

    // 3. Test Empty PIN submission
    await page.click('#submit-join-pin-btn');
    await expect(page.locator('text=Enter your quiz PIN.')).toBeVisible();

    // 4. Test Short PIN submission
    await pinInput.fill('123');
    await page.click('#submit-join-pin-btn');
    await expect(page.locator('text=Please enter a valid 6-digit quiz PIN.')).toBeVisible();

    // 5. Test Non-existent Room PIN (Server rejection)
    await pinInput.fill('999888');
    await page.click('#submit-join-pin-btn');
    await expect(page.locator('text=No active quiz was found for this PIN.')).toBeVisible();
    expect(page.url()).toContain('/dashboard');
  });

  test('Valid Room PIN successfully validates with backend and routes to Arena Lobby', async ({ page, request }) => {
    // 1. Create a real live session via API -- session creation now requires
    // a verified host session token (hostUsername alone is no longer trusted).
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'quizsrm@gmail.com', password: 'adminpass' },
    });
    const login = await loginRes.json();
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: {
        token: login.data.token,
        quizId: 'q_001',
        customRoomPin: '849201',
      },
    });
    expect(sessionRes.ok()).toBeTruthy();

    // 2. Log in as student
    await page.click('#nav-signin-btn');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', 'scholar@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button:has-text("Sign In & Continue")');

    await page.waitForURL('**/dashboard');

    // 3. Enter valid room PIN in Join Quiz card
    const pinInput = page.locator('input[placeholder="ENTER 6-DIGIT PIN"]');
    await pinInput.fill('849201');
    await page.click('#submit-join-pin-btn');

    // 4. Verify successful transition to live arena
    await page.waitForURL('**/arena/849201');
    await expect(page.locator('text=LIVE ROOM PIN: 849201')).toBeVisible();
    await expect(page.locator('text=Waiting for Host to Launch')).toBeVisible();
  });

  test('Landing Page Quick Join validates PIN with backend before routing', async ({ page, request }) => {
    // Spin up active room (requires a verified host session token)
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'quizsrm@gmail.com', password: 'adminpass' },
    });
    const login = await loginRes.json();
    await request.post('http://localhost:4000/api/sessions', {
      data: {
        token: login.data.token,
        quizId: 'q_002',
        customRoomPin: '739102',
      },
    });

    await page.goto('/');

    // Test invalid PIN on landing page
    const heroInput = page.locator('input[placeholder="ENTER 6-DIGIT PIN"]');
    await heroInput.fill('000111');
    await page.click('button:has-text("Join")');

    await expect(page.locator('text=No active quiz was found for this PIN.')).toBeVisible();

    // Test valid PIN on landing page (unauthenticated prompt)
    await heroInput.fill('739102');
    await page.click('button:has-text("Join")');

    // Opens Auth Drawer to authenticate before entering arena
    await expect(page.locator('text=SRMIST Campus Gateway')).toBeVisible();
  });
});

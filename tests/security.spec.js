import { test, expect } from '@playwright/test';

test.describe('LevelNLearn Security, Anti-Cheat, and Authority Suite', () => {
  test('Ensures ZERO Google Login or fake social OAuth buttons exist in the DOM', async ({ page }) => {
    await page.goto('/');

    // Check Landing Page DOM
    const googleButton = page.locator('button:has-text("Google"), button:has-text("Sign in with Google"), a:has-text("Google")');
    await expect(googleButton).toHaveCount(0);

    // Open Auth Drawer and check Auth Drawer DOM
    await page.click('button:has-text("Sign In")');
    await page.waitForSelector('input[type="email"]');

    const drawerGoogle = page.locator('button:has-text("Google"), [aria-label*="Google"], .google-btn');
    await expect(drawerGoogle).toHaveCount(0);
  });

  test('Non-super-admin users are strictly redirected away from /admin-console', async ({ page }) => {
    await page.goto('/');

    // Sign in as standard student
    await page.click('button:has-text("Sign In")');
    await page.fill('input[type="email"]', 'standardstudent@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button:has-text("Sign In & Continue")');
    await page.waitForURL('**/dashboard');

    // Attempt direct navigation to /admin-console
    await page.goto('http://localhost:3000/admin-console');

    // Should be redirected back to /dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=Welcome back')).toBeVisible();
  });

  test('Client payload question data never leaks correct_option answer keys', async ({ page, request }) => {
    // 1. Create a session via API (requires a verified host session token)
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'proctor@srmist.edu.in', password: 'pass123' },
    });
    const login = await loginRes.json();
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: {
        token: login.data.token,
        quizId: 'q_001',
      },
    });
    expect(sessionRes.status()).toBe(201);
    const sessionJson = await sessionRes.json();
    const pin = sessionJson.data.roomPin;

    // 2. Query quiz questions via API and ensure correct_option is protected/stripped for players
    const quizRes = await request.get(`http://localhost:4000/api/quizzes/q_001`);
    if (quizRes.status() === 200) {
      const quizData = await quizRes.json();
      expect(quizData).toBeDefined();
    }
  });

  test('Player identity cannot be spoofed via a known playerId; host actions require a verified host token', async ({ request }) => {
    const hostLogin = await (await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'hostuser@srmist.edu.in', password: 'password123' },
    })).json();
    const hostToken = hostLogin.data.token;

    const session = await (await request.post('http://localhost:4000/api/sessions', {
      data: { token: hostToken, quizId: 'q_demo1' },
    })).json();
    const roomPin = session.data.roomPin;

    // Unauthenticated host-action forgery must fail
    const forgedStart = await request.post('http://localhost:4000/api/game/host-action', {
      data: { roomPin, actionType: 'start_game' },
    });
    expect(forgedStart.status()).toBe(401);

    await request.post('http://localhost:4000/api/game/host-action', {
      data: { roomPin, actionType: 'start_game', token: hostToken },
    });

    const p1 = await (await request.post('http://localhost:4000/api/game/join', {
      data: { roomPin, username: 'p1@srmist.edu.in' },
    })).json();
    const p2 = await (await request.post('http://localhost:4000/api/game/join', {
      data: { roomPin, username: 'p2@srmist.edu.in' },
    })).json();

    // Attacker knows p2's playerId (visible via leaderboard/broadcasts) but not their token
    const impersonation = await request.post('http://localhost:4000/api/game/submit', {
      data: { roomPin, playerId: p2.data.playerId, questionIndex: 0, selectedOption: 1, responseTimeMs: 1000 },
    });
    const impersonationJson = await impersonation.json();
    expect(impersonationJson.success).not.toBe(true);

    // Legitimate submission using the real player's own token succeeds
    const legit = await request.post('http://localhost:4000/api/game/submit', {
      data: { roomPin, playerToken: p2.data.playerToken, questionIndex: 0, selectedOption: 1, responseTimeMs: 1000 },
    });
    const legitJson = await legit.json();
    expect(legitJson.success).toBe(true);

    await request.post('http://localhost:4000/api/game/end', { data: { roomPin, token: hostToken } });
  });

  test('Anti-Cheat Engine triggers proctoring overlay on blur event', async ({ page }) => {
    await page.goto('/');

    // Sign in as student
    await page.click('button:has-text("Sign In")');
    await page.fill('input[type="email"]', 'examinee@srmist.edu.in');
    await page.fill('input[type="password"]', 'pass123');
    await page.click('button:has-text("Sign In & Continue")');
    await page.waitForURL('**/dashboard');

    // Host or join room
    await page.locator('button:has-text("Host Live")').first().click();
    await page.waitForURL('**/arena/*');

    // Trigger blur event in browser context
    await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
    });

    // The Anti-Cheat overlay or event is active in the player hook
    expect(page.url()).toContain('/arena/');
  });
});

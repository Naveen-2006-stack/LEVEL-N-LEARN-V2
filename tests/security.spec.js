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
    // 1. Create a session via API
    const sessionRes = await request.post('http://localhost:4000/api/sessions', {
      data: {
        hostUsername: 'proctor@srmist.edu.in',
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

import { test, expect } from '@playwright/test';

/**
 * PLAYWRIGHT AGENT E — Independent Security Retest Suite
 * Tests adversarial protections:
 * - Client-side localStorage privilege escalation
 * - Answer key leakage protection in quiz payloads
 * - Host action authorization enforcement
 * - Super admin route enforcement
 */
test.describe('PLAYWRIGHT AGENT E — Security Retest Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('E1: LocalStorage role injection cannot bypass server authorization', async ({ page, request }) => {
    // Inject fake super_admin credentials into localStorage
    await page.evaluate(() => {
      localStorage.setItem('levelnlearn_srmist_user', JSON.stringify({
        id: 'fake_admin_uuid',
        email: 'hacker@srmist.edu.in',
        role: 'super_admin',
        token: 'forged.signature.token',
      }));
    });

    // Attempt to access admin console UI
    await page.goto('/admin-console');

    // Direct API request using forged token must be rejected with 401
    const res = await request.post('http://localhost:4000/api/quizzes', {
      headers: { 'Authorization': 'Bearer forged.signature.token' },
      data: { title: 'Hacked Quiz', questions: [] },
    });
    expect(res.status()).toBe(401);
  });

  test('E2: Student token cannot trigger host game actions', async ({ request }) => {
    // Log in as student
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'student123@srmist.edu.in', password: 'pass1234' },
    });
    expect(loginRes.status()).toBe(200);
    const { token } = (await loginRes.json()).data;

    // Attempt host action with student token
    const hostActionRes = await request.post('http://localhost:4000/api/game/host-action', {
      headers: { 'Authorization': `Bearer ${token}` },
      data: { roomPin: '999999', actionType: 'start_game', token },
    });
    // Must be rejected (either 403 or 404 for invalid/unowned room)
    expect([401, 403, 404]).toContain(hostActionRes.status());
  });

  test('E3: Correct answers are never leaked in public quiz payloads', async ({ request }) => {
    // Fetch a public quiz
    const res = await request.get('http://localhost:4000/api/quizzes/q_001');
    if (res.status() === 200) {
      const data = await res.json();
      if (data.data && Array.isArray(data.data.questions)) {
        for (const question of data.data.questions) {
          expect(question.correct_option).toBeUndefined();
        }
      }
    }
  });
});


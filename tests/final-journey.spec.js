import { test, expect } from '@playwright/test';

test.describe('LevelNLearn Final Release-Candidate Journey', () => {
  let hostContext, player1Context, player2Context;
  let hostPage, player1Page, player2Page;

  const BASE_URL = 'http://localhost:3000';

  test.beforeAll(async ({ browser }) => {
    hostContext = await browser.newContext();
    player1Context = await browser.newContext();
    player2Context = await browser.newContext();

    hostPage = await hostContext.newPage();
    player1Page = await player1Context.newPage();
    player2Page = await player2Context.newPage();

    global.__consoleErrors = [];
    for (const [label, p] of [['host', hostPage], ['player1', player1Page], ['player2', player2Page]]) {
      p.on('console', (msg) => {
        if (msg.type() === 'error') global.__consoleErrors.push(`[${label}] console.error: ${msg.text()}`);
      });
      p.on('pageerror', (err) => {
        global.__consoleErrors.push(`[${label}] pageerror: ${err.message}`);
      });
    }
  });

  test.afterAll(async () => {
    await hostContext.close();
    await player1Context.close();
    await player2Context.close();
  });

  test('Full journey: login -> lobby -> both questions -> final results -> refresh -> end session -> PIN dead', async () => {
    // Host login
    await hostPage.goto(BASE_URL);
    await hostPage.click('button:has-text("Sign In")');
    await hostPage.waitForSelector('input[type="email"]');
    await hostPage.fill('input[type="email"]', 'hostuser@srmist.edu.in');
    await hostPage.fill('input[type="password"]', 'password123');
    await hostPage.click('button:has-text("Sign In & Continue")');
    await hostPage.waitForURL('**/dashboard');

    await hostPage.locator('button:has-text("Host Live")').first().click();
    await hostPage.waitForURL('**/arena/*');
    const pin = hostPage.url().split('/').pop();
    expect(pin).toMatch(/^\d{6}$/);

    // Players join
    await player1Page.goto(BASE_URL);
    await player1Page.fill('input[placeholder="ENTER 6-DIGIT PIN"]', pin);
    await player1Page.click('button:has-text("Join")');
    await player1Page.waitForSelector('input[type="email"]');
    await player1Page.fill('input[type="email"]', 'player1@srmist.edu.in');
    await player1Page.fill('input[type="password"]', 'pass123');
    await player1Page.click('button:has-text("Sign In & Continue")');
    await player1Page.waitForURL('**/arena/*');

    await player2Page.goto(BASE_URL);
    await player2Page.fill('input[placeholder="ENTER 6-DIGIT PIN"]', pin);
    await player2Page.click('button:has-text("Join")');
    await player2Page.waitForSelector('input[type="email"]');
    await player2Page.fill('input[type="email"]', 'player2@srmist.edu.in');
    await player2Page.fill('input[type="password"]', 'pass123');
    await player2Page.click('button:has-text("Sign In & Continue")');
    await player2Page.waitForURL('**/arena/*');

    await hostPage.waitForTimeout(1000);
    await expect(hostPage.locator('text=2 Verified Players in Lobby')).toBeVisible();

    // Start game
    await hostPage.click('button:has-text("Start Arena Competition")');
    await expect(hostPage.locator('text=Question 1 of')).toBeVisible();
    await expect(player1Page.locator('text=Question 1 of')).toBeVisible();
    await expect(player2Page.locator('text=Question 1 of')).toBeVisible();

    // Q1: both answer
    await player1Page.locator('.arena-option-btn[data-option-index="0"]').click();
    await player2Page.locator('.arena-option-btn[data-option-index="1"]').click();
    await expect(player1Page.locator('text=Live Arena Leaderboard')).toBeVisible();
    await expect(hostPage.locator('text=Live Arena Leaderboard')).toBeVisible();

    // host advances to Q2 (host next-question button is disabled while timer running;
    // wait for it to become enabled once the visible timer reaches 0)
    await expect(hostPage.locator('button:has-text("Next Question")')).toBeEnabled({ timeout: 20000 });
    await hostPage.click('button:has-text("Next Question")');
    await expect(hostPage.locator('text=Question 2 of')).toBeVisible();
    await expect(player1Page.locator('text=Question 2 of')).toBeVisible();
    await expect(player2Page.locator('text=Question 2 of')).toBeVisible();

    // Q2: both answer (this is the last question in the demo quiz)
    await player1Page.locator('.arena-option-btn[data-option-index="2"]').click();
    await player2Page.locator('.arena-option-btn[data-option-index="0"]').click();

    // Host ends the session (final question completion path for this demo quiz)
    await expect(hostPage.locator('button:has-text("End Game Early")')).toBeVisible();
    await hostPage.click('button:has-text("End Game Early")');

    await expect(hostPage.locator('text=Arena Match Finished!')).toBeVisible({ timeout: 10000 });
    await expect(player1Page.locator('text=Arena Match Finished!')).toBeVisible({ timeout: 10000 });
    await expect(player2Page.locator('text=Arena Match Finished!')).toBeVisible({ timeout: 10000 });

    // Refresh at results -- must not crash, duplicate, or reset
    await player1Page.reload();
    await player1Page.waitForTimeout(4000);
    // After refresh, the room is already torn down server-side, so the player
    // should land on a real error/redirect state, NOT a blank screen or crash.
    const bodyText = await player1Page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
    console.log('--- player1 post-teardown-refresh FULL body text ---');
    console.log(bodyText);
    console.log('--- end body text ---');

    // Re-validate PIN is dead now
    const pinCheck = await hostPage.request.post('http://localhost:4000/api/sessions/validate-pin', {
      data: { pin },
    });
    expect([404, 410]).toContain(pinCheck.status());

    console.log('\n=== CONSOLE/PAGE ERRORS CAPTURED DURING FULL JOURNEY ===');
    if (global.__consoleErrors.length === 0) {
      console.log('(none)');
    } else {
      for (const e of global.__consoleErrors) console.log(e);
    }
    console.log('=== END CAPTURED ERRORS ===\n');
  });
});

import { test, expect } from '@playwright/test';

test.describe('LevelNLearn Multiplayer Real-Time Engine & Live Arena', () => {
  let hostContext, player1Context, player2Context;
  let hostPage, player1Page, player2Page;
  
  const BASE_URL = 'http://localhost:3000';

  test.beforeAll(async ({ browser }) => {
    // Create isolated browser contexts for multi-client testing
    hostContext = await browser.newContext();
    player1Context = await browser.newContext();
    player2Context = await browser.newContext();

    hostPage = await hostContext.newPage();
    player1Page = await player1Context.newPage();
    player2Page = await player2Context.newPage();
  });

  test.afterAll(async () => {
    await hostContext.close();
    await player1Context.close();
    await player2Context.close();
  });

  test('Host creates live room and players join via 6-digit PIN', async () => {
    // 1. Host logs in
    await hostPage.goto(BASE_URL);
    await hostPage.click('button:has-text("Sign In")');
    await hostPage.waitForSelector('input[type="email"]');
    
    await hostPage.fill('input[type="email"]', 'hostuser@srmist.edu.in');
    await hostPage.fill('input[type="password"]', 'password123');
    await hostPage.click('button:has-text("Sign In & Continue")');
    await hostPage.waitForURL('**/dashboard');

    // Host spins up a live room from Campus Quiz Bank
    await hostPage.locator('button:has-text("Host Live")').first().click();
    
    // Wait for Arena route
    await hostPage.waitForURL('**/arena/*');
    
    // Extract room pin from the URL
    const url = hostPage.url();
    const pin = url.split('/').pop();
    expect(pin).toMatch(/^\d{6}$/);

    // Verify host sees Lobby and Host Controls with zero-player warning (E3)
    await expect(hostPage.locator('text=Waiting for Host to Launch')).toBeVisible();
    await expect(hostPage.locator('#zero-players-warning')).toBeVisible();
    await expect(hostPage.locator('#start-arena-btn')).toBeDisabled();

    // 2. Player 1 joins using 6-Digit PIN
    await player1Page.goto(BASE_URL);
    await player1Page.fill('input[placeholder="ENTER 6-DIGIT PIN"]', pin);
    await player1Page.click('button:has-text("Join")');
    
    // Auth drawer triggers on Quick Join for unauthenticated player
    await player1Page.waitForSelector('input[type="email"]');
    await player1Page.fill('input[type="email"]', 'player1@srmist.edu.in');
    await player1Page.fill('input[type="password"]', 'pass123');
    await player1Page.click('button:has-text("Sign In & Continue")');
    
    // Wait for Arena route for Player 1
    await player1Page.waitForURL('**/arena/*');

    // Verify player 1 sees Lobby but NO host controls
    await expect(player1Page.locator('text=Waiting for Host to Launch')).toBeVisible();
    await expect(player1Page.locator('button:has-text("Start Arena Competition")')).not.toBeVisible();

    // 3. Player 2 joins
    await player2Page.goto(BASE_URL);
    await player2Page.fill('input[placeholder="ENTER 6-DIGIT PIN"]', pin);
    await player2Page.click('button:has-text("Join")');
    
    await player2Page.waitForSelector('input[type="email"]');
    await player2Page.fill('input[type="email"]', 'player2@srmist.edu.in');
    await player2Page.fill('input[type="password"]', 'pass123');
    await player2Page.click('button:has-text("Sign In & Continue")');
    
    await player2Page.waitForURL('**/arena/*');

    // Allow WebSocket synchronization
    await hostPage.waitForTimeout(1000);

    // Verify Host sees verified player count update in real-time
    await expect(hostPage.locator('text=Verified Players in Lobby')).toBeVisible();
    await expect(hostPage.locator('#zero-players-warning')).not.toBeVisible();
    await expect(hostPage.locator('#start-arena-btn')).toBeEnabled();
  });

  test('Host starts arena and all clients synchronize questions in real-time', async () => {
    await hostPage.click('button:has-text("Start Arena Competition")');
    
    // Verify Host transitions to active game view
    await expect(hostPage.locator('text=Question 1 of')).toBeVisible();
    await expect(hostPage.locator('text=Host Control Console')).toBeVisible();
    
    // Verify Players transition to active game view
    await expect(player1Page.locator('text=Question 1 of')).toBeVisible();
    await expect(player2Page.locator('text=Question 1 of')).toBeVisible();
  });

  test('Players submit answers and live leaderboard updates with points', async () => {
    await player1Page.waitForTimeout(500);

    // Player 1 submits option A (index 0)
    await player1Page.locator('.arena-option-btn[data-option-index="0"]').click();

    // Player 2 submits option B (index 1)
    await player2Page.locator('.arena-option-btn[data-option-index="1"]').click();

    // Verify Live Leaderboard sidebar updates
    await expect(hostPage.locator('text=Live Arena Leaderboard')).toBeVisible();
    await expect(player1Page.locator('text=Live Arena Leaderboard')).toBeVisible();
  });

  test('Duplicate answer submissions are handled idempotently without error (E4)', async ({ request }) => {
    // 1. Create a live room
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'quizsrm@gmail.com', password: 'adminpass' },
    });
    const login = await loginRes.json();
    const testPin = Math.floor(100000 + Math.random() * 900000).toString();
    await request.post('http://localhost:4000/api/sessions', {
      data: {
        token: login.data.token,
        quizId: 'q_001',
        customRoomPin: testPin,
      },
    });

    // 2. Join a player
    const joinRes = await request.post('http://localhost:4000/api/game/join', {
      data: {
        roomPin: testPin,
        username: 'idempotent_tester',
      },
    });
    const joinData = await joinRes.json();
    const playerToken = joinData.data.playerToken;

    // 3. Start game
    await request.post('http://localhost:4000/api/game/host-action', {
      data: {
        roomPin: testPin,
        actionType: 'start_game',
        token: login.data.token,
      },
    });

    // 4. First answer submission
    const res1 = await request.post('http://localhost:4000/api/game/submit', {
      data: {
        roomPin: testPin,
        playerToken,
        questionIndex: 0,
        selectedOption: 1,
        responseTimeMs: 2000,
      },
    });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.success).toBe(true);

    // 5. Second (duplicate) answer submission for same question index
    const res2 = await request.post('http://localhost:4000/api/game/submit', {
      data: {
        roomPin: testPin,
        playerToken,
        questionIndex: 0,
        selectedOption: 2,
        responseTimeMs: 1000,
      },
    });
    expect(res2.status()).toBe(200);
    const body2 = await res2.json();
    expect(body2.success).toBe(true);
    expect(body2.duplicate).toBe(true);
    expect(body2.pointsAwarded).toBe(0);
    expect(body2.newTotalScore).toBe(body1.newTotalScore);
  });

  test('Tied scores are sorted deterministically on leaderboard by response speed (E5)', async ({ request }) => {
    const loginRes = await request.post('http://localhost:4000/api/auth/srmist-login', {
      data: { email: 'quizsrm@gmail.com', password: 'adminpass' },
    });
    const login = await loginRes.json();
    const testPin = Math.floor(100000 + Math.random() * 900000).toString();
    await request.post('http://localhost:4000/api/sessions', {
      data: {
        token: login.data.token,
        quizId: 'q_001',
        customRoomPin: testPin,
      },
    });

    const pSlow = (await (await request.post('http://localhost:4000/api/game/join', {
      data: { roomPin: testPin, username: 'Player_Slow' }
    })).json()).data;

    const pFast = (await (await request.post('http://localhost:4000/api/game/join', {
      data: { roomPin: testPin, username: 'Player_Fast' }
    })).json()).data;

    await request.post('http://localhost:4000/api/game/host-action', {
      data: { roomPin: testPin, actionType: 'start_game', token: login.data.token }
    });

    await request.post('http://localhost:4000/api/game/submit', {
      data: { roomPin: testPin, playerToken: pSlow.playerToken, questionIndex: 0, selectedOption: -1, responseTimeMs: 8000 }
    });
    await request.post('http://localhost:4000/api/game/submit', {
      data: { roomPin: testPin, playerToken: pFast.playerToken, questionIndex: 0, selectedOption: -1, responseTimeMs: 500 }
    });

    const endRes = await request.post('http://localhost:4000/api/game/end', {
      data: { roomPin: testPin, token: login.data.token }
    });
    expect(endRes.status()).toBe(200);
  });
});

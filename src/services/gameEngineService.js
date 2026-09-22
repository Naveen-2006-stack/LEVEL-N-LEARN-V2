import crypto from 'crypto';
import { redis } from '../config/redis.js';
import { supabase } from '../config/supabase.js';
import { quizService } from './quizService.js';
import { signAuthToken, verifyAuthToken } from '../utils/cryptoUtils.js';

// Resilient in-memory session registry for zero-downtime offline/test execution
export const inMemorySessions = new Map();

/**
 * Per-player join tokens (Module: Guest Identity Security)
 * Issued once at /game/join and required on every subsequent player action
 * (submitAnswer, violation reports). This is the single source of truth for
 * "who is this player" -- a client-supplied playerId is NEVER trusted for
 * authorization. The token is a cryptographically signed, unguessable secret
 * bound to (roomPin, playerId); knowing another player's playerId (visible
 * in the shared leaderboard) is not sufficient to act as them.
 */
function signPlayerToken(roomPin, playerId) {
  return signAuthToken({ type: 'player', roomPin, playerId });
}

function verifyPlayerToken(token, roomPin) {
  const decoded = verifyAuthToken(token);
  if (!decoded || decoded.type !== 'player' || decoded.roomPin !== roomPin || !decoded.playerId) {
    return null;
  }
  return decoded;
}

export const gameEngineService = {
  /**
   * Generates a unique 6-digit room PIN.
   */
  generateRoomPin() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  /**
   * Creates a new live game session in Redis (and initializes game_sessions in Supabase).
   */
  async createSession({ quizId, hostId, roomPin }) {
    const pin = roomPin || this.generateRoomPin();
    let dbSessionId = 'mock_session_id';
    const isMock = quizId === 'q_demo1' || quizId === 'q_demo2' || quizId === 'q_001' || quizId === 'q_002' || quizId?.startsWith('q_ai_');

    // A real game_sessions DB row is created even for demo/mock-quiz-content
    // sessions (quiz_id left null when it's a synthetic id like "q_001" that
    // has no real row to reference) -- WITHOUT this, dbSessionId stays the
    // literal string "mock_session_id", which is not a valid UUID and makes
    // teardownSession's session_results/game_sessions writes fail silently,
    // so final scores for demo-quiz games are never actually persisted.
    try {
      const { data: dbSession, error: dbErr } = await supabase
        .from('game_sessions')
        .insert([
          {
            quiz_id: isMock ? null : (quizId || null),
            host_id: hostId,
            room_pin: pin,
            status: 'active',
            start_time: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (dbErr) {
        if (!isMock) {
          throw new Error(`Failed to create database game session: ${dbErr.message}`);
        }
        // Mock/demo session + DB unreachable: degrade to in-memory-only.
      } else {
        dbSessionId = dbSession.id;
      }
    } catch (e) {
      if (!isMock) throw e;
    }

    // Register in in-memory session store (resolved AFTER the DB write above,
    // so it reflects the real dbSessionId rather than the stale placeholder)
    inMemorySessions.set(pin, {
      session_id: dbSessionId,
      quiz_id: quizId || '',
      host_id: hostId,
      status: 'lobby',
      current_question: '0',
      created_at: Date.now().toString(),
    });

    // Set up initial state in Redis
    const metaKey = `room:${pin}:meta`;
    await redis.hset(metaKey, {
      session_id: dbSessionId,
      quiz_id: quizId || '',
      host_id: hostId,
      status: 'lobby',
      current_question: '0',
      created_at: Date.now().toString(),
    });

    // If quizId provided, fetch and cache questions immediately
    if (isMock) {
      const mockQuestions = [
          { id: 'mq_1', question_text: 'What is 2+2?', options: ['3', '4', '5', '6'], correct_option: 1 },
          { id: 'mq_2', question_text: 'Capital of France?', options: ['London', 'Berlin', 'Paris', 'Rome'], correct_option: 2 }
      ];
      await redis.set(`room:${pin}:questions`, JSON.stringify(mockQuestions));
    } else if (quizId) {
      try {
        const quiz = await quizService.getQuizById(quizId);
        if (quiz && quiz.questions && quiz.questions.length > 0) {
          await redis.set(`room:${pin}:questions`, JSON.stringify(quiz.questions));
        }
      } catch (e) {
        console.warn(`[Game Engine] Failed to cache questions for quiz ${quizId}:`, e.message);
      }
    }

    // Set 24 hour expiration on Redis keys as a safety fallback
    await redis.expire(metaKey, 86400);

    return {
      sessionId: dbSessionId,
      roomPin: pin,
      hostId,
    };
  },

  /**
   * Module 3: Crowd-Sourced Lobby Engine
   * Validates and pushes a crowd-sourced question into Redis list.
   */
  async submitCrowdQuestion(roomPin, { playerId, questionText, options, correctOption, difficultyTier }) {
    if (!questionText || !Array.isArray(options) || options.length < 2 || correctOption === undefined) {
      throw new Error('Invalid question payload format');
    }

    const questionObj = {
      submitted_by: playerId,
      question_text: questionText,
      options,
      correct_option: Number(correctOption),
      difficulty_tier: difficultyTier || 'medium',
      submitted_at: Date.now(),
    };

    const crowdKey = `room:${roomPin}:crowd_questions`;
    await redis.rpush(crowdKey, JSON.stringify(questionObj));
    const totalCount = await redis.llen(crowdKey);

    return {
      roomPin,
      totalCrowdQuestions: totalCount,
      submittedQuestion: questionObj,
    };
  },

  /**
   * Module 3: Compile Crowd Quiz (Host Event)
   * Pulls all questions from Redis list, formats unified quiz, and optionally saves to DB.
   */
  async compileCrowdQuiz(roomPin, { hostId, title = 'Crowd-Sourced Live Quiz' }) {
    const crowdKey = `room:${roomPin}:crowd_questions`;
    const rawQuestions = await redis.lrange(crowdKey, 0, -1);

    if (!rawQuestions || rawQuestions.length === 0) {
      throw new Error('No crowd questions have been submitted yet');
    }

    const questions = rawQuestions.map((q) => JSON.parse(q));

    // Save as formal Quiz in Supabase
    const { data: quiz, error: quizErr } = await supabase
      .from('quizzes')
      .insert([
        {
          creator_id: hostId,
          title: `${title} (${roomPin})`,
          description: `Compiled crowd-sourced quiz with ${questions.length} questions`,
        },
      ])
      .select()
      .single();

    if (quizErr) {
      throw new Error(`Failed to persist compiled crowd quiz: ${quizErr.message}`);
    }

    const questionsPayload = questions.map((q) => ({
      quiz_id: quiz.id,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      difficulty_tier: q.difficulty_tier,
    }));

    const { data: createdQuestions, error: qErr } = await supabase
      .from('questions')
      .insert(questionsPayload)
      .select();

    if (qErr) {
      throw new Error(`Failed to insert compiled questions: ${qErr.message}`);
    }

    // Attach compiled quiz to room meta in Redis
    await redis.hset(`room:${roomPin}:meta`, 'quiz_id', quiz.id);

    // Cache the newly generated questions for the game
    await redis.set(`room:${roomPin}:questions`, JSON.stringify(createdQuestions));

    return {
      quizId: quiz.id,
      title: quiz.title,
      questions: createdQuestions,
    };
  },

  /**
   * Registers player into room lobby in Redis and issues a signed per-player
   * join token. playerId is NEVER accepted from the client -- it is either
   * resumed (via a previously issued token, or a known account->player
   * mapping for logged-in users) or freshly minted server-side, so a client
   * can never choose/guess/squat another player's identity.
   */
  async joinPlayer(roomPin, { username, userId, rejoinPlayerId, rejoinToken }) {
    const metaKey = `room:${roomPin}:meta`;
    const exists = await redis.exists(metaKey);
    if (!exists) {
      throw new Error(`Room ${roomPin} does not exist or has expired`);
    }

    const meta = await redis.hgetall(metaKey);
    const isHost = userId === meta.host_id;

    const playersKey = `room:${roomPin}:players`;
    const accountPlayersKey = `room:${roomPin}:account_players`;

    let playerId = null;
    let playerToken = null;

    if (!isHost) {
      // 1. Resume an existing player session if a valid, still-registered
      //    join token is presented (browser refresh / reconnect).
      if (rejoinPlayerId && rejoinToken) {
        const decoded = verifyPlayerToken(rejoinToken, roomPin);
        if (decoded && decoded.playerId === rejoinPlayerId) {
          const stillRegistered = await redis.hexists(playersKey, rejoinPlayerId);
          if (stillRegistered) {
            playerId = rejoinPlayerId;
          }
        }
      }

      // 2. Resume via a known authenticated-account mapping (covers reconnects
      //    that lost client-side token storage but still hold their account session).
      if (!playerId && userId) {
        const mapped = await redis.hget(accountPlayersKey, userId);
        if (mapped) {
          const stillRegistered = await redis.hexists(playersKey, mapped);
          if (stillRegistered) {
            playerId = mapped;
          }
        }
      }

      // 3. Otherwise mint a brand-new, server-generated player identity.
      if (!playerId) {
        playerId = crypto.randomUUID();
        await redis.hset(playersKey, playerId, username || `Player_${playerId.slice(0, 4)}`);
        await redis.hsetnx(`room:${roomPin}:scores`, playerId, 0);
        await redis.hsetnx(`room:${roomPin}:streaks`, playerId, 0);
        await redis.hsetnx(`room:${roomPin}:action_points`, playerId, 0);
        if (userId) {
          await redis.hset(accountPlayersKey, userId, playerId);
        }
      } else if (username) {
        // Keep the display name fresh on rejoin.
        await redis.hset(playersKey, playerId, username);
      }

      playerToken = signPlayerToken(roomPin, playerId);
    }

    const activePlayers = await redis.hgetall(playersKey);

    // Fetch cached questions (stripped of correct_option for clients)
    let questions = [];
    try {
      const qStr = await redis.get(`room:${roomPin}:questions`);
      if (qStr) {
        questions = JSON.parse(qStr).map(q => ({
          id: q.id,
          question_text: q.question_text,
          options: q.options,
          difficulty_tier: q.difficulty_tier
        }));
      }
    } catch (e) {}

    return {
      roomPin,
      playerId,
      playerToken,
      username,
      players: activePlayers,
      gameState: {
        status: meta.status || 'lobby',
        currentQuestionIndex: parseInt(meta.current_question || '0', 10),
        hostId: meta.host_id,
        questions,
      }
    };
  },

  /**
   * Host Action: Start the game
   */
  async startGame(roomPin, hostId) {
    const metaKey = `room:${roomPin}:meta`;
    const meta = await redis.hgetall(metaKey);
    if (!meta || meta.host_id !== hostId) {
      throw new Error('Unauthorized or invalid room');
    }
    
    if (meta.status !== 'lobby') {
      throw new Error('Game already started');
    }

    await redis.hset(metaKey, {
      status: 'active',
      current_question: '0'
    });

    if (inMemorySessions.has(roomPin)) {
      inMemorySessions.set(roomPin, { ...inMemorySessions.get(roomPin), status: 'active', current_question: '0' });
    }

    return { status: 'active', currentQuestionIndex: 0 };
  },

  /**
   * Host Action: Move to next question
   */
  async nextQuestion(roomPin, hostId) {
    const metaKey = `room:${roomPin}:meta`;
    const meta = await redis.hgetall(metaKey);
    if (!meta || meta.host_id !== hostId) {
      throw new Error('Unauthorized or invalid room');
    }

    let currentIndex = parseInt(meta.current_question || '0', 10);
    currentIndex++;

    await redis.hset(metaKey, {
      status: 'active',
      current_question: currentIndex.toString()
    });

    // Clear the answers set for the next question to allow new submissions
    await redis.del(`room:${roomPin}:answered:${currentIndex}`);

    return { status: 'active', currentQuestionIndex: currentIndex };
  },
  /**
   * Anti-Cheat Engine: Records player violation breach in Redis.
   * Identity is derived exclusively from the signed player join token.
   */
  async recordViolation(roomPin, { playerToken, breachType, timestamp }) {
    const decoded = verifyPlayerToken(playerToken, roomPin);
    if (!decoded) {
      throw new Error('Unauthorized: invalid or missing player session token');
    }
    const playerId = decoded.playerId;
    const isRegisteredPlayer = await redis.hexists(`room:${roomPin}:players`, playerId);
    if (!isRegisteredPlayer) {
      throw new Error('Unauthorized: player has not joined this room');
    }

    if (!breachType) {
      throw new Error('breachType is required to record a violation');
    }

    const breachObj = {
      breach_type: breachType,
      timestamp: timestamp || Date.now(),
    };

    const violationsKey = `room:${roomPin}:violations:${playerId}`;
    await redis.rpush(violationsKey, JSON.stringify(breachObj));
    const totalViolations = await redis.llen(violationsKey);

    return {
      roomPin,
      playerId,
      breachType: breachObj.breach_type,
      timestamp: breachObj.timestamp,
      totalViolations,
    };
  },

  /**
   * Module 4: Live Game State & Adaptive Engine (Answer Processing)
   * All score calculation, streaks, and AP points handled strictly in Redis.
   */
  async processAnswerSubmission(roomPin, { playerToken, questionIndex, selectedOption, responseTimeMs }) {
    // 0. Identity comes ONLY from the signed player join token -- never from
    // a client-supplied playerId. This is what makes impersonation via a
    // known/guessed playerId (e.g. from the shared leaderboard) impossible:
    // an attacker would also need the unguessable secret token.
    const decoded = verifyPlayerToken(playerToken, roomPin);
    if (!decoded) {
      throw new Error('Unauthorized: invalid or missing player session token');
    }
    const playerId = decoded.playerId;

    const meta = await redis.hgetall(`room:${roomPin}:meta`);
    if (!meta || Object.keys(meta).length === 0) {
      throw new Error('Room does not exist or has expired');
    }
    // Reject submissions from players who never joined this room, or whose
    // registration was cleared by teardown (a token from an ended session
    // stops working the moment the room's player hash is deleted).
    const isRegisteredPlayer = await redis.hexists(`room:${roomPin}:players`, playerId);
    if (!isRegisteredPlayer) {
      throw new Error('Unauthorized: player has not joined this room');
    }

    // Reject answers for a question that isn't the room's current active question
    // (prevents pre-submitting/backdating answers for questions outside the live round).
    const activeIndex = parseInt(meta.current_question || '0', 10);
    const qIndex = parseInt(questionIndex, 10);
    if (!Number.isInteger(qIndex) || qIndex !== activeIndex) {
      throw new Error('Answer rejected: question is not currently active');
    }

    // 1. Prevent duplicate submissions per question using an atomic Redis SET operation
    const answeredKey = `room:${roomPin}:answered:${questionIndex}`;
    const addedCount = await redis.sadd(answeredKey, playerId);
    if (addedCount === 0) {
      throw new Error('Duplicate answer submission rejected');
    }

    // 2. Server-side validation of correct answer
    let isCorrect = false;
    let actualCorrectOption = null;
    try {
      const qStr = await redis.get(`room:${roomPin}:questions`);
      if (qStr) {
        const questions = JSON.parse(qStr);
        const q = questions[parseInt(questionIndex, 10)];
        if (q) {
          actualCorrectOption = Number(q.correct_option);
          isCorrect = Number(selectedOption) === actualCorrectOption;
        }
      }
    } catch (e) {
      console.warn(`[Game Engine] Failed to validate answer server-side:`, e.message);
    }

    // Server-clamped response time: never trust the client's raw value, which can
    // otherwise be set to 0/negative to farm an unbounded speed-bonus multiplier.
    const rawRt = Number(responseTimeMs);
    const safeResponseTimeMs = Number.isFinite(rawRt) ? Math.min(Math.max(rawRt, 0), 20000) : 20000;

    const streaksKey = `room:${roomPin}:streaks`;
    const scoresKey = `room:${roomPin}:scores`;
    const apKey = `room:${roomPin}:action_points`;

    let currentStreak = parseInt((await redis.hget(streaksKey, playerId)) || '0', 10);
    let currentScore = parseInt((await redis.hget(scoresKey, playerId)) || '0', 10);
    let currentAP = parseInt((await redis.hget(apKey, playerId)) || '0', 10);

    let isStreakActive = false;
    let pointsAwarded = 0;
    let apAwarded = 0;

    if (isCorrect) {
      currentStreak += 1;
      await redis.hset(streaksKey, playerId, currentStreak);

      // Multiplier Rule: If streak >= 3, apply 1.5x score multiplier for next question
      const scoreMultiplier = currentStreak >= 3 ? 1.5 : 1.0;
      if (currentStreak >= 3) {
        isStreakActive = true;
      }

      // Base points calculation: 1000 max base points scaled by response speed (within 20s)
      const speedBonus = Math.max(0, 20000 - safeResponseTimeMs) / 20;
      const basePoints = Math.round(500 + speedBonus);
      pointsAwarded = Math.round(basePoints * scoreMultiplier);

      currentScore += pointsAwarded;
      await redis.hset(scoresKey, playerId, currentScore);

      // Meta-game Currency (Action Points - AP)
      // Award 50 AP per correct answer + 25 bonus AP if on streak
      apAwarded = currentStreak >= 3 ? 75 : 50;
      currentAP += apAwarded;
      await redis.hset(apKey, playerId, currentAP);
    } else {
      // Reset streak on wrong answer
      currentStreak = 0;
      await redis.hset(streaksKey, playerId, 0);
    }

    return {
      playerId,
      isCorrect,
      selectedOption,
      correctOption: actualCorrectOption,
      pointsAwarded,
      newTotalScore: currentScore,
      currentStreak,
      isStreakActive,
      apAwarded,
      newTotalAP: currentAP,
    };
  },

  /**
   * Fetches real-time cached leaderboard from Redis (including Anti-Cheat stats).
   */
  async getLeaderboard(roomPin) {
    const scoresHash = await redis.hgetall(`room:${roomPin}:scores`);
    const playersHash = await redis.hgetall(`room:${roomPin}:players`);
    const apHash = await redis.hgetall(`room:${roomPin}:action_points`);
    const streakHash = await redis.hgetall(`room:${roomPin}:streaks`);

    const playerIds = Object.keys(scoresHash);
    const leaderboard = [];

    for (const pid of playerIds) {
      const violationsKey = `room:${roomPin}:violations:${pid}`;
      const rawViolations = await redis.lrange(violationsKey, 0, -1);
      const violationLogs = rawViolations.map((v) => JSON.parse(v));

      leaderboard.push({
        playerId: pid,
        username: playersHash[pid] || pid,
        score: parseInt(scoresHash[pid] || '0', 10),
        actionPoints: parseInt(apHash[pid] || '0', 10),
        streak: parseInt(streakHash[pid] || '0', 10),
        violationsCount: violationLogs.length,
        hasViolation: violationLogs.length > 0,
        violationLogs,
      });
    }

    // Sort descending by score
    leaderboard.sort((a, b) => b.score - a.score);
    return leaderboard;
  },

  /**
   * Module 4: Session Teardown
   * Flushes final cached leaderboard & player stats (including violation_logs) from Redis into Supabase.
   */
  async teardownSession(roomPin, hostId) {
    const metaKey = `room:${roomPin}:meta`;
    const meta = await redis.hgetall(metaKey);

    if (!meta || !meta.session_id) {
      throw new Error(`Active session meta not found for room PIN ${roomPin}`);
    }

    if (!hostId || meta.host_id !== hostId) {
      throw new Error('Unauthorized: only the room host can end this session');
    }

    const sessionId = meta.session_id;
    const leaderboard = await this.getLeaderboard(roomPin);

    // 1. Update Game Session Status in Supabase
    await supabase
      .from('game_sessions')
      .update({
        status: 'completed',
        end_time: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // 2. Prepare Bulk Session Results for Supabase (including violation_logs)
    if (leaderboard.length > 0) {
      const resultsPayload = [];

      for (const p of leaderboard) {
        // Ensure lightweight user profile exists for player
        const userProfile = await quizService.ensureUser(p.username);

        resultsPayload.push({
          session_id: sessionId,
          player_id: userProfile.id,
          final_score: p.score,
          action_points_earned: p.actionPoints,
          violation_logs: p.violationLogs || [],
        });
      }

      const { error: bulkErr } = await supabase
        .from('session_results')
        .upsert(resultsPayload, { onConflict: 'session_id, player_id' });

      if (bulkErr) {
        console.error(`[Game Engine] Bulk teardown insert error: ${bulkErr.message}`);
      }
    }

    // 3. Clean up Redis Keys
    const keysToDelete = [
      `room:${roomPin}:meta`,
      `room:${roomPin}:players`,
      `room:${roomPin}:scores`,
      `room:${roomPin}:streaks`,
      `room:${roomPin}:action_points`,
      `room:${roomPin}:crowd_questions`,
      `room:${roomPin}:questions`, // Clean up cached questions
      `room:${roomPin}:violations`, // Clean up anti-cheat violations list
    ];
    
    // Clean up all question-answer sets (assuming max 50 questions as an arbitrary limit for cleanup)
    for (let i = 0; i < 50; i++) {
      keysToDelete.push(`room:${roomPin}:answered:${i}`);
    }

    for (const p of leaderboard) {
      keysToDelete.push(`room:${roomPin}:violations:${p.playerId}`);
    }

    await redis.del(...keysToDelete);

    // Keep the in-memory session registry (used as the last-resort PIN lookup
    // fallback for mock/demo quizzes that never get a real DB row) in sync with
    // teardown, otherwise validate-pin can report a torn-down room as still
    // "lobby" forever -- a Redis/in-memory state disagreement visible to users.
    if (inMemorySessions.has(roomPin)) {
      const memSession = inMemorySessions.get(roomPin);
      inMemorySessions.set(roomPin, { ...memSession, status: 'completed' });
    }

    console.log(`[Game Engine] Session ${sessionId} (PIN ${roomPin}) successfully tore down & flushed violation_logs to DB`);

    return {
      sessionId,
      roomPin,
      finalLeaderboard: leaderboard,
    };
  }
};

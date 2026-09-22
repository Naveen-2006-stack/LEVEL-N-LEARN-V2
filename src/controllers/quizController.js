import { quizService } from '../services/quizService.js';
import { generateAndPersistQuiz } from '../services/llm/llmEngine.js';
import { gameEngineService, inMemorySessions } from '../services/gameEngineService.js';
import { supabase } from '../config/supabase.js';
import { redis } from '../config/redis.js';
import { signAuthToken, hashPassword, verifyPassword, verifyAuthToken } from '../utils/cryptoUtils.js';

/**
 * Extracts and verifies the caller's session token from either the
 * `Authorization: Bearer <token>` header or a `token` field in the body.
 * This is the ONLY source of truth for "who is making this request" --
 * client-supplied userId/hostId/creatorId fields are never trusted.
 */
function getVerifiedIdentity(request) {
  const header = request.headers?.authorization;
  const headerToken = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = headerToken || request.body?.token || null;
  return verifyAuthToken(token);
}

export const quizController = {
  /**
   * POST /api/auth/srmist-login - SRMIST Campus Sign In
   * Restricts exclusively to @srmist.edu.in email domain (or authorized super admin).
   * Validates credentials against stored cryptographic password hashes.
   */
  async srmistLogin(request, reply) {
    try {
      const { email, password } = request.body || {};

      if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Email and password are required',
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const isSrmist = cleanEmail.endsWith('@srmist.edu.in');
      const isSuperAdmin = cleanEmail === 'quizsrm@gmail.com';

      if (!isSrmist && !isSuperAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access Denied: Must be an official @srmist.edu.in campus email address.',
        });
      }

      // Query user profile
      const user = await quizService.findUserByEmail(cleanEmail);

      if (!user) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid email or password.',
        });
      }

      // Verify Password Hash
      const isPasswordValid = verifyPassword(password, user.password_hash, user.salt);

      if (!isPasswordValid) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid email or password.',
        });
      }

      if (user.is_verified === false) {
        return reply.code(403).send({
          success: false,
          error: 'Account requires email verification before signing in.',
        });
      }

      const netId = cleanEmail.split('@')[0];
      const role = user.role || (isSuperAdmin ? 'super_admin' : 'user');
      const token = signAuthToken({ userId: user.id, username: netId, role });

      return reply.code(200).send({
        success: true,
        message: 'SRMIST Campus authentication successful',
        data: {
          id: user.id,
          email: cleanEmail,
          fullName: user.full_name || netId.toUpperCase(),
          netId,
          role,
          campusDomain: '@srmist.edu.in',
          token,
        },
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: 'Authentication failed: ' + err.message,
      });
    }
  },

  /**
   * POST /api/auth/srmist-register - SRMIST Campus Registration
   * Restricts exclusively to @srmist.edu.in email domain.
   * Hashes credentials and creates account. Does NOT issue an authenticated session.
   */
  async srmistRegister(request, reply) {
    try {
      const { fullName, email, password } = request.body || {};

      if (!fullName || !email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return reply.code(400).send({
          success: false,
          error: 'Full name, valid email, and password are required for campus registration',
        });
      }

      const cleanEmail = email.trim().toLowerCase();
      const isSrmist = cleanEmail.endsWith('@srmist.edu.in');
      const isSuperAdmin = cleanEmail === 'quizsrm@gmail.com';

      if (!isSrmist && !isSuperAdmin) {
        return reply.code(403).send({
          success: false,
          error: 'Access Denied: Must be an official @srmist.edu.in campus email address.',
        });
      }

      if (password.length < 6) {
        return reply.code(400).send({
          success: false,
          error: 'Password must be at least 6 characters long',
        });
      }

      // Check if user already exists
      const existing = await quizService.findUserByEmail(cleanEmail);
      if (existing) {
        return reply.code(409).send({
          success: false,
          error: 'An account with this campus email already exists. Please sign in.',
        });
      }

      // Cryptographically hash password
      const { hash, salt } = hashPassword(password);
      const isSuper = cleanEmail === 'quizsrm@gmail.com';

      // Persist user record
      const newUser = await quizService.createUserWithCredentials({
        fullName: fullName.trim(),
        email: cleanEmail,
        passwordHash: hash,
        salt,
        role: isSuper ? 'super_admin' : 'user',
      });

      // Return registration success (Notice: NO AUTH TOKEN returned to enforce clean sign-in verification)
      return reply.code(201).send({
        success: true,
        message: 'Campus account created successfully! Please sign in with your credentials.',
        data: {
          id: newUser.id,
          email: cleanEmail,
          fullName: newUser.full_name,
          netId: cleanEmail.split('@')[0],
          isVerified: newUser.is_verified,
        },
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: 'Registration failed: ' + err.message,
      });
    }
  },

  /**
   * POST /api/sessions/validate-pin - Validate Quiz PIN
   * Checks if room PIN exists and is in an active/joinable state.
   */
  async validateRoomPin(request, reply) {
    try {
      const { pin } = request.body || request.params || {};
      const cleanPin = (pin || '').toString().trim();

      if (!cleanPin) {
        return reply.code(400).send({
          success: false,
          code: 'EMPTY',
          error: 'Enter your quiz PIN.',
        });
      }

      if (!/^\d{6}$/.test(cleanPin)) {
        return reply.code(400).send({
          success: false,
          code: 'INVALID_FORMAT',
          error: 'Please enter a valid 6-digit quiz PIN.',
        });
      }

      // 1. Check Redis Room Metadata
      const metaKey = `room:${cleanPin}:meta`;
      const meta = await redis.hgetall(metaKey);

      if (meta && Object.keys(meta).length > 0) {
        const status = meta.status || 'lobby';
        if (status === 'completed' || status === 'ended') {
          return reply.code(410).send({
            success: false,
            code: 'QUIZ_ENDED',
            error: 'This quiz session has already ended.',
          });
        }

        return reply.code(200).send({
          success: true,
          message: 'Room PIN verified',
          data: {
            roomPin: cleanPin,
            sessionId: meta.session_id || 'live_session',
            status,
          },
        });
      }

      // 2. Check Database Game Sessions
      try {
        const { data: dbSession, error: dbErr } = await supabase
          .from('game_sessions')
          .select('*')
          .eq('room_pin', cleanPin)
          .single();

        if (!dbErr && dbSession) {
          if (dbSession.status === 'completed' || dbSession.status === 'ended') {
            return reply.code(410).send({
              success: false,
              code: 'QUIZ_ENDED',
              error: 'This quiz session has already ended.',
            });
          }

          return reply.code(200).send({
            success: true,
            message: 'Room PIN verified',
            data: {
              roomPin: cleanPin,
              sessionId: dbSession.id,
              status: dbSession.status || 'lobby',
            },
          });
        }
      } catch (e) {}

      // 3. Check In-Memory Game Sessions (Resilient offline fallback)
      if (inMemorySessions.has(cleanPin)) {
        const memSession = inMemorySessions.get(cleanPin);
        if (memSession.status === 'completed' || memSession.status === 'ended') {
          return reply.code(410).send({
            success: false,
            code: 'QUIZ_ENDED',
            error: 'This quiz session has already ended.',
          });
        }

        return reply.code(200).send({
          success: true,
          message: 'Room PIN verified',
          data: {
            roomPin: cleanPin,
            sessionId: memSession.session_id || 'live_session',
            status: memSession.status || 'lobby',
          },
        });
      }

      // If not in Redis, DB, or Memory
      return reply.code(404).send({
        success: false,
        code: 'QUIZ_NOT_FOUND',
        error: 'No active quiz was found for this PIN.',
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Unable to connect to the quiz. Please try again.',
      });
    }
  },

  /**
   * POST /api/quizzes - Create manual quiz
   * Authenticated users only. The creator is always the verified token
   * identity -- never a client-supplied creatorUsername/creatorId.
   */
  async createQuiz(request, reply) {
    try {
      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to create a quiz' });
      }

      const { title, description, questions } = request.body || {};

      const createdQuiz = await quizService.createQuiz({
        creatorId: decoded.userId,
        title,
        description,
        questions,
      });

      return reply.code(201).send({
        success: true,
        data: createdQuiz,
      });
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * GET /api/quizzes - List quizzes
   */
  async listQuizzes(request, reply) {
    try {
      const { limit, offset } = request.query || {};
      const result = await quizService.listQuizzes(
        parseInt(limit || '20', 10),
        parseInt(offset || '0', 10)
      );
      return reply.send({
        success: true,
        ...result,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * GET /api/quizzes/:id - Get quiz details with nested questions
   * Quiz metadata/questions are intentionally public (campus-wide quiz bank
   * browsing), but `correct_option` is answer-key data and must only be
   * visible to the quiz's own creator (or an admin) -- e.g. a player about
   * to compete in a live session using this quiz must never be able to
   * fetch the answers ahead of time via this endpoint.
   */
  async getQuiz(request, reply) {
    try {
      const { id } = request.params;
      const quiz = await quizService.getQuizById(id);

      const decoded = getVerifiedIdentity(request);
      const isOwner = decoded && decoded.userId && quiz.creator_id === decoded.userId;
      const isAdmin = decoded && decoded.role === 'super_admin';

      const responseQuiz = (isOwner || isAdmin)
        ? quiz
        : {
            ...quiz,
            questions: (quiz.questions || []).map(({ correct_option, ...rest }) => rest),
          };

      return reply.send({
        success: true,
        data: responseQuiz,
      });
    } catch (err) {
      return reply.code(404).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * PUT /api/quizzes/:id - Update quiz and nested questions
   * Authenticated owner (quiz.creator_id) or super_admin only.
   */
  async updateQuiz(request, reply) {
    try {
      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to modify a quiz' });
      }

      const { id } = request.params;
      const owner = await quizService.getQuizOwner(id);
      if (!owner) {
        return reply.code(404).send({ success: false, error: 'Quiz not found' });
      }

      const isOwner = owner.creator_id === decoded.userId;
      const isAdmin = decoded.role === 'super_admin';
      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ success: false, error: 'You do not have permission to modify this quiz' });
      }

      const { title, description, questions } = request.body || {};
      const updated = await quizService.updateQuiz(id, { title, description, questions });
      return reply.send({
        success: true,
        data: updated,
      });
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * DELETE /api/quizzes/:id - Delete quiz
   * Authenticated owner (quiz.creator_id) or super_admin only.
   */
  async deleteQuiz(request, reply) {
    try {
      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to delete a quiz' });
      }

      const { id } = request.params;
      const owner = await quizService.getQuizOwner(id);
      if (!owner) {
        return reply.code(404).send({ success: false, error: 'Quiz not found' });
      }

      const isOwner = owner.creator_id === decoded.userId;
      const isAdmin = decoded.role === 'super_admin';
      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ success: false, error: 'You do not have permission to delete this quiz' });
      }

      const result = await quizService.deleteQuiz(id);
      return reply.send({
        success: true,
        ...result,
      });
    } catch (err) {
      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * POST /api/quizzes/generate - Trigger Multi-LLM generation
   */
  async generateAIQuiz(request, reply) {
    try {
      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to generate a quiz' });
      }

      const { lessonNotes, topic, numQuestions } = request.body || {};

      if (!lessonNotes && !topic) {
        return reply.code(400).send({
          success: false,
          error: 'Either lessonNotes or topic must be provided for AI generation',
        });
      }

      const result = await generateAndPersistQuiz({
        creatorId: decoded.userId,
        lessonNotes: lessonNotes || topic,
        topic: topic || 'Custom Topic',
        numQuestions: parseInt(numQuestions || '5', 10),
      });

      return reply.code(201).send({
        success: true,
        message: `Quiz generated successfully via ${result.providerUsed}`,
        data: result,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * POST /api/sessions - Spin up a new live game room (Role-agnostic)
   */
  async createGameSession(request, reply) {
    try {
      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to host a live session' });
      }

      const { quizId, customRoomPin } = request.body || {};

      const session = await gameEngineService.createSession({
        quizId,
        hostId: decoded.userId,
        roomPin: customRoomPin,
      });

      return reply.code(201).send({
        success: true,
        message: 'Live game room created successfully',
        data: session,
      });
    } catch (err) {
      console.error('[createGameSession Error]', err);
      return reply.code(400).send({
        success: false,
        error: err.message,
      });
    }
  },

  /**
   * POST /api/sessions/submit - Direct backend ingestion for Anti-Cheat V2 payload
   * This mutates a specific game_session's stored results (upsert on
   * session_id+player_id), so -- unlike the read-only quiz-browsing
   * endpoints, which are intentionally public -- it requires proof that the
   * caller is that session's own host. Without this, anyone who knows/guesses
   * a sessionId UUID and a username could overwrite another player's final
   * score/AP/violation log for any session, including ones long completed.
   */
  async submitSessionResult(request, reply) {
    try {
      const { sessionId, playerUsername, finalScore, actionPointsEarned, violation_logs } = request.body || {};

      if (!sessionId || !playerUsername) {
        return reply.code(400).send({
          success: false,
          error: 'sessionId and playerUsername are required in submission payload',
        });
      }

      const decoded = getVerifiedIdentity(request);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ success: false, error: 'Authentication required to submit session results' });
      }

      const { data: gameSession, error: sessionErr } = await supabase
        .from('game_sessions')
        .select('id, host_id')
        .eq('id', sessionId)
        .single();

      if (sessionErr || !gameSession) {
        return reply.code(404).send({ success: false, error: 'Session not found' });
      }
      if (gameSession.host_id !== decoded.userId) {
        return reply.code(403).send({ success: false, error: 'Only the session host can submit results for this session' });
      }

      const user = await quizService.ensureUser(playerUsername);

      const payload = {
        session_id: sessionId,
        player_id: user.id,
        final_score: parseInt(finalScore || '0', 10),
        action_points_earned: parseInt(actionPointsEarned || '0', 10),
        violation_logs: Array.isArray(violation_logs) ? violation_logs : [],
      };

      const { data, error } = await supabase
        .from('session_results')
        .upsert([payload], { onConflict: 'session_id, player_id' })
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      return reply.code(200).send({
        success: true,
        message: 'Session result and Anti-Cheat V2 logs successfully persisted to database',
        data,
      });
    } catch (err) {
      return reply.code(500).send({
        success: false,
        error: err.message,
      });
    }
  }
};

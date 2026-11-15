import { gameEngineService } from '../services/gameEngineService.js';
import { verifyAuthToken } from '../utils/cryptoUtils.js';
import { supabase } from '../config/supabase.js';

// Helper to broadcast via Supabase Realtime from the server
async function broadcastToRoom(roomPin, event, data) {
  const channel = supabase.channel(`room:${roomPin}`);
  await channel.send({
    type: 'broadcast',
    event: event,
    payload: data,
  });
}

export const gameController = {
  joinRoom: async (request, reply) => {
    try {
      const { roomPin, username, userId, token, rejoinPlayerId, rejoinToken } = request.body || {};

      // 1. Validate roomPin: must be present, non-empty string without whitespace-only (E1)
      if (!roomPin || typeof roomPin !== 'string' || !roomPin.trim()) {
        return reply.code(400).send({ error: 'Room PIN is required and cannot be empty' });
      }
      const trimmedPin = roomPin.trim();

      // 2. Validate token if token or userId is provided (E6)
      if (token || userId) {
        const decoded = verifyAuthToken(token);
        if (!decoded || (userId && decoded.userId !== userId)) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid or missing token' });
        }
      }

      // playerId is NEVER accepted from the client -- gameEngineService.joinPlayer
      // resumes it from rejoinToken/account mapping or mints a fresh one.
      const result = await gameEngineService.joinPlayer(trimmedPin, { username, userId, rejoinPlayerId, rejoinToken });

      // Broadcast to all players in room (never includes the secret playerToken)
      await broadcastToRoom(trimmedPin, 'player_joined', {
        playerId: result.playerId,
        username: result.username,
        totalPlayers: Object.keys(result.players).length,
        activePlayers: result.players,
      });

      // Return full current game state + the player's private join token
      // back to the joining player only (never broadcast).
      return reply.send({
        success: true,
        data: {
          roomPin: result.roomPin,
          playerId: result.playerId,
          playerToken: result.playerToken,
          username: result.username,
          activePlayers: result.players,
          gameState: result.gameState
        }
      });
    } catch (err) {
      if (err.message?.includes('does not exist') || err.message?.includes('expired')) {
        return reply.code(404).send({ error: err.message });
      }
      return reply.code(500).send({ error: `Failed to join room: ${err.message}` });
    }
  },

  hostAction: async (request, reply) => {
    try {
      const { roomPin, actionType, token } = request.body || {};

      // Validate roomPin
      if (!roomPin || typeof roomPin !== 'string' || !roomPin.trim()) {
        return reply.code(400).send({ error: 'Room PIN is required and cannot be empty' });
      }
      const trimmedPin = roomPin.trim();

      // SECURE AUTHORIZATION CHECK (E6, N5): derived from a verified session token
      const decoded = verifyAuthToken(token);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ error: 'Unauthorized: Invalid or missing host session token' });
      }
      const hostId = decoded.userId;

      if (actionType === 'start_game') {
        const result = await gameEngineService.startGame(trimmedPin, hostId);
        await broadcastToRoom(trimmedPin, 'game_started', {
          status: result.status,
          currentQuestionIndex: result.currentQuestionIndex,
          message: 'Game started by host'
        });
        return reply.send({ success: true });
      } else if (actionType === 'next_question') {
        const result = await gameEngineService.nextQuestion(trimmedPin, hostId);
        await broadcastToRoom(trimmedPin, 'question_active', {
          status: result.status,
          currentQuestionIndex: result.currentQuestionIndex,
          message: 'Next question is active'
        });
        return reply.send({ success: true });
      } else {
        return reply.code(400).send({ error: 'Unknown host action type' });
      }
    } catch (err) {
      const isAuthErr = err.message?.includes('Unauthorized') || err.message?.includes('invalid room');
      return reply.code(isAuthErr ? 403 : 500).send({ error: `Host action failed: ${err.message}` });
    }
  },

  violationDetected: async (request, reply) => {
    try {
      const { roomPin, playerToken, breachType, timestamp, username } = request.body || {};

      if (!playerToken || !breachType) {
        return reply.code(400).send({ error: 'Missing playerToken or breachType' });
      }

      // 1. Record violation in Redis array (identity derived from the token)
      const result = await gameEngineService.recordViolation(roomPin, {
        playerToken,
        breachType,
        timestamp: timestamp || Date.now(),
      });

      // 2. Emit host_violation_alert to Room Host & all clients
      await broadcastToRoom(roomPin, 'host_violation_alert', {
        playerId: result.playerId,
        username: username || result.playerId,
        breachType: result.breachType,
        timestamp: result.timestamp,
        totalViolations: result.totalViolations,
        alertMessage: `🚨 ANTI-CHEAT ALERT: Player ${username || result.playerId} triggered ${result.breachType} breach!`,
      });

      // 3. Broadcast updated leaderboard with red warning badges
      const leaderboard = await gameEngineService.getLeaderboard(roomPin);
      await broadcastToRoom(roomPin, 'leaderboard_update', { leaderboard });

      return reply.send({
        success: true,
        recorded: true,
        breachType: result.breachType,
        totalViolations: result.totalViolations,
      });
    } catch (err) {
      return reply.code(err.message?.includes('Unauthorized') ? 401 : 500).send({ error: `Failed to process violation: ${err.message}` });
    }
  },

  submitAnswer: async (request, reply) => {
    try {
      const { roomPin, playerToken, questionIndex, selectedOption, responseTimeMs } = request.body || {};

      if (!roomPin || typeof roomPin !== 'string' || !roomPin.trim()) {
        return reply.code(400).send({ error: 'Room PIN is required and cannot be empty' });
      }
      const trimmedPin = roomPin.trim();

      if (!playerToken) {
        return reply.code(401).send({ error: 'Unauthorized: Missing playerToken' });
      }

      const result = await gameEngineService.processAnswerSubmission(trimmedPin, {
        playerToken,
        questionIndex,
        selectedOption,
        responseTimeMs,
      });

      // Broadcast updated live leaderboard to room
      const leaderboard = await gameEngineService.getLeaderboard(trimmedPin);
      await broadcastToRoom(trimmedPin, 'leaderboard_update', { leaderboard });

      // Return the result directly to the submitting player
      return reply.send({
        success: true,
        isCorrect: result.isCorrect,
        pointsAwarded: result.pointsAwarded,
        newTotalScore: result.newTotalScore,
        currentStreak: result.currentStreak,
        isStreakActive: result.isStreakActive,
        apAwarded: result.apAwarded,
        newTotalAP: result.newTotalAP,
      });
    } catch (err) {
      return reply.code(err.message?.includes('Unauthorized') ? 401 : 500).send({ error: `Failed to process answer: ${err.message}` });
    }
  },

  endSession: async (request, reply) => {
    try {
      const { roomPin, token } = request.body || {};

      if (!roomPin || typeof roomPin !== 'string' || !roomPin.trim()) {
        return reply.code(400).send({ error: 'Room PIN is required and cannot be empty' });
      }
      const trimmedPin = roomPin.trim();

      // SECURE AUTHORIZATION CHECK: only the verified host may terminate a session.
      // roomPin alone is not a secret (6-digit PIN, brute-forceable) so this must
      // never be accepted without proof of host identity.
      const decoded = verifyAuthToken(token);
      if (!decoded || !decoded.userId) {
        return reply.code(401).send({ error: 'Unauthorized: Invalid or missing host session token' });
      }

      const result = await gameEngineService.teardownSession(trimmedPin, decoded.userId);

      await broadcastToRoom(trimmedPin, 'game_over', {
        message: 'Game Session Ended by Host',
        finalLeaderboard: result.finalLeaderboard,
      });

      return reply.send({ success: true });
    } catch (err) {
      return reply.code(err.message?.includes('Unauthorized') ? 403 : 500).send({ error: `Failed to end session: ${err.message}` });
    }
  }
};

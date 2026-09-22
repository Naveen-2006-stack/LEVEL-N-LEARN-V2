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
      const { roomPin, playerId, username, userId, token } = request.body;

      // SECURE AUTHORIZATION CHECK
      const decoded = verifyAuthToken(token);
      if (userId && (!decoded || decoded.userId !== userId)) {
        return reply.code(401).send({ error: 'Unauthorized: Invalid or missing token' });
      }

      const result = await gameEngineService.joinPlayer(roomPin, { playerId, username, userId });

      // Broadcast to all players in room
      await broadcastToRoom(roomPin, 'player_joined', {
        playerId,
        username: result.username,
        totalPlayers: Object.keys(result.players).length,
        activePlayers: result.players,
      });

      // Return full current game state back to the joining player
      return reply.send({
        success: true,
        data: {
          roomPin: result.roomPin,
          playerId: result.playerId,
          username: result.username,
          activePlayers: result.players,
          gameState: result.gameState
        }
      });
    } catch (err) {
      return reply.code(500).send({ error: `Failed to join room: ${err.message}` });
    }
  },

  hostAction: async (request, reply) => {
    try {
      const { roomPin, actionType, hostId } = request.body;

      if (actionType === 'start_game') {
        const result = await gameEngineService.startGame(roomPin, hostId);
        await broadcastToRoom(roomPin, 'game_started', {
          status: result.status,
          currentQuestionIndex: result.currentQuestionIndex,
          message: 'Game started by host'
        });
        return reply.send({ success: true });
      } else if (actionType === 'next_question') {
        const result = await gameEngineService.nextQuestion(roomPin, hostId);
        await broadcastToRoom(roomPin, 'question_active', {
          status: result.status,
          currentQuestionIndex: result.currentQuestionIndex,
          message: 'Next question is active'
        });
        return reply.send({ success: true });
      } else {
        return reply.code(400).send({ error: 'Unknown host action type' });
      }
    } catch (err) {
      return reply.code(500).send({ error: `Host action failed: ${err.message}` });
    }
  },

  violationDetected: async (request, reply) => {
    try {
      const { roomPin, playerId, breachType, timestamp, username } = request.body;

      if (!playerId || !breachType) {
        return reply.code(400).send({ error: 'Missing playerId or breachType' });
      }

      // 1. Record violation in Redis array
      const result = await gameEngineService.recordViolation(roomPin, {
        playerId,
        breachType,
        timestamp: timestamp || Date.now(),
      });

      // 2. Emit host_violation_alert to Room Host & all clients
      await broadcastToRoom(roomPin, 'host_violation_alert', {
        playerId,
        username: username || playerId,
        breachType: result.breachType,
        timestamp: result.timestamp,
        totalViolations: result.totalViolations,
        alertMessage: `🚨 ANTI-CHEAT ALERT: Player ${username || playerId} triggered ${result.breachType} breach!`,
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
      return reply.code(500).send({ error: `Failed to process violation: ${err.message}` });
    }
  },

  submitAnswer: async (request, reply) => {
    try {
      const { roomPin, playerId, questionIndex, selectedOption, responseTimeMs } = request.body;

      const result = await gameEngineService.processAnswerSubmission(roomPin, {
        playerId,
        questionIndex,
        selectedOption,
        responseTimeMs,
      });

      // Broadcast updated live leaderboard to room
      const leaderboard = await gameEngineService.getLeaderboard(roomPin);
      await broadcastToRoom(roomPin, 'leaderboard_update', { leaderboard });

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
      return reply.code(500).send({ error: `Failed to process answer: ${err.message}` });
    }
  },

  endSession: async (request, reply) => {
    try {
      const { roomPin } = request.body;
      const result = await gameEngineService.teardownSession(roomPin);

      await broadcastToRoom(roomPin, 'game_over', {
        message: 'Game Session Ended by Host',
        finalLeaderboard: result.finalLeaderboard,
      });

      return reply.send({ success: true });
    } catch (err) {
      return reply.code(500).send({ error: `Failed to end session: ${err.message}` });
    }
  }
};

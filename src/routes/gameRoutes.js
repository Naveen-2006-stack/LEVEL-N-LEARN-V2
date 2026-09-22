import { gameController } from '../controllers/gameController.js';

export async function gameRoutes(fastify, options) {
  fastify.post('/game/join', gameController.joinRoom);
  fastify.post('/game/host-action', gameController.hostAction);
  fastify.post('/game/violation', gameController.violationDetected);
  fastify.post('/game/submit', gameController.submitAnswer);
  fastify.post('/game/end', gameController.endSession);
}

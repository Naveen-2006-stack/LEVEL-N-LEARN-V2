import { quizController } from '../controllers/quizController.js';

export async function quizRoutes(fastify, opts) {
  // SRMIST Campus Auth Endpoints (@srmist.edu.in restricted)
  fastify.post('/auth/srmist-login', quizController.srmistLogin);
  fastify.post('/auth/srmist-register', quizController.srmistRegister);

  // Manual Quiz CRUD
  fastify.post('/quizzes', quizController.createQuiz);
  fastify.get('/quizzes', quizController.listQuizzes);
  fastify.get('/quizzes/:id', quizController.getQuiz);
  fastify.put('/quizzes/:id', quizController.updateQuiz);
  fastify.delete('/quizzes/:id', quizController.deleteQuiz);

  // AI Multi-LLM Generator Trigger
  fastify.post('/quizzes/generate', quizController.generateAIQuiz);

  // Live Session Creation, PIN Validation & Anti-Cheat V2 Direct Submission
  fastify.post('/sessions', quizController.createGameSession);
  fastify.post('/sessions/validate-pin', quizController.validateRoomPin);
  fastify.get('/sessions/pin/:pin', quizController.validateRoomPin);
  fastify.post('/sessions/submit', quizController.submitSessionResult);
}

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { quizRoutes } from './routes/quizRoutes.js';
import { gameRoutes } from './routes/gameRoutes.js';
import { checkRedisHealth } from './config/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Initialize Fastify Server
const server = Fastify({
  logger: {
    level: config.nodeEnv === 'development' ? 'info' : 'warn',
  },
});

// 2. Register Plugins
await server.register(fastifyCors, {
  origin: true, // Allow all origins for real-time game clients
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

// Determine static root directory (built dist or public fallback)
const distPath = path.join(__dirname, '../dist');
const publicPath = path.join(__dirname, 'public');
const staticRoot = fs.existsSync(distPath) ? distPath : publicPath;

await server.register(fastifyStatic, {
  root: staticRoot,
  prefix: '/',
});

// 3. Register Health Check Route
server.get('/health', async () => {
  const redisHealth = await checkRedisHealth();
  return {
    status: redisHealth.status === 'unhealthy' ? 'degraded' : 'ok',
    service: 'LevelNLearn-Backend-V2',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    architecture: 'Role-Agnostic Host/Player Model',
    antiCheatEngine: 'Active (Real-Time Redis & Supabase JSONB)',
    redis: {
      status: redisHealth.status,
      engine: redisHealth.engine,
      latencyMs: redisHealth.latencyMs,
    },
  };
});

// 4. Register REST API Routes
await server.register(quizRoutes, { prefix: '/api' });
await server.register(gameRoutes, { prefix: '/api' });

// 6. SPA Catch-all Client-side Routing Handler for React SPA
server.setNotFoundHandler((request, reply) => {
  if (request.raw.url.startsWith('/api')) {
    return reply.code(404).send({ success: false, error: 'API Endpoint Not Found' });
  }

  const indexPath = path.join(staticRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    return reply.sendFile('index.html');
  }

  return reply.code(404).send({ success: false, error: 'Resource Not Found' });
});

// 7. Start Server (if running directly, else export for Vercel)
const startServer = async () => {
  try {
    await server.listen({
      port: config.port,
      host: config.host,
    });

    console.log(`
🚀 LevelNLearn V2 Full-Stack Server is running!
--------------------------------------------------
💻 React Web Frontend: http://localhost:4000/
📡 REST API Endpoint:   http://localhost:4000/api
🛡️ Anti-Cheat Demo:     http://localhost:4000/demoHostPlayer.html
💚 Healthcheck:          http://localhost:4000/health
--------------------------------------------------
    `);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Check if running directly via node, or inside a serverless environment
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  startServer();
}

export default async function (req, res) {
  await server.ready();
  server.server.emit('request', req, res);
}

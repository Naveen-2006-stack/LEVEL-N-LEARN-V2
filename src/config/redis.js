import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { config } from './env.js';

class InMemoryRedisMock extends EventEmitter {
  constructor() {
    super();
    this.hashes = new Map();
    this.lists = new Map();
    this.subscribers = new Map();
    this.strings = new Map();
    this.sets = new Map();
    this.ttls = new Map();
  }

  async ping() {
    return 'PONG';
  }

  async set(key, value, ...args) {
    this.strings.set(key, String(value));
    if (args.length >= 2 && args[0].toUpperCase() === 'EX') {
      const ttlSec = parseInt(args[1], 10);
      if (!isNaN(ttlSec)) {
        this.ttls.set(key, Date.now() + ttlSec * 1000);
      }
    }
    return 'OK';
  }

  async get(key) {
    if (this._isExpired(key)) {
      await this.del(key);
      return null;
    }
    return this.strings.get(key) || null;
  }

  async exists(key) {
    if (this._isExpired(key)) {
      await this.del(key);
      return 0;
    }
    return this.hashes.has(key) || this.lists.has(key) || this.strings.has(key) || this.sets.has(key) ? 1 : 0;
  }

  async hset(key, fieldOrObj, value) {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const map = this.hashes.get(key);

    if (typeof fieldOrObj === 'object' && fieldOrObj !== null) {
      for (const [k, v] of Object.entries(fieldOrObj)) {
        map.set(k, String(v));
      }
    } else {
      map.set(fieldOrObj, String(value));
    }
    return 1;
  }

  async hsetnx(key, field, value) {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const map = this.hashes.get(key);
    if (!map.has(field)) {
      map.set(field, String(value));
      return 1;
    }
    return 0;
  }

  async hget(key, field) {
    if (this._isExpired(key)) {
      await this.del(key);
      return null;
    }
    const map = this.hashes.get(key);
    return map ? map.get(field) || null : null;
  }

  async hgetall(key) {
    if (this._isExpired(key)) {
      await this.del(key);
      return {};
    }
    const map = this.hashes.get(key);
    if (!map) return {};
    const obj = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async rpush(key, value) {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const arr = this.lists.get(key);
    arr.push(String(value));
    return arr.length;
  }

  async llen(key) {
    if (this._isExpired(key)) {
      await this.del(key);
      return 0;
    }
    const arr = this.lists.get(key);
    return arr ? arr.length : 0;
  }

  async lrange(key, start, stop) {
    if (this._isExpired(key)) {
      await this.del(key);
      return [];
    }
    const arr = this.lists.get(key);
    if (!arr) return [];
    if (stop === -1) return arr.slice(start);
    return arr.slice(start, stop + 1);
  }

  async sadd(key, ...members) {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key);
    let count = 0;
    for (const member of members.flat()) {
      if (!set.has(String(member))) {
        set.add(String(member));
        count++;
      }
    }
    return count;
  }

  async hexists(key, field) {
    if (this._isExpired(key)) {
      await this.del(key);
      return 0;
    }
    const map = this.hashes.get(key);
    return map && map.has(field) ? 1 : 0;
  }

  async sismember(key, member) {
    if (this._isExpired(key)) {
      await this.del(key);
      return 0;
    }
    const set = this.sets.get(key);
    return set && set.has(String(member)) ? 1 : 0;
  }

  async del(...keys) {
    let count = 0;
    for (const k of keys.flat()) {
      this.ttls.delete(k);
      if (this.hashes.delete(k)) count++;
      if (this.lists.delete(k)) count++;
      if (this.sets.delete(k)) count++;
      if (this.strings.delete(k)) count++;
    }
    return count;
  }

  async expire(key, seconds) {
    const sec = parseInt(seconds, 10);
    if (!isNaN(sec)) {
      this.ttls.set(key, Date.now() + sec * 1000);
      return 1;
    }
    return 0;
  }

  async ttl(key) {
    const exp = this.ttls.get(key);
    if (!exp) return -1;
    const remaining = Math.floor((exp - Date.now()) / 1000);
    if (remaining <= 0) {
      await this.del(key);
      return -2;
    }
    return remaining;
  }

  async publish(channel, message) {
    const handlers = this.subscribers.get(channel) || [];
    for (const h of handlers) {
      h(channel, message);
    }
    this.emit('message', channel, message);
    return handlers.length;
  }

  async subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    if (callback) this.subscribers.get(channel).push(callback);
    return 'OK';
  }

  _isExpired(key) {
    const exp = this.ttls.get(key);
    return exp ? Date.now() > exp : false;
  }
}

// Build connection options from single REDIS_URL or split configs
function buildRedisOptions() {
  const commonOptions = {
    lazyConnect: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        return null; // Stop reconnecting after 3 attempts
      }
      return Math.min(times * 1000, 3000);
    },
    enableReadyCheck: true,
  };

  if (config.redis.url) {
    return {
      type: 'url',
      url: config.redis.url,
      options: commonOptions,
    };
  }

  return {
    type: 'options',
    options: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      ...commonOptions,
    },
  };
}

const conf = buildRedisOptions();

let realRedis = null;
let realPub = null;
let realSub = null;
let isRedisConnected = false;
let redisInitError = null;

const inMemoryFallback = new InMemoryRedisMock();

function createClientInstance(label) {
  let client;
  if (conf.type === 'url') {
    client = new Redis(conf.url, conf.options);
  } else {
    client = new Redis(conf.options);
  }

  client.on('connect', () => {
    // Sanitized log without credentials
    console.log(`[Redis:${label}] Socket connection established`);
  });

  client.on('ready', () => {
    console.log(`[Redis:${label}] Client ready for commands`);
  });

  client.on('error', (err) => {
    // Sanitized error logging
    const safeMsg = err.message ? err.message.replace(/:[^:@]+@/, ':****@') : 'Unknown error';
    console.warn(`[Redis:${label}] Warning/Error: ${safeMsg}`);
  });

  client.on('close', () => {
    // Connection closed
  });

  client.on('reconnecting', (delay) => {
    console.log(`[Redis:${label}] Reconnecting in ${delay}ms...`);
  });

  return client;
}

try {
  realRedis = createClientInstance('main');
  realPub = createClientInstance('publisher');
  realSub = createClientInstance('subscriber');

  // Attempt initial connect
  Promise.all([
    realRedis.connect(),
    realPub.connect(),
    realSub.connect(),
  ]).then(() => {
    isRedisConnected = true;
    console.log('[Redis] ✅ Successfully connected to live Redis instance (Main, Pub, Sub)');
  }).catch((err) => {
    isRedisConnected = false;
    redisInitError = err;
    const safeError = err.message ? err.message.replace(/:[^:@]+@/, ':****@') : 'Connection failed';
    
    if (config.nodeEnv === 'production') {
      console.error(`[Redis CRITICAL] ❌ Failed to connect to Redis in PRODUCTION mode: ${safeError}`);
      console.error('[Redis CRITICAL] In-Memory fallback is strictly disabled in production.');
      throw new Error(`Fatal Production Error: Live Redis required but unreachable (${safeError})`);
    } else {
      console.warn(`[Redis] ⚠️ Live Redis unreachable (${safeError}).`);
      console.warn('[Redis] 👉 Operating in Development Mode with In-Memory Mock Session Engine.');
    }
  });
} catch (e) {
  if (config.nodeEnv === 'production') {
    throw e;
  }
  console.warn('[Redis] Initializer fallback triggered in development mode.');
}

const redisProxyHandler = (targetInstance) => ({
  get(obj, prop) {
    if (isRedisConnected && targetInstance && typeof targetInstance[prop] === 'function') {
      return targetInstance[prop].bind(targetInstance);
    }
    if (isRedisConnected && targetInstance && prop in targetInstance) {
      return targetInstance[prop];
    }
    if (typeof inMemoryFallback[prop] === 'function') {
      return inMemoryFallback[prop].bind(inMemoryFallback);
    }
    return inMemoryFallback[prop];
  },
});

export const redis = new Proxy({}, redisProxyHandler(realRedis));
export const redisPub = new Proxy({}, redisProxyHandler(realPub));
export const redisSub = new Proxy({}, redisProxyHandler(realSub));

export async function checkRedisHealth() {
  if (isRedisConnected && realRedis) {
    try {
      const start = Date.now();
      const ping = await realRedis.ping();
      const latency = Date.now() - start;
      return {
        status: 'connected',
        ping,
        latencyMs: latency,
        engine: 'live-redis',
      };
    } catch (e) {
      return {
        status: 'degraded',
        error: 'Ping failed',
        engine: 'live-redis',
      };
    }
  }

  return {
    status: config.nodeEnv === 'production' ? 'unhealthy' : 'connected-mock',
    ping: await inMemoryFallback.ping(),
    latencyMs: 0,
    engine: 'in-memory-dev-mock',
    mode: config.nodeEnv,
  };
}

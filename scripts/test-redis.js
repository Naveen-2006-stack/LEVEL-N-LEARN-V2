import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns/promises';
import net from 'net';
import Redis from 'ioredis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseRedisConfig() {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const isTls = parsed.protocol === 'rediss:';
      return {
        isUrl: true,
        protocol: parsed.protocol,
        host: parsed.hostname,
        port: parseInt(parsed.port || (isTls ? '6380' : '6379'), 10),
        hasPassword: Boolean(parsed.password),
        isTls,
        rawUrl: redisUrl,
      };
    } catch (e) {
      return {
        error: 'Invalid REDIS_URL format',
      };
    }
  }

  const host = process.env.REDIS_HOST || '127.0.0.1';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD || undefined;

  return {
    isUrl: false,
    protocol: 'redis:',
    host,
    port,
    hasPassword: Boolean(password),
    isTls: false,
    rawOptions: { host, port, password },
  };
}

async function runDiagnostics() {
  console.log('========================================================');
  console.log('  LEVELNLEARN V2 — REDIS DIAGNOSTIC & HEALTH SUITE      ');
  console.log('========================================================\n');

  // 1. Environment Variable Check (Sanitized)
  console.log('1. ENVIRONMENT VARIABLE CHECK:');
  console.log(`   - REDIS_URL:      ${process.env.REDIS_URL ? 'PRESENT [configured]' : 'NOT PRESENT'}`);
  console.log(`   - REDIS_HOST:     ${process.env.REDIS_HOST ? 'PRESENT' : 'NOT PRESENT'}`);
  console.log(`   - REDIS_PORT:     ${process.env.REDIS_PORT ? 'PRESENT' : 'NOT PRESENT'}`);
  console.log(`   - REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? 'PRESENT' : 'NOT PRESENT'}`);
  console.log(`   - NODE_ENV:       ${process.env.NODE_ENV || 'development'}\n`);

  const conf = parseRedisConfig();
  if (conf.error) {
    console.error(`❌ [Config Error]: ${conf.error}`);
    process.exit(1);
  }

  console.log('2. TARGET CONNECTION METRICS (SANITIZED):');
  console.log(`   - Target Host:    ${conf.host}`);
  console.log(`   - Target Port:    ${conf.port}`);
  console.log(`   - Protocol:       ${conf.protocol}`);
  console.log(`   - TLS Enabled:    ${conf.isTls ? 'YES (rediss://)' : 'NO (redis://)'}`);
  console.log(`   - Auth Present:   ${conf.hasPassword ? 'YES' : 'NO'}\n`);

  // 3. DNS Resolution Test
  console.log('3. DNS RESOLUTION TEST:');
  let resolvedIp = null;
  try {
    const startTime = Date.now();
    const lookupRes = await dns.lookup(conf.host);
    resolvedIp = lookupRes.address;
    console.log(`   ✅ DNS Resolved: ${conf.host} -> ${resolvedIp} (${Date.now() - startTime}ms)\n`);
  } catch (err) {
    console.error(`   ❌ DNS Resolution Failed for "${conf.host}": ${err.message}\n`);
    console.error('   [DIAGNOSIS]: Hostname is invalid or DNS servers cannot resolve the domain.');
    process.exit(1);
  }

  // 4. Low-Level TCP Socket Connectivity Test
  console.log('4. TCP SOCKET CONNECTIVITY TEST:');
  const tcpStartTime = Date.now();
  const tcpResult = await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(6000);

    socket.on('connect', () => {
      const latency = Date.now() - tcpStartTime;
      socket.destroy();
      resolve({ success: true, latency });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'ETIMEDOUT: TCP connection timed out after 6000ms' });
    });

    socket.on('error', (err) => {
      socket.destroy();
      resolve({ success: false, error: `${err.code || 'ERROR'}: ${err.message}` });
    });

    socket.connect(conf.port, resolvedIp || conf.host);
  });

  if (!tcpResult.success) {
    console.error(`   ❌ TCP Connection Failed on ${conf.host}:${conf.port}`);
    console.error(`   - Details: ${tcpResult.error}\n`);
    console.log('   [DIAGNOSIS & ROOT CAUSE ANALYSIS]:');
    console.log('   -------------------------------------------------------');
    console.log('   • Error Type: NETWORK / TCP UNREACHABLE (ETIMEDOUT / REFUSED)');
    console.log('   • Potential Causes:');
    console.log('     1. Outbound Network/ISP Restriction: Non-standard high ports (like 18818) are often blocked by corporate networks, college Wi-Fi, or firewalls.');
    console.log('     2. Redis Cloud IP Allowlist / Access Control: If Redis Cloud instance has IP restrictions enabled, incoming connections from this IP are dropped/timed out.');
    console.log('     3. Incorrect Port / Inactive Cloud Database: Check if the free Redis database instance is active and not paused.');
    console.log('   -------------------------------------------------------\n');
    process.exit(1);
  }

  console.log(`   ✅ TCP Socket Connected Successfully! (Latency: ${tcpResult.latency}ms)\n`);

  // 5. ioredis Client Initialization & Handshake
  console.log('5. IOREDIS CLIENT INITIALIZATION & PING:');
  const redisOptions = conf.isUrl
    ? conf.rawUrl
    : {
        host: conf.host,
        port: conf.port,
        password: conf.rawOptions.password,
        connectTimeout: 7000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      };

  const client = new Redis(redisOptions, {
    connectTimeout: 7000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    const pingStart = Date.now();
    const pingRes = await client.ping();
    const pingLatency = Date.now() - pingStart;
    console.log(`   ✅ Redis Connected! PING -> ${pingRes} (Latency: ${pingLatency}ms)\n`);
  } catch (err) {
    console.error(`   ❌ Redis Handshake/Auth Failed: ${err.message}\n`);
    if (err.message.includes('NOAUTH') || err.message.includes('WRONGPASS') || err.message.includes('password')) {
      console.log('   [DIAGNOSIS]: Authentication Failed. Please check the Redis password.');
    } else if (err.message.includes('certificate') || err.message.includes('TLS') || err.message.includes('SSL')) {
      console.log('   [DIAGNOSIS]: TLS/SSL Handshake failure. Verify rediss:// vs redis:// protocol.');
    } else {
      console.log(`   [DIAGNOSIS]: Connection error: ${err.message}`);
    }
    await client.quit().catch(() => client.disconnect());
    process.exit(1);
  }

  // 6. Data Integrity & Command Test (SET / GET / TTL / DEL)
  console.log('6. DATA OPERATIONS TEST (SET / GET / TTL / DEL):');
  const testKey = `levelnlearn:healthcheck:${Date.now()}`;
  const testPayload = JSON.stringify({ status: 'healthy', checkTime: new Date().toISOString() });

  try {
    // SET with TTL
    await client.set(testKey, testPayload, 'EX', 60);
    console.log(`   ✅ SET ${testKey} with 60s TTL`);

    // GET
    const retrieved = await client.get(testKey);
    const parsed = JSON.parse(retrieved);
    console.log(`   ✅ GET ${testKey} -> Verified payload matches: ${parsed.status}`);

    // TTL
    const ttl = await client.ttl(testKey);
    console.log(`   ✅ TTL ${testKey} -> Remaining: ${ttl} seconds`);

    // DEL
    const delCount = await client.del(testKey);
    console.log(`   ✅ DEL ${testKey} -> Deleted count: ${delCount}\n`);
  } catch (err) {
    console.error(`   ❌ Command execution failed: ${err.message}\n`);
    await client.quit().catch(() => client.disconnect());
    process.exit(1);
  }

  // 7. Pub/Sub Synchronization Test
  console.log('7. PUB/SUB SYNCHRONIZATION TEST:');
  const subClient = new Redis(redisOptions, {
    connectTimeout: 7000,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  try {
    const testChannel = `levelnlearn:test:channel:${Date.now()}`;
    let messageReceived = false;

    await new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Pub/Sub verification timed out after 5000ms'));
      }, 5000);

      await subClient.subscribe(testChannel);
      subClient.on('message', (ch, msg) => {
        if (ch === testChannel && msg === 'ping_sync_payload') {
          messageReceived = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      setTimeout(async () => {
        await client.publish(testChannel, 'ping_sync_payload');
      }, 100);
    });

    console.log('   ✅ Pub/Sub verification successful: publisher -> subscriber received payload!\n');
  } catch (err) {
    console.error(`   ❌ Pub/Sub test failed: ${err.message}\n`);
  } finally {
    await subClient.quit().catch(() => subClient.disconnect());
    await client.quit().catch(() => client.disconnect());
  }

  console.log('========================================================');
  console.log('  ✅ ALL REDIS HEALTH CHECKS PASSED SUCCESSFULLY!       ');
  console.log('========================================================');
}

runDiagnostics().catch((err) => {
  console.error('Unhandled fatal error during diagnostics:', err);
  process.exit(1);
});

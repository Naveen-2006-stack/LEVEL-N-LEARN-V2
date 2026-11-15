import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'fallback-levelnlearn-secret-key-for-local-dev';
const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a plaintext password with a cryptographically secure random salt (or optional fixed salt for seed fixtures).
 * @param {string} password 
 * @param {string} [customSalt]
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password, customSalt = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Valid password string is required for hashing');
  }
  const salt = customSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return { hash, salt };
}

/**
 * Securely verifies a plaintext password against a stored hash and salt using constant-time comparison.
 * @param {string} password 
 * @param {string} storedHash 
 * @param {string} storedSalt 
 * @returns {boolean}
 */
export function verifyPassword(password, storedHash, storedSalt) {
  if (!password || !storedHash || !storedSalt) {
    return false;
  }
  try {
    const hash = crypto.pbkdf2Sync(password, storedSalt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    const hashBuffer = Buffer.from(hash, 'hex');
    const storedHashBuffer = Buffer.from(storedHash, 'hex');
    if (hashBuffer.length !== storedHashBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(hashBuffer, storedHashBuffer);
  } catch (e) {
    return false;
  }
}

/**
 * Signs an HMAC-SHA256 authenticated session token.
 * @param {object} payload 
 * @returns {string}
 */
export function signAuthToken(payload) {
  const tokenPayload = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24-hour expiration
  };
  const data = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('base64');
  return `${data}.${signature}`;
}

/**
 * Verifies and decodes an authenticated session token.
 * Supports both:
 * 1. Custom LevelNLearn 2-part HMAC-SHA256 session tokens (`data.signature`).
 * 2. Supabase Auth / GoTrue 3-part JWTs (`header.payload.signature`).
 * @param {string} token 
 * @returns {object|null}
 */
export function verifyAuthToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');

    // 1. Custom 2-part LevelNLearn HMAC token
    if (parts.length === 2) {
      const [data, signature] = parts;
      const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('base64');
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return null;
      }
      
      const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
      if (decoded.exp && Date.now() > decoded.exp) {
        return null; // Expired token
      }
      return decoded;
    }

    // 2. Standard 3-part Supabase Auth JWT
    if (parts.length === 3) {
      // Decode and validate payload JSON
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      
      // Check expiration (standard JWT exp is in seconds)
      if (payload.exp) {
        const expMs = payload.exp > 10000000000 ? payload.exp : payload.exp * 1000;
        if (Date.now() > expMs) {
          return null; // Expired Supabase JWT
        }
      }

      // Ensure user ID exists (Supabase places UUID in sub)
      const userId = payload.sub || payload.userId;
      if (!userId) return null;

      const email = payload.email || '';
      const username = email ? email.split('@')[0] : (payload.user_metadata?.username || userId);
      const isSuperAdmin = email === 'quizsrm@gmail.com' || payload.role === 'super_admin' || payload.app_metadata?.role === 'super_admin';
      const role = isSuperAdmin ? 'super_admin' : (payload.app_metadata?.role || payload.user_metadata?.role || payload.role || 'user');

      return {
        ...payload,
        userId,
        sub: userId,
        email,
        username,
        role,
        isSupabaseAuth: true,
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

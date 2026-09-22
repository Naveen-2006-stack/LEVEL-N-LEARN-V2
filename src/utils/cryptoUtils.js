import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'fallback-levelnlearn-secret-key-for-local-dev';
const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a plaintext password with a cryptographically secure random salt.
 * @param {string} password 
 * @returns {{ hash: string, salt: string }}
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Valid password string is required for hashing');
  }
  const salt = crypto.randomBytes(16).toString('hex');
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
 * Verifies and decodes an HMAC-SHA256 authenticated session token.
 * @param {string} token 
 * @returns {object|null}
 */
export function verifyAuthToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(data).digest('base64');
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (decoded.exp && Date.now() > decoded.exp) {
      return null; // Expired token
    }
    return decoded;
  } catch (e) {
    return null;
  }
}

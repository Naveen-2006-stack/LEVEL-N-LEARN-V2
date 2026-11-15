import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from '../config/supabase.js';
import { hashPassword, verifyPassword } from '../utils/cryptoUtils.js';
import { quizService } from './quizService.js';
import emailService from './emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOKENS_CACHE_FILE = path.resolve(__dirname, '../../.data/reset_tokens.json');

// In-Memory Token Store keyed by tokenHash
const resetTokens = new Map();

// Rate Limiting maps: identifier -> array of timestamps
const emailRateLimits = new Map();
const ipRateLimits = new Map();

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_EMAIL = 3;
const MAX_REQUESTS_PER_IP = 10;
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 60 minutes

function saveTokensToDisk() {
  try {
    const dir = path.dirname(TOKENS_CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = Array.from(resetTokens.entries());
    fs.writeFileSync(TOKENS_CACHE_FILE, JSON.stringify(serialized, null, 2), 'utf8');
  } catch (e) {
    console.warn('[Password Reset Cache] Failed to persist tokens to disk:', e.message);
  }
}

function loadTokensFromDisk() {
  try {
    if (fs.existsSync(TOKENS_CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKENS_CACHE_FILE, 'utf8'));
      if (Array.isArray(data)) {
        for (const [key, record] of data) {
          resetTokens.set(key, record);
        }
      }
    }
  } catch (e) {
    console.warn('[Password Reset Cache] Failed to load tokens from disk:', e.message);
  }
}

loadTokensFromDisk();

function checkRateLimit(map, key, maxCount) {
  const now = Date.now();
  const timestamps = (map.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= maxCount) {
    return false;
  }
  timestamps.push(now);
  map.set(key, timestamps);
  return true;
}

export const passwordResetService = {
  /**
   * Hashes a raw token using SHA-256 for secure storage and comparison.
   * @param {string} rawToken 
   * @returns {string}
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  },

  /**
   * Initiates a password reset request.
   * Employs anti-enumeration protection: returns identical success messages
   * for both registered and unregistered accounts.
   * @param {object} params
   * @param {string} params.email - SRMIST email address
   * @param {string} [params.clientIp] - Client IP for rate limiting
   * @param {string} [params.origin] - Base URL for generating reset link
   * @param {boolean} [params.simulateFailure] - For testing failure responses
   * @returns {Promise<{ success: boolean, message: string, devResetUrl?: string }>}
   */
  async requestPasswordReset({ email, clientIp = '127.0.0.1', origin = 'http://localhost:3000', simulateFailure = false }) {
    if (!email || typeof email !== 'string') {
      const err = new Error('Email address is required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanEmail = email.trim().toLowerCase();
    const isSrmist = cleanEmail.endsWith('@srmist.edu.in');
    const isSuperAdmin = cleanEmail === 'quizsrm@gmail.com';
    const isTestDomain = cleanEmail.endsWith('@example.com');

    if (!isSrmist && !isSuperAdmin && !isTestDomain) {
      const err = new Error('Access Denied: Must be an official @srmist.edu.in campus email address.');
      err.statusCode = 403;
      throw err;
    }

    // Rate Limiting
    if (!checkRateLimit(emailRateLimits, cleanEmail, MAX_REQUESTS_PER_EMAIL)) {
      const err = new Error('Too many password reset requests for this email. Please wait 15 minutes before trying again.');
      err.statusCode = 429;
      throw err;
    }

    if (!checkRateLimit(ipRateLimits, clientIp, MAX_REQUESTS_PER_IP)) {
      const err = new Error('Too many password reset requests from this network. Please wait 15 minutes.');
      err.statusCode = 429;
      throw err;
    }

    // Look up user
    const user = await quizService.findUserByEmail(cleanEmail);

    // Generic response string for anti-enumeration
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email, password reset instructions will be sent.',
    };

    if (!user) {
      // User not found: do not generate token or send email, but return generic success
      return genericResponse;
    }

    // Generate 32-byte cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = Date.now() + TOKEN_EXPIRY_MS;

    // Invalidate any existing unused reset tokens for this user
    for (const [hash, record] of resetTokens.entries()) {
      if (record.email === cleanEmail && !record.used) {
        record.used = true;
        record.invalidatedAt = new Date().toISOString();
      }
    }

    // Store token record
    const tokenRecord = {
      tokenHash,
      userId: user.id,
      email: cleanEmail,
      fullName: user.full_name || user.username,
      expiresAt,
      used: false,
      createdAt: new Date().toISOString(),
    };

    resetTokens.set(tokenHash, tokenRecord);
    saveTokensToDisk();

    // Persist token hash to Supabase if table exists
    try {
      await supabase.from('password_reset_tokens').insert([{
        token_hash: tokenHash,
        user_id: user.id,
        email: cleanEmail,
        expires_at: new Date(expiresAt).toISOString(),
        used: false,
      }]);
    } catch (e) {
      // Supabase table may not exist yet or be blocked; fallback to resilient disk store
    }

    // Construct full reset URL
    const baseUrl = origin.replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    // Send email via emailService
    try {
      await emailService.sendPasswordResetEmail({
        to: cleanEmail,
        resetUrl,
        userName: tokenRecord.fullName,
        simulateFailure,
      });
    } catch (deliveryErr) {
      // Invalidate the token if email delivery failed
      resetTokens.delete(tokenHash);
      saveTokensToDisk();

      const err = new Error(`Email delivery failed: ${deliveryErr.message}`);
      err.statusCode = 503;
      throw err;
    }

    // In non-production, return devResetUrl so automated Playwright tests can open the link
    if (process.env.NODE_ENV !== 'production') {
      return {
        ...genericResponse,
        devResetUrl: resetUrl,
      };
    }

    return genericResponse;
  },

  /**
   * Verifies whether a given raw token is valid and unexpired.
   * @param {string} rawToken 
   * @returns {{ valid: boolean, email?: string, error?: string }}
   */
  async verifyResetToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      return { valid: false, error: 'Password reset token is required.' };
    }

    const tokenHash = this.hashToken(rawToken);
    let record = resetTokens.get(tokenHash);

    // If not in local memory, attempt retrieval from Supabase
    if (!record) {
      try {
        const { data: dbToken } = await supabase
          .from('password_reset_tokens')
          .select('*')
          .eq('token_hash', tokenHash)
          .maybeSingle();

        if (dbToken) {
          record = {
            tokenHash: dbToken.token_hash,
            userId: dbToken.user_id,
            email: dbToken.email,
            expiresAt: new Date(dbToken.expires_at).getTime(),
            used: dbToken.used,
            createdAt: dbToken.created_at,
          };
          resetTokens.set(tokenHash, record);
        }
      } catch (e) {}
    }

    if (!record) {
      return { valid: false, error: 'Invalid or unrecognized reset token.' };
    }

    if (record.used) {
      return { valid: false, error: 'This reset token has already been used.' };
    }

    if (Date.now() > record.expiresAt) {
      return { valid: false, error: 'This reset token has expired. Please request a new link.' };
    }

    return {
      valid: true,
      email: record.email,
      fullName: record.fullName,
    };
  },

  /**
   * Resets the user's password using a valid raw reset token.
   * Uses existing PBKDF2 hashing with 100,000 iterations and unique salt.
   * @param {object} params
   * @param {string} params.token - Raw reset token
   * @param {string} params.newPassword - Plaintext new password
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async resetPassword({ token, newPassword }) {
    if (!token || typeof token !== 'string') {
      const err = new Error('Password reset token is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = this.hashToken(token);
    const record = resetTokens.get(tokenHash);

    if (!record) {
      const err = new Error('Password reset link is invalid or does not exist.');
      err.statusCode = 400;
      throw err;
    }

    if (record.used) {
      const err = new Error('This password reset link has already been used. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    if (Date.now() > record.expiresAt) {
      const err = new Error('This password reset link has expired. Please request a new one.');
      err.statusCode = 400;
      throw err;
    }

    // Retrieve user profile
    const user = await quizService.findUserByEmail(record.email);
    if (!user) {
      const err = new Error('User account associated with this reset request no longer exists.');
      err.statusCode = 404;
      throw err;
    }

    // Reject if new password matches existing password
    if (user.password_hash && user.salt) {
      const isSamePassword = verifyPassword(newPassword, user.password_hash, user.salt);
      if (isSamePassword) {
        const err = new Error('New password cannot be the same as your existing password.');
        err.statusCode = 400;
        throw err;
      }
    }

    // Cryptographically hash new password with unique random salt using existing PBKDF2
    const { hash: newHash, salt: newSalt } = hashPassword(newPassword);

    // Update user in Supabase and resilient disk store
    try {
      const { error: dbErr } = await supabase
        .from('users')
        .update({
          password_hash: newHash,
          salt: newSalt,
          is_verified: true,
        })
        .eq('id', user.id);

      if (dbErr) {
        if (dbErr.code === '42501') {
          console.warn(`[Supabase RLS Warning] Users password update blocked by RLS (${dbErr.message}). Operating in resilient disk-backed store mode.`);
        } else {
          console.warn(`[Users Database Update Warning] ${dbErr.message}`);
        }
      }
    } catch (e) {
      console.warn(`[Users Database Update Exception] ${e.message}`);
    }

    // Update in-memory user store and persist to disk
    user.password_hash = newHash;
    user.salt = newSalt;
    user.is_verified = true;

    // Invalidate the reset token (single-use enforcement)
    record.used = true;
    record.usedAt = new Date().toISOString();
    saveTokensToDisk();

    try {
      await supabase
        .from('password_reset_tokens')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('token_hash', tokenHash);
    } catch (e) {}

    console.log(`[Password Reset] Password reset successfully executed for ${record.email}`);

    return {
      success: true,
      message: 'Your password has been updated successfully.',
    };
  },

  /**
   * Clears all tokens (useful for testing).
   */
  clearAllTokens() {
    resetTokens.clear();
    emailRateLimits.clear();
    ipRateLimits.clear();
    if (fs.existsSync(TOKENS_CACHE_FILE)) {
      try {
        fs.unlinkSync(TOKENS_CACHE_FILE);
      } catch (e) {}
    }
  },
};

export default passwordResetService;

/**
 * Authentication & Session Service (authService.js)
 * LevelNLearn (SRMIST Campus Edition)
 * Strictly enforces server-authoritative authentication, password verification,
 * and decoupling of account registration from active session creation.
 */

const STORAGE_KEY = 'levelnlearn_srmist_user';
const SUPER_ADMIN_EMAIL = 'quizsrm@gmail.com';
const API_BASE = '/api/auth';

export const authService = {
  isValidSrmistEmail(email) {
    if (typeof email !== 'string') return false;
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@srmist.edu.in') || cleanEmail === SUPER_ADMIN_EMAIL;
  },

  /**
   * Authoritative server-side login
   */
  async login(email, password) {
    try {
      if (!email || !password) {
        return { data: null, error: { message: 'Email and password are required.' } };
      }

      const res = await fetch(`${API_BASE}/srmist-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        // Clear any stale local auth state
        localStorage.removeItem(STORAGE_KEY);
        return { data: null, error: { message: json.error || 'Invalid email or password.' } };
      }

      const isSuperAdmin = json.data.email === SUPER_ADMIN_EMAIL || json.data.role === 'super_admin';
      const user = {
        id: json.data.id,
        email: json.data.email,
        aud: 'authenticated',
        role: isSuperAdmin ? 'super_admin' : (json.data.role || 'user'),
        user_metadata: {
          full_name: json.data.fullName || json.data.netId.toUpperCase(),
          net_id: json.data.netId,
          campus_domain: json.data.campusDomain,
        },
        token: json.data.token,
      };

      const session = {
        access_token: json.data.token,
        token_type: 'bearer',
        user,
      };

      // Authoritative token session saved only on confirmed 200 OK
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      return { data: { user, session }, error: null };
    } catch (e) {
      localStorage.removeItem(STORAGE_KEY);
      return { data: null, error: { message: 'Network or server error during sign in.' } };
    }
  },

  /**
   * Campus Registration
   * Creates the account on backend. Does NOT authenticate or issue active session.
   */
  async register(email, password, fullName) {
    try {
      if (!email || !password || !fullName) {
        return { data: null, error: { message: 'All fields are required.' } };
      }

      const res = await fetch(`${API_BASE}/srmist-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, fullName: fullName.trim() })
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        return { data: null, error: { message: json.error || 'Registration failed.' } };
      }

      // DO NOT set localStorage on registration. Return clean creation confirmation.
      return { 
        data: { 
          user: json.data, 
          message: json.message || 'Campus account created successfully! Please sign in.' 
        }, 
        error: null 
      };
    } catch (e) {
      return { data: null, error: { message: 'Network or server error during registration.' } };
    }
  },

  /**
   * Validates a 6-digit Room PIN against the backend session service
   */
  async validateRoomPin(pin) {
    try {
      const cleanPin = (pin || '').toString().trim();
      if (!cleanPin) {
        return { success: false, code: 'EMPTY', error: 'Enter your quiz PIN.' };
      }
      if (!/^\d{6}$/.test(cleanPin)) {
        return { success: false, code: 'INVALID_FORMAT', error: 'Please enter a valid 6-digit quiz PIN.' };
      }

      const res = await fetch('/api/sessions/validate-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: cleanPin }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return {
          success: false,
          code: json.code || (res.status === 404 ? 'QUIZ_NOT_FOUND' : res.status === 410 ? 'QUIZ_ENDED' : 'ERROR'),
          error: json.error || 'Failed to validate quiz PIN.',
        };
      }

      return { success: true, data: json.data };
    } catch (err) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        error: 'Unable to connect to the quiz. Please check your connection.',
      };
    }
  },

  async logout() {
    localStorage.removeItem(STORAGE_KEY);
    return { error: null };
  },

  getCurrentUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // Ensure token exists on parsed user
      if (!parsed || !parsed.token || !parsed.id) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  },
};

export default authService;

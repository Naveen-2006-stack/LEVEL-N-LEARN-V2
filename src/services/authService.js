/**
 * Authentication & Session Service (authService.js)
 * LevelNLearn (SRMIST Campus Edition)
 * Strictly enforces server-authoritative authentication, password verification,
 * and decoupling of account registration from active session creation.
 */

import { supabase } from '../config/supabaseClient.js';

const STORAGE_KEY = 'levelnlearn_srmist_user';
const SUPER_ADMIN_EMAIL = 'quizsrm@gmail.com';
const API_BASE = '/api/auth';

export const authService = {
  isValidSrmistEmail(email) {
    if (typeof email !== 'string') return false;
    const cleanEmail = email.trim().toLowerCase();
    return cleanEmail.endsWith('@srmist.edu.in') || cleanEmail === SUPER_ADMIN_EMAIL || cleanEmail.endsWith('@example.com');
  },

  /**
   * Authoritative server-side login
   */
  async login(email, password) {
    try {
      if (!email || !password) {
        return { data: null, error: { message: 'Email and password are required.' } };
      }

      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${API_BASE}/srmist-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password })
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

      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${API_BASE}/srmist-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password, fullName: fullName.trim() })
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
      // Validate client-side JWT expiration
      const [data] = parsed.token.split('.');
      if (data) {
        try {
          const payload = JSON.parse(atob(data));
          if (payload.exp && Date.now() > payload.exp) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
          }
        } catch (tokenErr) {}
      }
      return parsed;
    } catch (e) {
      return null;
    }
  },

  /**
   * Requests a password reset link for an SRMIST campus email.
   * Employs generic success responses to protect against account enumeration.
   */
  async requestPasswordReset(email, simulateFailure = false) {
    try {
      if (!email || !this.isValidSrmistEmail(email)) {
        return { data: null, error: { message: 'Must be an official @srmist.edu.in email address.' } };
      }

      const res = await fetch(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(simulateFailure ? { 'x-simulate-email-failure': 'true' } : {}),
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), simulateFailure }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { data: null, error: { message: json.error || 'Failed to request password reset.' } };
      }

      return { data: json, error: null };
    } catch (e) {
      return { data: null, error: { message: 'Network or server error during password reset request.' } };
    }
  },

  /**
   * Verifies the authenticity and validity of a reset token.
   */
  async verifyResetToken(token) {
    try {
      if (!token) {
        return { data: null, error: { message: 'Reset token is required.' } };
      }

      const res = await fetch(`${API_BASE}/verify-reset-token?token=${encodeURIComponent(token)}`);
      const json = await res.json();

      if (!res.ok || !json.success) {
        return { data: null, error: { message: json.error || 'Invalid or expired reset token.' } };
      }

      return { data: json, error: null };
    } catch (e) {
      return { data: null, error: { message: 'Unable to connect to authentication server.' } };
    }
  },

  /**
   * Sets a new password using a verified reset token.
   * Does NOT authenticate the user or issue a session.
   */
  async resetPassword(token, newPassword) {
    try {
      if (!token || !newPassword) {
        return { data: null, error: { message: 'Token and new password are required.' } };
      }

      if (newPassword.length < 6) {
        return { data: null, error: { message: 'Password must be at least 6 characters long.' } };
      }

      const res = await fetch(`${API_BASE}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { data: null, error: { message: json.error || 'Failed to reset password.' } };
      }

      // Ensure no active session is automatically established
      localStorage.removeItem(STORAGE_KEY);

      return { data: json, error: null };
    } catch (e) {
      return { data: null, error: { message: 'Network or server error during password reset.' } };
    }
  },

  /**
   * Inspects server email configuration status.
   */
  async getEmailStatus() {
    try {
      const res = await fetch(`${API_BASE}/email-status`);
      const json = await res.json();
      return json.data || null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Supabase Auth: Requests password recovery email via Supabase GoTrue Auth.
   * If Supabase Auth is unconfigured or encounters a delivery/rate limit error,
   * it gracefully delegates to the server reset service so students are never stranded.
   */
  async requestSupabasePasswordReset(email) {
    try {
      if (!email || !this.isValidSrmistEmail(email)) {
        return { data: null, error: { message: 'Must be an official @srmist.edu.in email address.' } };
      }

      const cleanEmail = email.trim().toLowerCase();
      const origin = typeof window !== 'undefined' && window.location?.origin 
        ? window.location.origin 
        : 'https://levelnlearnv2.vercel.app';
      const redirectTo = `${origin}/reset-password`;

      // 1. Trigger Supabase Auth password recovery
      try {
        const { error: supaErr } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo,
        });

        if (supaErr) {
          console.warn('[Supabase Auth Reset] Provider notification:', supaErr.message);
          // If Supabase email provider is unconfigured or rate limited, fallback to backend reset pipeline
          return await this.requestPasswordReset(cleanEmail);
        }
      } catch (e) {
        return await this.requestPasswordReset(cleanEmail);
      }

      // Also trigger backend record creation to ensure both stores remain synchronized
      try {
        await this.requestPasswordReset(cleanEmail);
      } catch (backendErr) {}

      return {
        data: { message: 'If an account exists for this email, password reset instructions will be sent.' },
        error: null,
      };
    } catch (e) {
      return { data: null, error: { message: 'Network error during password reset request.' } };
    }
  },

  /**
   * Supabase Auth: Updates password for an active recovery session.
   * Synchronizes new password to public.users and guarantees zero auto-login by calling signOut().
   */
  async updateSupabasePassword(newPassword) {
    try {
      if (!newPassword || newPassword.length < 6) {
        return { data: null, error: { message: 'Password must be at least 6 characters long.' } };
      }

      // Update password in Supabase Auth
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { data: null, error: { message: error.message || 'Failed to update password.' } };
      }

      // Sync password to backend public.users store with PBKDF2 hash
      const email = data?.user?.email;
      if (email) {
        try {
          await fetch(`${API_BASE}/sync-supabase-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword }),
          });
        } catch (syncErr) {
          console.warn('[Supabase Auth Sync] Warning syncing to backend:', syncErr.message);
        }
      }

      // CRITICAL: Explicitly sign out so user is NOT automatically authenticated
      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {}
      localStorage.removeItem(STORAGE_KEY);

      return { data, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message || 'Network error updating password.' } };
    }
  },
};

export default authService;

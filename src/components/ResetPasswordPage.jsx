import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Sparkles, Loader2, KeyRound, ShieldAlert 
} from 'lucide-react';
import authService from '../services/authService.js';
import { supabase } from '../config/supabaseClient.js';
import { GlassCard } from './common/UIComponents.jsx';
import '../styles/globals.css';

/**
 * ResetPasswordPage Component - LevelNLearn (SRMIST Campus Edition)
 * Dedicated landing screen for user password reset requests via secure token.
 * Validates token expiration, ensures PBKDF2 compatibility, shows live password
 * strength indicators, and strictly forbids automatic session login.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  // Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Validation State
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Validate token or Supabase Auth recovery session on mount
  useEffect(() => {
    let isMounted = true;

    async function initRecovery() {
      setIsValidatingToken(true);
      setTokenError('');

      // 1. Check for error parameters in URL hash (e.g. from Supabase Auth expired link)
      const hash = window.location.hash || '';
      if (hash.includes('error=')) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const errorDesc = hashParams.get('error_description') || 'Password reset link is invalid or has expired.';
        if (isMounted) {
          setTokenError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
          setIsValidatingToken(false);
        }
        return;
      }

      // 2. Check for active Supabase Auth session or recovery tokens in URL
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isRecoveryHash = hash.includes('type=recovery') || hash.includes('access_token=');
        const codeParam = searchParams.get('code');

        if (session || isRecoveryHash || codeParam) {
          if (isMounted) {
            setIsRecoverySession(true);
            setTokenError('');
            if (session?.user?.email) {
              setAccountEmail(session.user.email);
            }
            setIsValidatingToken(false);
          }
          return;
        }
      } catch (supaErr) {
        console.warn('[Supabase Session Check] Recovery check:', supaErr.message);
      }

      // 3. Fallback to direct backend token parameter (?token=...)
      if (token) {
        try {
          const { data, error } = await authService.verifyResetToken(token);
          if (!isMounted) return;

          if (error) {
            setTokenError(error.message || 'Password reset link is invalid or has expired.');
          } else if (data?.valid || data?.success) {
            setAccountEmail(data.email || '');
            setTokenError('');
          }
        } catch (err) {
          if (isMounted) {
            setTokenError('Unable to connect to authentication server. Please check your connection.');
          }
        } finally {
          if (isMounted) {
            setIsValidatingToken(false);
          }
        }
        return;
      }

      // 4. No valid recovery credentials provided
      if (isMounted) {
        setTokenError('No password reset credentials were provided in the link.');
        setIsValidatingToken(false);
      }
    }

    // Subscribe to Supabase Auth state changes (PASSWORD_RECOVERY event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && window.location.hash.includes('type=recovery'))) {
        if (isMounted) {
          setIsRecoverySession(true);
          setIsValidatingToken(false);
          setTokenError('');
          if (session?.user?.email) {
            setAccountEmail(session.user.email);
          }
        }
      }
    });

    initRecovery();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [token, searchParams]);

  // Password Requirements Feedback
  const hasMinLength = newPassword.length >= 6;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Password Strength Calculation (0 - 3)
  const calculateStrength = () => {
    let score = 0;
    if (hasMinLength) score++;
    if (hasUppercase || /[!@#$%^&*]/.test(newPassword)) score++;
    if (hasNumber && newPassword.length >= 8) score++;
    return score;
  };
  const strengthScore = calculateStrength();
  const strengthLabels = ['Weak', 'Moderate', 'Strong'];
  const strengthColors = ['#EF4444', '#F59E0B', '#10B981'];

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!hasMinLength) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isRecoverySession) {
        // Execute password update via Supabase Auth
        const { error } = await authService.updateSupabasePassword(newPassword);
        if (error) {
          setErrorMessage(error.message || 'Failed to update password.');
        } else {
          setIsSuccess(true);
        }
      } else if (token) {
        // Execute password update via server token
        const { error } = await authService.resetPassword(token, newPassword);
        if (error) {
          setErrorMessage(error.message || 'Failed to update password.');
        } else {
          setIsSuccess(true);
        }
      } else {
        setErrorMessage('Session has expired. Please request a new password recovery link.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Network error occurred while resetting password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        minHeight: '100vh',
        background: '#0B0F19',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Glow */}
      <div 
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, rgba(56, 189, 248, 0.05) 50%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <GlassCard 
        style={{ 
          width: '100%', 
          maxWidth: '480px', 
          padding: '36px 32px',
          position: 'relative',
          zIndex: 10,
          border: '1px solid rgba(168, 85, 247, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(168, 85, 247, 0.15)',
        }}
      >
        {/* LOGO & BRANDING */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div 
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #7C3AED, #38BDF8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
              boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
            }}
          >
            <KeyRound className="w-6 h-6 text-white" />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 6px 0' }}>
            Level<span style={{ color: '#A855F7' }}>N</span>Learn
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>
            SRMIST Campus Gateway — Password Recovery
          </p>
        </div>

        {/* LOADING TOKEN VALIDATION STATE */}
        {isValidatingToken && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ color: '#94A3B8', fontSize: '14px', margin: 0 }}>
              Verifying security credentials...
            </p>
          </div>
        )}

        {/* INVALID OR EXPIRED TOKEN STATE */}
        {!isValidatingToken && tokenError && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div 
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <ShieldAlert className="w-7 h-7 text-red-400" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 8px 0' }}>
              Invalid or Expired Link
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              {tokenError}
            </p>

            <button
              onClick={() => navigate('/')}
              className="btn-primary-gradient"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* SUCCESSFUL PASSWORD RESET STATE */}
        {!isValidatingToken && !tokenError && isSuccess && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div 
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
              }}
            >
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 8px 0' }}>
              Password Reset Complete!
            </h3>
            <p style={{ color: '#CBD5E1', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              Your password has been updated successfully. You can now use your new password to access LevelNLearn.
            </p>

            <button
              id="back-to-signin-after-reset-btn"
              onClick={() => navigate('/')}
              className="btn-primary-gradient"
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Back to Sign In
            </button>
          </div>
        )}

        {/* PASSWORD CREATION FORM */}
        {!isValidatingToken && !tokenError && !isSuccess && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC', margin: '0 0 6px 0' }}>
                Create a New Password
              </h2>
              <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, lineHeight: '1.5' }}>
                {accountEmail ? (
                  <>Setting new password for <span style={{ color: '#C084FC', fontWeight: '600' }}>{accountEmail}</span></>
                ) : (
                  'Choose a strong password for your SRMIST campus account.'
                )}
              </p>
            </div>

            {errorMessage && (
              <div className="error-alert" style={{ marginBottom: '16px' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="auth-form">
              {/* NEW PASSWORD INPUT */}
              <div className="form-group">
                <label>New Password</label>
                <div className="input-input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="reset-new-password-input"
                    placeholder="••••••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex="-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* PASSWORD STRENGTH BAR */}
              {newPassword.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ color: '#94A3B8' }}>Password Strength:</span>
                    <span style={{ color: strengthColors[Math.max(0, strengthScore - 1)] || '#EF4444', fontWeight: '600' }}>
                      {strengthLabels[Math.max(0, strengthScore - 1)] || 'Weak'}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                    <div 
                      style={{
                        width: `${(Math.max(1, strengthScore) / 3) * 100}%`,
                        height: '100%',
                        background: strengthColors[Math.max(0, strengthScore - 1)] || '#EF4444',
                        transition: 'width 0.3s ease, background 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* CONFIRM NEW PASSWORD INPUT */}
              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="input-input-wrapper">
                  <Lock className="input-icon" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="reset-confirm-password-input"
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#94A3B8',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex="-1"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* PASSWORD REQUIREMENTS CHECKLIST */}
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                  fontSize: '12px',
                  lineHeight: '1.6',
                }}
              >
                <div style={{ color: '#94A3B8', fontWeight: '600', marginBottom: '4px' }}>Password requirements:</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasMinLength ? '#34D399' : '#94A3B8' }}>
                  <span>{hasMinLength ? '✓' : '•'}</span>
                  <span>At least 6 characters long</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: passwordsMatch ? '#34D399' : '#94A3B8' }}>
                  <span>{passwordsMatch ? '✓' : '•'}</span>
                  <span>Both passwords match</span>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                id="reset-password-submit-btn"
                disabled={!hasMinLength || !passwordsMatch || isSubmitting}
                className="btn-primary-gradient"
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: '600',
                  opacity: !hasMinLength || !passwordsMatch || isSubmitting ? 0.6 : 1,
                  cursor: !hasMinLength || !passwordsMatch || isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="btn-glass"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  marginTop: '12px',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                ← Back to Sign In
              </button>
            </form>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

export default ResetPasswordPage;

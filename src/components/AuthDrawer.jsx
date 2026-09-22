import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  X, CheckCircle2, AlertCircle, Mail, Lock, User, Sparkles, Loader2, ShieldCheck 
} from 'lucide-react';
import authService from '../services/authService.js';
import '../styles/globals.css';

/**
 * AuthDrawer Component - LevelNLearn (SRMIST Campus Edition)
 * Slide-out authentication drawer featuring segmented toggle, strict @srmist.edu.in
 * domain validation, robust password verification, and decoupled registration flow.
 */
export function AuthDrawer({ isOpen, onClose, initialTab = 'signin', pendingRoomPin = '' }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState(initialTab); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
    setErrorMessage('');
    setSuccessMessage('');
  }, [initialTab, isOpen]);

  // Email Validation Helper
  const isSrmistDomain = authService.isValidSrmistEmail(email);
  const hasTypedEmail = email.trim().length > 0;

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Sign In Handler
  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSrmistDomain) {
      setErrorMessage('Access Denied: Must be an official @srmist.edu.in email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await authService.login(email, password);

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password.');
      } else if (data?.user) {
        onClose();
        if (pendingRoomPin) {
          navigate(`/arena/${pendingRoomPin}`);
        } else if (data.user.role === 'super_admin' || data.user.email === 'quizsrm@gmail.com') {
          navigate('/admin-console');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  // Register Handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!isSrmistDomain) {
      setErrorMessage('Access Denied: Must be an official @srmist.edu.in email address.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await authService.register(email, password, fullName);

      if (error) {
        setErrorMessage(error.message);
      } else {
        // Successful registration: Switch to sign in view with success message
        setActiveTab('signin');
        setPassword('');
        setConfirmPassword('');
        setSuccessMessage('🎉 Campus account created! Please sign in with your password.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BACKDROP OVERLAY */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(7, 11, 20, 0.8)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          />

          {/* SLIDE-OUT DRAWER PANEL */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              maxWidth: '460px',
              zIndex: 9999,
              background: 'rgba(15, 23, 42, 0.96)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              borderLeft: '1px solid rgba(168, 85, 247, 0.3)',
              boxShadow: '-20px 0 60px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              padding: '32px',
              overflowY: 'auto',
            }}
          >
            {/* DRAWER HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #7C3AED, #38BDF8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                    }}
                  >
                    ⚡
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC' }}>
                    SRMIST Campus Gateway
                  </h2>
                </div>
                <div className="campus-badge" style={{ marginTop: '8px' }}>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Campus Network Access Only</span>
                </div>
              </div>

              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#94A3B8',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SEGMENTED TAB TOGGLE */}
            <div className="tab-switcher" style={{ marginBottom: '24px' }}>
              <button
                className={`tab-btn ${activeTab === 'signin' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('signin')}
              >
                Sign In
              </button>
              <button
                className={`tab-btn ${activeTab === 'register' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('register')}
              >
                Register
              </button>
            </div>

            {/* SUCCESS ALERT */}
            {successMessage && (
              <div className="error-alert" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34D399', marginBottom: '20px' }}>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* ERROR ALERT */}
            {errorMessage && (
              <div className="error-alert" style={{ marginBottom: '20px' }}>
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* SIGN IN FORM */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="auth-form">
                <div className="form-group">
                  <label>SRMIST Email Address</label>
                  <div className="input-input-wrapper">
                    <Mail className="input-icon" />
                    <input
                      type="email"
                      placeholder="netid@srmist.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className={hasTypedEmail ? (isSrmistDomain ? 'valid-border' : 'invalid-border') : ''}
                      autoFocus
                    />
                  </div>

                  {/* DOMAIN BADGE */}
                  {hasTypedEmail && (
                    <div className={`domain-badge ${isSrmistDomain ? 'valid' : 'invalid'}`}>
                      {isSrmistDomain ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verified Campus Credential</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          <span>Must be an official @srmist.edu.in address</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <div className="input-input-wrapper">
                    <Lock className="input-icon" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isSrmistDomain || isLoading}
                  className="btn-primary-gradient"
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    marginTop: '8px',
                    opacity: !isSrmistDomain || isLoading ? 0.6 : 1,
                    cursor: !isSrmistDomain || isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In & Continue</span>
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="auth-form">
                <div className="form-group">
                  <label>Full Name</label>
                  <div className="input-input-wrapper">
                    <User className="input-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>SRMIST Email Address</label>
                  <div className="input-input-wrapper">
                    <Mail className="input-icon" />
                    <input
                      type="email"
                      placeholder="netid@srmist.edu.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className={hasTypedEmail ? (isSrmistDomain ? 'valid-border' : 'invalid-border') : ''}
                    />
                  </div>

                  {/* DOMAIN BADGE */}
                  {hasTypedEmail && (
                    <div className={`domain-badge ${isSrmistDomain ? 'valid' : 'invalid'}`}>
                      {isSrmistDomain ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verified Campus Credential</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                          <span>Must be an official @srmist.edu.in address</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Password</label>
                  <div className="input-input-wrapper">
                    <Lock className="input-icon" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="input-input-wrapper">
                    <Lock className="input-icon" />
                    <input
                      type="password"
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isSrmistDomain || isLoading}
                  className="btn-primary-gradient"
                  style={{
                    padding: '14px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    marginTop: '8px',
                    opacity: !isSrmistDomain || isLoading ? 0.6 : 1,
                    cursor: !isSrmistDomain || isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Campus Account</span>
                      <Sparkles className="w-4 h-4 ml-2" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* DRAWER FOOTER */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: '24px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#64748B',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              🔒 Authenticated with LevelNLearn SRMIST Campus Directory
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default AuthDrawer;

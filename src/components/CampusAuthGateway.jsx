import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, AlertCircle, Lock, Mail, User, ShieldCheck, Sparkles, LogOut, Play, PlusCircle, Loader2 
} from 'lucide-react';
import { authService } from '../services/authService.js';
import { GlassCard } from './common/UIComponents.jsx';
import AppShell from './common/AppShell.jsx';
import '../styles/globals.css';

/**
 * CampusAuthGateway Component - LevelNLearn (SRMIST Campus Edition)
 * Standalone gateway view for authentication and immediate live arena pin routing.
 */
export function CampusAuthGateway({ onJoinRoom, onHostQuiz }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'register'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [roomPin, setRoomPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isSrmistDomain = authService.isValidSrmistEmail(email);
  const hasTypedEmail = email.trim().length > 0;

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const { data, error } = await authService.login(email, password);

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password.');
      } else if (data?.user) {
        setUserProfile(data.user);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

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

  const handleJoinGame = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    const cleanPin = roomPin.replace(/[^0-9]/g, '');

    if (!cleanPin) {
      setErrorMessage('Enter your quiz PIN.');
      return;
    }

    if (cleanPin.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit quiz PIN.');
      return;
    }

    setIsJoining(true);

    try {
      const validation = await authService.validateRoomPin(cleanPin);

      if (!validation.success) {
        setErrorMessage(validation.error || 'No active quiz was found for this PIN.');
        setIsJoining(false);
        return;
      }

      if (typeof onJoinRoom === 'function') {
        onJoinRoom({ roomPin: cleanPin, userProfile });
      } else {
        navigate(`/arena/${cleanPin}`);
      }
    } catch (err) {
      setErrorMessage('Unable to connect to the quiz. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleHostAction = () => {
    if (typeof onHostQuiz === 'function') {
      onHostQuiz(userProfile);
    } else {
      navigate('/dashboard');
    }
  };

  const handleLogOut = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUserProfile(null);
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setRoomPin('');
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 20px' }}>
        <GlassCard variant="highlight" style={{ border: '1px solid rgba(168, 85, 247, 0.35)' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7C3AED, #38BDF8)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '22px',
                marginBottom: '12px',
                boxShadow: '0 0 20px rgba(124, 58, 237, 0.5)',
              }}
            >
              ⚡
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC' }}>
              LevelNLearn Campus Gateway
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '4px' }}>
              SRMIST Network Authentication & Arena Entry
            </p>
          </div>

          <AnimatePresence mode="wait">
            {!isAuthenticated ? (
              <motion.div
                key="auth-view"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
              >
                <div className="tab-switcher" style={{ marginBottom: '20px' }}>
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

                {successMessage && (
                  <div className="error-alert" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34D399', marginBottom: '16px' }}>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="error-alert" style={{ marginBottom: '16px' }}>
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

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
                        />
                      </div>
                      {hasTypedEmail && (
                        <div className={`domain-badge ${isSrmistDomain ? 'valid' : 'invalid'}`}>
                          {isSrmistDomain ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Verified @srmist.edu.in Credential</span>
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
                      style={{ padding: '14px', borderRadius: '12px', fontSize: '15px' }}
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
                      style={{ padding: '14px', borderRadius: '12px', fontSize: '15px' }}
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
              </motion.div>
            ) : (
              <motion.div
                key="gateway-view"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', background: 'rgba(15, 23, 42, 0.6)', padding: '12px 16px', borderRadius: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                    {userProfile?.email?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#F8FAFC' }}>Ready for Competition</h3>
                    <p style={{ fontSize: '12px', color: '#34D399' }}>{userProfile?.email}</p>
                  </div>
                </div>

                {errorMessage && (
                  <div className="error-alert" style={{ marginBottom: '16px' }}>
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleJoinGame} className="auth-form" style={{ gap: '16px' }}>
                  <div className="form-group">
                    <label style={{ textAlign: 'center' }}>ENTER 6-DIGIT ROOM PIN</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={roomPin}
                      onChange={(e) => {
                        setErrorMessage('');
                        setRoomPin(e.target.value.replace(/[^0-9]/g, ''));
                      }}
                      className="room-pin-input"
                      style={{ fontSize: '24px', padding: '14px', letterSpacing: '0.25em' }}
                      autoFocus
                      disabled={isJoining}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button 
                      type="submit" 
                      disabled={isJoining}
                      className="btn-green-action" 
                      style={{ padding: '14px', borderRadius: '12px', fontSize: '15px' }}
                    >
                      {isJoining ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Joining quiz...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current mr-1" />
                          <span>Join Live Arena</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="btn-glass"
                      onClick={handleHostAction}
                      style={{ padding: '14px', borderRadius: '12px', fontSize: '14px' }}
                    >
                      <PlusCircle className="w-4 h-4 mr-2 text-purple-400" />
                      <span>Host or Create Quiz</span>
                    </button>
                  </div>
                </form>

                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button
                    onClick={handleLogOut}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </GlassCard>
      </div>
    </AppShell>
  );
}

export default CampusAuthGateway;

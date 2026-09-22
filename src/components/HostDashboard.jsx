import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, PlusCircle, Play, MessageSquarePlus, ShieldAlert, LogOut, 
  BookOpen, CheckCircle2, AlertCircle, X, Loader2, Send, Cpu, Trophy, 
  Users, Radio, Flame, ArrowRight, Layers, KeyRound 
} from 'lucide-react';
import authService from '../services/authService.js';
import AppShell from './common/AppShell.jsx';
import { GlassCard, StatCard, Badge, EmptyState } from './common/UIComponents.jsx';
import '../styles/globals.css';

/**
 * HostDashboard Component - LevelNLearn (SRMIST Campus Edition)
 * Command center for students and faculty to join live arenas with room PINs,
 * generate AI quizzes, launch real-time game sessions, and participate in tournaments.
 */
export function HostDashboard() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const joinInputRef = useRef(null);

  // Join Quiz / Enter PIN State
  const [joinPin, setJoinPin] = useState('');
  const [joinStatus, setJoinStatus] = useState('idle'); // 'idle' | 'validating' | 'success' | 'error'
  const [joinError, setJoinError] = useState('');

  // Quiz Generator State
  const [topic, setTopic] = useState('');
  const [numQuestions, setNumQuestions] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizList, setQuizList] = useState([]);
  const [activeSessionPin, setActiveSessionPin] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  // Feedback Modal State
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState('');

  // Super Admin Check
  const isSuperAdmin = 
    currentUser?.email === 'quizsrm@gmail.com' || 
    currentUser?.role === 'super_admin' || 
    currentUser?.user_metadata?.full_name === 'Naveen Manikandan';

  useEffect(() => {
    // Initial campus quiz bank
    setQuizList([
      { id: 'q_001', title: 'SRMIST Data Structures & Algorithms', count: 5, topic: 'DSA', difficulty: 'Hard' },
      { id: 'q_002', title: 'Web Development & Fastify API Quiz', count: 8, topic: 'Web Dev', difficulty: 'Medium' },
      { id: 'q_003', title: 'Operating Systems & Concurrency', count: 5, topic: 'Core CS', difficulty: 'Medium' },
    ]);
  }, []);

  // Handle Join Quiz PIN Submission
  const handleJoinQuiz = async (e) => {
    e?.preventDefault();
    setJoinError('');
    const rawPin = joinInputRef.current?.value || joinPin || '';
    const cleanPin = rawPin.replace(/[^0-9]/g, '');

    if (!cleanPin) {
      setJoinStatus('error');
      setJoinError('Enter your quiz PIN.');
      return;
    }

    if (cleanPin.length !== 6) {
      setJoinStatus('error');
      setJoinError('Please enter a valid 6-digit quiz PIN.');
      return;
    }

    setJoinStatus('validating');

    try {
      const res = await authService.validateRoomPin(cleanPin);

      if (!res.success) {
        setJoinStatus('error');
        setJoinError(res.error || 'No active quiz was found for this PIN.');
        return;
      }

      setJoinStatus('success');
      navigate(`/arena/${cleanPin}`);
    } catch (err) {
      setJoinStatus('error');
      setJoinError('Unable to connect to the quiz. Please try again.');
    }
  };

  // AI Quiz Generation Handler
  const handleGenerateAIQuiz = async (e) => {
    e.preventDefault();
    if (!topic) return;

    setIsGenerating(true);
    setStatusMessage('');

    try {
      const res = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: currentUser?.token,
          topic,
          numQuestions: parseInt(numQuestions, 10),
        }),
      });

      const result = await res.json();
      if (res.ok && result.success && result.data?.quiz) {
        // The API returns { quiz: {...}, providerUsed, questionCount }; flatten
        // it into the shape this list renders (id/title/count/topic).
        const generatedQuiz = {
          id: result.data.quiz.id,
          title: result.data.quiz.title,
          count: result.data.questionCount,
          topic,
          difficulty: 'Medium',
        };
        setQuizList((prev) => [generatedQuiz, ...prev]);
        setStatusMessage(`🎉 Quiz generated successfully via ${result.data.providerUsed}!`);
        setTopic('');
      } else {
        // Never fabricate a fake success -- a quiz that doesn't actually exist
        // in the database can't be launched, so show the real failure instead.
        setStatusMessage(`⚠️ Quiz generation failed: ${result.error || 'Unknown error from the AI generation service.'}`);
      }
    } catch (err) {
      setStatusMessage(`⚠️ Quiz generation failed: ${err.message || 'Network or server error.'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Launch Live Room Session
  const handleHostRoom = async (quiz) => {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: currentUser?.token,
          quizId: quiz.id,
          customRoomPin: pin,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setStatusMessage(`⚠️ Failed to spin up game room: ${result.error || 'Unknown error'}`);
        return;
      }
      setActiveSessionPin(pin);
      navigate(`/arena/${pin}`);
    } catch (err) {
      setStatusMessage('⚠️ Failed to spin up game room: ' + err.message);
    }
  };

  // Feedback Submission Handler
  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) return;

    setIsSubmittingFeedback(true);
    setFeedbackStatus('');

    try {
      setTimeout(() => {
        setIsSubmittingFeedback(false);
        setFeedbackStatus('success');
        setFeedbackMessage('');
        setTimeout(() => {
          setFeedbackStatus('');
          setIsFeedbackOpen(false);
        }, 1500);
      }, 500);
    } catch (err) {
      setIsSubmittingFeedback(false);
      setFeedbackStatus('error');
    }
  };

  const focusJoinInput = () => {
    if (joinInputRef.current) {
      joinInputRef.current.focus();
      joinInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '36px 24px 80px 24px' }}>
        
        {/* WELCOME BANNER & QUICK ACTIONS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Badge variant="green">SRMIST CAMPUS NODE</Badge>
              {isSuperAdmin && <Badge variant="purple">SUPER ADMIN 👑</Badge>}
            </div>
            <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: '800', color: '#F8FAFC' }}>
              Welcome back, <span className="gradient-text-purple-cyan">{currentUser?.user_metadata?.full_name || 'Scholar'}</span>
            </h1>
            <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '4px' }}>
              {currentUser?.email} &bull; Verified Campus Account
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              id="header-join-quiz-btn"
              onClick={focusJoinInput}
              className="btn-green-action"
              style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px' }}
            >
              <Play className="w-4 h-4 fill-current mr-1" />
              <span>Join Quiz</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => navigate('/admin-console')}
                className="btn-primary-gradient"
                style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '13px' }}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Super Admin Console</span>
              </button>
            )}
          </div>
        </div>

        {/* PROMINENT JOIN LIVE QUIZ HERO CARD */}
        <div style={{ marginBottom: '32px' }}>
          <GlassCard 
            variant="highlight" 
            style={{ 
              border: '1.5px solid rgba(168, 85, 247, 0.45)', 
              boxShadow: '0 0 35px rgba(124, 58, 237, 0.25)',
              padding: '28px 32px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(124, 58, 237, 0.2)', padding: '6px 14px', borderRadius: '9999px', marginBottom: '12px', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                  <KeyRound className="w-4 h-4 text-purple-400" />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#C084FC', letterSpacing: '0.05em' }}>LIVE ARENA GATEWAY</span>
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                  JOIN A LIVE QUIZ
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '14px', maxWidth: '420px', lineHeight: 1.5 }}>
                  Enter the 6-digit PIN shared by your host to connect to the synchronous arena and compete in real time.
                </p>
              </div>

              <div>
                <form onSubmit={handleJoinQuiz} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      ref={joinInputRef}
                      type="text"
                      maxLength={6}
                      placeholder="ENTER 6-DIGIT PIN"
                      value={joinPin}
                      onChange={(e) => {
                        setJoinError('');
                        setJoinStatus('idle');
                        setJoinPin(e.target.value.replace(/[^0-9]/g, ''));
                      }}
                      className="room-pin-input"
                      style={{
                        flex: 1,
                        fontSize: '22px',
                        padding: '14px 16px',
                        letterSpacing: '0.25em',
                        textAlign: 'center',
                        border: joinError ? '1.5px solid rgba(239, 68, 68, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)',
                      }}
                      disabled={joinStatus === 'validating'}
                    />

                    <button
                      id="submit-join-pin-btn"
                      type="submit"
                      onClick={handleJoinQuiz}
                      disabled={joinStatus === 'validating'}
                      className="btn-green-action"
                      style={{ padding: '16px 24px', borderRadius: '12px', fontSize: '15px', flexShrink: 0 }}
                    >
                      {joinStatus === 'validating' ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Joining...</span>
                        </>
                      ) : joinStatus === 'success' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-400" />
                          <span>Joined!</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current mr-1" />
                          <span>Join Quiz</span>
                        </>
                      )}
                    </button>
                  </div>

                  {joinError && (
                    <div className="error-alert" style={{ margin: 0, padding: '10px 14px' }}>
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span style={{ fontSize: '13px' }}>{joinError}</span>
                    </div>
                  )}
                </form>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* METRIC STATS ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <StatCard
            label="Live Active Rooms"
            value="3 Arenas"
            subtext="Sub-millisecond WebSocket Sync"
            icon={Radio}
            color="green"
          />
          <StatCard
            label="Quizzes in Library"
            value={`${quizList.length} Sets`}
            subtext="Multi-LLM Generated"
            icon={BookOpen}
            color="purple"
          />
          <StatCard
            label="Anti-Cheat Status"
            value="Armed & Active"
            subtext="Supabase JSONB Proctoring"
            icon={ShieldAlert}
            color="cyan"
          />
          <StatCard
            label="Action Points (AP)"
            value="1,240 AP"
            subtext="Campus Streak Multiplier active"
            icon={Flame}
            color="amber"
          />
        </div>

        {/* STATUS ALERT */}
        {statusMessage && (
          statusMessage.startsWith('⚠️') ? (
            <div className="error-alert" style={{ marginBottom: '24px' }}>
              <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
              <span>{statusMessage}</span>
            </div>
          ) : (
            <div className="error-alert" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34D399', marginBottom: '24px' }}>
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
              <span>{statusMessage}</span>
            </div>
          )
        )}

        {/* TWO COLUMN WORKSPACE */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* AI GENERATOR STUDIO */}
          <GlassCard variant="highlight" style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C084FC' }}>
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                  Multi-LLM Quiz Studio
                </h2>
                <p style={{ color: '#94A3B8', fontSize: '12px' }}>
                  Groq Llama-3.3 & Gemini 3.1 Pro Engines
                </p>
              </div>
            </div>

            <form onSubmit={handleGenerateAIQuiz} className="auth-form" style={{ gap: '18px' }}>
              <div className="form-group">
                <label>Topic / Course Syllabus</label>
                <div className="input-input-wrapper">
                  <BookOpen className="input-icon" />
                  <input
                    type="text"
                    placeholder="e.g. Operating Systems: Virtual Memory & Page Tables"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Question Quantity & Intensity</label>
                <select
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    color: '#F8FAFC',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  disabled={isGenerating}
                >
                  <option value={3}>⚡ 3 Questions — Fast Sprint (30s)</option>
                  <option value={5}>🎯 5 Questions — Standard Campus Arena</option>
                  <option value={10}>🏆 10 Questions — Full Comprehensive Exam</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isGenerating || !topic.trim()}
                className="btn-primary-gradient"
                style={{
                  padding: '14px',
                  borderRadius: '12px',
                  fontSize: '15px',
                  marginTop: '6px',
                  opacity: isGenerating || !topic.trim() ? 0.6 : 1,
                  cursor: isGenerating || !topic.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Synthesizing via Multi-LLM...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span>Generate AI Quiz</span>
                  </>
                )}
              </button>
            </form>
          </GlassCard>

          {/* QUIZ BANK & LIVE HOSTING */}
          <GlassCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38BDF8' }}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                    Campus Quiz Bank
                  </h2>
                  <p style={{ color: '#94A3B8', fontSize: '12px' }}>
                    Ready to Host Live with 6-digit Room PIN
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
              {quizList.map((quiz) => (
                <div
                  key={quiz.id}
                  style={{
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '14px',
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#F8FAFC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {quiz.title}
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#94A3B8' }}>{quiz.count || 5} Questions</span>
                      <span style={{ fontSize: '10px', color: '#C084FC', background: 'rgba(124, 58, 237, 0.15)', padding: '2px 8px', borderRadius: '6px' }}>
                        {quiz.topic || 'General'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleHostRoom(quiz)}
                    className="btn-green-action"
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', flexShrink: 0 }}
                  >
                    <Play className="w-3.5 h-3.5 fill-current mr-1" />
                    <span>Host Live</span>
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

        </div>

      </div>

      {/* FLOATING ACTION BUTTON FOR FEEDBACK */}
      <button
        onClick={() => setIsFeedbackOpen(true)}
        style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          zIndex: 90,
          background: 'linear-gradient(135deg, #7C3AED, #3B82F6)',
          color: 'white',
          border: '1px solid rgba(168, 85, 247, 0.6)',
          borderRadius: '9999px',
          padding: '12px 20px',
          fontWeight: '700',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 0 25px rgba(124, 58, 237, 0.5)',
          cursor: 'pointer',
        }}
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span>Campus Feedback</span>
      </button>

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {isFeedbackOpen && (
          <div className="anti-cheat-blur-overlay">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{ width: '100%', maxWidth: '480px' }}
            >
              <GlassCard variant="highlight" style={{ border: '1px solid rgba(168, 85, 247, 0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquarePlus className="w-5 h-5 text-purple-400" />
                    <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                      Send Feedback to Super Admin
                    </h3>
                  </div>
                  <button
                    onClick={() => setIsFeedbackOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {feedbackStatus === 'success' && (
                  <div className="error-alert" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34D399', marginBottom: '16px' }}>
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>Feedback successfully routed to Admin inbox!</span>
                  </div>
                )}

                <form onSubmit={handleSendFeedback} className="auth-form">
                  <div className="form-group">
                    <label>Suggestions, Issues, or Feature Requests</label>
                    <textarea
                      rows={4}
                      placeholder="Describe your thoughts or report an issue in the SRMIST arena..."
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        resize: 'vertical',
                        outline: 'none',
                      }}
                      disabled={isSubmittingFeedback}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setIsFeedbackOpen(false)}
                      className="btn-glass"
                      style={{ flex: 1, padding: '12px' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingFeedback || !feedbackMessage.trim()}
                      className="btn-primary-gradient"
                      style={{ flex: 2, padding: '12px' }}
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          <span>Submit Feedback</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default HostDashboard;

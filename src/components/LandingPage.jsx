import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sparkles, ShieldCheck, ArrowRight, Play, Trophy, Users, Zap, 
  BookOpen, Award, CheckCircle2, Lock, Flame, Cpu, Globe, Loader2 
} from 'lucide-react';
import AuthDrawer from './AuthDrawer.jsx';
import AppShell from './common/AppShell.jsx';
import { GlassCard, Badge } from './common/UIComponents.jsx';
import authService from '../services/authService.js';
import '../styles/globals.css';

/**
 * LandingPage Component - LevelNLearn (SRMIST Campus Edition)
 * Visual masterpiece featuring dark midnight navy aesthetics, electric purple lighting,
 * 6-digit Room PIN Quick Join bar, AI quiz engine showcase, and seamless AuthDrawer integration.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState('signin'); // 'signin' | 'register'
  const [roomPin, setRoomPin] = useState('');
  const [roomPinError, setRoomPinError] = useState('');
  const [isValidatingPin, setIsValidatingPin] = useState(false);

  const openAuth = (tab = 'signin', pendingPin = '') => {
    if (currentUser) {
      if (pendingPin) {
        navigate(`/arena/${pendingPin}`);
      } else {
        navigate('/dashboard');
      }
    } else {
      setDrawerTab(tab);
      setIsDrawerOpen(true);
    }
  };

  const pinInputRef = useRef(null);

  const handleQuickJoinPin = async (e) => {
    e.preventDefault();
    setRoomPinError('');
    const rawPin = pinInputRef.current?.value || roomPin || '';
    const cleanPin = rawPin.replace(/[^0-9]/g, '');

    if (!cleanPin) {
      setRoomPinError('Enter your quiz PIN.');
      return;
    }

    if (cleanPin.length !== 6) {
      setRoomPinError('Please enter a valid 6-digit quiz PIN.');
      return;
    }

    setIsValidatingPin(true);
    try {
      const res = await authService.validateRoomPin(cleanPin);
      if (!res.success) {
        setRoomPinError(res.error || 'No active quiz was found for this PIN.');
        setIsValidatingPin(false);
        return;
      }

      if (!currentUser) {
        openAuth('signin', cleanPin);
      } else {
        navigate(`/arena/${cleanPin}`);
      }
    } catch (err) {
      setRoomPinError('Unable to connect to the quiz. Please try again.');
    } finally {
      setIsValidatingPin(false);
    }
  };

  return (
    <>
      <AppShell onOpenAuth={openAuth}>
      <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '60px 24px 80px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        {/* HERO PILL BADGE */}
        <div style={{ marginBottom: '24px' }}>
          <Badge variant="purple" icon={Sparkles} style={{ padding: '8px 18px', fontSize: '13px', boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)' }}>
            PLAY &bull; LEARN &bull; GROW &bull; SRMIST CAMPUS ARENA
          </Badge>
        </div>

        {/* PRIMARY HEADLINE */}
        <h1
          style={{
            fontSize: 'clamp(42px, 7vw, 76px)',
            fontWeight: '800',
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
            textAlign: 'center',
            maxWidth: '920px',
            marginBottom: '20px',
          }}
        >
          Learn. Quiz. <span className="gradient-text-purple-orange">Level Up.</span>
        </h1>

        {/* SUBTITLE */}
        <p
          style={{
            fontSize: 'clamp(16px, 2vw, 19px)',
            color: '#94A3B8',
            maxWidth: '700px',
            textAlign: 'center',
            lineHeight: 1.6,
            marginBottom: '40px',
          }}
        >
          The next-generation interactive learning platform built exclusively for SRMIST. 
          Generate AI-powered quizzes, challenge peers in live arenas, and climb the campus leaderboard.
        </p>

        {/* 6-DIGIT ROOM PIN QUICK JOIN BAR */}
        <div style={{ width: '100%', maxWidth: '460px', marginBottom: '36px' }}>
          <GlassCard
            variant="highlight"
            style={{
              padding: '16px 20px',
              border: '1.5px solid rgba(168, 85, 247, 0.4)',
              boxShadow: '0 0 35px rgba(124, 58, 237, 0.35)',
            }}
          >
            <form onSubmit={handleQuickJoinPin} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                ref={pinInputRef}
                type="text"
                maxLength={6}
                placeholder="ENTER 6-DIGIT PIN"
                value={roomPin}
                onChange={(e) => {
                  setRoomPinError('');
                  setRoomPin(e.target.value.replace(/[^0-9]/g, ''));
                }}
                className="room-pin-input"
                style={{
                  flex: 1,
                  fontSize: '20px',
                  padding: '12px 14px',
                  letterSpacing: '0.25em',
                }}
              />
              <button
                type="submit"
                disabled={isValidatingPin}
                className="btn-green-action"
                style={{
                  padding: '13px 22px',
                  borderRadius: '12px',
                  fontWeight: '800',
                  fontSize: '15px',
                  cursor: isValidatingPin ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              >
                {isValidatingPin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current mr-1" />
                    <span>Join</span>
                  </>
                )}
              </button>
            </form>
            {roomPinError && (
              <div style={{ color: '#F87171', fontSize: '13px', marginTop: '10px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck className="w-4 h-4" /> {roomPinError}
              </div>
            )}
          </GlassCard>
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '48px' }}>
          {currentUser ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary-gradient"
              style={{ padding: '16px 36px', borderRadius: '14px', fontSize: '16px' }}
            >
              <span>Launch Campus Dashboard</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button
                onClick={() => openAuth('register')}
                className="btn-primary-gradient"
                style={{ padding: '16px 36px', borderRadius: '14px', fontSize: '16px', cursor: 'pointer' }}
              >
                <span>Create Student / Host Account</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => openAuth('signin')}
                className="btn-glass"
                style={{ padding: '16px 32px', borderRadius: '14px', fontSize: '16px', cursor: 'pointer' }}
              >
                <span>Campus Sign In</span>
              </button>
            </>
          )}
        </div>

        {/* LIVE SOCIAL PROOF CLUSTER */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '14px',
            background: 'rgba(15, 23, 42, 0.7)',
            padding: '10px 22px',
            borderRadius: '9999px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '72px',
          }}
        >
          <div style={{ display: 'flex' }}>
            {['#7C3AED', '#38BDF8', '#10B981', '#F59E0B'].map((bg, idx) => (
              <div
                key={idx}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: bg,
                  border: '2px solid #080D1A',
                  marginLeft: idx > 0 ? '-8px' : '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: '800',
                  color: 'white',
                }}
              >
                {String.fromCharCode(65 + idx)}
              </div>
            ))}
          </div>
          <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>
            <strong style={{ color: '#F8FAFC' }}>5,200+ SRMIST students</strong> competing this semester
          </span>
        </div>

        {/* CORE PLATFORM FEATURES GRID */}
        <div style={{ width: '100%', marginBottom: '60px' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <Badge variant="cyan" style={{ marginBottom: '12px' }}>ENGINE ARCHITECTURE</Badge>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 36px)', fontWeight: '800', color: '#F8FAFC' }}>
              Engineered for <span className="gradient-text-purple-cyan">High-Stakes Campus Competitions</span>
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            <GlassCard variant="interactive">
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid #7C3AED',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#C084FC',
                  marginBottom: '18px',
                }}
              >
                <Cpu className="w-6 h-6" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#F8FAFC' }}>
                Multi-LLM AI Generation
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>
                Transform class notes, PDFs, and syllabus topics into multi-tier multiple-choice exams in seconds using Groq Llama-3.3 and Gemini 3.1 Pro engines.
              </p>
            </GlassCard>

            <GlassCard variant="interactive">
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid #38BDF8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38BDF8',
                  marginBottom: '18px',
                }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#F8FAFC' }}>
                Sub-Millisecond Live Arenas
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>
                Fastify WebSockets and Redis Pub/Sub power ultra-fast score updates, dynamic answer streaks, and instant campus-wide leaderboards.
              </p>
            </GlassCard>

            <GlassCard variant="interactive">
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10B981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34D399',
                  marginBottom: '18px',
                }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px', color: '#F8FAFC' }}>
                Anti-Cheat Engine V2
              </h3>
              <p style={{ color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>
                Advanced tab-switch tracking, window blur detection, clipboard lockouts, and hotkey proctoring logged securely into Supabase JSONB.
              </p>
            </GlassCard>

          </div>
        </div>

      </div>
    </AppShell>

    {/* SLIDE-OUT AUTHENTICATION DRAWER */}
    <AuthDrawer
      isOpen={isDrawerOpen}
      onClose={() => setIsDrawerOpen(false)}
      initialTab={drawerTab}
      pendingRoomPin={roomPin}
    />
  </>
);
}

export default LandingPage;

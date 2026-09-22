import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, Users, Trophy, Clock, CheckCircle2, XCircle, 
  ArrowRight, Activity, Zap, Flame, Crown, AlertTriangle, Play 
} from 'lucide-react';
import authService from '../services/authService.js';
import { useAntiCheat } from '../hooks/useAntiCheat.js';
import { GlassCard, Badge } from './common/UIComponents.jsx';
import { createClient } from '@supabase/supabase-js';
import '../styles/globals.css';

// Frontend-safe Supabase client using Vite env variables
const supabaseFrontend = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://pyevwribnexxousrdqri.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5ZXZ3cmlibmV4eG91c3JkcXJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNDA4NjQsImV4cCI6MjEwMTgxNjg2NH0.ywSqQ9xyQ9vgLSxBTUnUdddOC7gb7UXFS9kCjKm8SI4'
);

/**
 * Arena Component - LevelNLearn (SRMIST Campus Edition)
 * Real-time WebSocket game arena connecting players and hosts to live questions,
 * timers, anti-cheat proctoring, and instant server-authoritative scoring.
 */
export function Arena({ roomPin }) {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const username = currentUser?.email || 'netid@srmist.edu.in';

  // Supabase Channel Reference
  const channelRef = useRef(null);

  // Connection State
  const [connectionState, setConnectionState] = useState('CONNECTING'); // CONNECTING, CONNECTED, DISCONNECTED, ERROR
  const [errorMsg, setErrorMsg] = useState('');

  // Game State (Synced directly from Server)
  const [gameState, setGameState] = useState({
    status: 'connecting', // lobby, active, completed
    currentQuestionIndex: 0,
    questions: [],
    hostId: null,
  });
  
  const [players, setPlayers] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  
  // Local Player State
  const [playerId, setPlayerId] = useState(null);
  const playerTokenRef = useRef(null); // secret join token, never rendered/broadcast

  // Persist {playerId, playerToken} per-room so a refresh resumes the SAME
  // player identity/score instead of minting a brand-new (0-score) player.
  const sessionStorageKey = `arena_player_${roomPin}`;
  const loadStoredPlayerSession = () => {
    try {
      const raw = sessionStorage.getItem(sessionStorageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };
  const storePlayerSession = (pId, pToken) => {
    try {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify({ playerId: pId, playerToken: pToken }));
    } catch (e) {}
  };
  const [hasAnswered, setHasAnswered] = useState(false);
  const [selectedOption, setSelectedOption] = useState(null);
  const [answerFeedback, setAnswerFeedback] = useState(null); // { isCorrect, pointsAwarded }
  
  // Scoring (Authoritative Server Synced)
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [ap, setAp] = useState(0);
  const [streakMessage, setStreakMessage] = useState('');

  // Local Timer Visualization
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef(null);

  // Host Privilege Check
  const [isHost, setIsHost] = useState(false);

  // Connect to Supabase Realtime
  useEffect(() => {
    if (channelRef.current) return;

    const channel = supabaseFrontend.channel(`room:${roomPin}`);
    channelRef.current = channel;

    channel.on('broadcast', { event: '*' }, (payload) => {
      handleServerEvent(payload);
    });

    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        setConnectionState('CONNECTED');
        
        // Join room via HTTP. If we have a stored player session for this
        // room (refresh/reconnect), present it so the server resumes the
        // SAME playerId/score instead of minting a fresh one.
        const stored = loadStoredPlayerSession();
        try {
          const res = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomPin,
              username,
              userId: currentUser?.id,
              token: currentUser?.token,
              rejoinPlayerId: stored?.playerId,
              rejoinToken: stored?.playerToken,
            }),
          });
          const data = await res.json();
          if (data.success) {
            handleServerEvent({ event: 'room_state_sync', data: data.data });
          } else {
            setConnectionState('ERROR');
            setErrorMsg(data.error || 'Failed to join room');
          }
        } catch (error) {
          setConnectionState('ERROR');
          setErrorMsg('Failed to join room');
        }
      } else if (status === 'CLOSED') {
        setConnectionState('DISCONNECTED');
      } else if (status === 'CHANNEL_ERROR') {
        setConnectionState('ERROR');
        setErrorMsg('Supabase Channel error.');
      }
    });

    return () => {
      if (channelRef.current) {
        supabaseFrontend.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomPin, username]);

  // Anti-Cheat Engine Integration
  const { isObscured, resetObscured } = useAntiCheat({
    enabled: !isHost,
    onViolation: (breachType) => {
      if (connectionState === 'CONNECTED' && !isHost && playerTokenRef.current) {
        fetch('/api/game/violation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomPin,
            playerToken: playerTokenRef.current,
            username: username,
            breachType,
            timestamp: Date.now(),
          }),
        }).catch(err => console.error('Violation report failed', err));
      }
    },
  });

  const handleServerEvent = (payload) => {
    // Two call shapes land here: (1) real Supabase Realtime broadcasts, whose
    // actual message body is nested under `payload.payload` (per the
    // supabase-js broadcast callback contract -- NOT `payload.data`), and
    // (2) this component's own direct/synthetic dispatches (e.g. the initial
    // room_state_sync after HTTP join, or optimistic post-submit updates),
    // which already pass `{ event, data }` directly. Without this fallback,
    // every real broadcast from OTHER clients silently no-ops (`data` is
    // undefined), so nobody ever sees another player's actions in real time.
    const { event, message } = payload;
    const data = payload.data !== undefined ? payload.data : payload.payload;
    if (!data) return;

    switch (event) {
      case 'room_state_sync':
        setPlayerId(data.playerId);
        if (data.playerToken) {
          playerTokenRef.current = data.playerToken;
          storePlayerSession(data.playerId, data.playerToken);
        }
        setPlayers(data.activePlayers || {});
        setGameState(data.gameState);
        if (data.gameState?.status === 'active') {
          startTimer();
        }
        break;

      case 'player_joined':
        setPlayers(data.activePlayers || {});
        break;

      case 'game_started':
      case 'question_active':
        setGameState((prev) => ({
          ...prev,
          status: data.status,
          currentQuestionIndex: data.currentQuestionIndex,
        }));
        setHasAnswered(false);
        setSelectedOption(null);
        setAnswerFeedback(null);
        startTimer();
        break;

      case 'answer_result':
        setAnswerFeedback({
          isCorrect: data.isCorrect,
          pointsAwarded: data.pointsAwarded,
        });
        setScore(data.newTotalScore);
        setStreak(data.currentStreak);
        break;

      case 'streak_active':
        setStreakMessage(data.message);
        setTimeout(() => setStreakMessage(''), 3000);
        break;

      case 'ap_updated':
        setAp(data.newTotalAP);
        break;

      case 'leaderboard_update':
        setLeaderboard(data.leaderboard || []);
        break;
        
      case 'game_over':
        setGameState((prev) => ({ ...prev, status: 'completed' }));
        setLeaderboard(data.finalLeaderboard || []);
        if (timerRef.current) clearInterval(timerRef.current);
        break;

      case 'error':
        setErrorMsg(message);
        break;

      default:
        break;
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(15);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!hasAnswered && !isHost) {
            handleAnswerTimeout();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAnswerTimeout = () => {
    setHasAnswered(true);
    if (connectionState === 'CONNECTED') {
      fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomPin,
          playerToken: playerTokenRef.current,
          questionIndex: gameState.currentQuestionIndex,
          selectedOption: -1,
          responseTimeMs: 15000,
        }),
      }).then(res => res.json()).then(data => {
        if (data.success) {
          handleServerEvent({ event: 'answer_result', data });
          if (data.isStreakActive) {
            handleServerEvent({ event: 'streak_active', data: { message: '🔥 HOT STREAK! 1.5x multiplier applied for your next question!' } });
          }
          handleServerEvent({ event: 'ap_updated', data: { newTotalAP: data.newTotalAP } });
        }
      });
    }
  };

  const submitAnswer = (optionIndex) => {
    if (hasAnswered || timeLeft === 0 || isHost) return;
    
    setHasAnswered(true);
    setSelectedOption(optionIndex);
    
    const responseTimeMs = (15 - timeLeft) * 1000;
    
    fetch('/api/game/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomPin,
        playerToken: playerTokenRef.current,
        questionIndex: gameState.currentQuestionIndex,
        selectedOption: optionIndex,
        responseTimeMs,
      }),
    }).then(res => res.json()).then(data => {
      if (data.success) {
        handleServerEvent({ event: 'answer_result', data });
        if (data.isStreakActive) {
          handleServerEvent({ event: 'streak_active', data: { message: '🔥 HOT STREAK! 1.5x multiplier applied for your next question!' } });
        }
        handleServerEvent({ event: 'ap_updated', data: { newTotalAP: data.newTotalAP } });
      }
    });
  };

  const hostStartGame = () => {
    fetch('/api/game/host-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomPin, actionType: 'start_game', token: currentUser?.token }),
    });
  };

  const hostNextQuestion = () => {
    fetch('/api/game/host-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomPin, actionType: 'next_question', token: currentUser?.token }),
    });
  };

  const hostEndGame = () => {
    fetch('/api/game/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomPin, token: currentUser?.token }),
    });
  };
  
  // Host Check
  useEffect(() => {
    const checkIsSuperAdmin = currentUser?.email === 'quizsrm@gmail.com' || currentUser?.role === 'super_admin';
    const isRoomHost = currentUser && gameState?.hostId === currentUser.id;
    if (checkIsSuperAdmin || isRoomHost) {
      setIsHost(true);
    }
  }, [currentUser, gameState?.hostId]);

  // 1. CONNECTING STATE
  if (connectionState === 'CONNECTING') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <Activity className="w-12 h-12 text-purple-400 animate-spin" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC' }}>
          Connecting to SRMIST Live Arena...
        </h2>
        <p style={{ color: '#94A3B8', fontSize: '13px', marginTop: '6px' }}>
          Establishing encrypted WebSocket channel for PIN: {roomPin}
        </p>
      </div>
    );
  }

  // 2. ERROR OR DISCONNECTED STATE
  if (connectionState === 'ERROR' || connectionState === 'DISCONNECTED') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <XCircle className="w-16 h-16 text-red-400" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC' }}>
          Arena Connection Terminated
        </h2>
        <p style={{ color: '#94A3B8', maxWidth: '400px', margin: '8px auto 24px auto', fontSize: '14px' }}>
          {errorMsg || 'Disconnected from the real-time game server.'}
        </p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary-gradient" style={{ padding: '12px 28px', borderRadius: '12px' }}>
          Return to Dashboard
        </button>
      </div>
    );
  }

  // 3. LOBBY VIEW
  if (gameState.status === 'lobby' || gameState.status === 'connecting') {
    const playerCount = Object.keys(players).length;

    return (
      <div style={{ maxWidth: '640px', margin: '40px auto 0 auto' }}>
        <GlassCard variant="highlight" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <Badge variant="purple" icon={Activity} style={{ marginBottom: '16px' }}>
            LIVE LOBBY &bull; WAITING FOR PLAYERS
          </Badge>

          <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Waiting for Host to Launch
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '28px' }}>
            Share this 6-digit PIN with participants to join the live competition.
          </p>

          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              border: '2px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '16px',
              padding: '16px 24px',
              display: 'inline-block',
              fontSize: '32px',
              fontFamily: 'monospace',
              fontWeight: '900',
              color: '#34D399',
              letterSpacing: '0.25em',
              marginBottom: '32px',
              boxShadow: '0 0 25px rgba(56, 189, 248, 0.25)',
            }}
          >
            {roomPin}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '20px', color: '#94A3B8', fontSize: '14px', fontWeight: '700' }}>
            <Users className="w-5 h-5 text-purple-400" />
            <span>{playerCount} Verified {playerCount === 1 ? 'Player' : 'Players'} in Lobby</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '36px' }}>
            {Object.values(players).map((p, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  padding: '6px 14px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} />
                {p}
              </div>
            ))}
          </div>

          {isHost ? (
            <button
              onClick={hostStartGame}
              className="btn-primary-gradient"
              style={{ width: '100%', maxWidth: '360px', padding: '16px', borderRadius: '14px', fontSize: '16px' }}
            >
              <Zap className="w-5 h-5 mr-2" />
              <span>Start Arena Competition</span>
            </button>
          ) : (
            <p style={{ color: '#64748B', fontSize: '13px' }}>
              The quiz will start automatically when the host initiates.
            </p>
          )}
        </GlassCard>
      </div>
    );
  }

  // 4. GAME OVER & RESULTS VIEW
  if (gameState.status === 'completed') {
    return (
      <div style={{ maxWidth: '720px', margin: '40px auto 0 auto' }}>
        <GlassCard variant="highlight" style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid #F59E0B',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FBBF24',
              marginBottom: '16px',
            }}
          >
            <Trophy className="w-8 h-8" />
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Arena Match Finished!
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '14px', marginBottom: '32px' }}>
            Final results synchronized with campus scoreboard and Action Points vault.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '32px' }}>
            {leaderboard.map((player, idx) => (
              <div
                key={idx}
                style={{
                  background: idx === 0 ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.8))' : 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${idx === 0 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '14px',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: idx === 0 ? '#F59E0B' : idx === 1 ? '#94A3B8' : idx === 2 ? '#D97706' : '#334155',
                      color: '#0F172A',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', color: '#F8FAFC', fontSize: '15px' }}>
                      {player.username}
                    </div>
                    {player.hasViolation && (
                      <span style={{ fontSize: '11px', color: '#F87171', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <ShieldAlert className="w-3 h-3" /> Anti-Cheat Flagged
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#34D399' }}>
                    {player.score} pts
                  </div>
                  <div style={{ fontSize: '12px', color: '#C084FC', fontWeight: '700' }}>
                    +{player.actionPoints || 0} AP
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary-gradient"
            style={{ padding: '14px 32px', borderRadius: '12px', fontSize: '15px' }}
          >
            Exit Arena to Dashboard
          </button>
        </GlassCard>
      </div>
    );
  }

  // 5. ACTIVE LIVE ARENA VIEW
  const currentQuestion = gameState.questions[gameState.currentQuestionIndex];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ANTI-CHEAT BLUR PROCTORING OVERLAY */}
      <AnimatePresence>
        {isObscured && !isHost && (
          <div className="anti-cheat-blur-overlay">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{ width: '100%', maxWidth: '440px' }}
            >
              <GlassCard style={{ border: '2px solid rgba(239, 68, 68, 0.6)', textAlign: 'center', padding: '32px' }}>
                <ShieldAlert className="w-14 h-14 text-red-400" style={{ margin: '0 auto 16px auto' }} />
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                  Suspicious Activity Flagged
                </h2>
                <p style={{ color: '#FCA5A5', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
                  You switched tabs, minimized the window, or executed a restricted command. 
                  This event is being logged in the campus proctoring ledger.
                </p>
                <button
                  onClick={resetObscured}
                  className="btn-primary-gradient"
                  style={{ width: '100%', padding: '14px', borderRadius: '12px', background: '#EF4444', borderColor: '#F87171' }}
                >
                  I am back, Resume Quiz
                </button>
              </GlassCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOP LIVE HUD */}
      <GlassCard style={{ padding: '16px 24px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Score</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#34D399' }}>{score}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Streak</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#F59E0B' }}>🔥 {streak}</div>
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>AP Vault</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#C084FC' }}>⚡ {ap}</div>
          </div>
        </div>

        {/* CIRCULAR TIMER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              position: 'relative',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#0F172A',
              border: '3px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '20px', fontWeight: '900', color: timeLeft <= 5 ? '#EF4444' : '#F8FAFC' }}>
              {timeLeft}
            </span>
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }} viewBox="0 0 36 36">
              <path
                stroke={timeLeft <= 5 ? '#EF4444' : '#38BDF8'}
                strokeDasharray={`${(timeLeft / 15) * 100}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                strokeWidth="3.5"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
          </div>
        </div>
      </GlassCard>

      {/* STREAK MESSAGE TOAST */}
      {streakMessage && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #EA580C)',
            color: 'white',
            fontWeight: '800',
            padding: '10px 20px',
            borderRadius: '12px',
            textAlign: 'center',
            marginBottom: '20px',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
          }}
        >
          {streakMessage}
        </motion.div>
      )}

      {/* MAIN PLAY AREA GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* QUESTION & OPTIONS (LEFT 2 COLS) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <GlassCard variant="highlight" style={{ border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#94A3B8' }}>
                Question {gameState.currentQuestionIndex + 1} of {gameState.questions?.length || 5}
              </span>
              <Badge variant="purple">
                {currentQuestion?.difficulty_tier || 'Medium'}
              </Badge>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', lineHeight: 1.4 }}>
              {currentQuestion?.question_text || 'Synthesizing question from engine...'}
            </h2>

            {currentQuestion?.image_url && (
              <div 
                className="question-image-container"
                style={{ 
                  marginTop: '16px', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  maxHeight: '260px'
                }}
              >
                <img 
                  src={currentQuestion.image_url} 
                  alt="Question illustration" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '260px', 
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }} 
                />
              </div>
            )}
          </GlassCard>

          {/* ANSWER OPTIONS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {currentQuestion?.options?.map((option, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <button
                  key={idx}
                  data-option-index={idx}
                  className="arena-option-btn"
                  onClick={() => submitAnswer(idx)}
                  disabled={hasAnswered || isHost}
                  style={{
                    padding: '18px 20px',
                    borderRadius: '16px',
                    textAlign: 'left',
                    fontSize: '15px',
                    fontWeight: '700',
                    cursor: hasAnswered || isHost ? 'not-allowed' : 'pointer',
                    background: isSelected ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : 'rgba(15, 23, 42, 0.85)',
                    color: isSelected ? '#FFFFFF' : '#E2E8F0',
                    border: `1.5px solid ${isSelected ? '#A855F7' : 'rgba(255, 255, 255, 0.1)'}`,
                    boxShadow: isSelected ? '0 0 25px rgba(124, 58, 237, 0.5)' : 'none',
                    opacity: hasAnswered && !isSelected ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div
                    style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.25)' : '#1E293B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {['A', 'B', 'C', 'D'][idx]}
                  </div>
                  <span>{option}</span>
                </button>
              );
            })}
          </div>

          {/* ANSWER FEEDBACK OVERLAY */}
          <AnimatePresence>
            {hasAnswered && answerFeedback && !isHost && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  padding: '16px 20px',
                  borderRadius: '14px',
                  border: `1.5px solid ${answerFeedback.isCorrect ? '#10B981' : '#EF4444'}`,
                  background: answerFeedback.isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: answerFeedback.isCorrect ? '#34D399' : '#F87171',
                }}
              >
                {answerFeedback.isCorrect ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800' }}>
                    {answerFeedback.isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                  </h3>
                  {answerFeedback.pointsAwarded > 0 && (
                    <p style={{ fontSize: '13px', fontWeight: '700' }}>+{answerFeedback.pointsAwarded} points awarded</p>
                  )}
                </div>
              </motion.div>
            )}

            {hasAnswered && !answerFeedback && !isHost && (
              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.6)', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: '700' }}>
                Answer submitted. Syncing with campus arena ledger...
              </div>
            )}
          </AnimatePresence>

          {/* HOST CONTROLS */}
          {isHost && (
            <GlassCard style={{ border: '1px solid rgba(245, 158, 11, 0.4)', marginTop: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#FBBF24', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert className="w-4 h-4" /> Host Control Console
              </h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={hostNextQuestion}
                  disabled={timeLeft > 0}
                  className="btn-primary-gradient"
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', opacity: timeLeft > 0 ? 0.5 : 1 }}
                >
                  <ArrowRight className="w-4 h-4" /> Next Question
                </button>
                <button
                  onClick={hostEndGame}
                  className="btn-glass"
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', color: '#F87171' }}
                >
                  End Game Early
                </button>
              </div>
              {timeLeft > 0 && (
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', textAlign: 'center' }}>
                  Wait for timer expiration before advancing question.
                </p>
              )}
            </GlassCard>
          )}

        </div>

        {/* LIVE LEADERBOARD SIDEBAR */}
        <div>
          <GlassCard style={{ maxHeight: '540px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', sticky: 0 }}>
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#F8FAFC' }}>
                Live Arena Leaderboard
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {leaderboard.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#64748B', fontSize: '13px' }}>
                  Awaiting first answer submission...
                </div>
              ) : (
                leaderboard.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          background: idx === 0 ? '#F59E0B' : '#334155',
                          color: '#0F172A',
                          fontSize: '11px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#F8FAFC' }}>{p.username}</div>
                        {p.hasViolation && (
                          <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '700' }}>Flagged</span>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#34D399' }}>{p.score}</span>
                      {p.streak >= 3 && <div style={{ fontSize: '10px', color: '#F59E0B' }}>🔥 {p.streak}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>

      </div>

    </div>
  );
}

export default Arena;

import React, { useState } from 'react';
import { CampusAuthGateway } from './CampusAuthGateway.jsx';
import { LiveQuiz } from './LiveQuiz.jsx';

export function CampusGatewayDemo() {
  const [viewState, setViewState] = useState('gateway'); // 'gateway' | 'live_game' | 'dashboard'
  const [sessionInfo, setSessionInfo] = useState(null);

  const handleJoinRoom = ({ roomPin, userProfile }) => {
    setSessionInfo({ roomPin, userProfile });
    setViewState('live_game');
  };

  const handleHostQuiz = (userProfile) => {
    setSessionInfo({ userProfile });
    setViewState('dashboard');
  };

  return (
    <div>
      {viewState === 'gateway' && (
        <CampusAuthGateway
          onJoinRoom={handleJoinRoom}
          onHostQuiz={handleHostQuiz}
        />
      )}

      {viewState === 'live_game' && (
        <div style={{ padding: '20px' }}>
          <button
            onClick={() => setViewState('gateway')}
            style={{
              background: '#334155',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '16px',
              fontWeight: '700',
            }}
          >
            ← Exit Game to Campus Gateway
          </button>
          <LiveQuiz
            sessionId={`session_${sessionInfo?.roomPin || '666888'}`}
            playerUsername={sessionInfo?.userProfile?.email || 'netid@srmist.edu.in'}
          />
        </div>
      )}

      {viewState === 'dashboard' && (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '32px', background: '#1E293B', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#60A5FA', marginBottom: '12px' }}>
            👑 SRMIST Quiz Creator Dashboard
          </h2>
          <p style={{ color: '#94A3B8', marginBottom: '24px' }}>
            Logged in as: <strong>{sessionInfo?.userProfile?.email}</strong>
          </p>

          <button
            onClick={() => setViewState('gateway')}
            style={{
              background: '#7C3AED',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '10px',
              fontWeight: '800',
              cursor: 'pointer',
            }}
          >
            Return to Room Gateway
          </button>
        </div>
      )}
    </div>
  );
}

export default CampusGatewayDemo;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Users, Radio, BookOpen, Inbox, CheckCircle2, 
  ArrowLeft, RefreshCw, Loader2, Sparkles, UserCheck, ShieldAlert 
} from 'lucide-react';
import AppShell from './common/AppShell.jsx';
import { GlassCard, StatCard, Badge } from './common/UIComponents.jsx';
import '../styles/globals.css';

/**
 * SuperAdminConsole Component - LevelNLearn (SRMIST Campus Edition)
 * Exclusive Super Admin monitoring console for system status, user permissions,
 * and campus user feedback triage.
 */
export function SuperAdminConsole() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'inbox' | 'users'

  // Data States
  const [feedbackList, setFeedbackList] = useState([]);
  const [userList, setUserList] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 2,
    activeRooms: 3,
    quizzesGenerated: 14,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState('');

  const loadFeedbackData = async () => {
    setIsLoading(true);
    // Mock feedback records
    setFeedbackList([
      { id: 'fb_101', created_at: new Date().toISOString(), user_email: 'player1@srmist.edu.in', message: 'The Anti-Cheat hotkey blocker works amazingly! Would love a dark purple question theme.', status: 'unread' },
      { id: 'fb_102', created_at: new Date(Date.now() - 3600000).toISOString(), user_email: 'scholar2@srmist.edu.in', message: 'Could we increase the sprint timer to 20 seconds for complex DSA questions?', status: 'resolved' },
    ]);
    setIsLoading(false);
  };

  const loadUserData = async () => {
    try {
      const mockUsers = [
        { id: 1, username: 'quizsrm@gmail.com', role: 'super_admin' },
        { id: 2, username: 'player1@srmist.edu.in', role: 'user' },
        { id: 3, username: 'scholar2@srmist.edu.in', role: 'user' },
      ];
      setUserList(mockUsers);
      setStats((prev) => ({ ...prev, totalUsers: mockUsers.length }));
    } catch (e) {
      console.error('Failed to fetch user list:', e.message);
    }
  };

  useEffect(() => {
    loadFeedbackData();
    loadUserData();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    setActionStatus(`Updating feedback #${id.slice(0, 6)}...`);
    setTimeout(() => {
      setFeedbackList((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
      setActionStatus('✅ Status updated successfully!');
      setTimeout(() => setActionStatus(''), 2000);
    }, 400);
  };

  return (
    <AppShell>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px 80px 24px' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-glass"
              style={{ padding: '10px 14px', borderRadius: '12px' }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant="purple" icon={ShieldAlert}>SUPER ADMIN CONSOLE</Badge>
              </div>
              <h1 style={{ fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: '800', color: '#F8FAFC', marginTop: '4px' }}>
                SRMIST Platform Governance & Monitoring
              </h1>
            </div>
          </div>

          <button
            onClick={() => { loadFeedbackData(); loadUserData(); }}
            className="btn-glass"
            style={{ padding: '10px 18px', borderRadius: '12px', fontSize: '13px' }}
          >
            <RefreshCw className="w-4 h-4 mr-1 text-purple-400" />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        {actionStatus && (
          <div className="error-alert" style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#34D399', marginBottom: '24px' }}>
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{actionStatus}</span>
          </div>
        )}

        {/* TAB SWITCHER */}
        <div className="tab-switcher" style={{ gridTemplateColumns: 'repeat(3, 1fr)', maxWidth: '560px', marginBottom: '28px' }}>
          <button
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            System Metrics
          </button>
          <button
            className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            Feedback Inbox ({feedbackList.filter((f) => f.status === 'unread').length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Campus Accounts ({userList.length})
          </button>
        </div>

        {/* TAB 1: SYSTEM OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            <StatCard
              label="Registered Campus Users"
              value={stats.totalUsers}
              subtext="Verified @srmist.edu.in Accounts"
              icon={Users}
              color="cyan"
            />
            <StatCard
              label="Active Game Rooms"
              value={stats.activeRooms}
              subtext="Connected via Fastify WebSockets"
              icon={Radio}
              color="green"
            />
            <StatCard
              label="AI Quizzes Synthesized"
              value={stats.quizzesGenerated}
              subtext="Groq Llama-3.3 + Gemini 3.1 Pro"
              icon={BookOpen}
              color="purple"
            />
          </div>
        )}

        {/* TAB 2: FEEDBACK INBOX */}
        {activeTab === 'inbox' && (
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <Inbox className="w-5 h-5 text-purple-400" />
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                Campus User Feedback & Bug Ingestion
              </h2>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span>Loading feedback stream...</span>
              </div>
            ) : feedbackList.length === 0 ? (
              <p style={{ color: '#94A3B8', textAlign: 'center', padding: '40px' }}>No feedback submissions yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94A3B8' }}>
                      <th style={{ padding: '14px 12px' }}>Timestamp</th>
                      <th style={{ padding: '14px 12px' }}>User Email</th>
                      <th style={{ padding: '14px 12px' }}>Message Details</th>
                      <th style={{ padding: '14px 12px' }}>Status</th>
                      <th style={{ padding: '14px 12px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedbackList.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '14px 12px', color: '#64748B', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '14px 12px', fontWeight: '700', color: '#60A5FA' }}>
                          {item.user_email}
                        </td>
                        <td style={{ padding: '14px 12px', color: '#F8FAFC' }}>
                          {item.message}
                        </td>
                        <td style={{ padding: '14px 12px' }}>
                          <Badge variant={item.status === 'resolved' ? 'green' : 'amber'}>
                            {item.status}
                          </Badge>
                        </td>
                        <td style={{ padding: '14px 12px' }}>
                          {item.status !== 'resolved' ? (
                            <button
                              onClick={() => handleUpdateStatus(item.id, 'resolved')}
                              className="btn-green-action"
                              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                            >
                              Resolve
                            </button>
                          ) : (
                            <span style={{ color: '#34D399', fontSize: '12px', fontWeight: '700' }}>✓ Resolved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        )}

        {/* TAB 3: USER DIRECTORY */}
        {activeTab === 'users' && (
          <GlassCard>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <UserCheck className="w-5 h-5 text-emerald-400" />
              <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#F8FAFC' }}>
                Registered SRMIST Campus Accounts
              </h2>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94A3B8' }}>
                    <th style={{ padding: '14px 12px' }}>Username / NetID</th>
                    <th style={{ padding: '14px 12px' }}>Campus Role</th>
                    <th style={{ padding: '14px 12px' }}>Security Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map((user) => (
                    <tr key={user.id || user.username} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '14px 12px', fontWeight: '700', color: '#F8FAFC' }}>
                        {user.username}
                      </td>
                      <td style={{ padding: '14px 12px' }}>
                        <Badge variant={user.role === 'super_admin' ? 'purple' : 'cyan'}>
                          {user.role || 'user'}
                        </Badge>
                      </td>
                      <td style={{ padding: '14px 12px', color: '#34D399', fontWeight: '600', fontSize: '13px' }}>
                        Active Campus Credential
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}

      </div>
    </AppShell>
  );
}

export default SuperAdminConsole;

import React from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage.jsx';
import HostDashboard from './components/HostDashboard.jsx';
import SuperAdminConsole from './components/SuperAdminConsole.jsx';
import Arena from './components/Arena.jsx';
import AppShell from './components/common/AppShell.jsx';
import authService from './services/authService.js';
import './styles/globals.css';

/**
 * RequireAuth Wrapper Component
 * Requires authenticated user, otherwise redirects to / (Landing Page with Auth Drawer).
 */
function RequireAuth({ children }) {
  const currentUser = authService.getCurrentUser();
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/**
 * RequireAdmin Wrapper Component
 * Requires super_admin role or quizsrm@gmail.com, otherwise redirects to /dashboard.
 */
function RequireAdmin({ children }) {
  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  const isSuperAdmin =
    currentUser?.email === 'quizsrm@gmail.com' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.user_metadata?.full_name === 'Naveen Manikandan';

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * ArenaWrapper Component for /arena/:roomPin
 */
function ArenaWrapper() {
  const { roomPin } = useParams();
  const navigate = useNavigate();

  return (
    <AppShell>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px 60px 20px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-glass"
            style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
          >
            ← Back to Dashboard
          </button>
          
          <div
            style={{
              color: '#34D399',
              fontWeight: '800',
              fontSize: '13px',
              background: 'rgba(16, 185, 129, 0.12)',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              letterSpacing: '0.05em',
            }}
          >
            LIVE ROOM PIN: {roomPin}
          </div>
        </div>

        <Arena roomPin={roomPin} />
      </div>
    </AppShell>
  );
}

/**
 * Main Application Router Component
 */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Unrestricted Landing Page Route with Slide-Out Auth Drawer */}
        <Route path="/" element={<LandingPage />} />

        {/* Protected Dashboard Route */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <HostDashboard />
            </RequireAuth>
          }
        />

        {/* Protected Arena Route */}
        <Route
          path="/arena/:roomPin"
          element={
            <RequireAuth>
              <ArenaWrapper />
            </RequireAuth>
          }
        />

        {/* Restricted Super Admin Console Route */}
        <Route
          path="/admin-console"
          element={
            <RequireAdmin>
              <SuperAdminConsole />
            </RequireAdmin>
          }
        />

        {/* Fallback Catch-all Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

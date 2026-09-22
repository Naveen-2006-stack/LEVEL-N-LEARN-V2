import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, LogOut, Menu, X, LayoutDashboard, Play, Sparkles } from 'lucide-react';
import authService from '../../services/authService.js';
import ConnectionIndicator from './ConnectionIndicator.jsx';
import '../../styles/globals.css';

/**
 * AppShell Component
 * Master application navigation shell for all authenticated and public views.
 */
export function AppShell({ children, connectionStatus = 'CONNECTED', onOpenAuth = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isSuperAdmin =
    currentUser?.email === 'quizsrm@gmail.com' ||
    currentUser?.role === 'super_admin' ||
    currentUser?.user_metadata?.full_name === 'Naveen Manikandan';

  const handleLogout = async () => {
    await authService.logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-retro-grid relative text-white flex flex-col">
      {/* GLOWING AMBIENT BACKGROUND ORBS */}
      <div className="orb orb-purple" />
      <div className="orb orb-cyan" />
      <div className="orb orb-green" />

      {/* TOP NAVIGATION BAR */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(8, 13, 26, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* BRAND LOGO */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => navigate(currentUser ? '/dashboard' : '/')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7C3AED, #38BDF8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 0 15px rgba(124, 58, 237, 0.5)',
              }}
            >
              ⚡
            </div>
            <div>
              <span
                style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #F8FAFC 0%, #C084FC 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                LevelNLearn
              </span>
              <span style={{ fontSize: '10px', color: '#38BDF8', fontWeight: '800', marginLeft: '4px' }}>V2</span>
            </div>
            <div className="campus-badge" style={{ marginLeft: '4px' }}>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden-mobile">SRMIST</span>
            </div>
          </div>

          {/* DESKTOP NAV LINKS */}
          <nav style={{ display: 'flex', gap: '24px', alignItems: 'center' }} className="hidden-mobile">
            {currentUser && (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: location.pathname === '/dashboard' ? '#C084FC' : '#94A3B8',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Dashboard</span>
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => navigate('/admin-console')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: location.pathname === '/admin-console' ? '#C084FC' : '#94A3B8',
                      fontWeight: '700',
                      fontSize: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <ShieldAlert className="w-4 h-4 text-purple-400" />
                    <span>Admin Console</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* RIGHT ACTION CONTROLS */}
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <ConnectionIndicator status={connectionStatus} />

            {currentUser ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(15, 23, 42, 0.6)',
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                  className="hidden-mobile"
                >
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #7C3AED, #38BDF8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '800',
                    }}
                  >
                    {currentUser.email?.charAt(0).toUpperCase() || 'S'}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#E2E8F0', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentUser.email}
                  </span>
                </div>

                <button
                  onClick={handleLogout}
                  className="btn-glass"
                  style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12px', cursor: 'pointer' }}
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden-mobile">Sign Out</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  id="nav-signin-btn"
                  onClick={() => onOpenAuth && onOpenAuth('signin')}
                  className="btn-glass"
                  style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Sign In
                </button>
                <button
                  id="nav-register-btn"
                  onClick={() => onOpenAuth && onOpenAuth('register')}
                  className="btn-primary-gradient"
                  style={{ padding: '8px 18px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
                >
                  Register
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                display: 'none',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
              }}
              className="mobile-menu-btn"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* MOBILE DRAWER */}
        {isMobileMenuOpen && (
          <div
            style={{
              padding: '16px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {currentUser ? (
              <>
                <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                  Signed in as <strong style={{ color: '#F8FAFC' }}>{currentUser.email}</strong>
                </div>
                <button
                  onClick={() => {
                    navigate('/dashboard');
                    setIsMobileMenuOpen(false);
                  }}
                  className="btn-glass"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      navigate('/admin-console');
                      setIsMobileMenuOpen(false);
                    }}
                    className="btn-glass"
                    style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
                  >
                    <ShieldAlert className="w-4 h-4 text-purple-400" /> Admin Console
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="btn-glass"
                  style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px', color: '#FCA5A5' }}
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth('signin');
                    setIsMobileMenuOpen(false);
                  }}
                  className="btn-glass"
                  style={{ width: '100%' }}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    if (onOpenAuth) onOpenAuth('register');
                    setIsMobileMenuOpen(false);
                  }}
                  className="btn-primary-gradient"
                  style={{ width: '100%' }}
                >
                  Register Account
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main style={{ flex: 1, position: 'relative', zIndex: 10 }}>{children}</main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '20px 24px',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '12px',
          position: 'relative',
          zIndex: 10,
          background: 'rgba(8, 13, 26, 0.5)',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <span>🔒 Restricted exclusively to verified SRMIST Campus Network &bull; LevelNLearn V2</span>
          <span style={{ color: '#94A3B8' }}>PLAY &bull; LEARN &bull; GROW</span>
        </div>
      </footer>
    </div>
  );
}

export default AppShell;

import React, { useState } from 'react';

export default function TopNavbar({ user, systemType, activeSectionTitle, alertCount = 0, onNavigateAlerts, onLogout }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const contextLabel = systemType === 'WAREHOUSE' ? 'Warehouse operations' : 'Pharmacy operations';
  const userInitials = (user?.name || user?.username || 'AM')
    .split(' ')
    .map(p => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="topbar-context">{contextLabel}</span>
        <span className="topbar-slash">/</span>
        <span>{activeSectionTitle}</span>
      </div>

      <div className="topbar-actions">
        <div className="global-search">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input placeholder="Search anything..." />
          <kbd>⌘ K</kbd>
        </div>

        <button className="topbar-icon" onClick={onNavigateAlerts} title="System Alerts">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {alertCount > 0 && <i></i>}
        </button>

        <div style={{ position: 'relative' }}>
          <button
            className="topbar-profile"
            onClick={() => setShowProfileMenu(prev => !prev)}
            title={`${user?.name || 'User'} (${user?.role?.role_name || user?.role || ''})`}
          >
            <span className="user-avatar">{userInitials}</span>
            <span className="chevron">⌵</span>
          </button>

          {showProfileMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                background: '#ffffff',
                border: '1px solid #e8edf2',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '8px 12px',
                minWidth: '180px',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#18212f' }}>
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>
                {user?.role?.role_name || user?.role || ''}
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid #f1f5f9', margin: '4px 0' }} />
              <button
                className="action-icon-btn danger"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={onLogout}
              >
                Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

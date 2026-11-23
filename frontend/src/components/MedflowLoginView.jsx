import React, { useState } from 'react';
import { authService } from '../services/api';

export default function MedflowLoginView({ onAuthSuccess, showToast }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUser = identifier.trim();
    if (!cleanUser || !password) {
      showToast('Please enter both your email address/username and password.', 'error');
      return;
    }

    setLoading(true);

    // Support both full email (e.g. alex.morgan@medflow.co) and username (alex.morgan)
    const usernameCandidates = [cleanUser];
    if (cleanUser.includes('@')) {
      usernameCandidates.push(cleanUser.split('@')[0]);
    }

    try {
      let result = null;
      let systemType = null;
      let pharmacyId = null;

      // 1. Attempt Central Warehouse Login first
      for (const u of usernameCandidates) {
        try {
          const res = await authService.warehouseLogin(u, password);
          if (res && res.success) {
            result = res;
            systemType = 'WAREHOUSE';
            pharmacyId = null;
            break;
          }
        } catch {
          // Continue to next check
        }
      }

      // 2. If warehouse login did not match, attempt Pharmacy Branch Login
      if (!result || !result.success) {
        for (const u of usernameCandidates) {
          try {
            const res = await authService.pharmacyLogin(u, password, 'pharmacy');
            if (res && res.success) {
              result = res;
              systemType = 'PHARMACY';
              pharmacyId = 'pharmacy';
              break;
            }
          } catch {
            // Continue
          }
        }
      }

      // 3. Handle Successful Authentication & Auto-route based on Verified User Role
      if (result && result.success) {
        const user = result.data.user;
        const roleName = user?.role?.role_name || user?.role || 'USER';
        showToast(`Welcome back, ${user?.name || user?.username || 'User'} (${roleName})!`, 'success');
        onAuthSuccess({
          user: user,
          token: result.data.token,
          systemType,
          pharmacyId: systemType === 'PHARMACY' ? (pharmacyId || 'pharmacy') : null
        });
      } else {
        throw new Error('Invalid credentials. Please verify your email/username and password.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Invalid credentials or authentication error.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="medflow-login-page">
      <div className="medflow-login-container">
        <form onSubmit={handleSubmit} className="medflow-login-form" noValidate>
          {/* Header Branding */}
          <div className="login-header-branding" style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: '#fee2e2', color: '#dc2626', marginBottom: '10px', fontSize: '24px' }}>
              💊
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>Welcome to Medflow</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Sign in with your organization credentials</p>
          </div>

          {/* Email / Username Input */}
          <div className="login-form-group">
            <label className="login-form-label" htmlFor="medflow-email">
              Email address or Username
            </label>
            <input
              id="medflow-email"
              type="text"
              className="login-form-input"
              placeholder="Enter your username or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {/* Password Input with Show/Hide toggle */}
          <div className="login-form-group">
            <div className="label-row">
              <label className="login-form-label" htmlFor="medflow-password">
                Password
              </label>
              <button
                type="button"
                className="show-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                tabIndex={0}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="medflow-password"
              type={showPassword ? 'text' : 'password'}
              className="login-form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {/* Continue to Workspace Primary Action Button */}
          <button
            type="submit"
            className="medflow-primary-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="btn-spinner" style={{ width: '18px', height: '18px', borderColor: '#ffffff', borderTopColor: 'transparent' }} />
            ) : (
              <>
                Continue to workspace <span className="btn-arrow">→</span>
              </>
            )}
          </button>

          {/* Quick 1-Click Demo Credentials Pill Bar */}
          <div className="demo-credentials-bar" style={{ marginTop: '16px', padding: '10px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ color: '#475569', fontWeight: 600, fontSize: '11px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>⚡ Quick Credentials</span>
              <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'none' }}>Click to autofill</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              <button
                type="button"
                className="demo-pill-btn"
                onClick={() => {
                  setIdentifier('admin');
                  setPassword('Password@123');
                }}
                style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', display: 'flex', flexDirection: 'column', transition: 'all 0.15s ease' }}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>🛡️ Warehouse Admin</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>admin / Password@123</span>
              </button>
              <button
                type="button"
                className="demo-pill-btn"
                onClick={() => {
                  setIdentifier('whstaff');
                  setPassword('Password@123');
                }}
                style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', display: 'flex', flexDirection: 'column', transition: 'all 0.15s ease' }}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>📦 Warehouse Staff</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>whstaff / Password@123</span>
              </button>
              <button
                type="button"
                className="demo-pill-btn"
                onClick={() => {
                  setIdentifier('pharmadmin');
                  setPassword('Password@123');
                }}
                style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', display: 'flex', flexDirection: 'column', transition: 'all 0.15s ease' }}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>🏥 Pharmacy Admin</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>pharmadmin / Password@123</span>
              </button>
              <button
                type="button"
                className="demo-pill-btn"
                onClick={() => {
                  setIdentifier('phstaff');
                  setPassword('Password@123');
                }}
                style={{ padding: '6px 8px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', textAlign: 'left', display: 'flex', flexDirection: 'column', transition: 'all 0.15s ease' }}
              >
                <span style={{ fontWeight: 600, color: '#0f172a' }}>💊 Pharmacy Staff</span>
                <span style={{ color: '#64748b', fontSize: '10px' }}>phstaff / Password@123</span>
              </button>
            </div>
          </div>

          {/* Help & Status Links */}
          <div className="login-help-row">
            <span>Need help?</span>{' '}
            <button
              type="button"
              className="help-link-btn"
              onClick={() => showToast('Help Desk: support@medflow.co | Call: 1800-MEDFLOW', 'info')}
            >
              Contact support
            </button>{' '}
            <span className="bullet-sep">·</span>{' '}
            <button
              type="button"
              className="help-link-btn"
              onClick={() => showToast('All Medflow services operational (100% SLA uptime).', 'success')}
            >
              System status
            </button>
          </div>
        </form>
      </div>

      {/* Professional Bottom System Footer */}
      <footer className="medflow-page-footer">
        <div className="footer-copyright">
          © {new Date().getFullYear()} Medflow Systems
        </div>
        <div className="footer-compliance">
          HIPAA-ready infrastructure <span className="compliance-dot">●</span>
        </div>
      </footer>
    </div>
  );
}

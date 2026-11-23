import React, { useState } from 'react';
import { authService } from '../services/api';

export default function SignInForm({ onAuthSuccess, showToast }) {
  const [portal, setPortal] = useState('warehouse'); // 'warehouse' | 'pharmacy'
  const [pharmacyId, setPharmacyId] = useState('pharmacy');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Please enter both username and password.', 'error');
      return;
    }

    setLoading(true);
    try {
      let result;
      if (portal === 'warehouse') {
        result = await authService.warehouseLogin(username.trim(), password);
      } else {
        result = await authService.pharmacyLogin(username.trim(), password, pharmacyId.trim());
      }

      if (result && result.success) {
        showToast(`Welcome back, ${result.data.user.name}!`, 'success');
        onAuthSuccess({
          user: result.data.user,
          token: result.data.token,
          systemType: portal.toUpperCase(),
          pharmacyId: portal === 'pharmacy' ? (pharmacyId.trim() || 'pharmacy') : null
        });
      } else {
        throw new Error(result?.message || 'Login failed.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Unable to connect to backend server.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container sign-in-container">
      <form onSubmit={handleSubmit} noValidate>
        <h1 className="form-title">Sign In</h1>

        {/* Portal Selector */}
        <div className="portal-selector" role="radiogroup">
          <label className={`portal-pill ${portal === 'warehouse' ? 'active' : ''}`}>
            <input
              type="radio"
              name="signInPortal"
              value="warehouse"
              checked={portal === 'warehouse'}
              onChange={() => setPortal('warehouse')}
            />
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21V3h6v18"/>
            </svg>
            <span>Central Warehouse</span>
          </label>
          <label className={`portal-pill ${portal === 'pharmacy' ? 'active' : ''}`}>
            <input
              type="radio"
              name="signInPortal"
              value="pharmacy"
              checked={portal === 'pharmacy'}
              onChange={() => setPortal('pharmacy')}
            />
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/><path d="M10 7h4M12 5v4"/>
            </svg>
            <span>Pharmacy Branch</span>
          </label>
        </div>

        {portal === 'pharmacy' && (
          <div className="input-group">
            <span className="input-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Pharmacy ID (e.g. pharmacy)"
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
            />
          </div>
        )}

        {/* Username */}
        <div className="input-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Username or User ID"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        {/* Password */}
        <div className="input-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="pwd-toggle-btn"
            onClick={() => setShowPassword(!showPassword)}
            title="Toggle visibility"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              {showPassword ? (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </>
              ) : (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </>
              )}
            </svg>
          </button>
        </div>

        <button
          type="button"
          className="forgot-link"
          onClick={() => showToast('Password recovery: Please contact your System Administrator.', 'info')}
        >
          Forgot your password?
        </button>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="btn-spinner"></span> : <span>SIGN IN</span>}
        </button>
      </form>
    </div>
  );
}

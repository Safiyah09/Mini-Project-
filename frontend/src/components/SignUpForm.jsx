import React, { useState } from 'react';
import { authService } from '../services/api';

const ROLES = {
  warehouse: [
    { value: 'WAREHOUSE_ADMIN', label: 'Warehouse Admin (Full System Administrator)' },
    { value: 'INVENTORY_MANAGER', label: 'Inventory Manager (FEFO Stock & Expiry)' },
    { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer (Supplier Purchase Orders)' },
    { value: 'DISPATCH_OPERATOR', label: 'Dispatch Operator (Pharmacy Dispatches)' }
  ],
  pharmacy: [
    { value: 'PHARMACY_ADMIN', label: 'Pharmacy Admin (Branch Dispensary Head)' },
    { value: 'PHARMACIST', label: 'Pharmacist (Verifies Stock & Dispenses)' },
    { value: 'CASHIER', label: 'Cashier (Point-of-Sale Billing & Returns)' }
  ]
};

export default function SignUpForm({ onAuthSuccess, showToast }) {
  const [portal, setPortal] = useState('warehouse'); // 'warehouse' | 'pharmacy'
  const [pharmacyId, setPharmacyId] = useState('pharmacy');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('WAREHOUSE_ADMIN');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePortalChange = (newPortal) => {
    setPortal(newPortal);
    if (newPortal === 'warehouse') {
      setRole('WAREHOUSE_ADMIN');
    } else {
      setRole('PHARMACY_ADMIN');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !password) {
      showToast('Name, username, and password are required.', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters long.', 'error');
      return;
    }

    setLoading(true);
    try {
      let result;
      const payload = {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        password,
        role_name: role
      };

      if (portal === 'warehouse') {
        result = await authService.warehouseRegister(payload);
      } else {
        result = await authService.pharmacyRegister(payload, pharmacyId.trim());
      }

      if (result && result.success) {
        showToast(`Account registered successfully for ${result.data.user.name}!`, 'success');
        onAuthSuccess({
          user: result.data.user,
          token: result.data.token,
          systemType: portal.toUpperCase(),
          pharmacyId: portal === 'pharmacy' ? (pharmacyId.trim() || 'pharmacy') : null
        });
      } else {
        throw new Error(result?.message || 'Registration failed.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Registration failed.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container sign-up-container">
      <form onSubmit={handleSubmit} noValidate>
        <h1 className="form-title">Create Account</h1>

        {/* Portal Selector */}
        <div className="portal-selector" role="radiogroup">
          <label className={`portal-pill ${portal === 'warehouse' ? 'active' : ''}`}>
            <input
              type="radio"
              name="signUpPortal"
              value="warehouse"
              checked={portal === 'warehouse'}
              onChange={() => handlePortalChange('warehouse')}
            />
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M3 7v14M21 7v14M6 11h4M6 15h4M14 11h4M14 15h4M9 21V3h6v18"/>
            </svg>
            <span>Warehouse Staff</span>
          </label>
          <label className={`portal-pill ${portal === 'pharmacy' ? 'active' : ''}`}>
            <input
              type="radio"
              name="signUpPortal"
              value="pharmacy"
              checked={portal === 'pharmacy'}
              onChange={() => handlePortalChange('pharmacy')}
            />
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/><path d="M10 7h4M12 5v4"/>
            </svg>
            <span>Pharmacy Staff</span>
          </label>
        </div>

        {/* Name Input */}
        <div className="input-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        {/* Email Input */}
        <div className="input-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </span>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        {/* Username Input */}
        <div className="input-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>
            </svg>
          </span>
          <input
            type="text"
            placeholder="Username (for login)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        {/* Role Select */}
        <div className="input-group select-group">
          <span className="input-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </span>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES[portal].map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        {/* Password Input */}
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
            autoComplete="new-password"
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

        {portal === 'pharmacy' && (
          <div className="input-group">
            <span className="input-icon">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Pharmacy Branch ID (e.g. pharmacy)"
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? <span className="btn-spinner"></span> : <span>SIGN UP</span>}
        </button>
      </form>
    </div>
  );
}

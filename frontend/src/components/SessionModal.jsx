import React, { useState } from 'react';

export default function SessionModal({ session, onClose, onLogout }) {
  const [copied, setCopied] = useState(false);

  if (!session) return null;

  const { user, token, systemType, pharmacyId } = session;
  const roleName = user.role?.role_name || user.role || 'USER';

  const handleCopy = () => {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-icon-wrapper success">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <div>
            <h2>Authentication Successful!</h2>
            <p className="modal-sub">Session Token Generated Successfully</p>
          </div>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="user-summary-card">
            <div className="user-avatar">
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h3>{user.name}</h3>
              <span className="user-badge">{roleName}</span>
              <span className="system-badge">{systemType} SYSTEM</span>
            </div>
          </div>

          <div className="meta-grid">
            <div className="meta-item">
              <span className="meta-label">Username:</span>
              <span className="meta-value">{user.username}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">User ID:</span>
              <span className="meta-value">{user.user_id || user.id || '--'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Email:</span>
              <span className="meta-value">{user.email || 'None'}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Tenancy Context:</span>
              <span className="meta-value">
                {systemType === 'PHARMACY' ? (pharmacyId || 'pharmacy') : 'Central Warehouse (Master)'}
              </span>
            </div>
          </div>

          <div className="jwt-preview-block">
            <div className="jwt-header">
              <span>Authorization Bearer Token (JWT):</span>
              <button className="copy-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <code>{token}</code>
          </div>

          <div className="system-capabilities">
            <h4>Authorized System Operations:</h4>
            <ul>
              {systemType === 'WAREHOUSE' ? (
                <>
                  <li>FEFO medicine batch allocation &amp; expiration monitoring</li>
                  <li>Central warehouse stock management &amp; adjustments</li>
                  <li>Pharmacy supply request fulfillment &amp; stock dispatches</li>
                  <li>Supplier purchase orders &amp; goods receipts</li>
                </>
              ) : (
                <>
                  <li>Pharmacy branch stock tracking &amp; inventory counts</li>
                  <li>Point-of-sale customer billing &amp; medicine sales</li>
                  <li>Near-expiry alerts &amp; real-time availability checks</li>
                  <li>Supply requests to central warehouse &amp; stock receipts</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onLogout}>Log Out</button>
          <button className="btn btn-primary" onClick={onClose}>Continue Session</button>
        </div>
      </div>
    </div>
  );
}

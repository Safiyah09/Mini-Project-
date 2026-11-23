import React from 'react';

export default function Header() {
  return (
    <header className="system-header">
      <div className="system-meta">
        <div className="header-logo">
          <svg className="med-cross-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M2 12h20"/>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" strokeDasharray="3 3"/>
          </svg>
          <span>PharmaSync<strong>Core</strong></span>
        </div>
        <div className="problem-statement-badge">
          <span className="badge-dot"></span> Central Warehouse &bull; Multi-Pharmacy Network
        </div>
      </div>
    </header>
  );
}

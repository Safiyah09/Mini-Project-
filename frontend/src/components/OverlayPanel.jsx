import React from 'react';

export default function OverlayPanel({ isRightPanelActive, onToggleSignIn, onToggleSignUp }) {
  return (
    <div className="overlay-container">
      <div className="overlay">
        
        {/* Left Overlay: Matches the teal side of the reference image */}
        <div className="overlay-panel overlay-left">
          <div className="overlay-brand">
            <div className="brand-symbol">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="4"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <span className="brand-name">Diprella <span>Pharma</span></span>
          </div>

          {/* Watermark Diamond Shapes */}
          <div className="geo-shape diamond-1" aria-hidden="true"></div>
          <div className="geo-shape diamond-2" aria-hidden="true"></div>
          <div className="geo-shape diamond-3" aria-hidden="true"></div>
          <div className="geo-shape circle-accent" aria-hidden="true"></div>

          <div className="overlay-content">
            <h1 className="overlay-heading">Welcome Back!</h1>
            <p className="overlay-desc">
              To keep connected with us please login with your personal info
            </p>
            <button className="btn btn-ghost" onClick={onToggleSignIn}>
              SIGN IN
            </button>

            <div className="system-caption">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <span>Stock &bull; Sales &bull; FEFO Expiry &bull; Availability</span>
            </div>
          </div>
        </div>

        {/* Right Overlay: Shown when on Sign In view */}
        <div className="overlay-panel overlay-right">
          <div className="overlay-brand">
            <div className="brand-symbol">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="4"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
            </div>
            <span className="brand-name">Diprella <span>Pharma</span></span>
          </div>

          <div className="geo-shape diamond-1" aria-hidden="true"></div>
          <div className="geo-shape diamond-2" aria-hidden="true"></div>
          <div className="geo-shape diamond-3" aria-hidden="true"></div>
          <div className="geo-shape circle-accent" aria-hidden="true"></div>

          <div className="overlay-content">
            <h1 className="overlay-heading">Hello, Colleague!</h1>
            <p className="overlay-desc">
              Authorized staff portal for Central Warehouse and connected Pharmacy branches.
            </p>
            <button className="btn btn-ghost" onClick={onToggleSignUp}>
              SIGN UP
            </button>

            <div className="system-caption">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>Enterprise Security &bull; Real-time Verification</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

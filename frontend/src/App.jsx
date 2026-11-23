import React, { useState, useEffect, useCallback } from 'react';
import MedflowLoginView from './components/MedflowLoginView';
import Toast from './components/Toast';
import DashboardContainer from './components/dashboard/DashboardContainer';
import ErrorBoundary from './components/ErrorBoundary';
import './dashboard.css';
import './App.css';

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [session, setSession] = useState(null);

  // Load existing session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pharma_auth_session');
      if (stored) {
        setSession(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleAuthSuccess = (sessionData) => {
    setSession(sessionData);
    localStorage.setItem('pharma_auth_session', JSON.stringify(sessionData));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('pharma_auth_session');
    showToast('You have been logged out successfully.', 'info');
  };

  // If user is authenticated, route immediately to their role-specific dashboard!
  if (session && session.user) {
    return (
      <ErrorBoundary onReset={handleLogout}>
        <DashboardContainer
          session={session}
          onLogout={handleLogout}
          showToast={showToast}
        />
        <Toast toasts={toasts} />
      </ErrorBoundary>
    );
  }

  // Render Medflow Modern Authentication Page Matching Reference Image 100%
  return (
    <ErrorBoundary>
      <MedflowLoginView
        onAuthSuccess={handleAuthSuccess}
        showToast={showToast}
      />
      <Toast toasts={toasts} />
    </ErrorBoundary>
  );
}

import React from 'react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmType = 'primary', loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ width: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-bar">
          <h3>{title}</h3>
          <button className="modal-close-cross" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-form-body">
          <p style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <div className="modal-action-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`btn ${confirmType === 'danger' ? 'action-icon-btn danger' : 'btn-primary'}`}
            style={{ padding: '8px 20px', borderRadius: '8px' }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <span className="btn-spinner"></span> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function Modal({ isOpen, onClose, title, children, maxWidth = '600px' }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ width: maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-bar">
          <h3>{title}</h3>
          <button className="modal-close-cross" onClick={onClose} title="Close">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

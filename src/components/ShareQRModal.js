"use client";

import QRCode from "react-qr-code";

export default function ShareQRModal({ isOpen, onClose, url, title }) {
  if (!isOpen || !url) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📱 Scan to Join</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="qr-modal-body">
          {title && <p className="qr-modal-session-title">{title}</p>}
          <div className="qr-code-wrapper">
            <QRCode
              value={url}
              size={220}
              bgColor="transparent"
              fgColor="currentColor"
              level="M"
            />
          </div>
          <p className="qr-modal-url">{url}</p>
        </div>
      </div>
    </div>
  );
}

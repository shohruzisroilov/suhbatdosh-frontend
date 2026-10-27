import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from './Modal';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { MicOff, Settings, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import { selectionHaptic, tapHaptic, notifyHaptic } from '../utils/haptics';

export default function MicPermissionModal() {
  const { micErrorModal, setMicErrorModal } = useAppStore();
  const t = useT();
  const [isRetrying, setIsRetrying] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  if (!micErrorModal || !micErrorModal.isOpen) return null;

  const handleClose = () => {
    tapHaptic('light');
    setMicErrorModal(null);
  };

  const handleTryAgain = async () => {
    selectionHaptic();
    setIsRetrying(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Unsupported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      notifyHaptic('success');
      setPermissionGranted(true);
      setTimeout(() => {
        setMicErrorModal(null);
        setPermissionGranted(false);
        setIsRetrying(false);
      }, 800);
    } catch (err) {
      notifyHaptic('error');
      setIsRetrying(false);
    }
  };

  const modalContent = (
    <Modal
      isOpen
      onClose={handleClose}
      backdropClassName="mic-modal-overlay"
      className="mic-modal-card"
      labelledBy="mic-modal-title"
    >
        {/* Close Icon Button */}
        <button
          type="button"
          className="mic-modal-close-btn"
          onClick={handleClose}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Animated Badge Icon */}
        <div className="mic-modal-badge-wrapper">
          <div className={`mic-modal-badge ${permissionGranted ? 'mic-modal-badge--success' : 'mic-modal-badge--error'}`}>
            {permissionGranted ? (
              <CheckCircle2 size={36} />
            ) : (
              <MicOff size={34} />
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mic-modal-title" id="mic-modal-title">
          {permissionGranted ? t('mic.grantedTitle') : t('mic.modalTitle')}
        </h3>

        {/* Description */}
        <p className="mic-modal-desc">
          {permissionGranted
            ? t('mic.grantedDesc')
            : micErrorModal.errorMsg || t('mic.modalDesc')}
        </p>

        {/* Instructions Steps Card */}
        {!permissionGranted && (
          <div className="mic-modal-steps-card">
            <div className="mic-modal-steps-header">
              <Settings size={15} />
              <span>{t('mic.instructionsTitle')}</span>
            </div>
            <div className="mic-modal-step-item">
              <span className="mic-modal-step-num">1</span>
              <span className="mic-modal-step-text">{t('mic.step1')}</span>
            </div>
            <div className="mic-modal-step-item">
              <span className="mic-modal-step-num">2</span>
              <span className="mic-modal-step-text">{t('mic.step2')}</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="mic-modal-actions">
          {!permissionGranted && (
            <button
              type="button"
              className="mic-modal-btn mic-modal-btn--primary"
              onClick={handleTryAgain}
              disabled={isRetrying}
            >
              <RefreshCw
                size={18}
                className={isRetrying ? 'spin-anim' : ''}
              />
              <span>{isRetrying ? t('mic.checking') : t('mic.tryAgain')}</span>
            </button>
          )}

          <button
            type="button"
            className="mic-modal-btn mic-modal-btn--secondary"
            onClick={handleClose}
          >
            {t('mic.close')}
          </button>
        </div>

      <style>{`
        .mic-modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(5, 8, 15, 0.78);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          animation: micFadeIn 0.22s ease-out;
        }

        @keyframes micFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .mic-modal-card {
          width: 100%;
          max-width: 380px;
          background: linear-gradient(150deg, #182232 0%, #0f1622 100%);
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(239, 68, 68, 0.12);
          padding: 26px 22px;
          color: #ffffff;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          animation: micPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes micPopUp {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .mic-modal-close-btn {
          position: absolute;
          top: 18px; right: 18px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 50%;
          width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .mic-modal-close-btn:active {
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .mic-modal-badge-wrapper {
          margin-top: 4px;
          margin-bottom: 18px;
          display: flex; align-items: center; justify-content: center;
        }

        .mic-modal-badge {
          width: 76px; height: 76px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .mic-modal-badge--error {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(220, 38, 38, 0.45));
          border: 1.5px solid rgba(239, 68, 68, 0.4);
          color: #f87171;
          box-shadow: 0 0 30px rgba(239, 68, 68, 0.35);
          animation: micPulseRed 2s ease-in-out infinite;
        }
        .mic-modal-badge--success {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.22), rgba(16, 185, 129, 0.45));
          border: 1.5px solid rgba(34, 197, 94, 0.4);
          color: #4ade80;
          box-shadow: 0 0 30px rgba(34, 197, 94, 0.35);
        }

        @keyframes micPulseRed {
          0%, 100% { box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); }
          50% { box-shadow: 0 0 35px rgba(239, 68, 68, 0.55); }
        }

        .mic-modal-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: -0.3px;
          color: #ffffff;
        }

        .mic-modal-desc {
          font-size: 13.5px;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 20px;
          padding: 0 4px;
        }

        .mic-modal-steps-card {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 14px 16px;
          margin-bottom: 22px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mic-modal-steps-header {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--primary);
          margin-bottom: 2px;
        }

        .mic-modal-step-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          line-height: 1.45;
        }

        .mic-modal-step-num {
          width: 20px; height: 20px;
          border-radius: 50%;
          background: var(--primary-subtle);
          border: 1px solid rgba(0, 168, 255, 0.3);
          color: var(--primary);
          font-size: 11px;
          font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .mic-modal-step-text {
          flex: 1;
        }

        .mic-modal-actions {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .mic-modal-btn {
          width: 100%;
          padding: 13px 20px;
          border-radius: var(--radius-md, 14px);
          font-size: 14.5px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: transform 0.15s ease, opacity 0.15s ease, background 0.15s ease;
        }
        .mic-modal-btn:active {
          transform: scale(0.975);
        }

        .mic-modal-btn--primary {
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: var(--grad-primary);
          color: var(--primary-contrast, #ffffff);
          box-shadow: var(--primary-shadow);
        }
        .mic-modal-btn--primary:disabled {
          opacity: 0.75;
          cursor: not-allowed;
        }

        .mic-modal-btn--secondary {
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.75);
        }
        .mic-modal-btn--secondary:hover {
          background: rgba(255, 255, 255, 0.09);
        }

        .spin-anim {
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      
        /* Telegram light mode support */
        .light .mic-modal-overlay { background: rgba(15, 23, 42, 0.45); }
        .light .mic-modal-card {
          background: var(--bg-secondary);
          border-color: var(--border);
          color: var(--text-primary);
          box-shadow: var(--shadow-md);
        }
        .light .mic-modal-title { color: var(--text-primary); }
        .light .mic-modal-desc { color: var(--text-secondary); }
        .light .mic-modal-close-btn {
          background: var(--surface-2);
          border-color: var(--border);
          color: var(--text-secondary);
        }
        .light .mic-modal-close-btn:active {
          background: var(--surface-3);
          color: var(--text-primary);
        }
        .light .mic-modal-steps-card {
          background: var(--surface-2);
          border-color: var(--border);
        }
        .light .mic-modal-step-item { color: var(--text-primary); }
        .light .mic-modal-steps-header,
        .light .mic-modal-step-num { color: var(--primary); }
        .light .mic-modal-btn--primary { border-color: transparent; }
        .light .mic-modal-btn--secondary {
          background: var(--surface-2);
          border-color: var(--border);
          color: var(--text-primary);
        }
        .light .mic-modal-btn--secondary:hover { background: var(--surface-3); }
      `}</style>
    </Modal>
  );

  return createPortal(modalContent, document.body);
}

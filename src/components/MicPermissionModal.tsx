import React, { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { MicOff, Settings, RefreshCw, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { selectionHaptic, tapHaptic, notifyHaptic } from '../utils/haptics';

export default function MicPermissionModal() {
  const { micErrorModal, setMicErrorModal } = useAppStore();
  const t = useT();
  const [isRetrying, setIsRetrying] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  if (!micErrorModal || !micErrorModal.isOpen) return null;

  const handleClose = () => {
    tapHaptic();
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-[#1c2430], #131922',
          backgroundColor: 'var(--card-bg, #1a222d)',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
          padding: '24px',
          color: '#ffffff',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          animation: 'scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Close Icon */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
          }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Animated Badge Icon */}
        <div
          style={{
            position: 'relative',
            marginTop: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              background: permissionGranted
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.4))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.3))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: permissionGranted
                ? '0 0 25px rgba(34, 197, 94, 0.4)'
                : '0 0 25px rgba(239, 68, 68, 0.3)',
            }}
          >
            {permissionGranted ? (
              <CheckCircle2 size={38} color="#22c55e" />
            ) : (
              <MicOff size={36} color="#ef4444" />
            )}
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: '8px',
            letterSpacing: '-0.01em',
            color: '#ffffff',
          }}
        >
          {permissionGranted
            ? 'Mikrofon ulandi!'
            : t('mic.modal.title') || 'Mikrofon ruxsati zarur'}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.75)',
            marginBottom: '20px',
            padding: '0 8px',
          }}
        >
          {permissionGranted
            ? 'Ruxsat muvaffaqiyatli berildi. Endi davom etishingiz mumkin.'
            : micErrorModal.errorMsg ||
              'Jonli muloqot va ovozli mashq qilish uchun mikrofonga ruxsat bering.'}
        </p>

        {/* Instructions Box */}
        {!permissionGranted && (
          <div
            style={{
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '14px 16px',
              marginBottom: '24px',
              textAlign: 'left',
              fontSize: '13px',
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 600,
                marginBottom: '8px',
                color: '#38bdf8',
              }}
            >
              <Settings size={15} />
              <span>Ruxsat berish tartibi:</span>
            </div>
            <ol
              style={{
                margin: 0,
                paddingLeft: '18px',
                lineHeight: 1.6,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <li>Telegram sozlamalari ⚙️ <b>Privacy & Security</b> ga kiring.</li>
              <li><b>Microphone</b> bo'limidan berilgan ruxsatni yoqing.</li>
            </ol>
          </div>
        )}

        {/* Buttons */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!permissionGranted && (
            <button
              onClick={handleTryAgain}
              disabled={isRetrying}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 20px rgba(37, 99, 235, 0.35)',
                transition: 'transform 0.15s ease, opacity 0.15s ease',
              }}
            >
              <RefreshCw
                size={18}
                style={{
                  animation: isRetrying ? 'spin 1s linear infinite' : 'none',
                }}
              />
              <span>{isRetrying ? 'Tekshirilmoqda…' : 'Qayta urinish'}</span>
            </button>
          )}

          <button
            onClick={handleClose}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

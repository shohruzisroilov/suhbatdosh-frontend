import React from 'react';
import { useT } from '../i18n';
import { tapHaptic } from '../utils/haptics';

function MicOnIcon() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v7a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 15.93V21h2v-2.07A8.001 8.001 0 0 0 20 11h-2a6 6 0 0 1-12 0H4a8.001 8.001 0 0 0 7 7.93z" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-2.21-1.79-4-4-4S7 2.79 7 5v.18l7.98 7.99zm-11.1-8.9L2.81 3.4 1.4 4.81 7 10.41V11c0 2.21 1.79 4 4 4 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H4c0 3.41 2.72 6.23 6 6.72V21h2v-2.28c.91-.13 1.77-.45 2.54-.9l4.65 4.65 1.41-1.41L3.88 2.27z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
    </svg>
  );
}

function CamOnIcon() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
      <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z" />
    </svg>
  );
}

function EndCallIcon() {
  return (
    <svg width="26" height="26" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.37c0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  );
}

interface CallControlsProps {
  micOn: boolean;
  camOn: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onEnd: () => void;
  onOpenChat: () => void;
  unread?: number;
  speaking?: boolean;
  hidden?: boolean;
  /**
   * The AI partner has no camera to show, and no face to look at, so its bar is the
   * three controls that mean something there: microphone, transcript, end.
   */
  showCamera?: boolean;
}

export default function CallControls({
  micOn,
  camOn,
  onToggleMic,
  onToggleCam,
  onEnd,
  onOpenChat,
  unread = 0,
  speaking = false,
  hidden = false,
  showCamera = true,
}: CallControlsProps) {
  const t = useT();

  const handleMic = () => {
    tapHaptic();
    onToggleMic();
  };
  const handleCam = () => {
    tapHaptic();
    onToggleCam();
  };
  const handleEnd = () => {
    tapHaptic('medium');
    onEnd();
  };
  const handleChat = () => {
    tapHaptic();
    onOpenChat();
  };

  return (
    <div className={`cc-bar${hidden ? ' cc-bar--hidden' : ''}`} aria-hidden={hidden}>
      <div className="cc-row">
        <div className="cc-item">
          <button
            className={`cc-btn${micOn ? '' : ' cc-btn--off'}${speaking ? ' cc-btn--speaking' : ''}`}
            onClick={handleMic}
            aria-label={micOn ? t('cc.mute') : t('cc.unmute')}
          >
            {micOn ? <MicOnIcon /> : <MicOffIcon />}
          </button>
          <span className="cc-label">{micOn ? t('cc.mute') : t('cc.unmute')}</span>
        </div>

        {showCamera && (
          <div className="cc-item">
            <button
              className={`cc-btn${camOn ? ' cc-btn--active' : ' cc-btn--off'}`}
              onClick={handleCam}
              aria-label={camOn ? t('cc.stop') : t('cc.camera')}
            >
              {camOn ? <CamOnIcon /> : <CamOffIcon />}
            </button>
            <span className="cc-label">{camOn ? t('cc.stop') : t('cc.camera')}</span>
          </div>
        )}

        <div className="cc-item">
          <button className="cc-btn cc-btn--chat" onClick={handleChat} aria-label={t('cc.chat')}>
            <ChatIcon />
            {unread > 0 && <span className="cc-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <span className="cc-label">{t('cc.chat')}</span>
        </div>

        <div className="cc-divider" aria-hidden="true" />

        <div className="cc-item cc-item--end">
          <button className="cc-btn cc-btn--end" onClick={handleEnd} aria-label={t('cc.end')}>
            <EndCallIcon />
          </button>
          <span className="cc-label">{t('cc.end')}</span>
        </div>
      </div>

      <style>{`
        .cc-bar {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          padding: var(--space-4) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-6));
          background: linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);
          z-index: 20;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
        }
        .cc-bar--hidden {
          transform: translateY(130%);
          opacity: 0;
          pointer-events: none;
        }
        .cc-row {
          display: flex;
          justify-content: center;
          align-items: flex-end;
          gap: var(--space-4);
        }
        .cc-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-1-5);
          flex: 1;
          max-width: 72px;
        }
        .cc-item--end { margin-left: var(--space-1); }
        .cc-divider {
          width: 1px; height: 40px; flex-shrink: 0;
          background: rgba(255,255,255,0.14);
          margin-bottom: var(--space-5);
        }
        .cc-btn {
          width: 58px; height: 58px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.1s, background 0.15s;
          box-shadow: 0 2px 12px rgba(0,0,0,0.35);
          position: relative;
        }
        .cc-btn:active { transform: scale(0.87); }
        .cc-btn--off {
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.07);
        }
        .cc-btn--off svg { opacity: 0.4; }
        .cc-btn--speaking {
          background: rgba(52,199,89,0.28);
          border-color: rgba(52,199,89,0.6);
          animation: ccSpeakPulse 1.2s ease-out infinite;
        }
        @keyframes ccSpeakPulse {
          0%   { box-shadow: 0 0 0 0 rgba(52,199,89,0.5); }
          100% { box-shadow: 0 0 0 12px rgba(52,199,89,0); }
        }
        .cc-btn--active {
          background: rgba(52,199,89,0.22);
          border-color: rgba(52,199,89,0.45);
        }
        .cc-btn--end {
          width: 66px; height: 66px;
          background: #e53e3e;
          border-color: transparent;
          box-shadow: 0 4px 20px rgba(229,62,62,0.55);
        }
        .cc-btn--end:active { transform: scale(0.87); }
        .cc-btn--chat { position: relative; }
        .cc-badge {
          position: absolute; top: -2px; right: -2px;
          min-width: 18px; height: 18px;
          background: var(--danger); color: #fff;
          border-radius: 99px; font-size: var(--text-xs); font-weight: var(--weight-bold);
          display: flex; align-items: center; justify-content: center;
          padding: 0 var(--space-1); border: 2px solid #000;
        }
        .cc-label {
          font-size: var(--text-xs); font-weight: var(--weight-medium);
          color: rgba(255,255,255,0.6);
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

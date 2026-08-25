import React, { useEffect } from 'react';
import useAppStore from '../store/useAppStore';

export default function Toast() {
  const appError = useAppStore((s) => s.appError);
  const setAppError = useAppStore((s) => s.setAppError);

  useEffect(() => {
    if (!appError) return;
    const t = setTimeout(() => setAppError(null), 4000);
    return () => clearTimeout(t);
  }, [appError, setAppError]);

  if (!appError) return null;

  return (
    <>
      <div
        className="toast-bar fade-up"
        onClick={() => setAppError(null)}
        role="alert"
        aria-live="assertive"
      >
        <span className="toast-bar__dot" />
        <span className="toast-bar__text">{appError}</span>
      </div>
      <style>{`
        .toast-bar {
          position: fixed;
          bottom: calc(env(safe-area-inset-bottom, 0px) + 88px);
          left: 50%; transform: translateX(-50%);
          z-index: 9999;
          display: inline-flex; align-items: center; gap: 8px;
          padding: 10px 18px;
          border-radius: var(--radius-full);
          background: rgba(30, 36, 48, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          white-space: nowrap;
          cursor: pointer;
          max-width: calc(100vw - 32px);
        }
        .toast-bar__dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--danger); flex-shrink: 0;
          box-shadow: 0 0 6px var(--danger);
        }
        .toast-bar__text {
          color: #F8FAFC;
          font-size: 13px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </>
  );
}

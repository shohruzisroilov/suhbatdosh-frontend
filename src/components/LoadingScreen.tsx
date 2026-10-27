import React from 'react';
import { Mic } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-brand">
        <div className="loading-logo">
          <Mic size={26} strokeWidth={2.5} />
        </div>
        <span className="loading-name">Suhbatdosh</span>
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>

      <style>{`
        .loading-screen {
          flex: 1; display: flex;
          align-items: center; justify-content: center;
          background: var(--bg);
        }
        .loading-brand {
          display: flex; flex-direction: column;
          align-items: center; gap: var(--space-4);
          animation: fadeIn 0.4s ease both;
        }
        .loading-logo {
          width: 76px; height: 76px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-xl, 24px);
          background: var(--grad-primary);
          box-shadow: var(--primary-shadow);
          color: #fff;
          animation: loadingBreath 1.8s ease-in-out infinite;
        }
        .loading-logo-emoji {
          font-size: 34px; line-height: 1;
        }
        .loading-name {
          font-size: var(--text-md); font-weight: var(--weight-bold);
          letter-spacing: -0.3px;
          color: var(--text-primary);
        }
        .loading-dots {
          display: flex; gap: var(--space-1);
        }
        .loading-dots span {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-secondary);
          animation: loadingDot 1.2s ease-in-out infinite;
        }
        .loading-dots span:nth-child(2) { animation-delay: 0.16s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.32s; }

        @keyframes loadingBreath {
          0%, 100% { transform: scale(1);    opacity: 0.9; }
          50%      { transform: scale(1.06); opacity: 1; }
        }
        @keyframes loadingDot {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40%           { opacity: 1;    transform: scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-logo,
          .loading-dots span { animation: none; }
        }
      `}</style>
    </div>
  );
}

import React from 'react';
import { useT } from '../i18n';

interface EndSessionSheetProps {
  onConfirm: () => void;
  onCancel: () => void;
  isEnding?: boolean;
}

export default function EndSessionSheet({ onConfirm, onCancel, isEnding }: EndSessionSheetProps) {
  const t = useT();
  return (
    <div className="end-sheet-overlay" onClick={onCancel}>
      <div className="end-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="end-sheet__handle" />
        <h3>{t('es.title')}</h3>
        <p>{t('es.desc')}</p>
        <button className="end-sheet__confirm" onClick={onConfirm}>
          {isEnding ? t('es.ending') : t('es.end')}
        </button>
        <button className="btn-secondary" onClick={onCancel}>
          {t('es.keep')}
        </button>
      </div>

      <style>{`
        .end-sheet-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.4);
          display: flex; align-items: flex-end;
          z-index: 100; animation: fadeIn 0.2s ease;
        }
        .end-sheet {
          background: var(--bg); width: 100%;
          border-radius: 24px 24px 0 0; padding: var(--space-3) var(--space-5) var(--space-7);
          display: flex; flex-direction: column; gap: var(--space-3);
          animation: slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);
        }
        .end-sheet__handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: var(--border); margin: 0 auto var(--space-2);
        }
        .end-sheet h3 { font-size: var(--text-md); font-weight: var(--weight-bold); letter-spacing: -0.3px; }
        .end-sheet p  { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; }
        .end-sheet__confirm {
          display: flex; align-items: center; justify-content: center;
          width: 100%; padding: var(--space-4);
          background: var(--btn-bg); color: var(--btn-text);
          border-radius: var(--radius-lg);
          font-size: var(--text-base); font-weight: var(--weight-semi);
          transition: opacity var(--t), transform var(--t);
        }
        .end-sheet__confirm:active { opacity: 0.8; transform: scale(0.98); }
      `}</style>
    </div>
  );
}

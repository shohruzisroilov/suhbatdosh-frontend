import React, { useState } from 'react';
import { reportSession, blockSession } from '../api/endpoints';
import { useT } from '../i18n/index';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

const REASONS = ['inappropriate', 'harassment', 'spam', 'fake', 'other'];

interface ReportSheetProps {
  sessionId?: string | number;
  partnerName?: string;
  onClose: () => void;
  onDone?: (msg: string) => void;
}

export default function ReportSheet({ sessionId, partnerName, onClose, onDone }: ReportSheetProps) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function handleReport(reason: string) {
    if (busy || !sessionId) return;
    setBusy(true);
    tapHaptic('medium');
    try {
      await reportSession(sessionId, reason);
      notifyHaptic('success');
      onDone?.(t('rep.doneReport'));
    } catch {
      onDone?.(t('rep.doneReport'));
    }
  }

  async function handleBlockOnly() {
    if (busy || !sessionId) return;
    setBusy(true);
    tapHaptic('medium');
    try {
      await blockSession(sessionId);
      notifyHaptic('success');
      onDone?.(t('rep.doneBlock'));
    } catch {
      onDone?.(t('rep.doneBlock'));
    }
  }

  return (
    <div className="rs-overlay" onClick={onClose}>
      <div className="rs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="rs-handle" />
        <h3 className="rs-title">{t('rep.title', { name: partnerName })}</h3>
        <p className="rs-desc">{t('rep.desc')}</p>

        <div className="rs-reasons">
          {REASONS.map((r) => (
            <button
              key={r}
              className="rs-reason"
              onClick={() => handleReport(r)}
              disabled={busy}
            >
              {t(`rep.reason.${r}`)}
            </button>
          ))}
        </div>

        <button className="rs-block" onClick={handleBlockOnly} disabled={busy}>
          {t('rep.blockOnly')}
        </button>
        <button className="rs-cancel" onClick={onClose} disabled={busy}>
          {t('rep.cancel')}
        </button>
      </div>

      <style>{`
        .rs-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5);
          display: flex; align-items: flex-end;
          z-index: 300; animation: fadeIn 0.2s ease;
        }
        .rs-sheet {
          background: var(--bg); width: 100%;
          border-radius: 24px 24px 0 0;
          padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-6));
          display: flex; flex-direction: column; gap: var(--space-2);
          animation: slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);
        }
        .rs-handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: var(--border); margin: 0 auto var(--space-1-5);
        }
        .rs-title { font-size: var(--text-md); font-weight: var(--weight-heavy); letter-spacing: -0.3px; }
        .rs-desc { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1-5); }
        .rs-reasons { display: flex; flex-direction: column; gap: var(--space-2); }
        .rs-reason {
          width: 100%; text-align: left;
          padding: var(--space-4) var(--space-4); font-size: var(--text-base); font-weight: var(--weight-semi);
          color: var(--text-primary);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          transition: opacity var(--t);
        }
        .rs-reason:active:not(:disabled) { opacity: 0.6; }
        .rs-reason:disabled { opacity: 0.4; }
        .rs-block {
          margin-top: var(--space-2); width: 100%; padding: var(--space-4);
          font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--danger);
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: var(--radius-md);
          transition: opacity var(--t);
        }
        .rs-block:active:not(:disabled) { opacity: 0.6; }
        .rs-cancel {
          width: 100%; padding: var(--space-3);
          font-size: var(--text-base); color: var(--text-secondary); font-weight: var(--weight-semi);
          transition: opacity var(--t);
        }
        .rs-cancel:active { opacity: 0.6; }
      `}</style>
    </div>
  );
}

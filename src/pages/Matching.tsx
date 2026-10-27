import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../hooks/useMatch';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { Users, RotateCcw, Megaphone, GraduationCap, MessageSquare } from 'lucide-react';

function fmtElapsed(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Sherik qidirish ekrani.
 */
export default function Matching() {
  const { user, navigate, waitingCount, callMode } = useAppStore();
  const { matchingStatus, startSearch, cancel } = useMatch();
  const t = useT();
  const started = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  useEffect(() => {
    const backBtn = window.Telegram?.WebApp?.BackButton;
    let handleBack: (() => void) | undefined;
    if (backBtn) {
      handleBack = () => cancelRef.current?.();
      backBtn.onClick(handleBack);
      backBtn.show();
    }
    if (!started.current) { started.current = true; startSearch(); }
    return () => {
      if (backBtn) {
        if (handleBack) backBtn.offClick(handleBack);
        backBtn.hide();
      }
    };
  }, []);

  useEffect(() => {
    if (matchingStatus !== 'searching') { setElapsed(0); return; }
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [matchingStatus]);

  const isTimeout = matchingStatus === 'timeout';

  if (isTimeout) {
    return (
      <div className="mt">
        <div className="mt__body scale-in">
          <span className="mt__glyph"><Users size={30} /></span>

          <div className="mt__copy">
            <h2 className="mt__title">{t('match.noneTitle')}</h2>
            <p className="mt__desc">{t('match.noneDesc')}</p>
          </div>

          <button
            className="btn-primary flex items-center justify-center gap-2"
            onClick={startSearch}
          >
            <RotateCcw size={16} />
            <span>{t('common.tryAgain')}</span>
          </button>

          <button className="btn-secondary flex items-center justify-center gap-2" onClick={() => navigate('listings')}>
            <Megaphone size={16} />
            <span>{t('nav.listings')}</span>
          </button>
          <button className="btn-quiet" onClick={() => navigate('home')}>{t('common.goBack')}</button>
        </div>
        <Styles />
      </div>
    );
  }

  const others = waitingCount >= 2;

  return (
    <div className="mt">
      <div className="mt__body scale-in">
        <div className="mt__mode-badge">
          {callMode === 'ielts' ? (
            <>
              <GraduationCap size={13} />
              <span>IELTS Practice</span>
            </>
          ) : (
            <>
              <MessageSquare size={13} />
              <span>Free Talk</span>
            </>
          )}
        </div>

        <div className="mt__dial">
          <span className="mt__ripple" aria-hidden="true" />
          <span className="mt__ripple mt__ripple--2" aria-hidden="true" />
          <span className="mt__scale" aria-hidden="true"><i /></span>
          <span className="mt__hole" aria-hidden="true" />
          <span className="mt__core">
            <span className="mt__core-level">{user?.level ? t(`level.${user.level}`) : 'EN'}</span>
          </span>
        </div>

        <div className="mt__copy">
          <h2 className="mt__title">
            {t('match.searching')}
            <span className="mt__dots" aria-hidden="true"><i /><i /><i /></span>
          </h2>
          <p className="mt__desc">{t('match.lookingFor')}</p>
        </div>

        <div className="mt__status">
          <div className="mt__meta">
            <div className="mt__cell">
              <span className="eyebrow">{t('match.queueLabel')}</span>
              <span className={`mt__val${others ? ' mt__val--live' : ''}`}>
                {others && <span className="dot-live" />}
                {others ? t('match.queueMany', { n: waitingCount }) : t('match.queueAlone')}
              </span>
            </div>
            <span className="mt__div" aria-hidden="true" />
            <div className="mt__cell">
              <span className="eyebrow">{t('match.waitLabel')}</span>
              <span className="mt__val num">{fmtElapsed(elapsed)}</span>
            </div>
          </div>
          <p className="mt__hint">{others ? t('match.hintMany') : t('match.hintAlone')}</p>
        </div>


        <button className="btn-quiet mt__cancel" onClick={cancel}>{t('common.cancel')}</button>
      </div>

      <Styles />
    </div>
  );
}

const Styles = React.memo(function Styles() {
  return (
    <style>{`
      .mt {
        flex: 1; height: 100%; overflow-y: auto;
        display: flex; align-items: center; justify-content: center;
        padding: var(--space-6) var(--space-4); background: var(--bg);
      }
      .mt__body {
        width: 100%; max-width: 340px;
        display: flex; flex-direction: column; align-items: center;
        gap: var(--space-4); text-align: center;
      }

      .mt__mode-badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 4px 12px; border-radius: var(--radius-full);
        background: var(--primary-subtle); border: 1px solid rgba(0, 168, 255, 0.25);
        color: var(--primary); font-size: 11px; font-weight: var(--weight-bold);
        text-transform: uppercase; letter-spacing: 0.05em;
      }

      .mt__dial {
        position: relative; width: 200px; height: 200px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .mt__ripple {
        position: absolute; inset: 0; border-radius: 50%;
        border: 1.5px solid var(--primary); opacity: 0;
        animation: radarRipple 2.8s cubic-bezier(0.1, 0.8, 0.3, 1) infinite;
      }
      .mt__ripple--2 { animation-delay: 1.4s; }

      .mt__scale, .mt__hole { position: absolute; border-radius: 50%; }
      .mt__scale {
        inset: 12px;
        background: var(--border-strong);
        -webkit-mask-image: repeating-conic-gradient(from -0.8deg, #000 0deg 1.6deg, transparent 1.6deg 7.5deg);
                mask-image: repeating-conic-gradient(from -0.8deg, #000 0deg 1.6deg, transparent 1.6deg 7.5deg);
      }
      .mt__scale i {
        position: absolute; inset: 0; border-radius: 50%;
        background: conic-gradient(from 0deg,
          transparent 0deg 200deg,
          var(--primary) 352deg,
          transparent 356deg);
        animation: dialScan 3s linear infinite;
        will-change: transform;
      }
      .mt__hole { width: 82%; height: 82%; background: var(--bg); }
      .mt__core {
        position: relative; z-index: 1;
        width: 92px; height: 92px; border-radius: 50%;
        background: var(--grad-primary); color: var(--primary-contrast);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        box-shadow: 0 0 35px rgba(0, 168, 255, 0.5), 0 8px 28px rgba(0, 0, 0, 0.35);
      }
      .mt__core-level {
        font-family: var(--font-display);
        font-size: 22px; font-weight: var(--weight-heavy);
        letter-spacing: -0.02em; line-height: 1;
      }
      @keyframes dialScan { to { transform: rotate(360deg); } }

      .mt__glyph {
        width: 68px; height: 68px; border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-2); color: var(--text-secondary);
        border: 1px solid var(--border);
      }

      .mt__copy { display: flex; flex-direction: column; gap: var(--space-1-5); }
      .mt__title {
        font-family: var(--font-display);
        font-size: var(--text-lg); font-weight: var(--weight-heavy);
        letter-spacing: -0.02em;
        display: flex; align-items: flex-end; justify-content: center; gap: 5px;
      }
      .mt__desc { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.55; }
      .mt__fine {
        font-size: var(--text-xs); color: var(--text-secondary);
        margin-top: calc(var(--space-2) * -1);
      }

      .mt__dots { display: inline-flex; gap: 3px; padding-bottom: 6px; }
      .mt__dots i {
        width: 4px; height: 4px; border-radius: 50%; background: currentColor;
        animation: dotBlink 1.4s infinite; opacity: 0;
      }
      .mt__dots i:nth-child(2) { animation-delay: 0.2s; }
      .mt__dots i:nth-child(3) { animation-delay: 0.4s; }

      .mt__status {
        display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
        width: 100%;
      }
      .mt__meta {
        display: flex; align-items: stretch; width: 100%;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        overflow: hidden;
      }
      .mt__cell {
        flex: 1; min-width: 0;
        display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
        padding: var(--space-3) var(--space-2);
      }
      .mt__div { width: 1px; background: var(--border); margin: var(--space-3) 0; }
      .mt__val {
        display: flex; align-items: center; gap: var(--space-1-5);
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-bold);
        letter-spacing: -0.01em; color: var(--text-primary);
        white-space: nowrap;
      }
      .mt__val--live { color: var(--success); }
      .mt__hint {
        font-size: var(--text-xs); color: var(--text-secondary);
        line-height: 1.5; max-width: 300px;
      }
      .mt__cancel {
        border: 1px solid var(--border); padding: 0 var(--space-5);
        border-radius: var(--radius-full); min-height: 44px;
        font-size: var(--text-sm); font-weight: var(--weight-bold);
        color: var(--text-secondary);
        transition: background var(--t), color var(--t);
      }
      .mt__cancel:active { background: var(--surface-2); color: var(--text-primary); }
    `}</style>
  );
});


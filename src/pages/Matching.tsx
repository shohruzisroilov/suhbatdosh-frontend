import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../hooks/useMatch';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { Clock, Users, RotateCcw, Star } from 'lucide-react';

function fmtElapsed(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const MOCK_OFFER_AFTER_SEC = 10;

/**
 * Sherik qidirish ekrani.
 */
export default function Matching() {
  const { user, navigate, waitingCount, noPartnerYet } = useAppStore();
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
  const isLimit   = matchingStatus === 'limit_reached';

  if (isLimit) {
    return (
      <div className="mt">
        <div className="mt__body scale-in">
          <span className="mt__glyph"><Clock size={30} /></span>

          <div className="mt__copy">
            <h2 className="mt__title">{t('match.limitTitle', { min: user?.dailyLimit || 10 })}</h2>
            <p className="mt__desc">{t('match.limitDesc')}</p>
          </div>

          <button
            className="btn-primary"
            onClick={() => navigate('premium', { from: 'home' })}
          >
            <Star size={17} strokeWidth={2.5} />
            {t('match.getPremium')}
          </button>
          <p className="mt__fine">{t('match.unlimitedDaily')}</p>

          <button className="btn-quiet" onClick={() => navigate('home')}>{t('common.goBack')}</button>
        </div>
        <Styles />
      </div>
    );
  }

  if (isTimeout) {
    return (
      <div className="mt">
        <div className="mt__body scale-in">
          <span className="mt__glyph"><Users size={30} /></span>

          <div className="mt__copy">
            <h2 className="mt__title">{t('match.noOne')}</h2>
            <p className="mt__desc">{t('match.noOneDesc')}</p>
          </div>

          <button className="btn-secondary" onClick={startSearch}>
            <RotateCcw size={16} />
            {t('common.tryAgain')}
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
        <div className="mt__dial">
          <span className="mt__scale" aria-hidden="true"><i /></span>
          <span className="mt__hole" aria-hidden="true" />
          <span className="mt__core">
            {user?.level ? t(`level.${user.level}`) : 'EN'}
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

      .mt__dial {
        position: relative; width: 180px; height: 180px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .mt__scale, .mt__hole { position: absolute; border-radius: 50%; }
      .mt__scale {
        inset: 0;
        background: var(--border-strong);
        -webkit-mask-image: repeating-conic-gradient(from -0.8deg, #000 0deg 1.6deg, transparent 1.6deg 7.5deg);
                mask-image: repeating-conic-gradient(from -0.8deg, #000 0deg 1.6deg, transparent 1.6deg 7.5deg);
      }
      .mt__scale i {
        position: absolute; inset: 0; border-radius: 50%;
        background: conic-gradient(from 0deg,
          transparent 0deg 200deg,
          var(--btn-bg) 352deg,
          transparent 356deg);
        animation: dialScan 3.4s linear infinite;
        will-change: transform;
      }
      .mt__hole { width: 89%; height: 89%; background: var(--bg); }
      .mt__core {
        position: relative; z-index: 1;
        width: 84px; height: 84px; border-radius: 50%;
        background: var(--grad-primary); color: var(--btn-text);
        display: flex; align-items: center; justify-content: center;
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-heavy);
        letter-spacing: -0.02em;
        box-shadow: 0 0 30px rgba(42, 171, 238, 0.45), 0 8px 24px rgba(0, 0, 0, 0.45);
      }
      @keyframes dialScan { to { transform: rotate(360deg); } }

      .mt__glyph {
        width: 64px; height: 64px; border-radius: var(--radius-full);
        display: flex; align-items: center; justify-content: center;
        background: var(--surface-2); color: var(--text-secondary);
      }

      .mt__copy { display: flex; flex-direction: column; gap: var(--space-2); }
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
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
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
      .mt__cancel { border: 1px solid var(--border); padding: 0 var(--space-5); }
    `}</style>
  );
});

import React, { useEffect, useRef, useState } from 'react';
import { useMatch } from '../hooks/useMatch';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { Users, RotateCcw, Megaphone } from 'lucide-react';

function fmtElapsed(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Sherik qidirish ekrani.
 */
export default function Matching() {
  const { user, navigate, waitingCount } = useAppStore();
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

      .mt__dial {
        position: relative; width: 200px; height: 200px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .mt__ripple {
        position: absolute; inset: 0; border-radius: 50%;
        border: 1.5px solid var(--btn-bg); opacity: 0;
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
          var(--btn-bg) 352deg,
          transparent 356deg);
        animation: dialScan 3s linear infinite;
        will-change: transform;
      }
      .mt__hole { width: 82%; height: 82%; background: var(--bg); }
      .mt__core {
        position: relative; z-index: 1;
        width: 92px; height: 92px; border-radius: 50%;
        background: var(--grad-primary); color: var(--btn-text);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        box-shadow: 0 0 40px rgba(0, 168, 255, 0.6), 0 8px 28px rgba(0, 0, 0, 0.45);
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
        background: var(--bg-secondary);
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
        border-radius: var(--radius-full); min-height: 40px;
        font-size: var(--text-sm); font-weight: var(--weight-bold);
        color: var(--text-secondary);
        transition: background var(--t), color var(--t);
      }
      .mt__cancel:active { background: var(--surface-2); color: var(--text-primary); }

      /* AI Partner Matching Card Styles */
      .ai-partner-matching-card {
        width: 100%;
        margin-top: 6px;
        padding: 16px 18px;
        border-radius: 20px;
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(3, 105, 161, 0.25) 100%);
        border: 1.5px solid rgba(56, 189, 248, 0.45);
        box-shadow: 0 8px 24px rgba(2, 132, 199, 0.2);
        display: flex;
        flex-direction: column;
        gap: 12px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        text-align: left;
      }
      .ai-partner-matching-card:hover, .ai-partner-matching-card:active {
        transform: translateY(-2px) scale(1.01);
        border-color: rgba(56, 189, 248, 0.8);
        box-shadow: 0 12px 30px rgba(2, 132, 199, 0.35);
        background: linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(3, 105, 161, 0.35) 100%);
      }
      .ai-card-glow {
        position: absolute;
        top: -30px;
        right: -30px;
        width: 100px;
        height: 100px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(56, 189, 248, 0.4) 0%, transparent 70%);
        pointer-events: none;
      }
      .ai-card-header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .ai-card-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 12px;
        background: rgba(56, 189, 248, 0.2);
        border: 1px solid rgba(56, 189, 248, 0.4);
        font-size: 10px;
        font-weight: 700;
        color: var(--btn-bg);
        letter-spacing: 0.5px;
      }
      .ai-card-content {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .ai-card-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
        flex-shrink: 0;
      }
      .ai-card-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      /* The card is a blue tint the page shows through, not a solid blue card, so
         its words follow the scheme. White read as white-on-pale-blue in light mode. */
      .ai-card-title {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        line-height: 1.25;
      }
      .ai-card-desc {
        font-size: 12px;
        color: var(--text-secondary);
        margin: 0;
      }
      .ai-card-action {
        width: 100%;
        padding: 10px 14px;
        border-radius: 12px;
        background: #0284c7;
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
      }
    `}</style>
  );
});


import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { rateSession } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import ReportSheet from '../components/ReportSheet';
import Modal from '../components/Modal';
import ReviewPrompt from '../components/ReviewPrompt';
import { Star, Check, Flag, PartyPopper, LogOut, Flame, Sparkles, Target } from 'lucide-react';

function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hov, setHov] = useState(0);
  const active = hov || value;
  return (
    <div className="stars" role="radiogroup" aria-label="rating">
      {[1,2,3,4,5].map(s => (
        <button
          key={s}
          className={`star ${active >= s ? 'on' : ''}`}
          onClick={() => { selectionHaptic(); onChange(s); }}
          onMouseEnter={() => setHov(s)}
          onMouseLeave={() => setHov(0)}
          role="radio"
          aria-checked={value === s}
          aria-label={`${s} star`}
          type="button"
        ><Star size={30} fill={active >= s ? 'currentColor' : 'none'} strokeWidth={1.75} /></button>
      ))}
    </div>
  );
}

export default function SessionEnd() {
  const { session, screenParams, navigate, clearSession, setMatchingStatus } = useAppStore();
  const t = useT();
  const LABELS = ['', t('se.rate.1'), t('se.rate.2'), t('se.rate.3'), t('se.rate.4'), t('se.rate.5')];
  const [rating, setRating]       = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState<string | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const isAi        = !!screenParams?.isAi || !!session?.isAi;
  const aiStats     = screenParams?.aiStats || null;
  const sessionId   = screenParams?.sessionId || session?.id;
  const partnerName = isAi ? 'Suhbatdosh AI' : (session?.partnerName || t('common.yourPartner'));
  const reason      = screenParams?.reason;

  useEffect(() => {
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
  }, []);

  const dur = (() => {
    if (screenParams?.elapsed) return screenParams.elapsed;
    if (session?.startedAt && session?.endedAt) {
      return Math.floor((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 1000);
    }
    if (session?.startedAt) {
      return Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000);
    }
    return null;
  })();

  const durText = dur != null && dur > 0
    ? dur < 60
      ? `${dur}s`
      : `${Math.floor(dur / 60)}m ${dur % 60 > 0 ? `${dur % 60}s` : ''}`
    : null;

  async function handleRate() {
    if (!rating) return;
    tapHaptic('medium');
    if (!isAi && sessionId) {
      setLoading(true);
      try { await rateSession(sessionId, rating); } catch {}
    }
    setSubmitted(true);
    setLoading(false);
  }

  function goMatch() {
    tapHaptic('light');
    clearSession();
    setMatchingStatus('idle');
    navigate('matching');
  }

  function handleGoHome() {
    tapHaptic('light');
    setShowReviewModal(true);
  }

  function finishGoHome() {
    clearSession();
    setMatchingStatus('idle');
    navigate('home');
  }

  return (
    <div className="end-screen">
      <div className="end-body scale-in">

        <span className="end-ico">
          {reason === 'partner_left' ? <LogOut size={26} /> : <PartyPopper size={26} />}
        </span>

        <div className="end-head">
          <h2>{reason === 'partner_left' ? t('se.partnerLeft') : t('se.complete')}</h2>
          <p>
            {reason === 'partner_left'
              ? t('se.partnerLeftDesc', { name: partnerName })
              : t('se.greatConv', { name: partnerName })}
          </p>
        </div>

        <div className="end-card">
          <div className="end-row">
            <span>{t('se.partner')}</span>
            <span className="end-row-val">{partnerName}</span>
          </div>
          {durText && (
            <div className="end-row">
              <span>{t('se.duration')}</span>
              <span className="end-row-val">{durText}</span>
            </div>
          )}
        </div>

        {/* ── Celebration & Streak Motivation Banner ── */}
        <div className="end-streak-banner scale-in">
          <div className="end-streak-badge">
            <Flame size={15} fill="#FF9F0A" className="end-flame-ico" />
            <span>{t('end.badge')}</span>
          </div>
          <p className="end-streak-title">{t('end.title')}</p>
          {durText && (
            <p className="end-streak-sub">{t('end.sub', { dur: durText })}</p>
          )}
        </div>

        {/* What the AI session produced. A practice session used to end with nothing
            to show for it — no numbers, no sense that anything had been done. */}
        {isAi && aiStats && (
          <div className="end-ai-stats fade-up">
            <div className="end-ai-stat">
              <span className="end-ai-stat__value num">{aiStats.turnCount ?? 0}</span>
              <span className="end-ai-stat__label">{t('ai.endTurnsLabel')}</span>
            </div>
            <div className="end-ai-stat">
              <span className="end-ai-stat__value num">{aiStats.wordsSpoken ?? 0}</span>
              <span className="end-ai-stat__label">{t('ai.endWordsLabel')}</span>
            </div>
            {aiStats.avgWpm ? (
              <div className="end-ai-stat">
                <span className="end-ai-stat__value num">{aiStats.avgWpm}</span>
                <span className="end-ai-stat__label">{t('ai.endWpmLabel')}</span>
              </div>
            ) : null}
          </div>
        )}

        {!submitted ? (
          <div className="end-rate fade-up">
            <p className="end-rate-title">{t('se.rate')}</p>
            {rating > 0 && <p className="end-rate-label">{LABELS[rating]}</p>}
            <Stars value={rating} onChange={setRating} />
            <button className="btn-primary" onClick={handleRate} disabled={!rating || loading}>
              {loading ? t('se.submitting') : t('se.submit')}
            </button>
            <button className="end-skip" onClick={() => setSubmitted(true)}>{t('se.skip')}</button>
          </div>
        ) : (
          <div className="end-thanks fade-up">
            <p>{t('se.thanks')}</p>
          </div>
        )}

        <div className="end-actions fade-up" style={{ width: '100%', marginTop: 12 }}>
          <button className="btn-primary" onClick={goMatch}>{t('se.findAnother')}</button>
          <button className="btn-secondary" style={{ marginTop: 8 }} onClick={handleGoHome}>{t('se.goHome')}</button>
        </div>

        {!isAi && (reportDone ? (
          <p className="end-report-done"><Check size={14} /> {reportDone}</p>
        ) : sessionId ? (
          <button className="end-report" onClick={() => { tapHaptic('light'); setReportOpen(true); }}>
            <Flag size={14} /> {t('rep.link')}
          </button>
        ) : null)}

      </div>

      {showReviewModal && createPortal(
        <Modal
          isOpen
          onClose={finishGoHome}
          backdropClassName="home-review-modal-backdrop"
          className="home-review-modal-content scale-in"
          label={t('rp.title')}
        >
          <ReviewPrompt forceShow={true} onClose={finishGoHome} />
        </Modal>,
        document.body
      )}

      {reportOpen && (
        <ReportSheet
          sessionId={sessionId}
          partnerName={partnerName}
          onClose={() => setReportOpen(false)}
          onDone={(msg: string) => { setReportDone(msg); setReportOpen(false); }}
        />
      )}

      <style>{`
        .end-screen {
          display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
          padding: var(--space-6) var(--space-4); flex: 1; background: var(--bg);
          overflow-y: auto; overflow-x: hidden; width: 100%; position: relative;
        }
        .end-body {
          width: 100%; max-width: 340px;
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-4); text-align: center;
        }
        .end-ico {
          width: 68px; height: 68px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, var(--primary-subtle), rgba(0, 102, 255, 0.25));
          border: 1px solid rgba(0, 168, 255, 0.25);
          color: var(--primary);
          box-shadow: 0 8px 24px var(--primary-subtle);
        }
        .end-head h2 {
          font-family: var(--font-display);
          font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
        }
        .end-head p  { font-size: var(--text-base); color: var(--text-secondary); margin-top: var(--space-1); }

        .end-card {
          width: 100%; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: var(--radius-lg);
          padding: var(--space-1) 0; display: flex; flex-direction: column;
        }
        .end-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-base); color: var(--text-secondary);
          border-bottom: 1px solid var(--border);
        }
        .end-row:last-child { border-bottom: none; }
        .end-row-val { font-weight: var(--weight-bold); color: var(--text-primary); }

        .end-rate { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); width: 100%; }
        .end-rate-title { font-size: var(--text-md); font-weight: var(--weight-bold); }
        .end-rate-label { font-size: var(--text-base); color: var(--text-secondary); min-height: 20px; }

        .stars { display: flex; gap: var(--space-1); }
        .star {
          width: 46px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          color: var(--border-strong);
          transition: color var(--t), transform var(--t-spring);
        }
        .star.on     { color: var(--rating); }
        .star:active { transform: scale(0.85); }

        .end-skip {
          font-size: var(--text-sm); color: var(--text-secondary);
          padding: var(--space-2); font-weight: var(--weight-medium); transition: opacity var(--t);
        }
        .end-skip:active { opacity: 0.6; }

        .end-thanks { font-size: var(--text-md); font-weight: var(--weight-bold); }
        .end-actions { display: flex; flex-direction: column; gap: var(--space-1-5); width: 100%; }

        /* ── Post-Session Celebration Banner ── */
        .end-ai-stats {
          display: flex; gap: var(--space-2);
          margin: var(--space-3) 0;
        }
        .end-ai-stat {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: var(--space-3) var(--space-2);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .end-ai-stat__value {
          font-family: var(--font-display);
          font-size: var(--text-lg); font-weight: var(--weight-heavy);
          color: var(--text-primary); line-height: 1;
        }
        .end-ai-stat__label {
          font-size: var(--text-2xs); font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.06em;
          color: var(--text-secondary); text-align: center;
        }

        .end-streak-banner {
          width: 100%;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, rgba(255, 159, 10, 0.12) 0%, rgba(234, 179, 8, 0.08) 100%);
          border: 1px solid rgba(255, 159, 10, 0.3);
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 4px; text-align: left;
          box-shadow: 0 4px 16px rgba(255, 159, 10, 0.15);
        }
        /* The banner is a tint, not a solid colour: the page shows through it, so its
           text has to follow the scheme rather than assume a dark one. White here put
           the streak message on pale cream in light mode, where it disappeared. */
        .end-streak-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 800; color: var(--accent);
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .end-flame-ico { color: var(--accent); filter: drop-shadow(0 0 6px rgba(255, 159, 10, 0.6)); }
        .end-streak-title {
          font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 2px 0 0 0;
        }
        .end-streak-sub {
          font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.4;
        }

        .end-report {
          display: flex; align-items: center; justify-content: center; gap: var(--space-1-5);
          font-size: var(--text-sm); color: var(--text-tertiary);
          padding: var(--space-2); font-weight: var(--weight-medium); margin-top: var(--space-0-5);
          transition: opacity var(--t);
        }
        .end-report:active { opacity: 0.6; }
        .end-report-done {
          display: flex; align-items: center; justify-content: center; gap: var(--space-1-5);
          font-size: var(--text-sm); color: var(--success);
          padding: var(--space-2); margin-top: var(--space-0-5);
        }
      `}</style>
    </div>
  );
}

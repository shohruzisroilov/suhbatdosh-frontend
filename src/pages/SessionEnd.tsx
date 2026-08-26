import { useState, useEffect } from 'react';
import { rateSession } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import ReportSheet from '../components/ReportSheet';
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
            <span>Great Practice!</span>
          </div>
          <p className="end-streak-title">You're building fluency step by step! 🔥</p>
          {durText && (
            <p className="end-streak-sub">
              🎯 +{durText} spoken English practice completed today.
            </p>
          )}
        </div>

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

      {showReviewModal && (
        <div className="home-review-modal-backdrop" onClick={finishGoHome}>
          <div className="home-review-modal-content scale-in" onClick={(e) => e.stopPropagation()}>
            <ReviewPrompt forceShow={true} onClose={finishGoHome} />
          </div>
        </div>
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
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-6) var(--space-4); flex: 1; background: var(--bg); overflow-y: auto;
        }
        .end-body {
          width: 100%; max-width: 340px;
          display: flex; flex-direction: column; align-items: center;
          gap: var(--space-4); text-align: center;
        }
        .end-ico {
          width: 68px; height: 68px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(135deg, rgba(0,168,255,0.2), rgba(0,102,255,0.3));
          border: 1px solid rgba(0,168,255,0.25);
          color: var(--btn-bg);
          box-shadow: 0 8px 24px rgba(0,168,255,0.2);
        }
        .end-head h2 {
          font-family: var(--font-display);
          font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
        }
        .end-head p  { font-size: var(--text-base); color: var(--text-secondary); margin-top: var(--space-1); }

        .end-card {
          width: 100%; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: var(--radius-md);
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
        .end-streak-banner {
          width: 100%;
          border-radius: var(--radius-lg);
          background: linear-gradient(135deg, rgba(255, 159, 10, 0.12) 0%, rgba(234, 179, 8, 0.08) 100%);
          border: 1px solid rgba(255, 159, 10, 0.3);
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 4px; text-align: left;
          box-shadow: 0 4px 16px rgba(255, 159, 10, 0.15);
        }
        .end-streak-badge {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 800; color: #FF9F0A;
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .end-flame-ico { color: #FF9F0A; filter: drop-shadow(0 0 6px rgba(255, 159, 10, 0.6)); }
        .end-streak-title {
          font-size: 14px; font-weight: 700; color: #ffffff; margin: 2px 0 0 0;
        }
        .end-streak-sub {
          font-size: 12px; color: rgba(255, 255, 255, 0.75); margin: 0; line-height: 1.4;
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

import React, { useState, useEffect } from 'react';
import { rateSession } from '../api/endpoints';
import useAppStore from '../store/useAppStore.js';
import { useT } from '../i18n/index.js';
import { tapHaptic, selectionHaptic } from '../utils/haptics.js';
import ReportSheet from '../components/ReportSheet.jsx';
import ReviewPrompt from '../components/ReviewPrompt.jsx';
import { Star, Check, Flag, PartyPopper, LogOut } from 'lucide-react';

function Stars({ value, onChange }) {
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
  const [reportDone, setReportDone] = useState(null);

  const sessionId   = screenParams?.sessionId || session?.id;
  const partnerName = session?.partnerName || t('common.yourPartner');
  const reason      = screenParams?.reason;

  useEffect(() => {
    if (window.Telegram?.WebApp?.BackButton) window.Telegram.WebApp.BackButton.hide();
  }, []);

  // Duration: screenParams.elapsed (from Chat timer) yoki startedAt/endedAt dan
  const dur = (() => {
    if (screenParams?.elapsed) return screenParams.elapsed;
    if (session?.startedAt && session?.endedAt) {
      return Math.floor((new Date(session.endedAt) - new Date(session.startedAt)) / 1000);
    }
    if (session?.startedAt) {
      return Math.floor((Date.now() - new Date(session.startedAt)) / 1000);
    }
    return null;
  })();

  const durText = dur != null && dur > 0
    ? dur < 60
      ? `${dur}s`
      : `${Math.floor(dur / 60)}m ${dur % 60 > 0 ? `${dur % 60}s` : ''}`
    : null;

  async function handleRate() {
    if (!rating || !sessionId) return;
    tapHaptic('medium');
    setLoading(true);
    try { await rateSession(sessionId, rating); } catch {}
    setSubmitted(true); setLoading(false);
  }

  function goMatch() { clearSession(); setMatchingStatus('idle'); navigate('matching'); }
  function goHome()  { clearSession(); setMatchingStatus('idle'); navigate('home'); }

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

        {/* Ilova haqidagi review — sherikni baholagandan KEYIN.
            Ikkalasini birga so'rash ikki xil savolni chalkashtiradi:
            biri sherik haqida, biri ilova haqida. */}
        {submitted && <ReviewPrompt />}

        {submitted && (
          <div className="end-actions fade-up">
            <button className="btn-primary" onClick={goMatch}>{t('se.findAnother')}</button>
            <button className="btn-secondary" style={{marginTop:4}} onClick={goHome}>{t('se.goHome')}</button>
          </div>
        )}

        {/* Report / block */}
        {reportDone ? (
          <p className="end-report-done"><Check size={14} /> {reportDone}</p>
        ) : sessionId ? (
          <button className="end-report" onClick={() => { tapHaptic('light'); setReportOpen(true); }}>
            <Flag size={14} /> {t('rep.link')}
          </button>
        ) : null}

      </div>

      {reportOpen && (
        <ReportSheet
          sessionId={sessionId}
          partnerName={partnerName}
          onClose={() => setReportOpen(false)}
          onDone={(msg) => { setReportDone(msg); setReportOpen(false); }}
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
          width: 62px; height: 62px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--surface-2); color: var(--text-secondary);
        }
        .end-head h2 {
          font-family: var(--font-display);
          font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
        }
        .end-head p  { font-size: var(--text-base); color: var(--text-secondary); margin-top: var(--space-1); }

        .end-card {
          width: 100%; background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: var(--radius-md);
          padding: var(--space-4) var(--space-4); display: flex; flex-direction: column; gap: var(--space-3);
        }
        .end-row {
          display: flex; justify-content: space-between;
          font-size: var(--text-base); color: var(--text-secondary);
        }
        .end-row-val { font-weight: var(--weight-bold); color: var(--text-primary); }

        .end-rate { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); width: 100%; }
        .end-rate-title { font-size: var(--text-md); font-weight: var(--weight-bold); }
        .end-rate-label { font-size: var(--text-base); color: var(--text-secondary); min-height: 20px; }

        .stars { display: flex; gap: var(--space-1); }
        .star {
          width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
          color: var(--border-strong);
          transition: color var(--t), transform var(--t);
        }
        .star.on     { color: var(--rating); }
        .star:active { transform: scale(0.88); }

        .end-skip {
          font-size: var(--text-sm); color: var(--text-secondary);
          padding: var(--space-2); font-weight: var(--weight-medium); transition: opacity var(--t);
        }
        .end-skip:active { opacity: 0.6; }

        .end-thanks { font-size: var(--text-md); font-weight: var(--weight-bold); }
        .end-actions { display: flex; flex-direction: column; gap: var(--space-1-5); width: 100%; }

        .end-report {
          display: flex; align-items: center; justify-content: center; gap: var(--space-1-5);
          font-size: var(--text-sm); color: var(--text-secondary);
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

import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Mic, ShieldCheck, Star, ChevronRight, MessageSquare, Users, Bot, Sparkles } from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import PrimeTimeBanner from '../components/PrimeTimeBanner';
import DailyProgress from '../components/DailyProgress';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';
import HomeReviews from '../components/HomeReviews';

/**
 * Bosh sahifa — Conversation-First layout.
 */
export default function Home() {
  const { user, stats, recentSessions, setStats, setRecentSessions, setUser, navigate,
          homeLoaded, setHomeLoaded, partnerPref, setPartnerPref, waitingCount } = useAppStore();
  const t = useT();

  const isFemale  = user?.gender === 'female';
  const womenOnly = isFemale && partnerPref === 'female';
  const showPremium = !user?.isPremium && (user?.dailyLimit ?? 0) > 0;

  useEffect(() => {
    getMe().then(d => {
      setStats(d.stats);
      setRecentSessions(d.recentSessions);
      if (d.user) setUser(d.user);
    }).catch(() => {}).finally(() => setHomeLoaded(true));
  }, []);

  return (
    <div className="home">
      <HomeHeader
        user={user}
        streak={stats?.streakCount || 0}
        doneToday={stats?.hasPracticedToday || false}
      />

      <div className="home__scroll">

        {/* Xavfsizlik filtri (Ayollar / Girls uchun eng tepada) */}
        {isFemale && (
          <button
            type="button"
            className={`row${womenOnly ? ' row--on' : ''} fade-up`}
            onClick={() => { selectionHaptic(); setPartnerPref(womenOnly ? 'any' : 'female'); }}
            aria-pressed={womenOnly}
            style={{ marginBottom: '12px' }}
          >
            <span className={`row__ico${womenOnly ? ' row__ico--primary' : ''}`}>
              <ShieldCheck size={18} />
            </span>
            <span className="row__text">
              <span className="row__title">{t('match.pref.womenOnly')}</span>
              <span className="row__sub">{t('match.pref.womenOnlyHint')}</span>
            </span>
            <span className={`switch${womenOnly ? ' switch--on' : ''}`} />
          </button>
        )}

        {/* ── Find Partner Hero Card ── */}
        <section className="hero fade-up" onClick={() => { tapHaptic('medium'); navigate('matching'); }}>
          {/* Animated background orbs */}
          <div className="hero__orb hero__orb--1" />
          <div className="hero__orb hero__orb--2" />
          <div className="hero__orb hero__orb--3" />

          <div className="hero__inner">
            {/* Live badge */}
            <div className="hero__top-row">
              <span className="hero__tag">
                <span className="hero__live-dot" />
                {waitingCount >= 2
                  ? t('home.heroLive', { n: waitingCount })
                  : waitingCount === 1
                    ? t('home.heroLiveOne')
                    : t('home.heroTag')}
              </span>
              {waitingCount > 0 && (
                <span className="hero__online-pill">
                  <Users size={11} />
                  <span>{waitingCount} online</span>
                </span>
              )}
            </div>

            {/* Title & description */}
            <div className="hero__content">
              <h1 className="hero__title">{t('home.ctaTitle')}</h1>
              <p className="hero__sub">{t('home.ctaSub')}</p>
            </div>

            {/* Mic icon + CTA */}
            <div className="hero__cta-row">
              <div className="hero__mic-ring">
                <div className="hero__mic-pulse" />
                <div className="hero__mic-icon">
                  <Mic size={22} strokeWidth={2.5} />
                </div>
              </div>
              <button
                className="hero__btn"
                onClick={(e) => { e.stopPropagation(); tapHaptic('medium'); navigate('matching'); }}
              >
                <span>{t('home.start')}</span>
                <ChevronRight size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </section>

        {/* ── Quick AI Voice Practice Card ── */}
        <section
          className="home-ai-quick-card fade-up"
          onClick={() => { tapHaptic('medium'); navigate('chat', { isAi: true, mode: 'ai' }); }}
        >
          <div className="home-ai-quick-top">
            <span className="home-ai-quick-badge">
              <Sparkles size={12} />
              <span>AI VOICE PARTNER</span>
            </span>
            <span className="home-ai-quick-free">FREE</span>
          </div>

          <div className="home-ai-quick-body">
            <div className="home-ai-quick-info">
              <h3 className="home-ai-quick-title">Practice English with AI 🎙️</h3>
              <p className="home-ai-quick-sub">Instant voice practice • Level-adapted • No waiting</p>
            </div>
            <button type="button" className="home-ai-quick-btn">
              <Bot size={16} />
              <span>Start</span>
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </section>



        <div className="home__list stagger">
          {/* Prime Time Event Banner */}
          <PrimeTimeBanner />

          {/* Kunlik hisoblagich */}
          {!user?.isPremium && (
            <DailyProgress
              dailyMinutes={user?.dailyMinutes || 0}
              dailyLimit={user?.dailyLimit || 0}
              onUpgrade={() => navigate('premium', { from: 'home' })}
            />
          )}



          {showPremium && (
            <button className="row" onClick={() => navigate('premium', { from: 'home' })}>
              <span className="row__ico row__ico--accent"><Star size={18} /></span>
              <span className="row__text">
                <span className="row__title">{t('home.getPremium')}</span>
                <span className="row__sub">{t('home.premiumSub')}</span>
              </span>
              <ChevronRight size={18} className="row__arrow" />
            </button>
          )}
        </div>

        {/* Foydalanuvchilar fikri va Review qoldirish bo'limi */}
        <HomeReviews />

        {/* Recent Practice History */}
        {!homeLoaded ? (
          <section className="home__section">
            <p className="eyebrow">{t('home.recent')}</p>
            <div className="home__sessions">
              {[0, 1, 2].map(i => <SkeletonRow key={i} avatar={40} />)}
            </div>
          </section>
        ) : (recentSessions?.length ?? 0) > 0 ? (
          <section className="home__section">
            <p className="eyebrow">{t('home.recent')}</p>
            <div className="home__sessions">
              {recentSessions.slice(0, 5).map((s: any) => <SessionRow key={s.id} session={s} />)}
            </div>
          </section>
        ) : (
          <section className="home__empty">
            <span className="home__empty-ico"><MessageSquare size={22} /></span>
            <p className="home__empty-title">{t('home.noSessions')}</p>
            <p className="home__empty-sub">{t('home.noSessionsSub')}</p>
          </section>
        )}

        <div className="home__foot" />
      </div>

      <style>{`
        /* ── Page Shell ── */
        .home { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .home__scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-3) var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .home__list { display: flex; flex-direction: column; gap: var(--space-2); }

        /* ── Hero / Find Partner Card ── */
        .hero {
          position: relative; overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(145deg, #0369A1 0%, #0EA5E9 45%, #38BDF8 100%);
          border: 1px solid rgba(255, 255, 255, 0.20);
          border-radius: var(--radius-lg, 20px);
          padding: 18px 16px 16px;
          display: flex; flex-direction: column;
          box-shadow: 0 8px 32px rgba(3, 105, 161, 0.45), 0 2px 8px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
          -webkit-tap-highlight-color: transparent;
        }
        .hero:active {
          transform: scale(0.985);
          box-shadow: 0 4px 16px rgba(3, 105, 161, 0.35), 0 1px 4px rgba(0, 0, 0, 0.15);
        }

        /* Animated background orbs */
        .hero__orb {
          position: absolute; border-radius: 50%; pointer-events: none;
        }
        .hero__orb--1 {
          width: 180px; height: 180px;
          top: -60px; right: -40px;
          background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
          animation: orbFloat1 6s ease-in-out infinite;
        }
        .hero__orb--2 {
          width: 100px; height: 100px;
          bottom: -30px; left: 20px;
          background: radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%);
          animation: orbFloat2 8s ease-in-out infinite;
        }
        .hero__orb--3 {
          width: 60px; height: 60px;
          top: 30px; right: 60px;
          background: radial-gradient(circle, rgba(255,255,255,0.10) 0%, transparent 70%);
          animation: orbFloat3 5s ease-in-out infinite;
        }
        @keyframes orbFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-10px,8px) scale(1.05); } }
        @keyframes orbFloat2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(8px,-6px); } }
        @keyframes orbFloat3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-5px,5px) scale(0.95); } }

        .hero__inner { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }

        /* Top row: live badge + online count */
        .hero__top-row { display: flex; align-items: center; justify-content: space-between; }
        .hero__tag {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.20);
          border: 1px solid rgba(255, 255, 255, 0.30);
          color: #FFFFFF;
          font-size: 11px; font-weight: var(--weight-bold);
          letter-spacing: 0.02em;
          backdrop-filter: blur(4px);
        }
        .hero__live-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #86EFAC;
          box-shadow: 0 0 6px #86EFAC;
          animation: livePulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes livePulse {
          0%,100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.7; }
        }
        .hero__online-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 8px;
          border-radius: var(--radius-full);
          background: rgba(134, 239, 172, 0.20);
          border: 1px solid rgba(134, 239, 172, 0.35);
          color: #86EFAC;
          font-size: 10px; font-weight: var(--weight-bold);
        }

        /* Title & sub */
        .hero__content { display: flex; flex-direction: column; gap: 4px; }
        .hero__title {
          font-family: var(--font-display);
          font-size: 20px; font-weight: var(--weight-heavy);
          color: #FFFFFF; letter-spacing: -0.02em;
          line-height: 1.15;
          text-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .hero__sub {
          font-size: 13px; line-height: 1.4;
          color: rgba(255, 255, 255, 0.85);
        }

        /* Mic ring + CTA button row */
        .hero__cta-row {
          display: flex; align-items: center; gap: 12px;
          margin-top: 2px;
        }
        .hero__mic-ring {
          position: relative; flex-shrink: 0;
          width: 48px; height: 48px;
        }
        .hero__mic-pulse {
          position: absolute; inset: -4px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.4);
          animation: micRingPulse 2s ease-out infinite;
        }
        .hero__mic-pulse::after {
          content: '';
          position: absolute; inset: -6px;
          border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.2);
          animation: micRingPulse 2s ease-out 0.6s infinite;
        }
        @keyframes micRingPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .hero__mic-icon {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.22);
          border: 1.5px solid rgba(255,255,255,0.45);
          border-radius: 50%;
          color: #FFFFFF;
          backdrop-filter: blur(4px);
        }
        .hero__btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 48px;
          background: #FFFFFF;
          color: #0369A1;
          border-radius: var(--radius-md, 14px);
          font-size: 15px; font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
          transition: transform 0.15s var(--ease-out), box-shadow 0.15s var(--ease-out);
          cursor: pointer;
        }
        .hero__btn:active {
          transform: scale(0.97);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        }

        /* ── Mini Stats Row ── */
        .mini-stats {
          display: flex; align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 16px;
          gap: 0;
        }
        .mini-stat {
          flex: 1; display: flex; align-items: center; gap: 10px;
        }
        .mini-stat__divider {
          width: 1px; height: 32px;
          background: var(--border);
          flex-shrink: 0;
          margin: 0 4px;
        }
        .mini-stat__ico {
          width: 30px; height: 30px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; font-size: 14px;
        }
        .mini-stat__ico--blue  { background: rgba(0, 168, 255, 0.14); color: var(--btn-bg); }
        .mini-stat__ico--green { background: rgba(16, 185, 129, 0.14); color: var(--success); }
        .mini-stat__ico--gold  { background: var(--rating-bg); }
        .mini-stat__info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .mini-stat__val  { font-size: 15px; font-weight: var(--weight-heavy); color: var(--text-primary); letter-spacing: -0.3px; }
        .mini-stat__lbl  { font-size: 10px; font-weight: var(--weight-bold); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.06em; }

        /* ── Sections ── */
        .home__section { display: flex; flex-direction: column; gap: var(--space-2); }
        .home__section-head { display: flex; align-items: center; justify-content: space-between; }

        /* ── Toggle Row extras ── */
        .row--on { border-color: var(--btn-bg); }
        .row__arrow { color: var(--text-secondary); flex-shrink: 0; }
        .switch {
          flex-shrink: 0; width: 40px; height: 24px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          position: relative; transition: background var(--t), border-color var(--t);
        }
        .switch::after {
          content: ''; position: absolute; top: 2px; left: 2px;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--text-secondary);
          transition: transform var(--t), background var(--t);
        }
        .switch--on { background: var(--btn-bg); border-color: var(--btn-bg); }
        .switch--on::after { transform: translateX(16px); background: var(--btn-text); }

        /* ── Sessions list ── */
        .home__sessions { display: flex; flex-direction: column; gap: var(--space-1-5); }

        /* ── Empty state ── */
        .home__empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-6) var(--space-5); text-align: center;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
        }
        .home__empty-ico {
          width: 48px; height: 48px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--btn-bg-soft); color: var(--btn-bg);
          margin-bottom: var(--space-1);
        }
        /* ── AI Voice Quick Card ── */
        .home-ai-quick-card {
          position: relative;
          background: linear-gradient(135deg, #047857 0%, #10B981 60%, #06B6D4 100%);
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 20px;
          padding: 16px;
          display: flex; flex-direction: column; gap: 10px;
          box-shadow: 0 8px 24px rgba(16, 185, 129, 0.35);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .home-ai-quick-card:active {
          transform: scale(0.985);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
        }
        .home-ai-quick-top {
          display: flex; align-items: center; justify-content: space-between;
        }
        .home-ai-quick-badge {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; font-weight: 800; color: #a7f3d0;
          background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 3px 9px; border-radius: 20px;
          letter-spacing: 0.05em; text-transform: uppercase;
        }
        .home-ai-quick-free {
          font-size: 10px; font-weight: 800; color: #ffffff;
          background: rgba(255, 255, 255, 0.25);
          padding: 2px 7px; border-radius: 10px; letter-spacing: 0.05em;
        }
        .home-ai-quick-body {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .home-ai-quick-info { flex: 1; min-width: 0; }
        .home-ai-quick-title {
          font-size: 16px; font-weight: 800; color: #ffffff; margin: 0 0 3px 0;
          letter-spacing: -0.01em; line-height: 1.25;
        }
        .home-ai-quick-sub {
          font-size: 12px; color: rgba(255, 255, 255, 0.9); margin: 0;
          line-height: 1.35; font-weight: 500;
        }
        .home-ai-quick-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 30px;
          background: #ffffff; color: #047857;
          font-size: 14px; font-weight: 800; border: none;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
          flex-shrink: 0; cursor: pointer;
        }

        .home__foot { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}


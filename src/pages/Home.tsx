import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import {
  Mic,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Users,
} from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';

/**
 * Bosh sahifa — Oddiy, qulay va toza suhbat markazi.
 */
export default function Home() {
  const {
    user,
    stats,
    recentSessions,
    setStats,
    setRecentSessions,
    setUser,
    navigate,
    homeLoaded,
    setHomeLoaded,
    partnerPref,
    setPartnerPref,
    waitingCount,
  } = useAppStore();
  const t = useT();

  const isFemale = user?.gender === 'female';
  const womenOnly = isFemale && partnerPref === 'female';

  useEffect(() => {
    getMe()
      .then((d) => {
        setStats(d.stats);
        setRecentSessions(d.recentSessions);
        if (d.user) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setHomeLoaded(true));
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
            style={{ marginBottom: '8px' }}
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

        {/* ── ASOSIY QO'NG'IROQ MARKAZI (Hero Card) ── */}
        <section className="hero fade-up">
          <div className="hero__orb hero__orb--1" aria-hidden="true" />
          <div className="hero__orb hero__orb--2" aria-hidden="true" />
          <div className="hero__orb hero__orb--3" aria-hidden="true" />

          <div className="hero__inner">
            {/* Live badge & presence */}
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

            {/* Sarlavha va Tavsif */}
            <div className="hero__content">
              <h1 className="hero__title">
                {t('home.ctaTitle')}
              </h1>
              <p className="hero__sub">
                Erkin muloqot, IELTS, CEFR yoki kundalik mashq uchun darajangizga mos sherik toping
              </p>
            </div>

            {/* Boshqaruv tugmasi: Asosiy Sherik Topish */}
            <button
              type="button"
              className="hero__main-btn"
              onClick={() => {
                tapHaptic('heavy');
                navigate('matching');
              }}
            >
              <div className="hero__mic-ring">
                <div className="hero__mic-pulse" />
                <div className="hero__mic-icon">
                  <Mic size={20} strokeWidth={2.5} />
                </div>
              </div>
              <span>{t('home.start')}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>
          </div>
        </section>

        {/* ── HAMKORLAR E'LONLARI (Listings Board) ── */}
        <button
          type="button"
          className="row fade-up"
          onClick={() => {
            tapHaptic('medium');
            navigate('listings');
          }}
        >
          <span
            className="row__ico"
            style={{ background: 'rgba(255, 159, 10, 0.12)', color: '#FF9F0A' }}
          >
            <Users size={18} aria-hidden="true" />
          </span>
          <span className="row__text">
            <span className="row__title">{t('home.listingsTitle')}</span>
            <span className="row__sub">{t('home.listingsSub')}</span>
          </span>
          <ChevronRight size={18} className="row__arrow" aria-hidden="true" />
        </button>

        {/* ── OXIRGI SUHBATLAR TARIXI ── */}
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
          position: relative; isolation: isolate; overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(135deg, #00A8FF 0%, #0077EE 50%, #0055D4 100%);
          border: 1px solid rgba(255, 255, 255, 0.20);
          border-radius: var(--radius-lg);
          padding: 18px 16px;
          display: flex; flex-direction: column;
          box-shadow: 0 8px 30px rgba(0, 168, 255, 0.35), 0 2px 8px rgba(0, 0, 0, 0.2);
          transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out);
          -webkit-tap-highlight-color: transparent;
        }

        /* Animated background orbs */
        .hero__orb {
          position: absolute; z-index: -1; border-radius: 50%; pointer-events: none;
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

        .hero__inner { display: flex; flex-direction: column; gap: 14px; }

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

        /* CTA main button */
        .hero__main-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          min-height: 50px; width: 100%;
          background: #FFFFFF; color: #0077EE;
          border-radius: var(--radius-md); border: none;
          font-size: 15px; font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
          cursor: pointer;
          transition: transform 0.15s var(--ease-out);
          margin-top: 4px;
        }
        .hero__main-btn:active {
          transform: scale(0.97);
        }
        .hero__mic-ring {
          position: relative; flex-shrink: 0;
          width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
        }
        .hero__mic-pulse {
          position: absolute; inset: -3px;
          border-radius: 50%;
          border: 1.5px solid rgba(0, 119, 238, 0.3);
          animation: micRingPulse 2s ease-out infinite;
        }
        @keyframes micRingPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .hero__mic-icon {
          display: flex; align-items: center; justify-content: center;
          color: #0077EE;
        }

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

        .home__foot { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}

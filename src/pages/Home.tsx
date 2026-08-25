import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Mic, ShieldCheck, Star, ChevronRight } from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import IeltsCard from '../components/IeltsCard';
import PrimeTimeBanner from '../components/PrimeTimeBanner';
import DailyProgress from '../components/DailyProgress';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';

/**
 * Bosh sahifa.
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
        onSettings={() => navigate('settings')}
      />

      <div className="home__scroll">
        <section className="hero fade-up">
          <span className="hero__tag">
            <span className="dot-live" />
            {waitingCount >= 2
              ? t('home.heroLive', { n: waitingCount })
              : waitingCount === 1
                ? t('home.heroLiveOne')
                : t('home.heroTag')}
          </span>

          <h1 className="hero__title">{t('home.ctaTitle')}</h1>
          <p className="hero__sub">{t('home.ctaSub')}</p>

          <button
            className="hero__btn"
            onClick={() => { tapHaptic('medium'); navigate('matching'); }}
          >
            <Mic size={18} strokeWidth={2.5} />
            {t('home.start')}
          </button>
        </section>

        <div className="home__list stagger">
          {/* Prime Time Event Banner */}
          <PrimeTimeBanner />

          {/* IELTS mock */}
          <IeltsCard />

          {/* Kunlik hisoblagich */}
          {!user?.isPremium && (
            <DailyProgress
              dailyMinutes={user?.dailyMinutes || 0}
              dailyLimit={user?.dailyLimit || 0}
              onUpgrade={() => navigate('premium', { from: 'home' })}
            />
          )}

          {/* Xavfsizlik filtri */}
          {isFemale && (
            <button
              type="button"
              className={`row${womenOnly ? ' row--on' : ''}`}
              onClick={() => { selectionHaptic(); setPartnerPref(womenOnly ? 'any' : 'female'); }}
              aria-pressed={womenOnly}
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

        {/* Tarix */}
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
            <span className="home__empty-ico"><Mic size={22} /></span>
            <p className="home__empty-title">{t('home.noSessions')}</p>
            <p className="home__empty-sub">{t('home.noSessionsSub')}</p>
          </section>
        )}

        <div className="home__foot" />
      </div>

      <style>{`
        .home { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .home__scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-5);
        }
        .home__list { display: flex; flex-direction: column; gap: var(--space-2); }

        .hero {
          position: relative; overflow: hidden;
          flex-shrink: 0;
          background: var(--grad-primary);
          border-radius: var(--radius-lg);
          padding: var(--space-4) var(--space-4) var(--space-4);
          display: flex; flex-direction: column; gap: var(--space-2);
          box-shadow: 0 10px 30px rgba(42, 171, 238, 0.28);
        }
        .hero::after {
          content: ''; position: absolute;
          top: -40%; right: -20%; width: 220px; height: 220px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%);
          pointer-events: none;
        }
        .hero > * { position: relative; z-index: 1; }

        .hero__tag {
          display: inline-flex; align-items: center; gap: var(--space-2);
          align-self: flex-start;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.22);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          color: #FFFFFF;
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          letter-spacing: 0.02em;
        }
        .hero__title {
          font-family: var(--font-display);
          font-size: 21px; font-weight: var(--weight-heavy);
          color: #FFFFFF; letter-spacing: -0.02em;
          margin-top: 2px;
          line-height: 1.25;
        }
        .hero__sub {
          font-size: var(--text-sm); line-height: 1.45;
          color: rgba(255, 255, 255, 0.90);
          margin-top: 0px;
        }
        .hero__btn {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          width: 100%; min-height: 48px; margin-top: var(--space-2);
          background: #FFFFFF; color: #1B7DB4;
          border-radius: var(--radius-md);
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
          transition: transform var(--t), opacity var(--t);
        }
        .hero__btn:active { transform: scale(0.98); opacity: 0.92; }

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

        .home__section { display: flex; flex-direction: column; gap: var(--space-2); }
        .home__sessions { display: flex; flex-direction: column; gap: var(--space-1); }

        .home__empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-2);
          padding: var(--space-6) var(--space-5); text-align: center;
        }
        .home__empty-ico {
          width: 48px; height: 48px; border-radius: var(--radius-full);
          display: flex; align-items: center; justify-content: center;
          background: var(--surface-2); color: var(--text-secondary);
          margin-bottom: var(--space-1);
        }
        .home__empty-title { font-size: var(--text-base); font-weight: var(--weight-bold); }
        .home__empty-sub   { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; }

        .home__foot { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}

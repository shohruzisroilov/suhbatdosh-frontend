import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Mic, ShieldCheck, Star, ChevronRight, MessageSquare } from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import PrimeTimeBanner from '../components/PrimeTimeBanner';
import DailyProgress from '../components/DailyProgress';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';

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
        {/* Main Conversation-First Hero */}
        <section className="hero fade-up">
          <div className="hero__glow" />

          <div className="hero__top-row">
            <span className="hero__tag">
              <span className="dot-live" />
              {waitingCount >= 2
                ? t('home.heroLive', { n: waitingCount })
                : waitingCount === 1
                  ? t('home.heroLiveOne')
                  : t('home.heroTag')}
            </span>
          </div>

          <div className="hero__content">
            <h1 className="hero__title">{t('home.ctaTitle')}</h1>
            <p className="hero__sub">{t('home.ctaSub')}</p>
          </div>

          <button
            className="hero__btn"
            onClick={() => { tapHaptic('medium'); navigate('matching'); }}
          >
            <Mic size={20} strokeWidth={2.5} />
            <span>{t('home.start')}</span>
          </button>
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
        .home { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .home__scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-3) var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .home__list { display: flex; flex-direction: column; gap: var(--space-2); }

        .hero {
          position: relative; overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%);
          border: 1px solid rgba(255, 255, 255, 0.35);
          border-radius: var(--radius-lg, 18px);
          padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          box-shadow: 0 6px 20px rgba(14, 165, 233, 0.25);
        }
        .hero__glow {
          position: absolute; top: -30px; right: -30px; width: 130px; height: 130px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent 70%);
          pointer-events: none;
        }
        .hero > * { position: relative; z-index: 1; }

        .hero__top-row { display: flex; align-items: center; justify-content: space-between; }
        .hero__tag {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px;
          border-radius: var(--radius-full);
          background: rgba(255, 255, 255, 0.22);
          border: 1px solid rgba(255, 255, 255, 0.35);
          color: #FFFFFF;
          font-size: 10px; font-weight: var(--weight-bold);
          letter-spacing: 0.02em;
        }

        .hero__content { display: flex; flex-direction: column; gap: 2px; }
        .hero__title {
          font-family: var(--font-display);
          font-size: 16px; font-weight: var(--weight-heavy);
          color: #FFFFFF; letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .hero__sub {
          font-size: 12px; line-height: 1.35;
          color: rgba(255, 255, 255, 0.92);
        }

        .hero__btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%; min-height: 40px;
          background: #FFFFFF;
          color: #0284C7;
          border-radius: var(--radius-md, 12px);
          font-size: 14px; font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
          transition: transform var(--t), opacity var(--t), box-shadow var(--t);
          cursor: pointer;
        }
        .hero__btn:active { transform: scale(0.975); opacity: 0.92; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }

        .home__section { display: flex; flex-direction: column; gap: var(--space-2); }
        .home__section-head { display: flex; align-items: center; justify-content: space-between; }

        .topics-carousel {
          display: flex; gap: var(--space-2.5, 10px);
          overflow-x: auto; scrollbar-width: none;
          padding-bottom: 4px;
          margin: 0 calc(var(--space-4) * -1);
          padding-left: var(--space-4); padding-right: var(--space-4);
        }
        .topics-carousel::-webkit-scrollbar { display: none; }

        .topic-card {
          flex: 0 0 160px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: flex; flex-direction: column; gap: 8px;
          cursor: pointer;
          transition: border-color var(--t), transform var(--t);
        }
        .topic-card:active { transform: scale(0.96); border-color: var(--btn-bg); }
        .topic-card__emoji { font-size: 24px; line-height: 1; }
        .topic-card__content { display: flex; flex-direction: column; gap: 2px; }
        .topic-card__title { font-size: 13px; font-weight: var(--weight-bold); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .topic-card__desc { font-size: 10px; color: var(--text-secondary); line-height: 1.3; height: 26px; overflow: hidden; }

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

        .home__sessions { display: flex; flex-direction: column; gap: var(--space-1-5); }

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
        .home__empty-title { font-size: var(--text-base); font-weight: var(--weight-bold); }
        .home__empty-sub   { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; }

        .home__foot { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}


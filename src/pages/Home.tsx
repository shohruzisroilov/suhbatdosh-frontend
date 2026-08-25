import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Mic, ShieldCheck, Star, ChevronRight, Compass, MessageSquare } from 'lucide-react';

import HomeHeader from '../components/HomeHeader';
import PrimeTimeBanner from '../components/PrimeTimeBanner';
import DailyProgress from '../components/DailyProgress';
import SessionRow from '../components/SessionRow';
import SkeletonRow from '../components/SkeletonRow';

const TOPICS = [
  { id: '1', title: 'Travel & Culture', emoji: '✈️', desc: 'Share your favorite trip stories' },
  { id: '2', title: 'Hometown & Life', emoji: '🏡', desc: 'Talk about where you grew up' },
  { id: '3', title: 'Movies & Music', emoji: '🎬', desc: 'Discuss your favorite films' },
  { id: '4', title: 'Career & Ambition', emoji: '🚀', desc: 'Future goals and dream job' },
];

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

          <div className="hero__top">
            <span className="hero__tag">
              <span className="dot-live" />
              {waitingCount >= 2
                ? t('home.heroLive', { n: waitingCount })
                : waitingCount === 1
                  ? t('home.heroLiveOne')
                  : t('home.heroTag')}
            </span>
          </div>

          <h1 className="hero__title">{t('home.ctaTitle')}</h1>
          <p className="hero__sub">{t('home.ctaSub')}</p>

          <button
            className="hero__btn"
            onClick={() => { tapHaptic('medium'); navigate('matching'); }}
          >
            <span className="hero__btn-icon">
              <Mic size={22} strokeWidth={2.5} />
            </span>
            <span className="hero__btn-text">{t('home.start')}</span>
          </button>
        </section>

        {/* Quick Conversation Topics Carousel */}
        <section className="home__section fade-up">
          <div className="home__section-head">
            <span className="eyebrow flex items-center gap-1">
              <Compass size={13} className="text-[var(--btn-bg)]" />
              Practice Topics
            </span>
          </div>

          <div className="topics-carousel">
            {TOPICS.map((topic) => (
              <div
                key={topic.id}
                className="topic-card"
                onClick={() => { tapHaptic('light'); navigate('matching'); }}
              >
                <span className="topic-card__emoji">{topic.emoji}</span>
                <div className="topic-card__content">
                  <span className="topic-card__title">{topic.title}</span>
                  <span className="topic-card__desc">{topic.desc}</span>
                </div>
              </div>
            ))}
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
          padding: var(--space-4) var(--space-4) calc(90px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        .home__list { display: flex; flex-direction: column; gap: var(--space-2); }

        .hero {
          position: relative; overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(145deg, #0A2540 0%, #001220 100%);
          border: 1px solid rgba(0, 168, 255, 0.25);
          border-radius: var(--radius-xl);
          padding: var(--space-5) var(--space-4) var(--space-5);
          display: flex; flex-direction: column; gap: var(--space-2);
          box-shadow: 0 12px 36px rgba(0, 168, 255, 0.18);
        }
        .hero__glow {
          position: absolute; top: -50%; right: -25%; width: 280px; height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 168, 255, 0.35), transparent 70%);
          pointer-events: none;
        }
        .hero > * { position: relative; z-index: 1; }

        .hero__tag {
          display: inline-flex; align-items: center; gap: var(--space-2);
          align-self: flex-start;
          padding: 4px 12px;
          border-radius: var(--radius-full);
          background: rgba(0, 168, 255, 0.18);
          border: 1px solid rgba(0, 168, 255, 0.3);
          color: #38BDF8;
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          letter-spacing: 0.02em;
        }
        .hero__title {
          font-family: var(--font-display);
          font-size: 22px; font-weight: var(--weight-heavy);
          color: #FFFFFF; letter-spacing: -0.02em;
          margin-top: 4px;
          line-height: 1.25;
        }
        .hero__sub {
          font-size: var(--text-sm); line-height: 1.45;
          color: rgba(255, 255, 255, 0.85);
          margin-top: 0px;
        }
        .hero__btn {
          display: flex; align-items: center; justify-content: center; gap: var(--space-3);
          width: 100%; min-height: 54px; margin-top: var(--space-3);
          background: var(--grad-primary); color: #FFFFFF;
          border-radius: var(--radius-md);
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          letter-spacing: -0.01em;
          box-shadow: 0 6px 24px rgba(0, 168, 255, 0.45);
          transition: transform var(--t), opacity var(--t), box-shadow var(--t);
        }
        .hero__btn:active { transform: scale(0.975); opacity: 0.92; box-shadow: 0 3px 12px rgba(0, 168, 255, 0.3); }
        .hero__btn-icon {
          display: flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
        }

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


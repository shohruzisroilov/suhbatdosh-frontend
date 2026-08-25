import { useEffect } from 'react';
import { getMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import { BarChart3, ChevronRight, LifeBuoy, MessageSquare, Star } from 'lucide-react';

const SUPPORT_URL = 'https://t.me/Shohruz_Isroilov';

function openSupport() {
  const wa = window.Telegram?.WebApp;
  if (wa?.openTelegramLink) wa.openTelegramLink(SUPPORT_URL);
  else window.open(SUPPORT_URL, '_blank', 'noopener');
}

function formatDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <ChevronRight
      size={16}
      className={`profile__chev${open ? ' profile__chev--open' : ''}`}
    />
  );
}

export default function Profile() {
  const { user, setStats, setRecentSessions, setUser, navigate,
          setHomeLoaded } = useAppStore();
  const t = useT();

  useEffect(() => {
    getMe().then(d => {
      setStats(d.stats);
      setRecentSessions(d.recentSessions);
      if (d.user) setUser(d.user);
    }).catch(() => {}).finally(() => setHomeLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPremium = !!user?.isPremium;
  const premiumUntil = formatDate(user?.premiumUntil);

  return (
    <div className="profile">
      <div className="profile__scroll">
        <div className="profile__hero">
          <Avatar name={user?.displayName} avatarUrl={user?.avatarUrl} size={84} />
          <h1 className="profile__name">{user?.displayName || t('common.anonymous')}</h1>
          {user?.username && <p className="profile__username">@{user.username}</p>}
          {isPremium && (
            <span className="profile__premium-badge">
              <Star size={11} fill="currentColor" strokeWidth={0} /> {t('profile.premium')}
            </span>
          )}
        </div>

        <div className="profile__card">
          <button
            className="profile__row"
            onClick={() => { tapHaptic('light'); navigate('statistics', { from: 'profile' }); }}
          >
            <span className="profile__row-ico"><BarChart3 size={18} /></span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.stats')}</span>
              <span className="profile__row-sub">{t('profile.statsSub')}</span>
            </div>
            <Chevron />
          </button>

          <button
            className="profile__row"
            onClick={() => { if (!isPremium) { tapHaptic('light'); navigate('premium', { from: 'profile' }); } }}
            disabled={isPremium}
          >
            <span className="profile__row-ico"><Star size={18} /></span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.plan')}</span>
              <span className="profile__row-sub">
                {isPremium ? t('profile.unlimited') : t('profile.freeSub')}
              </span>
            </div>
            <span className="profile__row-val">
              {isPremium
                ? (premiumUntil ? t('profile.premiumUntil', { date: premiumUntil }) : t('profile.premium'))
                : t('profile.free')}
            </span>
            {!isPremium && <Chevron />}
          </button>

          <button
            className="profile__row"
            onClick={() => { tapHaptic('light'); navigate('reviews'); }}
          >
            <span className="profile__row-ico"><MessageSquare size={18} /></span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.reviews')}</span>
              <span className="profile__row-sub">{t('profile.reviewsSub')}</span>
            </div>
            <Chevron />
          </button>

          <button
            className="profile__row"
            onClick={() => { tapHaptic('light'); openSupport(); }}
          >
            <span className="profile__row-ico"><LifeBuoy size={18} /></span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.support')}</span>
              <span className="profile__row-sub">{t('profile.supportSub')}</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="profile__footer" />
      </div>

      <style>{`
        .profile { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .profile__scroll {
          flex: 1; overflow-y: auto;
          padding: calc(var(--space-5) + env(safe-area-inset-top, 0px)) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
        }

        .profile__hero {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-1-5);
          padding: var(--space-2) 0 var(--space-1);
        }
        .profile__name { font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.4px; text-align: center; }
        .profile__username { font-size: var(--text-sm); color: var(--text-secondary); margin-top: calc(var(--space-0-5) * -1); }
        .profile__premium-badge {
          margin-top: var(--space-1); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full);
          background: var(--btn-bg); color: var(--btn-text);
          font-size: var(--text-sm); font-weight: var(--weight-heavy); letter-spacing: 0.2px;
        }

        .profile__card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .profile__row {
          display: flex; align-items: center; gap: var(--space-3);
          width: 100%; text-align: left;
          padding: var(--space-4) var(--space-4);
          border-bottom: 1px solid var(--border);
          transition: opacity var(--t);
        }
        .profile__row:last-child { border-bottom: none; }
        .profile__row:active:not(:disabled) { opacity: 0.6; }
        .profile__row:disabled { cursor: default; }
        .profile__row-ico { font-size: var(--text-lg); flex-shrink: 0; width: 24px; text-align: center; }
        .profile__row-text { flex: 1; display: flex; flex-direction: column; gap: var(--space-0-5); min-width: 0; }
        .profile__row-title { font-size: var(--text-base); font-weight: var(--weight-bold); color: var(--text-primary); }
        .profile__row-sub { font-size: var(--text-sm); color: var(--text-secondary); }
        .profile__row-val {
          font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-secondary);
          white-space: nowrap; flex-shrink: 0;
        }
        .profile__row-val--accent { color: var(--btn-bg); font-weight: var(--weight-heavy); }
        .profile__chev { color: var(--text-secondary); flex-shrink: 0; opacity: 0.6; }

        .profile__since {
          text-align: center; font-size: var(--text-sm); color: var(--text-secondary);
          padding: var(--space-0-5) 0;
        }

        .profile__section { display: flex; flex-direction: column; gap: var(--space-1-5); margin-top: var(--space-1); }
        .profile__section-title {
          font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px; padding: 0 var(--space-1);
        }
        .profile__list { display: flex; flex-direction: column; gap: var(--space-1); }
        .profile__empty {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-1-5);
          padding: var(--space-6) var(--space-5); text-align: center; color: var(--text-secondary);
        }
        .profile__empty span { font-size: 40px; opacity: 0.5; }
        .profile__empty p { font-size: var(--text-base); }
        .profile__footer { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}

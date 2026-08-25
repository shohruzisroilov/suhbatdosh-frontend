import { useEffect, useState } from 'react';
import { getMe, getMyRatings, updateMe } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import {
  Check,
  ChevronRight,
  Clock,
  Gauge,
  LifeBuoy,
  MessageSquare,
  Star,
  User as UserIcon,
  Users,
  X,
} from 'lucide-react';

const SUPPORT_URL = 'https://t.me/Shohruz_Isroilov';

const LEVELS = [1, 2, 3, 4, 5, 6];

const GENDERS = [
  { v: 'female', key: 'gender.female' },
  { v: 'male', key: 'gender.male' },
  { v: 'skip', key: 'gender.notSay' },
];

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

function formatPracticeTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <ChevronRight
      size={14}
      className={`profile__chev${open ? ' profile__chev--open' : ''}`}
    />
  );
}

interface RatingItem {
  id: string;
  score: number;
  created_at: string;
  rater_name: string | null;
  rater_avatar_url: string | null;
}

export default function Profile() {
  const { user, stats, setStats, setRecentSessions, setUser, navigate, setHomeLoaded } = useAppStore();
  const t = useT();

  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);

  const [ratingsList, setRatingsList] = useState<RatingItem[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);

  useEffect(() => {
    getMe()
      .then((d) => {
        setStats(d.stats);
        setRecentSessions(d.recentSessions);
        if (d.user) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setHomeLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRatings = () => {
    tapHaptic('light');
    setShowRatingsModal(true);
    setLoadingRatings(true);
    getMyRatings()
      .then((d) => {
        setRatingsList(d.ratings || []);
      })
      .catch(() => {})
      .finally(() => setLoadingRatings(false));
  };

  const pickLevel = (v: number) => {
    if (!user || v === user.level) return;
    selectionHaptic();
    setUser({ ...user, level: v });
    updateMe({ level: v }).catch(() => {});
    setShowLevelModal(false);
  };

  const pickGender = (v: string) => {
    const next = v === 'skip' ? null : v;
    if (!user || next === user.gender) return;
    selectionHaptic();
    setUser({ ...user, gender: next });
    updateMe({ gender: next ?? '' }).catch(() => {});
    setShowGenderModal(false);
  };

  const isPremium = !!user?.isPremium;
  const premiumUntil = formatDate(user?.premiumUntil);

  const level = user?.level || 1;
  const gender = user?.gender || null;

  const avgRatingNum = Number(stats.avg_rating || 0).toFixed(1);
  const ratingCount = stats.rating_count || 0;
  const uniquePartners = stats.unique_partners || 0;
  const totalMinutes = stats.total_minutes || 0;

  return (
    <div className="profile">
      <div className="profile__scroll">
        {/* User Hero Header */}
        <div className="profile__hero">
          <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={54} />
          <h1 className="profile__name">{user?.displayName || t('common.anonymous')}</h1>
          {user?.username && <p className="profile__username">@{user.username}</p>}
          {isPremium && (
            <span className="profile__premium-badge">
              <Star size={9} fill="currentColor" strokeWidth={0} /> {t('profile.premium')}
            </span>
          )}
        </div>

        {/* Quick Interactive Stats Grid */}
        <div className="profile__stats-grid">
          <div
            className="profile__stat-box profile__stat-box--clickable"
            onClick={() => {
              tapHaptic('light');
              navigate('statistics', { from: 'profile' });
            }}
          >
            <span className="profile__stat-icon profile__stat-icon--time">
              <Clock size={13} />
            </span>
            <span className="profile__stat-value">{formatPracticeTime(totalMinutes)}</span>
            <span className="profile__stat-label">{t('profile.timeTalked')}</span>
          </div>

          <div className="profile__stat-box">
            <span className="profile__stat-icon profile__stat-icon--users">
              <Users size={13} />
            </span>
            <span className="profile__stat-value">{uniquePartners}</span>
            <span className="profile__stat-label">{t('profile.partners')}</span>
          </div>

          <div
            className="profile__stat-box profile__stat-box--clickable"
            onClick={openRatings}
          >
            <span className="profile__stat-icon profile__stat-icon--star">
              <Star size={13} fill="currentColor" />
            </span>
            <span className="profile__stat-value">{avgRatingNum} ★</span>
            <span className="profile__stat-label">
              {ratingCount} {ratingCount === 1 ? 'rating' : 'ratings'}
            </span>
          </div>
        </div>

        {/* Settings Section */}
        <div className="profile__section-header">{t('settings.title')}</div>
        <div className="profile__card">
          {/* Level Row */}
          <button className="profile__row" onClick={() => { tapHaptic('light'); setShowLevelModal(true); }}>
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--blue">
              <Gauge size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('settings.levelTitle')}</span>
              <span className="profile__row-sub">
                {t(`level.${level}`)} · {t(`levelName.${level}`)}
              </span>
            </div>
            <Chevron />
          </button>

          {/* Gender Row */}
          <button className="profile__row" onClick={() => { tapHaptic('light'); setShowGenderModal(true); }}>
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--purple">
              <UserIcon size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('settings.genderTitle')}</span>
              <span className="profile__row-sub">
                {gender ? t(`gender.${gender}`) : t('settings.genderNotSet')}
              </span>
            </div>
            <Chevron />
          </button>
        </div>

        {/* Account & Support Section */}
        <div className="profile__section-header">Account</div>
        <div className="profile__card">
          {/* Subscription / Plan Row */}
          <button
            className="profile__row"
            onClick={() => {
              if (!isPremium) {
                tapHaptic('light');
                navigate('premium', { from: 'profile' });
              }
            }}
            disabled={isPremium}
          >
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--amber">
              <Star size={14} />
            </span>
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

          {/* Community Reviews Row */}
          <button
            className="profile__row"
            onClick={() => {
              tapHaptic('light');
              navigate('reviews');
            }}
          >
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--cyan">
              <MessageSquare size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.reviews')}</span>
              <span className="profile__row-sub">{t('profile.reviewsSub')}</span>
            </div>
            <Chevron />
          </button>

          {/* Support Row */}
          <button
            className="profile__row"
            onClick={() => {
              tapHaptic('light');
              openSupport();
            }}
          >
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--rose">
              <LifeBuoy size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.support')}</span>
              <span className="profile__row-sub">{t('profile.supportSub')}</span>
            </div>
            <Chevron />
          </button>
        </div>

        <div className="profile__footer" />
      </div>

      {/* Level Selector Modal */}
      {showLevelModal && (
        <div className="ratings-modal-backdrop" onClick={() => setShowLevelModal(false)}>
          <div className="ratings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ratings-modal__head">
              <h2 className="ratings-modal__title">{t('settings.levelTitle')}</h2>
              <button type="button" className="ratings-modal__close" onClick={() => setShowLevelModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="ratings-modal__body">
              <div className="profile__modal-list">
                {LEVELS.map((lv) => {
                  const selected = level === lv;
                  return (
                    <div
                      key={lv}
                      className={`profile__modal-option${selected ? ' profile__modal-option--selected' : ''}`}
                      onClick={() => pickLevel(lv)}
                    >
                      <div className="profile__level-badge">{t(`level.${lv}`)}</div>
                      <div className="profile__modal-option-text">
                        <span className="profile__modal-option-title">{t(`levelName.${lv}`)}</span>
                        <span className="profile__modal-option-sub">{t(`ob.level${lv}.sub`)}</span>
                      </div>
                      {selected && <Check size={16} className="profile__modal-check" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gender Selector Modal */}
      {showGenderModal && (
        <div className="ratings-modal-backdrop" onClick={() => setShowGenderModal(false)}>
          <div className="ratings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ratings-modal__head">
              <h2 className="ratings-modal__title">{t('settings.genderTitle')}</h2>
              <button type="button" className="ratings-modal__close" onClick={() => setShowGenderModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="ratings-modal__body">
              <div className="profile__modal-list">
                {GENDERS.map((g) => {
                  const selected = (g.v === 'skip' ? null : g.v) === gender;
                  return (
                    <div
                      key={g.v}
                      className={`profile__modal-option${selected ? ' profile__modal-option--selected' : ''}`}
                      onClick={() => pickGender(g.v)}
                    >
                      <span className="profile__modal-option-title">{t(g.key)}</span>
                      {selected && <Check size={16} className="profile__modal-check" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partner Ratings Modal */}
      {showRatingsModal && (
        <div className="ratings-modal-backdrop" onClick={() => setShowRatingsModal(false)}>
          <div className="ratings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ratings-modal__head">
              <h2 className="ratings-modal__title">{t('profile.ratingsModalTitle')}</h2>
              <button
                type="button"
                className="ratings-modal__close"
                onClick={() => setShowRatingsModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="ratings-modal__body">
              {loadingRatings ? (
                <div className="ratings-modal__loading">Loading ratings…</div>
              ) : ratingsList.length > 0 ? (
                <div className="ratings-modal__list">
                  {ratingsList.map((item) => (
                    <div key={item.id} className="ratings-modal__item">
                      <Avatar name={item.rater_name || undefined} avatarUrl={item.rater_avatar_url || undefined} size={34} />
                      <div className="ratings-modal__info">
                        <span className="ratings-modal__name">
                          {item.rater_name || t('common.anonymous')}
                        </span>
                        <span className="ratings-modal__date">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="ratings-modal__stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            fill={star <= item.score ? '#f59e0b' : 'none'}
                            color={star <= item.score ? '#f59e0b' : 'var(--text-secondary)'}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ratings-modal__empty">
                  <Star size={28} color="var(--text-secondary)" opacity={0.5} />
                  <p>{t('profile.noRatingsYet')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .profile { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }
        .profile__scroll {
          flex: 1; overflow-y: auto;
          padding: calc(var(--space-2) + env(safe-area-inset-top, 0px)) var(--space-3) calc(110px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-1-5);
        }

        .profile__hero {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          padding: 2px 0;
        }
        .profile__name { font-size: 16px; font-weight: var(--weight-heavy); letter-spacing: -0.3px; text-align: center; }
        .profile__username { font-size: 11px; color: var(--text-secondary); margin-top: -2px; }
        .profile__premium-badge {
          margin-top: 2px; padding: 2px 8px; border-radius: var(--radius-full);
          background: var(--btn-bg); color: var(--btn-text);
          font-size: 10px; font-weight: var(--weight-heavy); letter-spacing: 0.2px;
          display: inline-flex; align-items: center; gap: 3px;
        }

        .profile__stats-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 2px;
        }
        .profile__stat-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md, 10px);
          padding: 6px 4px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
          gap: 1px;
          transition: transform 0.15s, border-color 0.15s;
        }
        .profile__stat-box--clickable { cursor: pointer; }
        .profile__stat-box--clickable:active { transform: scale(0.96); border-color: var(--btn-bg); }
        .profile__stat-icon {
          width: 22px; height: 22px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
        }
        .profile__stat-icon--time { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
        .profile__stat-icon--users { background: rgba(168, 85, 247, 0.12); color: #a855f7; }
        .profile__stat-icon--star { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }

        .profile__stat-value { font-size: 13px; font-weight: var(--weight-heavy); color: var(--text-primary); }
        .profile__stat-label { font-size: 10px; color: var(--text-secondary); }

        .profile__section-header {
          font-size: 10px; font-weight: var(--weight-bold);
          color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.6px;
          padding: 2px 4px 0;
        }

        .profile__card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md, 10px);
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .profile__row {
          display: flex; align-items: center; gap: 8px;
          width: 100%; text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
          transition: background-color 0.15s, opacity 0.15s;
          border-top: none; border-left: none; border-right: none;
          background: transparent; cursor: pointer;
        }
        .profile__row:last-child { border-bottom: none; }
        .profile__row:active:not(:disabled) { opacity: 0.7; background: rgba(255, 255, 255, 0.03); }
        .profile__row:disabled { cursor: default; }

        .profile__row-icon-wrapper {
          width: 26px; height: 26px; border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .profile__row-icon-wrapper--blue { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
        .profile__row-icon-wrapper--purple { background: rgba(168, 85, 247, 0.12); color: #a855f7; }
        .profile__row-icon-wrapper--amber { background: rgba(245, 158, 11, 0.12); color: #f59e0b; }
        .profile__row-icon-wrapper--cyan { background: rgba(6, 182, 212, 0.12); color: #06b6d4; }
        .profile__row-icon-wrapper--rose { background: rgba(244, 63, 94, 0.12); color: #f43f5e; }

        .profile__row-text { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .profile__row-title { font-size: 13px; font-weight: var(--weight-bold); color: var(--text-primary); }
        .profile__row-sub { font-size: 10px; color: var(--text-secondary); }
        .profile__row-val {
          font-size: 10px; font-weight: var(--weight-bold); color: var(--text-secondary);
          white-space: nowrap; flex-shrink: 0;
        }
        .profile__chev { color: var(--text-secondary); flex-shrink: 0; opacity: 0.6; }
        .profile__footer { height: 30px; }

        /* Modals */
        .ratings-modal-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .ratings-modal {
          width: 100%; max-width: 500px; max-height: 80vh;
          background: var(--bg); border-top-left-radius: var(--radius-lg, 16px); border-top-right-radius: var(--radius-lg, 16px);
          border: 1px solid var(--border); border-bottom: none;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.2);
        }
        .ratings-modal__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border);
        }
        .ratings-modal__title { font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--text-primary); }
        .ratings-modal__close {
          background: none; border: none; color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-1); cursor: pointer; border-radius: var(--radius-full);
        }
        .ratings-modal__close:active { opacity: 0.6; }

        .ratings-modal__body { flex: 1; overflow-y: auto; padding: var(--space-3); }
        .ratings-modal__loading { text-align: center; padding: var(--space-6); color: var(--text-secondary); font-size: var(--text-sm); }
        .ratings-modal__list { display: flex; flex-direction: column; gap: var(--space-2); }
        .ratings-modal__item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-2-5, 10px); background: var(--bg-secondary);
          border: 1px solid var(--border); border-radius: var(--radius-md);
        }
        .ratings-modal__info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .ratings-modal__name { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-primary); }
        .ratings-modal__date { font-size: var(--text-xs); color: var(--text-secondary); }
        .ratings-modal__stars { display: flex; align-items: center; gap: 2px; }

        .ratings-modal__empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-2); padding: var(--space-8) var(--space-4); text-align: center; color: var(--text-secondary);
        }

        .profile__modal-list { display: flex; flex-direction: column; gap: var(--space-2); }
        .profile__modal-option {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-md); cursor: pointer; transition: border-color 0.15s;
        }
        .profile__modal-option--selected { border-color: var(--btn-bg); }
        .profile__level-badge {
          font-family: monospace; font-weight: var(--weight-heavy);
          color: var(--btn-bg); font-size: var(--text-sm); min-width: 28px; text-align: center;
        }
        .profile__modal-option-text { flex: 1; display: flex; flex-direction: column; gap: 1px; }
        .profile__modal-option-title { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-primary); }
        .profile__modal-option-sub { font-size: var(--text-xs); color: var(--text-secondary); }
        .profile__modal-check { color: var(--btn-bg); flex-shrink: 0; }
      `}</style>
    </div>
  );
}

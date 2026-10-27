import { useEffect, useState } from 'react';
import { getMe, getMyRatings, updateMe } from '../api/endpoints';
import Modal from '../components/Modal';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic, tapHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import {
  Check,
  ChevronRight,
  Clock,
  Gift,
  LifeBuoy,
  MessageSquare,
  SlidersHorizontal,
  Star,
  Users,
  X,
} from 'lucide-react';

const SUPPORT_URL = 'https://t.me/Shohruz_Isroilov';

const LEVELS = [1, 2, 3, 4, 5, 6];


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
          <div className="profile__avatar-ring">
            <div className="profile__avatar-ring-inner">
              <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={58} />
            </div>
          </div>
          <h1 className="profile__name">{user?.displayName || t('common.anonymous')}</h1>
          {user?.username && <p className="profile__username">@{user.username}</p>}

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

        {/* Settings Section — one door, not three.
            Level and gender used to live here AND inside Settings, so opening
            "Notifications" from Profile landed on a menu repeating rows the user had
            just scrolled past. Settings now owns all three preferences; the level is
            still one tap away from the home header. */}
        <div className="profile__section-header">{t('settings.title')}</div>
        <div className="profile__card">
          <button
            className="profile__row"
            onClick={() => { tapHaptic('light'); navigate('settings', { from: 'profile' }); }}
          >
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--slate">
              <SlidersHorizontal size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('settings.title')}</span>
              <span className="profile__row-sub">{t('profile.settingsSub')}</span>
            </div>
            <span className="profile__row-val">{t(`level.${level}`)}</span>
            <Chevron />
          </button>
        </div>

        {/* Account & Support Section */}
        <div className="profile__section-header">Account</div>
        <div className="profile__card">
          {/* Subscription / Plan Row - 100% Free & Unlimited */}
          <div className="profile__row" style={{ cursor: 'default' }}>
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--green">
              <Check size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('profile.plan')}</span>
              <span className="profile__row-sub">
                {t('profile.unlimited')}
              </span>
            </div>
            <span className="profile__row-val" style={{ color: 'var(--success, #34C759)' }}>
              Free &amp; Unlimited
            </span>
          </div>

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

          {/* Invite Row — moved out of the bottom nav; a referral link is something
              you reach for occasionally, not every session. */}
          <button
            className="profile__row"
            onClick={() => { tapHaptic('light'); navigate('invite', { from: 'profile' }); }}
          >
            <span className="profile__row-icon-wrapper profile__row-icon-wrapper--green">
              <Gift size={14} />
            </span>
            <div className="profile__row-text">
              <span className="profile__row-title">{t('nav.invite')}</span>
              <span className="profile__row-sub">{t('profile.inviteSub')}</span>
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

      {/* Partner Ratings Modal */}
      {showRatingsModal && (
        <Modal
          isOpen
          onClose={() => setShowRatingsModal(false)}
          backdropClassName="ratings-modal-backdrop"
          className="ratings-modal"
          labelledBy="profile-ratings-title"
        >
            <div className="ratings-modal__handle" aria-hidden="true" />
            <div className="ratings-modal__head">
              <h2 className="ratings-modal__title" id="profile-ratings-title">{t('profile.ratingsModalTitle')}</h2>
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
        </Modal>
      )}

      <style>{`
        .profile {
          display: flex; flex-direction: column;
          height: 100%; background: var(--bg);
          /* overflow: hidden EMAS — scroll kerakli */
        }
        .profile__scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding: var(--space-3) var(--space-4) calc(140px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: 12px;
        }

        .profile__hero {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 12px 0 4px;
        }
        .profile__avatar-ring {
          position: relative;
          padding: 3px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--btn-bg), #0066FF);
          margin-bottom: 4px;
        }
        .profile__avatar-ring-inner {
          padding: 2px;
          border-radius: 50%;
          background: var(--bg);
        }
        .profile__name { font-size: 19px; font-weight: var(--weight-heavy); letter-spacing: -0.4px; text-align: center; color: var(--text-primary); }
        .profile__username { font-size: 12px; color: var(--text-secondary); margin-top: -2px; }
        .profile__premium-badge {
          margin-top: 2px; padding: 3px 12px; border-radius: var(--radius-full);
          background: linear-gradient(135deg, #FFD700, #FF9500);
          color: #1a1000;
          font-size: 10px; font-weight: var(--weight-heavy); letter-spacing: 0.3px;
          display: inline-flex; align-items: center; gap: 4px;
          box-shadow: 0 3px 10px rgba(255, 215, 0, 0.3);
        }

        .profile__stats-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 2px;
        }
        .profile__stat-box {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 8px;
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
          gap: 4px;
          transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
        }
        .profile__stat-box--clickable { cursor: pointer; }
        .profile__stat-box--clickable:active { transform: scale(0.95); border-color: var(--btn-bg); box-shadow: 0 4px 14px rgba(0,168,255,0.15); }
        .profile__stat-icon {
          width: 28px; height: 28px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center; margin-bottom: 2px;
        }
        .profile__stat-icon--time  { background: rgba(59, 130, 246, 0.14); color: #3b82f6; }
        .profile__stat-icon--users { background: rgba(168, 85, 247, 0.14); color: #a855f7; }
        .profile__stat-icon--star  { background: rgba(245, 158, 11, 0.14); color: #f59e0b; }

        .profile__stat-value { font-size: 15px; font-weight: var(--weight-heavy); color: var(--text-primary); letter-spacing: -0.3px; }
        .profile__stat-label { font-size: 10px; color: var(--text-secondary); font-weight: var(--weight-bold); text-transform: uppercase; letter-spacing: 0.05em; }

        .profile__section-header {
          font-size: 11px; font-weight: var(--weight-bold);
          color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em;
          padding: 4px 2px 0;
        }

        .profile__card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          /* overflow: hidden OLIB TASHLANDI — row clipping muammosi */
          display: flex; flex-direction: column;
        }
        .profile__row {
          display: flex; align-items: center; gap: 12px;
          width: 100%; text-align: left;
          padding: 14px 14px;
          border-bottom: 1px solid var(--border);
          transition: background-color 0.15s, opacity 0.15s;
          border-top: none; border-left: none; border-right: none;
          background: transparent; cursor: pointer;
          /* Birinchi va oxirgi row uchun radius */
        }
        .profile__row:first-child {
          border-radius: calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px) 0 0;
        }
        .profile__row:last-child {
          border-bottom: none;
          border-radius: 0 0 calc(var(--radius-md) - 1px) calc(var(--radius-md) - 1px);
        }
        .profile__row:only-child {
          border-radius: calc(var(--radius-md) - 1px);
        }
        .profile__row:active:not(:disabled) { background: var(--surface-2); }
        .profile__row:disabled { cursor: default; opacity: 0.8; }

        .profile__row-icon-wrapper {
          width: 34px; height: 34px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .profile__row-icon-wrapper--blue   { background: rgba(59, 130, 246, 0.14); color: #3b82f6; }
        .profile__row-icon-wrapper--purple { background: rgba(168, 85, 247, 0.14); color: #a855f7; }
        .profile__row-icon-wrapper--amber  { background: rgba(245, 158, 11, 0.14);  color: #f59e0b; }
        .profile__row-icon-wrapper--cyan   { background: rgba(6, 182, 212, 0.14);   color: #06b6d4; }
        .profile__row-icon-wrapper--rose   { background: rgba(244, 63, 94, 0.14);   color: #f43f5e; }
        .profile__row-icon-wrapper--slate  { background: rgba(148, 163, 184, 0.14); color: #94a3b8; }
        .profile__row-icon-wrapper--green  { background: var(--success-bg);          color: var(--success); }

        .profile__row-text { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .profile__row-title { font-size: 14px; font-weight: var(--weight-bold); color: var(--text-primary); }
        .profile__row-sub { font-size: 11px; color: var(--text-secondary); line-height: 1.35; }
        .profile__row-val {
          font-size: 11px; font-weight: var(--weight-bold); color: var(--text-secondary);
          white-space: nowrap; flex-shrink: 0;
        }
        .profile__chev { color: var(--text-tertiary); flex-shrink: 0; }
        .profile__footer { padding-bottom: 20px; }

        /* Bottom Sheet Modals */
        .ratings-modal-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(6px);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .ratings-modal {
          width: 100%; max-width: 500px; max-height: 82vh;
          background: var(--bg-secondary);
          border-radius: 24px 24px 0 0;
          border: 1px solid var(--border-strong); border-bottom: none;
          display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.28s var(--ease-spring) both;
        }
        .ratings-modal__handle {
          width: 40px; height: 4px; border-radius: 2px;
          background: var(--border-strong); margin: 12px auto 4px;
          flex-shrink: 0;
        }
        .ratings-modal__head {
          display: flex; align-items: center; justify-content: space-between;
          padding: var(--space-2) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
        }
        .ratings-modal__title { font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--text-primary); }
        .ratings-modal__close {
          background: none; border: none; color: var(--text-secondary);
          display: flex; align-items: center; justify-content: center;
          padding: var(--space-1); cursor: pointer; border-radius: var(--radius-full);
          width: 30px; height: 30px;
          background: var(--surface-2);
        }
        .ratings-modal__close:active { opacity: 0.6; }

        .ratings-modal__body { flex: 1; overflow-y: auto; padding: var(--space-3); }
        .ratings-modal__loading { text-align: center; padding: var(--space-6); color: var(--text-secondary); font-size: var(--text-sm); }
        .ratings-modal__list { display: flex; flex-direction: column; gap: var(--space-2); }
        .ratings-modal__item {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3); background: var(--surface-2);
          border: 1px solid var(--border); border-radius: var(--radius-md);
        }
        .ratings-modal__info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .ratings-modal__name { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-primary); }
        .ratings-modal__date { font-size: var(--text-xs); color: var(--text-secondary); }
        .ratings-modal__stars { display: flex; align-items: center; gap: 2px; }

        .ratings-modal__empty {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-3); padding: var(--space-7) var(--space-4); text-align: center; color: var(--text-secondary);
        }
        .ratings-modal__empty p { font-size: var(--text-sm); }

        .profile__modal-list { display: flex; flex-direction: column; gap: var(--space-2); }
      `}</style>
    </div>
  );
}

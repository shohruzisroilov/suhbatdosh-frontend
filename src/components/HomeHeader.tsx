import React from 'react';
import Avatar from './Avatar';
import { useT } from '../i18n';
import { Flame, ChevronDown } from 'lucide-react';
import { User } from '../types';
import useAppStore from '../store/useAppStore';
import { tapHaptic } from '../utils/haptics';

interface HomeHeaderProps {
  user: User | null;
  streak?: number;
  doneToday?: boolean;
}

export default function HomeHeader({
  user,
  streak = 0,
  doneToday = false,
}: HomeHeaderProps) {
  const t = useT();
  const { navigate } = useAppStore();

  const level = user?.level || 1;
  const shown = Math.max(streak, doneToday ? 1 : 0);

  return (
    <>
      <header className="hh">
        <button
          type="button"
          className="hh__avatar-wrapper hh__avatar-btn"
          onClick={() => { tapHaptic('light'); navigate('profile'); }}
          aria-label={t('nav.profile')}
        >
          <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={42} />
        </button>

        <button
          type="button"
          className="hh__info"
          onClick={() => {
            tapHaptic('light');
            navigate('settings', { from: 'home', section: 'level' });
          }}
        >
          <div className="hh__name-row">
            <span className="hh__name">{user?.displayName || t('common.anonymous')}</span>
            <span className="hh__level-pill">
              {t(`level.${level}`)}
              <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.8 }} />
            </span>
          </div>
          <span className="hh__sub">{t(`levelName.${level}`)} • {t('hh.tapToChange')}</span>
        </button>

        <div className="hh__actions">
          {shown > 0 && (
            <div className={`hh__streak ${doneToday ? 'hh__streak--active' : ''}`}>
              <Flame size={15} strokeWidth={2.5} className="hh__flame-icon" />
              <span className="hh__streak-num num">{shown}</span>
              <span className="hh__streak-label">day{shown > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      <style>{`
        .hh {
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          background: var(--chrome-bg-soft);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          flex-shrink: 0; z-index: 10;
        }
        .hh__avatar-wrapper { position: relative; flex-shrink: 0; }
        .hh__avatar-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-full);
          transition: transform 0.15s var(--ease-out);
        }
        .hh__avatar-btn:active { transform: scale(0.92); }
        .hh__info {
          flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 2px;
          text-align: left; cursor: pointer;
        }
        .hh__name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .hh__name {
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          letter-spacing: -0.01em; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hh__level-pill {
          display: inline-flex; align-items: center;
          font-size: 10px; font-weight: var(--weight-heavy);
          color: var(--primary); background: var(--primary-subtle);
          padding: 2px 7px; border-radius: var(--radius-full);
          letter-spacing: 0.02em; flex-shrink: 0;
          border: 1px solid rgba(40, 120, 240, 0.25);
          transition: transform 0.15s ease;
        }
        .hh__info:active .hh__level-pill {
          transform: scale(0.96);
        }
        .hh__sub { font-size: var(--text-xs); color: var(--text-secondary); }
        
        .hh__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        
        .hh__streak {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary);
          transition: all 0.25s var(--ease-out);
        }
        .hh__streak--active {
          background: var(--accent-bg);
          border-color: rgba(255, 200, 87, 0.5);
          color: #B45309;
          box-shadow: 0 1px 8px rgba(255, 200, 87, 0.25);
        }
        .hh__flame-icon {
          color: #F59E0B;
        }
        .hh__streak-num { font-size: 13px; font-weight: var(--weight-heavy); }
        .hh__streak-label { font-size: 10px; font-weight: var(--weight-medium); opacity: 0.85; }
      `}</style>
    </>
  );
}


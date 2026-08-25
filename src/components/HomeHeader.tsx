import React from 'react';
import Avatar from './Avatar';
import { useT } from '../i18n';
import { Flame, ShieldCheck } from 'lucide-react';
import { User } from '../types';

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
  const level = user?.level || 1;
  const shown = Math.max(streak, doneToday ? 1 : 0);

  return (
    <header className="hh">
      <div className="hh__avatar-wrapper">
        <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={42} />
        {user?.isPremium && (
          <span className="hh__pro-dot" title="Premium Subscriber" />
        )}
      </div>

      <div className="hh__info">
        <div className="hh__name-row">
          <span className="hh__name">{user?.displayName || t('common.anonymous')}</span>
          <span className="hh__level-pill">{t(`level.${level}`)}</span>
        </div>
        <span className="hh__sub">{t(`levelName.${level}`)}</span>
      </div>

      <div className="hh__actions">
        {shown > 0 && (
          <div className={`hh__streak ${doneToday ? 'hh__streak--active' : ''}`}>
            <Flame size={15} strokeWidth={2.5} className="hh__flame-icon" />
            <span className="hh__streak-num num">{shown}</span>
            <span className="hh__streak-label">day{shown > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      <style>{`
        .hh {
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          background: rgba(9, 13, 20, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          flex-shrink: 0; z-index: 10;
        }
        .hh__avatar-wrapper { position: relative; flex-shrink: 0; }
        .hh__pro-dot {
          position: absolute; bottom: 0; right: 0; width: 13px; height: 13px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFD700, #FF9500);
          border: 2px solid var(--bg);
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.7);
        }
        .hh__info { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 2px; }
        .hh__name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .hh__name {
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          letter-spacing: -0.01em; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hh__level-pill {
          font-size: 10px; font-weight: var(--weight-heavy);
          color: var(--btn-bg); background: var(--btn-bg-soft);
          padding: 2px 7px; border-radius: var(--radius-full);
          letter-spacing: 0.02em; flex-shrink: 0;
          border: 1px solid rgba(0, 168, 255, 0.2);
        }
        .hh__sub { font-size: var(--text-xs); color: var(--text-tertiary); }
        
        .hh__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        
        .hh__streak {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary);
          transition: all 0.25s var(--ease-out);
        }
        .hh__streak--active {
          background: rgba(255, 159, 10, 0.14);
          border-color: rgba(255, 159, 10, 0.4);
          color: #FF9F0A;
          box-shadow: 0 0 16px rgba(255, 159, 10, 0.2);
        }
        .hh__flame-icon {
          color: #FF9F0A;
          filter: drop-shadow(0 0 5px rgba(255, 159, 10, 0.7));
        }
        .hh__streak-num { font-size: 13px; font-weight: var(--weight-heavy); }
        .hh__streak-label { font-size: 10px; font-weight: var(--weight-medium); opacity: 0.8; }
      `}</style>
    </header>
  );
}


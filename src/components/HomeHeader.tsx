import React from 'react';
import Avatar from './Avatar';
import { useT } from '../i18n';
import { Flame } from 'lucide-react';
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
      <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={40} />

      <div className="hh__info">
        <span className="hh__name">{user?.displayName || t('common.anonymous')}</span>
        <span className="hh__sub">
          {t(`level.${level}`)} · {t(`levelName.${level}`)}
        </span>
      </div>

      {shown > 0 && (
        <span className={`pill${doneToday ? ' pill--accent' : ''} hh__streak`}>
          <Flame size={13} strokeWidth={2.5} />
          <span className="num">{shown}</span>
        </span>
      )}

      <style>{`
        .hh {
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-3) var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .hh__info { flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 1px; }
        .hh__name {
          font-size: var(--text-base); font-weight: var(--weight-bold);
          letter-spacing: -0.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hh__sub { font-size: var(--text-xs); color: var(--text-secondary); }
        .hh__streak { flex-shrink: 0; }
      `}</style>
    </header>
  );
}

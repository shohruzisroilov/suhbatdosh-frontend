import React from 'react';
import Avatar from './Avatar';
import { useT } from '../i18n';

function duration(startedAt?: string, endedAt?: string) {
  if (!startedAt || !endedAt) return null;
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  const totalSecs = Math.floor(ms / 1000);
  if (totalSecs < 0) return '0s';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function timeAgo(dateStr: string | undefined, t: any) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return t('time.justNow');

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('time.minAgo', { n: diffMin });

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('time.hourAgo', { n: diffHour });

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return t('time.yesterday');
  if (diffDay < 7) return t('time.dayAgo', { n: diffDay });

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

interface SessionRowProps {
  session: {
    partner_name?: string;
    partner_avatar_url?: string;
    started_at?: string;
    ended_at?: string;
  };
}

export default function SessionRow({ session: s }: SessionRowProps) {
  const t = useT();
  const dur = duration(s.started_at, s.ended_at);

  return (
    <div className="session-row">
      <Avatar name={s.partner_name} avatarUrl={s.partner_avatar_url} size={40} />
      <div className="session-row__info">
        <span className="session-row__name">{s.partner_name}</span>
        <span className="session-row__sub">
          {t('lang.en')}
          {dur ? ` · ${dur}` : ''}
        </span>
      </div>
      <span className="session-row__date">{timeAgo(s.ended_at, t)}</span>

      <style>{`
        .session-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-4);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          transition: background var(--t), transform var(--t);
          cursor: default;
        }
        .session-row:active { background: var(--surface-2); transform: scale(0.99); }
        .session-row__info {
          flex: 1; display: flex; flex-direction: column; gap: var(--space-0-5);
        }
        .session-row__name { font-weight: var(--weight-bold); font-size: var(--text-base); color: var(--text-primary); }
        .session-row__sub  { font-size: var(--text-xs); color: var(--text-secondary); }
        .session-row__date { font-size: var(--text-xs); color: var(--text-tertiary); white-space: nowrap; }
      `}</style>
    </div>
  );
}

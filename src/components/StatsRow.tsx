import React from 'react';
import { useT } from '../i18n';
import Skeleton from './Skeleton';

interface StatsRowProps {
  stats?: {
    total_sessions?: number;
    total_minutes?: number;
    avg_rating?: string | number;
  };
  loaded?: boolean;
}

export default function StatsRow({ stats, loaded = true }: StatsRowProps) {
  const t = useT();
  const sessions = stats?.total_sessions ?? 0;
  const totalMinutes = Math.round(stats?.total_minutes ?? 0);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const timeDisplay =
    h === 0
      ? t('lb.minutesShort', { n: m })
      : m === 0
      ? t('lb.hoursShort', { n: h })
      : t('lb.hm', { h, m });
  const ratingNum = parseFloat(String(stats?.avg_rating ?? 0));
  const items = [
    { label: t('stat.practice'), value: sessions },
    { label: t('stat.time'), value: timeDisplay },
    { label: t('stat.rating'), value: ratingNum > 0 ? ratingNum.toFixed(1) : '—' },
  ];

  return (
    <div className="stats-row">
      {items.map(({ label, value }) => (
        <div className="stats-row__item" key={label}>
          {loaded ? (
            <span className="stats-row__val">{value}</span>
          ) : (
            <Skeleton width={34} height={22} radius="6px" style={{ margin: 'var(--space-0-5) 0' }} />
          )}
          <span className="stats-row__lbl">{label}</span>
        </div>
      ))}

      <style>{`
        .stats-row {
          display: flex; gap: var(--space-2);
        }
        .stats-row__item {
          flex: 1; display: flex; flex-direction: column; align-items: center; gap: var(--space-1);
          padding: var(--space-3) var(--space-2);
          background: var(--bg-secondary);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }
        .stats-row__val {
          font-size: var(--text-lg); font-weight: var(--weight-bold); letter-spacing: -0.5px;
        }
        .stats-row__lbl {
          font-size: var(--text-xs); color: var(--text-secondary);
          font-weight: var(--weight-semi); text-transform: uppercase; letter-spacing: 0.3px;
        }
      `}</style>
    </div>
  );
}

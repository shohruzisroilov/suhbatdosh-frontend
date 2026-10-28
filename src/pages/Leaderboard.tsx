import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import SkeletonRow from '../components/SkeletonRow';
import { Flame, Star, Trophy, Crown } from 'lucide-react';

const LEVEL_CODE: Record<number, string> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };

function Row({ row, index, me, valueText }: { row: any; index: number; me: any; valueText: React.ReactNode }) {
  const t = useT();
  const isMe = me && row.id === me;
  const name = row.display_name || row.username || t('common.anonymous');
  const rank = index + 1;

  let rankBadge = null;
  if (rank === 1) {
    rankBadge = <Crown size={18} className="text-[#D97706] fill-[#FFC857]" />;
  } else if (rank === 2) {
    rankBadge = <span className="lb-rank-badge lb-rank-badge--2">2</span>;
  } else if (rank === 3) {
    rankBadge = <span className="lb-rank-badge lb-rank-badge--3">3</span>;
  } else {
    rankBadge = <span className="lb-rank-num">#{rank}</span>;
  }

  return (
    <div className={`lb-row lb-row--rank-${rank <= 3 ? rank : 'normal'} ${isMe ? 'me' : ''}`}>
      <div className="lb-rank-col">
        {rankBadge}
      </div>
      <Avatar name={name} avatarUrl={row.avatar_url} size={40} />
      <div className="lb-row__info">
        <div className="lb-row__name-line">
          <span className="lb-row__nametext">{name}</span>
          {isMe && <span className="lb-you">{t('lb.you')}</span>}
        </div>
        {LEVEL_CODE[row.level] && (
          <span className="lb-row__level">{LEVEL_CODE[row.level]}</span>
        )}
      </div>
      <div className="lb-row__value-col">
        <span className="lb-row__value">{valueText}</span>
      </div>
    </div>
  );
}

const SCOPES = [
  { key: 'today',   label: 'lb.scopeToday' },
  { key: 'weekly',  label: 'lb.scopeWeekly' },
  { key: 'monthly', label: 'lb.scopeMonthly' },
];

export default function Leaderboard() {
  const { user, leaderboardCache, setLeaderboardScope } = useAppStore();
  const t = useT();
  const [tab, setTab] = useState<'active' | 'rated'>('active');
  const [scope, setScope] = useState<'today' | 'weekly' | 'monthly'>('today');

  const leaderboard = leaderboardCache[scope] || null;
  const loaded = leaderboard != null;

  useEffect(() => {
    getLeaderboard(scope)
      .then((d) => setLeaderboardScope(scope, d))
      .catch(() => { if (!leaderboardCache[scope]) setLeaderboardScope(scope, { mostActive: [], topRated: [] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const mostActive = leaderboard?.mostActive || [];
  const topRated   = leaderboard?.topRated   || [];
  const activeList = tab === 'active' ? mostActive : topRated;

  function formatValue(row: any) {
    if (tab === 'active') {
      const mins = row.total_minutes || 0;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const timeStr = h === 0 ? `${m}m` : `${h}h ${m}m`;
      return <>{timeStr}</>;
    } else {
      return <>{Number(row.avg_rating || 0).toFixed(1)} ★</>;
    }
  }

  return (
    <div className="lb">
      <div className="lb-head">
        <div className="flex items-center gap-2">
          <Trophy className="text-[#FFD700]" size={24} />
          <h1 className="lb-title">{t('lb.title')}</h1>
        </div>
        <p className="lb-sub">{t('lb.subtitle')}</p>
      </div>

      {/* Scope filter */}
      <div className="lb-scope">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            className={`lb-scope-btn ${scope === s.key ? 'on' : ''}`}
            onClick={() => { if (scope !== s.key) { selectionHaptic(); setScope(s.key as any); } }}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      {/* Category Tabs */}
      <div className="lb-tabs">
        <button
          type="button"
          className={`lb-tab ${tab === 'active' ? 'on' : ''}`}
          onClick={() => { if (tab !== 'active') { selectionHaptic(); setTab('active'); } }}
        >
          <Flame size={15} className="text-[#FF9F0A]" />
          <span>{t('lb.mostActive')}</span>
        </button>
        <button
          type="button"
          className={`lb-tab ${tab === 'rated' ? 'on' : ''}`}
          onClick={() => { if (tab !== 'rated') { selectionHaptic(); setTab('rated'); } }}
        >
          <Star size={15} className="text-[#F59E0B]" />
          <span>{t('lb.topRated')}</span>
        </button>
      </div>

      <div className="lb-scroll">
        {!loaded ? (
          <div className="lb-list">
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} rank avatar={36} />)}
          </div>
        ) : activeList.length > 0 ? (
          <div className="lb-list">
            {activeList.map((row: any, i: number) => (
              <Row
                key={row.id || i}
                row={row}
                index={i}
                me={user?.id}
                valueText={formatValue(row)}
              />
            ))}
          </div>
        ) : (
          <p className="lb-empty">{t(tab === 'active' ? 'lb.emptyActive' : 'lb.emptyRated')}</p>
        )}
        <div className="lb-footer" />
      </div>

      <style>{`
        .lb {
          display: flex; flex-direction: column;
          height: 100%; overflow: hidden; background: var(--bg);
        }
        .lb-head {
          padding: calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-2);
        }
        .lb-title { font-size: 22px; font-weight: var(--weight-heavy); letter-spacing: -0.5px; }
        .lb-sub { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 2px; }

        .lb-scope {
          display: flex; gap: var(--space-1-5);
          margin: 0 var(--space-4) var(--space-2);
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          padding: 3px;
        }
        .lb-scope-btn {
          flex: 1; padding: 7px var(--space-2);
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: var(--text-secondary);
          border-radius: var(--radius-full);
          transition: all 0.18s var(--ease-out);
        }
        .lb-scope-btn.on {
          color: #FFFFFF; background: var(--primary);
          box-shadow: 0 2px 8px rgba(40, 120, 240, 0.25);
        }
        .lb-scope-btn:active:not(.on) { background: var(--surface-3); color: var(--text-primary); }

        .lb-tabs {
          display: flex; gap: var(--space-1);
          margin: 0 var(--space-4) var(--space-3);
          padding: 4px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .lb-tab {
          flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px var(--space-2);
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: var(--text-secondary);
          border: none;
          border-radius: calc(var(--radius-md) - 4px);
          transition: all var(--t);
          cursor: pointer;
        }
        .lb-tab.on {
          background: var(--surface-2);
          color: var(--text-primary);
          box-shadow: var(--shadow-sm);
        }

        .lb-scroll {
          flex: 1; overflow-y: auto;
          padding: 0 var(--space-4) calc(120px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-3);
        }

        .lb-list { display: flex; flex-direction: column; gap: 8px; }

        .lb-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .lb-row:active { transform: scale(0.99); }
        .lb-row.me { border-color: var(--primary) !important; background: var(--primary-subtle) !important; }

        .lb-row--rank-1 {
          border-color: rgba(255, 200, 87, 0.55);
          background: linear-gradient(135deg, rgba(255, 200, 87, 0.12) 0%, var(--bg-secondary) 100%);
          box-shadow: 0 4px 14px rgba(255, 200, 87, 0.12);
        }
        .lb-row--rank-2 {
          border-color: rgba(148, 163, 184, 0.45);
          background: linear-gradient(135deg, rgba(148, 163, 184, 0.10) 0%, var(--bg-secondary) 100%);
        }
        .lb-row--rank-3 {
          border-color: rgba(217, 119, 6, 0.45);
          background: linear-gradient(135deg, rgba(217, 119, 6, 0.10) 0%, var(--bg-secondary) 100%);
        }

        .lb-rank-col {
          min-width: 28px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lb-rank-num {
          font-size: 12px; font-weight: var(--weight-heavy); color: var(--text-tertiary);
        }
        .lb-rank-badge {
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: 50%;
          font-size: 11px; font-weight: var(--weight-heavy);
        }
        .lb-rank-badge--2 {
          background: var(--surface-2);
          color: var(--text-primary);
          border: 1px solid rgba(148, 163, 184, 0.5);
        }
        .lb-rank-badge--3 {
          background: rgba(217, 119, 6, 0.16);
          color: #F59E0B;
          border: 1px solid rgba(217, 119, 6, 0.4);
        }

        .lb-row__info { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .lb-row__name-line {
          display: flex; align-items: center; gap: 6px; min-width: 0;
        }
        .lb-row__nametext {
          font-size: 14px; font-weight: var(--weight-bold); color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
        }
        .lb-you {
          font-size: 9px; font-weight: var(--weight-bold);
          padding: 2px 6px; border-radius: 999px;
          background: var(--primary); color: #FFFFFF;
          flex-shrink: 0;
        }
        .lb-row__level {
          font-size: 10px; font-weight: var(--weight-bold);
          color: var(--primary);
          background: var(--primary-subtle);
          padding: 1px 6px; border-radius: 4px;
          width: fit-content;
        }

        .lb-row__value-col { flex-shrink: 0; text-align: right; }
        .lb-row__value {
          font-size: 13px; font-weight: var(--weight-heavy);
          color: var(--primary); white-space: nowrap;
        }

        .lb-empty {
          font-size: var(--text-sm); color: var(--text-secondary);
          text-align: center; padding: var(--space-5) var(--space-3);
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .lb-footer { padding-bottom: var(--space-2); }
      `}</style>
    </div>
  );
}


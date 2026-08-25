import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic } from '../utils/haptics';
import Avatar from '../components/Avatar';
import SkeletonRow from '../components/SkeletonRow';
import { Flame, Star, Trophy, Crown } from 'lucide-react';

const LEVEL_CODE: Record<number, string> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };

function PodiumCard({ row, rank, me, valueText }: { row: any; rank: number; me: any; valueText: React.ReactNode }) {
  const t = useT();
  if (!row) return null;
  const isMe = me && row.id === me;
  const name = row.display_name || row.username || t('common.anonymous');

  return (
    <div className={`podium-card podium-card--${rank} ${isMe ? 'me' : ''}`}>
      <div className="podium-card__rank">
        {rank === 1 ? <Crown size={18} className="text-[#FFD700]" /> : `#${rank}`}
      </div>
      <Avatar name={name} avatarUrl={row.avatar_url} size={rank === 1 ? 52 : 44} />
      <span className="podium-card__name">{name}</span>
      {LEVEL_CODE[row.level] && <span className="podium-card__level">{LEVEL_CODE[row.level]}</span>}
      <span className="podium-card__value">{valueText}</span>
    </div>
  );
}

function Row({ row, index, me, valueText }: { row: any; index: number; me: any; valueText: React.ReactNode }) {
  const t = useT();
  const isMe = me && row.id === me;
  const name = row.display_name || row.username || t('common.anonymous');
  const rank = index + 1;

  return (
    <div className={`lb-row ${isMe ? 'me' : ''}`}>
      <span className="lb-rank">#{rank}</span>
      <Avatar name={name} avatarUrl={row.avatar_url} size={38} />
      <div className="lb-row__info">
        <span className="lb-row__name">
          <span className="lb-row__nametext">{name}</span>
          {isMe && <span className="lb-you">{t('lb.you')}</span>}
        </span>
        {LEVEL_CODE[row.level] && (
          <span className="lb-row__level">{LEVEL_CODE[row.level]}</span>
        )}
      </div>
      <span className="lb-row__value">{valueText}</span>
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

  const top1 = activeList[0];
  const top2 = activeList[1];
  const top3 = activeList[2];
  const restList = activeList.slice(3);

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
          <>
            {/* Top 3 Podium */}
            <div className="podium-container">
              {top2 && <PodiumCard row={top2} rank={2} me={user?.id} valueText={formatValue(top2)} />}
              {top1 && <PodiumCard row={top1} rank={1} me={user?.id} valueText={formatValue(top1)} />}
              {top3 && <PodiumCard row={top3} rank={3} me={user?.id} valueText={formatValue(top3)} />}
            </div>

            {/* Ranks 4+ */}
            {restList.length > 0 && (
              <div className="lb-list">
                {restList.map((row: any, i: number) => (
                  <Row
                    key={row.id}
                    row={row}
                    index={i + 3}
                    me={user?.id}
                    valueText={formatValue(row)}
                  />
                ))}
              </div>
            )}
          </>
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
        }
        .lb-scope-btn {
          flex: 1; padding: 6px var(--space-2);
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          color: var(--text-secondary);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          transition: all 0.15s;
        }
        .lb-scope-btn.on {
          color: #FFFFFF; background: var(--btn-bg); border-color: var(--btn-bg);
          box-shadow: 0 2px 10px rgba(0, 168, 255, 0.3);
        }
        .lb-scope-btn:active { opacity: 0.8; }

        .lb-tabs {
          display: flex; gap: var(--space-1);
          margin: 0 var(--space-4) var(--space-3);
          padding: 3px;
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
          border-radius: calc(var(--radius-md) - 3px);
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
          padding: 0 var(--space-4) calc(80px + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-3);
        }

        /* Podium styling */
        .podium-container {
          display: flex; align-items: flex-end; justify-content: center; gap: 10px;
          margin-top: 8px; margin-bottom: 8px;
        }
        .podium-card {
          flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 12px 6px; gap: 4px;
          position: relative;
        }
        .podium-card--1 {
          border-color: rgba(255, 215, 0, 0.4);
          background: linear-gradient(180deg, rgba(255, 215, 0, 0.1) 0%, var(--bg-secondary) 100%);
          transform: translateY(-8px);
          box-shadow: 0 8px 24px rgba(255, 215, 0, 0.15);
        }
        .podium-card--2 { border-color: rgba(226, 232, 240, 0.25); }
        .podium-card--3 { border-color: rgba(245, 158, 11, 0.25); }
        .podium-card.me { border-color: var(--btn-bg); }

        .podium-card__rank {
          font-size: 11px; font-weight: var(--weight-heavy); color: var(--text-secondary);
        }
        .podium-card__name {
          font-size: 12px; font-weight: var(--weight-bold); color: var(--text-primary);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;
        }
        .podium-card__level {
          font-size: 9px; font-weight: var(--weight-bold); color: var(--btn-bg); background: var(--btn-bg-soft);
          padding: 1px 5px; border-radius: var(--radius-full);
        }
        .podium-card__value {
          font-size: 11px; font-weight: var(--weight-heavy); color: var(--accent); margin-top: 2px;
        }

        .lb-list { display: flex; flex-direction: column; gap: 8px; }

        .lb-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: 10px 14px;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .lb-row.me { border-color: var(--btn-bg); background: rgba(0, 168, 255, 0.06); }
        .lb-rank {
          min-width: 28px; font-size: 12px; font-weight: var(--weight-heavy);
          color: var(--text-tertiary); text-align: center;
        }
        .lb-row__info { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
        .lb-row__name {
          font-weight: var(--weight-bold); font-size: 13px;
          display: flex; align-items: center; gap: 6px;
          min-width: 0;
        }
        .lb-row__nametext {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          min-width: 0;
        }
        .lb-you {
          font-size: 9px; font-weight: var(--weight-bold);
          padding: 1px 6px; border-radius: 999px;
          background: var(--btn-bg); color: var(--btn-text);
          flex-shrink: 0;
        }
        .lb-row__level { font-size: 10px; font-weight: var(--weight-bold); color: var(--text-secondary); }
        .lb-row__value { font-size: 12px; font-weight: var(--weight-bold); color: var(--text-primary); white-space: nowrap; }

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


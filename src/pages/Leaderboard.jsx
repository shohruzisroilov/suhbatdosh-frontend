import React, { useEffect, useState } from 'react';
import { getLeaderboard } from '../api/endpoints';
import useAppStore from '../store/useAppStore.js';
import { useT } from '../i18n/index.js';
import { selectionHaptic } from '../utils/haptics.js';
import Avatar from '../components/Avatar.jsx';
import SkeletonRow from '../components/SkeletonRow.jsx';
import { Flame, Star } from 'lucide-react';

const LEVEL_CODE = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' };
// O'rin belgisi — raqamning o'zi. Medal emojisi uchtadan keyin tugaydi va
// qolgan hamma bir xil ko'rinadi; raqam esa har doim ishlaydi.
const TOP3 = ['lb-rank--1', 'lb-rank--2', 'lb-rank--3'];

function Rank({ i }) {
  return <span className={`lb-rank ${TOP3[i] || ''}`}>{i + 1}</span>;
}

function Row({ row, index, me, valueText }) {
  const t = useT();
  const isMe = me && row.id === me;
  const name = row.display_name || row.username || t('common.anonymous');
  return (
    <div className={`lb-row ${isMe ? 'me' : ''}`}>
      <Rank i={index} />
      <Avatar name={name} avatarUrl={row.avatar_url} size={36} />
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
  { key: 'all',     label: 'lb.scopeAll' },
  { key: 'weekly',  label: 'lb.scopeWeekly' },
  { key: 'friends', label: 'lb.scopeFriends' },
];

export default function Leaderboard() {
  const { user, leaderboardCache, setLeaderboardScope } = useAppStore();
  const t = useT();
  const [tab, setTab] = useState('active');   // 'active' | 'rated'
  const [scope, setScope] = useState('all');  // 'all' | 'weekly' | 'friends'

  const leaderboard = leaderboardCache[scope] || null;
  // Skeleton faqat shu scope birinchi marta yuklanayotganda ko'rinadi.
  const loaded = leaderboard != null;

  useEffect(() => {
    getLeaderboard(scope)
      .then((d) => setLeaderboardScope(scope, d))
      .catch(() => { if (!leaderboardCache[scope]) setLeaderboardScope(scope, { mostActive: [], topRated: [] }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const mostActive = leaderboard?.mostActive || [];
  const topRated   = leaderboard?.topRated   || [];

  // Soat va daqiqa ko'rinishida: "45m", "2h", "1h 20m"
  function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return t('lb.minutesShort', { n: m });
    if (m === 0) return t('lb.hoursShort', { n: h });
    return t('lb.hm', { h, m });
  }
  function chats(n) {
    return t(n === 1 ? 'lb.chat' : 'lb.chats', { n });
  }
  function ratings(n) {
    return t(n === 1 ? 'lb.rating' : 'lb.ratings', { n });
  }

  return (
    <div className="lb">
      <div className="lb-head">
        <h1 className="lb-title">{t('lb.title')}</h1>
        <p className="lb-sub">{t('lb.subtitle')}</p>
      </div>

      {/* Scope filter */}
      <div className="lb-scope">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            className={`lb-scope-btn ${scope === s.key ? 'on' : ''}`}
            onClick={() => { if (scope !== s.key) { selectionHaptic(); setScope(s.key); } }}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="lb-tabs">
        <button
          className={`lb-tab ${tab === 'active' ? 'on' : ''}`}
          onClick={() => { if (tab !== 'active') { selectionHaptic(); setTab('active'); } }}
        >
          <Flame size={14} /> {t('lb.mostActive')}
        </button>
        <button
          className={`lb-tab ${tab === 'rated' ? 'on' : ''}`}
          onClick={() => { if (tab !== 'rated') { selectionHaptic(); setTab('rated'); } }}
        >
          <Star size={14} /> {t('lb.topRated')}
        </button>
      </div>

      <div className="lb-scroll">
        {!loaded ? (
          <div className="lb-list">
            {[0, 1, 2, 3, 4].map(i => <SkeletonRow key={i} rank avatar={36} />)}
          </div>
        ) : tab === 'active' ? (
          mostActive.length ? (
            <div className="lb-list">
              {mostActive.map((row, i) => (
                <Row
                  key={row.id}
                  row={row}
                  index={i}
                  me={user?.id}
                  valueText={
                    <>
                      <strong>{formatTime(row.total_minutes)}</strong>
                      {' · '}{chats(row.session_count)}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="lb-empty">{t('lb.emptyActive')}</p>
          )
        ) : (
          topRated.length ? (
            <div className="lb-list">
              {topRated.map((row, i) => (
                <Row
                  key={row.id}
                  row={row}
                  index={i}
                  me={user?.id}
                  valueText={
                    <>
                      <strong className="num">{Number(row.avg_rating).toFixed(1)}</strong>
                      {' · '}{ratings(row.rating_count)}
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <p className="lb-empty">{t('lb.emptyRated')}</p>
          )
        )}
        <div className="lb-footer" />
      </div>

      <style>{`
        .lb {
          display: flex; flex-direction: column;
          height: 100%; overflow: hidden; background: var(--bg);
        }
        .lb-head {
          padding: calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
        }
        .lb-title { font-size: var(--text-lg); font-weight: var(--weight-heavy); letter-spacing: -0.5px; }
        .lb-sub { font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-0-5); }

        /* Scope filter */
        .lb-scope {
          display: flex; gap: var(--space-1-5);
          margin: 0 var(--space-4) var(--space-3);
        }
        .lb-scope-btn {
          flex: 1; padding: var(--space-1-5) var(--space-2);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          color: var(--text-secondary);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-full, 999px);
          transition: all 0.15s;
        }
        .lb-scope-btn.on {
          color: var(--btn-text); background: var(--btn-bg); border-color: var(--btn-bg);
        }
        .lb-scope-btn:active { opacity: 0.7; }

        /* Segmented tabs */
        .lb-tabs {
          display: flex; gap: var(--space-1);
          margin: 0 var(--space-4) var(--space-3);
          padding: var(--space-1);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .lb-tab {
          flex: 1; padding: var(--space-2) var(--space-2);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          color: var(--text-secondary);
          border-radius: calc(var(--radius-md) - 4px);
          transition: all var(--t);
        }
        .lb-tab.on {
          background: var(--bg);
          color: var(--text-primary);
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .lb-tab:active { opacity: 0.7; }

        .lb-scroll {
          flex: 1; overflow-y: auto;
          padding: 0 var(--space-4) var(--space-2);
          display: flex; flex-direction: column; gap: var(--space-1-5);
        }
        .lb-loading { text-align: center; color: var(--text-secondary); padding: var(--space-7) 0; font-size: var(--text-base); }

        .lb-list { display: flex; flex-direction: column; gap: var(--space-1-5); }

        .lb-row {
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) var(--space-3);
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
        }
        .lb-row.me { border-color: var(--btn-bg); }
        .lb-rank {
          min-width: 24px; text-align: center;
          font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--text-secondary);
        }
        .lb-row__info { flex: 1; display: flex; flex-direction: column; gap: var(--space-0-5); min-width: 0; }
        .lb-row__name {
          font-weight: var(--weight-bold); font-size: var(--text-base);
          display: flex; align-items: center; gap: var(--space-1-5);
          min-width: 0;
        }
        .lb-row__nametext {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          min-width: 0;
        }
        .lb-you {
          font-size: var(--text-xs); font-weight: var(--weight-bold); letter-spacing: 0.3px;
          padding: var(--space-0-5) var(--space-1-5); border-radius: 999px;
          background: var(--btn-bg); color: var(--btn-text);
          flex-shrink: 0;
        }
        .lb-row__level { font-size: var(--text-xs); font-weight: var(--weight-bold); color: var(--text-secondary); }
        .lb-row__value { font-size: var(--text-sm); color: var(--text-secondary); white-space: nowrap; }
        .lb-row__value strong { color: var(--text-primary); font-weight: var(--weight-bold); }

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

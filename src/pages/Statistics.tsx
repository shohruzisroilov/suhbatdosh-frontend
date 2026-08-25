import { useEffect, useState, useRef } from 'react';
import { getActivity } from '../api/endpoints';
import useAppStore from '../store/useAppStore';
import { useT, useLang } from '../i18n';
import StatsRow from '../components/StatsRow';
import { ArrowLeft } from 'lucide-react';

const RANGES = ['week', 'month', 'all'];

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}

function useTimeFmt() {
  const t = useT();
  return (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h === 0) return t('lb.minutesShort', { n: m });
    if (m === 0) return t('lb.hoursShort', { n: h });
    return t('lb.hm', { h, m });
  };
}

export default function Statistics() {
  const t = useT();
  const lang = useLang();
  const fmtTime = useTimeFmt();
  const { stats, homeLoaded, navigate, screenParams } = useAppStore();

  const [range, setRange] = useState('week');
  const [cache, setCache] = useState<Record<string, any[]>>({});
  const [granByRange, setGranByRange] = useState<Record<string, string>>({});

  const back = () => navigate(screenParams?.from || 'profile');

  useEffect(() => {
    if (cache[range]) return;
    let alive = true;
    getActivity(range)
      .then((d) => {
        if (!alive) return;
        setCache((c) => ({ ...c, [range]: d.buckets || [] }));
        setGranByRange((g) => ({ ...g, [range]: d.granularity || 'day' }));
      })
      .catch(() => {
        if (!alive) return;
        setCache((c) => ({ ...c, [range]: [] }));
        setGranByRange((g) => ({ ...g, [range]: 'day' }));
      });
    return () => { alive = false; };
  }, [range, cache]);

  const backRef = useRef(back);
  backRef.current = back;

  useEffect(() => {
    const backBtn = window.Telegram?.WebApp?.BackButton;
    let handleBack: (() => void) | undefined;
    if (backBtn) {
      handleBack = () => backRef.current?.();
      backBtn.onClick(handleBack);
      backBtn.show();
    }
    return () => {
      if (backBtn) {
        if (handleBack) backBtn.offClick(handleBack);
        backBtn.hide();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buckets = cache[range] || null;
  const granularity = granByRange[range] || 'day';
  const list = buckets || [];
  const dense = list.length > 10;

  const totalMinutes = list.reduce((s, b) => s + b.minutes, 0);
  const totalSessions = list.reduce((s, b) => s + b.sessions, 0);
  const isEmpty = buckets !== null && totalMinutes === 0 && totalSessions === 0;

  const valOf = (b: any) => b.minutes;
  const maxVal = Math.max(1, ...list.map(valOf));
  const lastKey = list.length ? list[list.length - 1].key : null;

  const labelStep = dense ? Math.ceil(list.length / 6) : 1;
  const xLabel = (b: any, i: number) => {
    if (dense && i % labelStep !== 0 && i !== list.length - 1) return '';
    const date = parseKey(b.key);
    if (granularity === 'month') return date.toLocaleDateString([lang], { month: 'short' });
    if (range === 'month') return String(date.getDate());
    return date.toLocaleDateString([lang], { weekday: 'short' });
  };

  return (
    <div className="stx-page">
      <div className="stx-topbar">
        <button className="stx-back" onClick={back} aria-label={t('common.goBack')}><ArrowLeft size={20} /></button>
        <h1 className="stx-topbar-title">{t('profile.stats')}</h1>
        <div style={{ width: 36 }} />
      </div>

      <div className="stx-scroll">
        <StatsRow stats={stats} loaded={homeLoaded} />

        <div className="stx-card">
          <div className="stx-card-head">
            <div>
              <h2 className="stx-card-title">{t('stats.activityTitle')}</h2>
              <p className="stx-card-sub">{t('stats.activitySub')}</p>
            </div>
          </div>

          <div className="stx-seg">
            {RANGES.map((r) => (
              <button
                key={r}
                className={`stx-seg-btn${range === r ? ' stx-seg-btn--on' : ''}`}
                onClick={() => setRange(r)}
              >
                {t(`stats.range.${r}`)}
              </button>
            ))}
          </div>

          {buckets !== null && !isEmpty && (
            <div className="stx-summary">
              <span className="stx-summary-val">{fmtTime(totalMinutes)}</span>
              <span className="stx-summary-sep">·</span>
              <span className="stx-summary-val">{t('stats.totalPractices', { n: totalSessions })}</span>
            </div>
          )}

          {buckets === null ? (
            <div className="stx-chart stx-chart--skel">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div className="stx-bar-col" key={i}>
                  <div className="stx-bar-track"><div className="stx-bar stx-bar--skel" /></div>
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <p className="stx-empty">{t('stats.noActivity')}</p>
          ) : (
            <div className={`stx-chart${dense ? ' stx-chart--dense' : ''}`}>
              {list.map((b: any, i: number) => {
                const v = valOf(b);
                const pct = Math.round((v / maxVal) * 100);
                const isLast = b.key === lastKey;
                return (
                  <div className="stx-bar-col" key={b.key}>
                    <div className="stx-bar-track">
                      <div
                        className={`stx-bar${isLast ? ' stx-bar--today' : ''}`}
                        style={{ height: `${Math.max(pct, v > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className={`stx-bar-day${isLast ? ' stx-bar-day--today' : ''}`}>{xLabel(b, i)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .stx-page { display: flex; flex-direction: column; height: 100%; background: var(--bg); }
        .stx-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .stx-back {
          width: 36px; height: 36px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--bg-secondary); color: var(--text-primary);
          transition: opacity var(--t);
        }
        .stx-back:active { opacity: 0.6; }
        .stx-topbar-title { font-size: var(--text-md); font-weight: var(--weight-bold); }

        .stx-scroll {
          flex: 1; overflow-y: auto;
          padding: var(--space-4) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom, 0px));
          display: flex; flex-direction: column; gap: var(--space-4);
          -webkit-overflow-scrolling: touch;
        }

        .stx-card {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          display: flex; flex-direction: column; gap: var(--space-4);
        }
        .stx-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
        .stx-card-title { font-size: var(--text-md); font-weight: var(--weight-heavy); letter-spacing: -0.3px; }
        .stx-card-sub { font-size: var(--text-sm); color: var(--text-secondary); margin-top: var(--space-0-5); }

        .stx-seg {
          display: flex; gap: var(--space-1); padding: var(--space-1);
          background: var(--bg); border: 1px solid var(--border);
          border-radius: 999px;
        }
        .stx-seg-btn {
          flex: 1; padding: var(--space-1-5) 0; border-radius: 999px;
          font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--text-secondary);
          transition: background var(--t), color var(--t);
        }
        .stx-seg-btn--on { background: var(--btn-bg); color: var(--btn-text, #fff); }

        .stx-summary {
          display: flex; align-items: center; justify-content: center; gap: var(--space-3);
          font-size: var(--text-base); font-weight: var(--weight-heavy); color: var(--text-primary);
        }
        .stx-summary-sep { color: var(--text-secondary); font-weight: var(--weight-semi); }

        .stx-chart {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--space-1-5); height: 150px;
        }
        .stx-chart--dense { gap: var(--space-0-5); }
        .stx-bar-col {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          gap: var(--space-1-5); height: 100%; min-width: 0;
        }
        .stx-bar-track {
          flex: 1; width: 100%;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .stx-bar {
          width: 70%; max-width: 22px; min-height: 0;
          background: var(--border);
          border-radius: 6px 6px 3px 3px;
          transition: height 0.4s ease;
        }
        .stx-chart--dense .stx-bar { width: 80%; max-width: none; border-radius: 3px 3px 1px 1px; }
        .stx-bar--today { background: var(--btn-bg); }
        .stx-bar--skel { height: 40%; opacity: 0.5; }
        .stx-chart--skel { opacity: 0.6; }
        .stx-bar-day {
          font-size: var(--text-xs); color: var(--text-secondary); font-weight: var(--weight-semi);
          text-transform: capitalize; white-space: nowrap;
        }
        .stx-chart--dense .stx-bar-day { font-size: var(--text-xs); }
        .stx-bar-day--today { color: var(--text-primary); font-weight: var(--weight-heavy); }

        .stx-empty {
          text-align: center; color: var(--text-secondary);
          font-size: var(--text-sm); padding: var(--space-7) 0;
        }
      `}</style>
    </div>
  );
}

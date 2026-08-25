import React from 'react';
import { useT } from '../i18n/index';
import { ChevronRight } from 'lucide-react';

interface DailyProgressProps {
  dailyMinutes?: number;
  dailyLimit?: number;
  onUpgrade?: () => void;
}

export default function DailyProgress({
  dailyMinutes = 0,
  dailyLimit = 0,
  onUpgrade,
}: DailyProgressProps) {
  const t = useT();

  if (!dailyLimit) return null;

  const used = Math.min(dailyMinutes, dailyLimit);
  const left = Math.max(dailyLimit - dailyMinutes, 0);
  const pct = (used / dailyLimit) * 100;
  const maxed = left === 0;
  const ticks = dailyLimit <= 20 ? dailyLimit : 0;

  return (
    <div className={`dp${maxed ? ' dp--maxed' : ''}`}>
      <div className="dp__head">
        <span className="dp__label">{t('daily.label')}</span>
        <span className="dp__val num">
          {maxed ? t('daily.limitReached') : t('daily.left', { n: left })}
        </span>
      </div>

      <div
        className="dp__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={dailyLimit}
        aria-valuenow={used}
        aria-label={t('daily.label')}
      >
        <div className="dp__fill" style={{ width: `${pct}%` }} />
        {ticks > 0 && (
          <div className="dp__ticks" aria-hidden="true">
            {Array.from({ length: ticks - 1 }, (_, i) => (
              <span key={i} className="dp__tick" style={{ left: `${((i + 1) / ticks) * 100}%` }} />
            ))}
          </div>
        )}
      </div>

      {maxed && (
        <button className="dp__cta" onClick={onUpgrade}>
          {t('daily.getPremium')}
          <ChevronRight size={15} />
        </button>
      )}

      <style>{`
        .dp {
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: var(--space-3) var(--space-4);
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .dp--maxed { border-color: var(--border-strong); }

        .dp__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-3); }
        .dp__label {
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        .dp__val { font-size: var(--text-sm); font-weight: var(--weight-bold); }
        .dp--maxed .dp__val { color: var(--accent); }

        .dp__track {
          position: relative; height: 8px;
          background: var(--surface-2);
          border-radius: var(--radius-full); overflow: hidden;
        }
        .dp__fill {
          position: absolute; inset: 0 auto 0 0; height: 100%;
          border-radius: var(--radius-full);
          background: var(--grad-primary);
          transition: width 0.5s var(--ease-out);
        }
        .dp--maxed .dp__fill { background: var(--accent); }

        .dp__ticks { position: absolute; inset: 0; }
        .dp__tick {
          position: absolute; top: 0; bottom: 0; width: 2px;
          background: var(--bg-secondary);
          transform: translateX(-1px);
        }

        .dp__cta {
          display: flex; align-items: center; justify-content: center; gap: var(--space-1);
          min-height: 40px; margin-top: var(--space-1);
          border-radius: var(--radius-sm);
          background: var(--accent-bg); color: var(--accent);
          font-size: var(--text-sm); font-weight: var(--weight-bold);
          transition: opacity var(--t);
        }
        .dp__cta:active { opacity: 0.7; }
      `}</style>
    </div>
  );
}

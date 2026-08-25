import React from 'react';

const MIN = 0;
const MAX = 9;
const TICKS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface BandScaleProps {
  value?: number | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showEnds?: boolean;
}

export default function BandScale({ value, label, size = 'md', showEnds = true }: BandScaleProps) {
  const n = Number.parseFloat(String(value ?? 0));
  const valid = Number.isFinite(n);
  const clamped = valid ? Math.min(Math.max(n, MIN), MAX) : 0;
  const pct = ((clamped - MIN) / (MAX - MIN)) * 100;

  return (
    <div className={`bs bs--${size}`}>
      {label && (
        <div className="bs__head">
          <span className="bs__label">{label}</span>
          <span className="bs__value num">{valid ? clamped.toFixed(1) : '—'}</span>
        </div>
      )}

      <div
        className="bs__track"
        role="meter"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={valid ? clamped : undefined}
        aria-label={label ? `${label} band` : 'Band'}
      >
        <div className="bs__fill" style={{ width: `${pct}%` }} />
        <div className="bs__ticks" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t} className={`bs__tick${t <= clamped ? ' bs__tick--past' : ''}`} />
          ))}
        </div>
        {valid && <div className="bs__marker" style={{ left: `${pct}%` }} />}
      </div>

      {showEnds && (
        <div className="bs__ends" aria-hidden="true">
          <span className="num">0</span>
          <span className="num">9</span>
        </div>
      )}

      <Styles />
    </div>
  );
}

const Styles = React.memo(function Styles() {
  return (
    <style>{`
      .bs { display: flex; flex-direction: column; gap: var(--space-2); width: 100%; }

      .bs__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
      .bs__label {
        font-size: var(--text-sm); font-weight: var(--weight-semi);
        color: var(--text-secondary);
      }
      .bs__value {
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-heavy);
        color: var(--text-primary); letter-spacing: -0.02em;
      }

      .bs__track {
        position: relative;
        height: 8px; border-radius: var(--radius-full);
        background: var(--surface-2);
        overflow: visible;
      }
      .bs--sm .bs__track { height: 6px; }
      .bs--lg .bs__track { height: 12px; }

      .bs__fill {
        position: absolute; inset: 0 auto 0 0;
        border-radius: var(--radius-full);
        background: var(--grad-primary);
        transition: width 0.6s var(--ease-out);
      }

      .bs__ticks {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 1px;
      }
      .bs__tick {
        width: 2px; height: 2px; border-radius: 50%;
        background: var(--border-strong);
      }
      .bs__tick--past { background: rgba(4, 34, 42, 0.45); }

      .bs__marker {
        position: absolute; top: 50%;
        width: 14px; height: 14px; border-radius: 50%;
        background: var(--text-primary);
        border: 3px solid var(--bg-secondary);
        transform: translate(-50%, -50%);
        transition: left 0.6s var(--ease-out);
        box-shadow: var(--shadow-sm);
      }
      .bs--sm .bs__marker { width: 11px; height: 11px; border-width: 2px; }
      .bs--lg .bs__marker { width: 18px; height: 18px; }

      .bs__ends {
        display: flex; justify-content: space-between;
        font-size: var(--text-xs); color: var(--text-secondary);
        letter-spacing: 0.04em;
      }
    `}</style>
  );
});

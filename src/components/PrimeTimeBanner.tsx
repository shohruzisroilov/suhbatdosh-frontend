import React, { useState, useEffect } from 'react';
import { Flame, Zap, Clock, ChevronRight } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { tapHaptic } from '../utils/haptics';

const DEFAULT_PRIME_HOUR = 20;
const PRIME_LENGTH_H = 2;
const NEAR_MS = 60 * 60 * 1000;

function tashkentNow() {
  const now = new Date();
  return new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 5 * 3600000);
}

function fmtGap(ms: number) {
  const total = Math.max(Math.floor(ms / 1000), 0);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export default function PrimeTimeBanner() {
  const { navigate, waitingCount, user } = useAppStore();
  const t = useT();
  const [now, setNow] = useState(() => tashkentNow());

  const primeStart = Number.isInteger(user?.primeTimeHour)
    ? (user!.primeTimeHour as number)
    : DEFAULT_PRIME_HOUR;
  const primeEnd = primeStart + PRIME_LENGTH_H;

  const hour = now.getHours();
  const isLive = hour >= primeStart && hour < primeEnd;

  const target = new Date(now);
  if (isLive) {
    target.setHours(primeEnd, 0, 0, 0);
  } else {
    if (hour >= primeEnd) target.setDate(target.getDate() + 1);
    target.setHours(primeStart, 0, 0, 0);
  }
  const gapMs = target.getTime() - now.getTime();

  useEffect(() => {
    const tick = () => setNow(tashkentNow());
    const period = gapMs <= NEAR_MS ? 1000 : 60_000;
    const id = setInterval(tick, period);
    return () => clearInterval(id);
  }, [gapMs <= NEAR_MS]);

  return (
    <div
      className={`pt-banner ${isLive ? 'pt-banner--live' : ''}`}
      onClick={() => {
        tapHaptic('medium');
        navigate('matching');
      }}
    >
      <div className="pt-banner__header">
        <span className="pt-banner__badge">
          {isLive ? (
            <>
              <span className="pt-banner__live-dot" />
              <span>{t('pt.liveBadge')}</span>
            </>
          ) : (
            <>
              <Clock size={12} />
              <span>{t('pt.soonBadge', { time: `${String(primeStart).padStart(2, '0')}:00` })}</span>
            </>
          )}
        </span>
        <span className="pt-banner__timer">
          {isLive ? t('pt.endsIn', { time: fmtGap(gapMs) }) : t('pt.startsIn', { time: fmtGap(gapMs) })}
        </span>
      </div>

      <div className="pt-banner__body">
        <div className="pt-banner__icon">
          {isLive ? <Flame size={22} className="pt-icon-flame" /> : <Zap size={20} />}
        </div>
        <div className="pt-banner__content">
          <h3 className="pt-banner__title">
            {isLive
              ? t('pt.liveTitle')
              : t('pt.soonTitle', { time: `${String(primeStart).padStart(2, '0')}:00` })}
          </h3>
          <p className="pt-banner__sub">
            {waitingCount > 0
              ? t('pt.waitingNow', { n: waitingCount })
              : isLive
              ? t('pt.liveSub')
              : t('pt.soonSub', {
                  a: `${String(primeStart).padStart(2, '0')}:00`,
                  b: `${String((primeStart + 1) % 24).padStart(2, '0')}:00`,
                })}
          </p>
        </div>
        <ChevronRight size={20} className="pt-banner__arrow" />
      </div>

      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style>{`
      .pt-banner {
        position: relative;
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg, 16px);
        padding: 14px 16px;
        cursor: pointer;
        overflow: hidden;
        transition: all 0.2s ease;
        box-shadow: var(--shadow-sm);
      }
      .pt-banner:active {
        transform: scale(0.98);
      }
      .pt-banner--live {
        background: linear-gradient(135deg, rgba(225, 29, 72, 0.15), rgba(124, 58, 237, 0.18));
        border-color: rgba(244, 63, 94, 0.35);
        box-shadow: 0 4px 24px rgba(225, 29, 72, 0.15);
      }

      .pt-banner__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
      }
      .pt-banner__badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border-radius: 99px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3px;
        background: var(--surface-2);
        color: var(--text-secondary);
      }
      .pt-banner--live .pt-banner__badge {
        background: rgba(244, 63, 94, 0.2);
        color: var(--danger);
      }
      .pt-banner__live-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #f43f5e;
        box-shadow: 0 0 8px #f43f5e;
        animation: pt-pulse 1.4s infinite;
      }
      @keyframes pt-pulse {
        0% { transform: scale(0.95); opacity: 0.8; }
        50% { transform: scale(1.3); opacity: 1; }
        100% { transform: scale(0.95); opacity: 0.8; }
      }

      .pt-banner__timer {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        font-weight: 700;
        color: var(--btn-bg);
      }
      .pt-banner--live .pt-banner__timer {
        color: var(--danger);
      }

      .pt-banner__body {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pt-banner__icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: var(--btn-bg-soft);
        color: var(--btn-bg);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .pt-banner--live .pt-banner__icon {
        background: linear-gradient(135deg, #f43f5e, #e11d48);
        color: #fff;
        box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4);
      }
      .pt-icon-flame {
        animation: pt-flame-bounce 1s ease-in-out infinite alternate;
      }
      @keyframes pt-flame-bounce {
        from { transform: translateY(0); }
        to { transform: translateY(-3px); }
      }

      .pt-banner__content {
        flex: 1;
        min-width: 0;
      }
      .pt-banner__title {
        font-size: 14px;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        line-height: 1.3;
      }
      .pt-banner__sub {
        font-size: 11px;
        color: var(--text-secondary);
        margin: 2px 0 0 0;
        line-height: 1.35;
      }
      .pt-banner--live .pt-banner__sub {
        color: var(--text-primary);
      }

      .pt-banner__arrow {
        color: var(--text-secondary);
        flex-shrink: 0;
        transition: transform 0.2s;
      }
      .pt-banner:hover .pt-banner__arrow {
        transform: translateX(3px);
        color: var(--text-primary);
      }
    `}</style>
  );
}

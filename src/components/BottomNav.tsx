import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic } from '../utils/haptics';
import { Mic, Trophy, Gift, User } from 'lucide-react';

interface Tab {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    key: 'home',
    label: 'nav.home',
    icon: <Mic size={20} strokeWidth={2.2} />,
  },
  {
    key: 'leaderboard',
    label: 'nav.leaderboard',
    icon: <Trophy size={20} strokeWidth={2.2} />,
  },
  {
    key: 'invite',
    label: 'nav.invite',
    icon: <Gift size={20} strokeWidth={2.2} />,
  },
  {
    key: 'profile',
    label: 'nav.profile',
    icon: <User size={20} strokeWidth={2.2} />,
  },
];

interface BottomNavProps {
  active: string;
}

export default function BottomNav({ active }: BottomNavProps) {
  const { navigate } = useAppStore();
  const t = useT();

  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__inner">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              className={`bottom-nav__item ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (!isActive) {
                  selectionHaptic();
                  navigate(tab.key);
                }
              }}
              aria-label={t(tab.label)}
            >
              <div className="bottom-nav__icon-wrap">
                {tab.icon}
                {isActive && <span className="bottom-nav__active-glow" />}
              </div>
              <span className="bottom-nav__label">{t(tab.label)}</span>
            </button>
          );
        })}
      </div>

      <style>{`
        .bottom-nav {
          position: relative; z-index: 100;
          border-top: 1px solid var(--border);
          background: rgba(18, 24, 36, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          flex-shrink: 0;
        }
        .bottom-nav__inner {
          display: flex; align-items: center; justify-content: space-around;
          height: 60px; max-width: 480px; margin: 0 auto;
        }
        .bottom-nav__item {
          flex: 1; height: 100%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; color: var(--text-secondary);
          position: relative; transition: color 0.18s var(--ease-out), transform 0.15s var(--ease-out);
        }
        .bottom-nav__item:active { transform: scale(0.92); }
        .bottom-nav__item.active { color: var(--btn-bg); }

        .bottom-nav__icon-wrap {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
        }
        .bottom-nav__active-glow {
          position: absolute; inset: -4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 168, 255, 0.28) 0%, transparent 70%);
          pointer-events: none;
        }
        .bottom-nav__label {
          font-size: 10px; font-weight: var(--weight-bold);
          letter-spacing: 0.02em; line-height: 1;
        }
      `}</style>
    </nav>
  );
}


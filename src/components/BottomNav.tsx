import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
import { selectionHaptic } from '../utils/haptics';
import { Mic, Users, Trophy, User } from 'lucide-react';

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
    key: 'listings',
    label: 'nav.listings',
    icon: <Users size={20} strokeWidth={2.2} />,
  },
  {
    key: 'leaderboard',
    label: 'nav.leaderboard',
    icon: <Trophy size={20} strokeWidth={2.2} />,
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
              // Which tab is selected was communicated by colour alone; aria-current
              // is what a screen reader announces as "current page".
              aria-current={isActive ? 'page' : undefined}
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
          background: var(--chrome-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          flex-shrink: 0;
          box-shadow: 0 -2px 10px rgba(24, 35, 56, 0.03);
        }
        .bottom-nav__inner {
          display: flex; align-items: center; justify-content: space-around;
          height: 62px; max-width: 480px; margin: 0 auto;
        }
        .bottom-nav__item {
          flex: 1; height: 100%;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; color: var(--text-secondary);
          position: relative;
          transition: color 0.18s var(--ease-out), transform 0.12s var(--ease-out);
        }
        .bottom-nav__item:active { transform: scale(0.90); }
        .bottom-nav__item.active { color: var(--primary); font-weight: var(--weight-bold); }

        .bottom-nav__icon-wrap {
          position: relative;
          display: flex; align-items: center; justify-content: center;
          width: 46px; height: 30px;
          border-radius: var(--radius-full);
          transition: background 0.2s var(--ease-out);
        }
        .bottom-nav__item.active .bottom-nav__icon-wrap {
          background: var(--primary-subtle);
        }
        .bottom-nav__active-glow {
          position: absolute; inset: 0;
          border-radius: var(--radius-full);
          background: radial-gradient(circle, var(--primary-subtle) 0%, transparent 80%);
          pointer-events: none;
        }
        .bottom-nav__label {
          font-size: 11px; font-weight: var(--weight-semibold, 600);
          letter-spacing: 0.01em; line-height: 1.1;
          transition: color 0.18s var(--ease-out);
        }
      `}</style>
    </nav>
  );
}


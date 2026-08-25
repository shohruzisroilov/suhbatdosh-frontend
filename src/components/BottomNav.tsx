import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n/index';
import { selectionHaptic } from '../utils/haptics';

interface Tab {
  key: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  {
    key: 'home',
    label: 'nav.home',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10v9a1 1 0 001 1h12a1 1 0 001-1v-9" />
      </svg>
    ),
  },
  {
    key: 'leaderboard',
    label: 'nav.leaderboard',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3" />
      </svg>
    ),
  },
  {
    key: 'invite',
    label: 'nav.invite',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19a5 5 0 00-10 0" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 12a4 4 0 100-8 4 4 0 000 8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 8v6M21 11h-6" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'nav.profile',
    icon: (
      <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 20a7 7 0 0114 0" />
      </svg>
    ),
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
            {tab.icon}
            <span className="bottom-nav__label">{t(tab.label)}</span>
          </button>
        );
      })}

      <style>{`
        .bottom-nav {
          display: flex; align-items: stretch;
          border-top: 1px solid var(--border);
          background: var(--bg);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          flex-shrink: 0;
        }
        .bottom-nav__item {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: var(--space-1); padding: var(--space-2) 0;
          color: var(--text-secondary);
          transition: color var(--t), opacity var(--t);
        }
        .bottom-nav__item:active { opacity: 0.6; }
        .bottom-nav__item.active { color: var(--btn-bg); }
        .bottom-nav__label { font-size: var(--text-xs); font-weight: var(--weight-semi); letter-spacing: 0.1px; }
      `}</style>
    </nav>
  );
}

import React from 'react';
import useAppStore from '../store/useAppStore';
import { useT } from '../i18n';
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
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(10, 17, 24, 0.78);
          backdrop-filter: blur(24px) saturate(200%);
          -webkit-backdrop-filter: blur(24px) saturate(200%);
          box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.35);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          flex-shrink: 0;
          position: relative;
          z-index: 50;
        }
        .light .bottom-nav {
          background: rgba(247, 250, 251, 0.85);
          border-top: 1px solid rgba(12, 26, 34, 0.08);
          box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.06);
        }
        .bottom-nav__item {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; padding: 10px 0;
          color: var(--text-secondary);
          transition: color 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
        }
        .bottom-nav__item:active { transform: scale(0.92); opacity: 0.8; }
        .bottom-nav__item.active {
          color: var(--btn-bg);
          font-weight: var(--weight-bold);
        }
        .bottom-nav__item.active svg {
          filter: drop-shadow(0 0 8px rgba(42, 171, 238, 0.6));
        }
        .bottom-nav__label { font-size: 11px; font-weight: var(--weight-semi); letter-spacing: 0.1px; }
      `}</style>
    </nav>
  );
}

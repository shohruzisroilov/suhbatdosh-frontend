import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';
import { useT } from '../i18n';
import { Flame, ChevronDown, Check, X } from 'lucide-react';
import { User } from '../types';
import Modal from './Modal';
import useAppStore from '../store/useAppStore';
import { updateMe } from '../api/endpoints';
import { tapHaptic, selectionHaptic } from '../utils/haptics';

interface HomeHeaderProps {
  user: User | null;
  streak?: number;
  doneToday?: boolean;
}

const LEVELS = [
  { id: 1, code: 'A1', name: 'Beginner' },
  { id: 2, code: 'A2', name: 'Elementary' },
  { id: 3, code: 'B1', name: 'Intermediate' },
  { id: 4, code: 'B2', name: 'Upper-Intermediate' },
  { id: 5, code: 'C1', name: 'Advanced' },
  { id: 6, code: 'C2', name: 'Proficient' },
];

export default function HomeHeader({
  user,
  streak = 0,
  doneToday = false,
}: HomeHeaderProps) {
  const t = useT();
  const { setUser, navigate } = useAppStore();
  const [openLevelModal, setOpenLevelModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  const level = user?.level || 1;
  const shown = Math.max(streak, doneToday ? 1 : 0);

  const handleSelectLevel = async (lvlId: number) => {
    if (lvlId === level || updating) return;
    selectionHaptic();
    setUpdating(true);
    try {
      const res = await updateMe({ level: lvlId });
      if (res?.user) {
        setUser(res.user);
      } else {
        setUser({ ...(user as any), level: lvlId });
      }
    } catch {
      setUser({ ...(user as any), level: lvlId });
    } finally {
      setUpdating(false);
      setOpenLevelModal(false);
    }
  };

  return (
    <>
      <header className="hh">
        <button
          type="button"
          className="hh__avatar-wrapper hh__avatar-btn"
          onClick={() => { tapHaptic('light'); navigate('profile'); }}
          aria-label={t('nav.profile')}
        >
          <Avatar name={user?.displayName || undefined} avatarUrl={user?.avatarUrl || undefined} size={42} />
        </button>

        <button
          type="button"
          className="hh__info"
          onClick={() => { tapHaptic('light'); setOpenLevelModal(true); }}
        >
          <div className="hh__name-row">
            <span className="hh__name">{user?.displayName || t('common.anonymous')}</span>
            <span className="hh__level-pill">
              {t(`level.${level}`)}
              <ChevronDown size={10} style={{ marginLeft: 2, opacity: 0.8 }} />
            </span>
          </div>
          <span className="hh__sub">{t(`levelName.${level}`)} • {t('hh.tapToChange')}</span>
        </button>

        <div className="hh__actions">
          {shown > 0 && (
            <div className={`hh__streak ${doneToday ? 'hh__streak--active' : ''}`}>
              <Flame size={15} strokeWidth={2.5} className="hh__flame-icon" />
              <span className="hh__streak-num num">{shown}</span>
              <span className="hh__streak-label">day{shown > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* Quick Level Change Modal */}
      {openLevelModal && createPortal(
        <Modal
          isOpen
          onClose={() => setOpenLevelModal(false)}
          backdropClassName="home-review-modal-backdrop"
          className="hh-level-modal scale-in"
          labelledBy="hh-level-title"
        >
            <div className="hh-level-header">
              <h3 id="hh-level-title">{t('hh.levelTitle')}</h3>
              <button
                type="button"
                className="hh-level-close"
                onClick={() => setOpenLevelModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <p className="hh-level-desc">{t('hh.levelDesc')}</p>

            <div className="hh-level-list">
              {LEVELS.map((item) => {
                const isSelected = item.id === level;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`hh-level-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectLevel(item.id)}
                    disabled={updating}
                  >
                    <div className="hh-level-item-left">
                      <span className="hh-level-code">{item.code}</span>
                      <span className="hh-level-name">{item.name}</span>
                    </div>
                    {isSelected && <Check size={18} className="hh-level-check" />}
                  </button>
                );
              })}
            </div>
        </Modal>,
        document.body
      )}

      <style>{`
        .hh {
          display: flex; align-items: center; gap: var(--space-3);
          padding: calc(var(--space-3) + env(safe-area-inset-top, 0px)) var(--space-4) var(--space-3);
          border-bottom: 1px solid var(--border);
          background: var(--chrome-bg-soft);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          flex-shrink: 0; z-index: 10;
        }
        .hh__avatar-wrapper { position: relative; flex-shrink: 0; }
        .hh__avatar-btn {
          background: none; border: none; padding: 0; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-full);
          transition: transform 0.15s var(--ease-out);
        }
        .hh__avatar-btn:active { transform: scale(0.92); }
        .hh__pro-dot {
          position: absolute; bottom: 0; right: 0; width: 13px; height: 13px;
          border-radius: 50%;
          background: linear-gradient(135deg, #FFD700, #FF9500);
          border: 2px solid var(--bg);
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.7);
        }
        .hh__info {
          flex: 1; display: flex; flex-direction: column; min-width: 0; gap: 2px;
          text-align: left; cursor: pointer;
        }
        .hh__name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .hh__name {
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          letter-spacing: -0.01em; color: var(--text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .hh__level-pill {
          display: inline-flex; align-items: center;
          font-size: 10px; font-weight: var(--weight-heavy);
          color: var(--primary); background: var(--primary-subtle);
          padding: 2px 7px; border-radius: var(--radius-full);
          letter-spacing: 0.02em; flex-shrink: 0;
          border: 1px solid rgba(40, 120, 240, 0.25);
          transition: transform 0.15s ease;
        }
        .hh__info:active .hh__level-pill {
          transform: scale(0.96);
        }
        .hh__sub { font-size: var(--text-xs); color: var(--text-secondary); }
        
        .hh__actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        
        .hh__streak {
          display: flex; align-items: center; gap: 4px;
          padding: 5px 10px; border-radius: var(--radius-full);
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary);
          transition: all 0.25s var(--ease-out);
        }
        .hh__streak--active {
          background: var(--accent-bg);
          border-color: rgba(255, 200, 87, 0.5);
          color: #B45309;
          box-shadow: 0 1px 8px rgba(255, 200, 87, 0.25);
        }
        .hh__flame-icon {
          color: #F59E0B;
        }
        .hh__streak-num { font-size: 13px; font-weight: var(--weight-heavy); }
        .hh__streak-label { font-size: 10px; font-weight: var(--weight-medium); opacity: 0.85; }

        /* Level Selector Modal */
        .hh-level-modal {
          width: 90%; max-width: 380px;
          background: var(--bg-secondary); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: 20px;
          box-shadow: var(--shadow-md);
        }
        .hh-level-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 6px;
        }
        .hh-level-header h3 {
          font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0;
        }
        .hh-level-close {
          background: var(--surface-2); border: none; color: var(--text-secondary);
          width: 30px; height: 30px; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; cursor: pointer;
        }
        .hh-level-desc {
          font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0; line-height: 1.4;
        }
        .hh-level-list {
          display: flex; flex-direction: column; gap: 8px;
        }
        .hh-level-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px; border-radius: var(--radius-md); background: var(--surface-2);
          border: 1px solid var(--border); color: var(--text-primary);
          cursor: pointer; transition: all 0.2s ease; text-align: left;
        }
        .hh-level-item:active { transform: scale(0.98); }
        .hh-level-item.active {
          background: var(--primary-subtle);
          border-color: var(--primary);
          color: var(--primary);
        }
        .hh-level-item-left { display: flex; align-items: center; gap: 10px; }
        .hh-level-code {
          font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px;
          background: var(--surface-3); color: var(--text-primary);
        }
        .hh-level-item.active .hh-level-code {
          background: var(--primary); color: var(--primary-contrast);
        }
        .hh-level-name { font-size: 14px; font-weight: 600; }
        .hh-level-check { color: var(--primary); }
      `}</style>
    </>
  );
}


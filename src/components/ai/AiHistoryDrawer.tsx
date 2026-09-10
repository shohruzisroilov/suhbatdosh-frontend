import { useEffect } from 'react';
import { MessageSquare, MessageSquarePlus, Trash2, X } from 'lucide-react';
import type { AiConversationSummary } from '../../api/endpoints';
import { tapHaptic } from '../../utils/haptics';
import { useT } from '../../i18n';

/**
 * The list of saved conversations, behind the header's history button.
 *
 * A drawer rather than a persistent column: this is a phone-width mini app, and a
 * sidebar that is always visible would take a third of the reading width away from the
 * thing people are actually here for.
 *
 * The rows are the app's own list rows — icon tile, title, quiet second line — so the
 * history reads like the lists on Home and the sessions list, not like a different
 * product bolted on.
 */
export default function AiHistoryDrawer({
  conversations,
  activeId,
  loading,
  onOpen,
  onNew,
  onDelete,
  onClose,
}: {
  conversations: AiConversationSummary[];
  activeId: string | null;
  loading: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();

  // Escape closes it, the way every other dismissible layer in the app behaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="hist" role="dialog" aria-label={t('ai.chats')}>
      <div className="hist__scrim" onClick={onClose} />

      <aside className="hist__panel">
        <header className="hist__head">
          <div className="hist__head-text">
            <h2 className="hist__title">{t('ai.chats')}</h2>
            <p className="hist__sub">{t('ai.partnerName')}</p>
          </div>
          <button type="button" className="hist__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <button
          type="button"
          className="hist__new"
          onClick={() => {
            tapHaptic('light');
            onNew();
          }}
        >
          <MessageSquarePlus size={18} strokeWidth={2.4} aria-hidden="true" />
          <span>{t('ai.newChat')}</span>
        </button>

        <div className="hist__list">
          {loading && <p className="hist__empty">{t('ai.loading')}</p>}

          {!loading && conversations.length === 0 && (
            <div className="hist__blank">
              <span className="hist__blank-ico">
                <MessageSquare size={22} />
              </span>
              <p className="hist__blank-text">{t('ai.historyEmpty')}</p>
            </div>
          )}

          {conversations.map((c) => (
            <div key={c.id} className={`hist__item${c.id === activeId ? ' hist__item--active' : ''}`}>
              <button
                type="button"
                className="hist__open"
                onClick={() => {
                  tapHaptic('light');
                  onOpen(c.id);
                }}
              >
                <span className={`row__ico${c.id === activeId ? ' row__ico--primary' : ''}`}>
                  <MessageSquare size={17} aria-hidden="true" />
                </span>
                <span className="row__text">
                  <span className="row__title hist__row-title">{c.title || t('ai.newChat')}</span>
                  {c.preview && <span className="row__sub hist__row-sub">{c.preview}</span>}
                </span>
              </button>

              <button
                type="button"
                className="hist__delete"
                onClick={() => onDelete(c.id)}
                aria-label={`Delete ${c.title || t('ai.newChat')}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <style>{`
        .hist { position: fixed; inset: 0; z-index: 110; }
        .hist__scrim {
          position: absolute; inset: 0;
          background: rgba(0, 0, 0, 0.55);
          animation: fadeIn 0.2s ease;
        }

        .hist__panel {
          position: absolute; inset: 0 auto 0 0;
          width: min(86vw, 340px);
          display: flex; flex-direction: column;
          background: var(--bg);
          border-right: 1px solid var(--border);
          padding: calc(var(--space-4) + env(safe-area-inset-top, 0px)) var(--space-4)
                   calc(var(--space-4) + env(safe-area-inset-bottom, 0px));
          animation: histIn 0.26s var(--ease-out);
        }
        @keyframes histIn { from { transform: translateX(-100%); } to { transform: none; } }

        .hist__head {
          display: flex; align-items: center; gap: var(--space-2);
          padding-bottom: var(--space-3);
        }
        .hist__head-text { flex: 1; min-width: 0; }
        .hist__title {
          font-size: 17px; font-weight: var(--weight-heavy);
          color: var(--text-primary); letter-spacing: -0.3px; margin: 0;
        }
        .hist__sub { font-size: 11px; color: var(--text-tertiary); margin: 0; }
        .hist__close {
          width: 38px; height: 38px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface-2); color: var(--text-secondary);
          transition: transform 0.15s var(--ease-out), color var(--t);
        }
        .hist__close:active { transform: scale(0.94); color: var(--text-primary); }

        .hist__new {
          display: flex; align-items: center; justify-content: center; gap: var(--space-2);
          width: 100%; min-height: 48px;
          margin-bottom: var(--space-4);
          border-radius: var(--radius-md);
          background: var(--grad-primary); color: var(--btn-text);
          font-size: var(--text-base); font-weight: var(--weight-bold);
          box-shadow: 0 4px 20px rgba(0, 168, 255, 0.3);
          transition: transform var(--t), opacity var(--t);
        }
        .hist__new:active { transform: scale(0.975); opacity: 0.92; }

        .hist__list {
          flex: 1; overflow-y: auto;
          display: flex; flex-direction: column; gap: var(--space-2);
          overscroll-behavior: contain;
        }
        .hist__empty {
          padding: var(--space-4) var(--space-1);
          color: var(--text-tertiary); font-size: var(--text-sm);
        }
        .hist__blank {
          display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
          padding: var(--space-7) var(--space-4); text-align: center;
        }
        .hist__blank-ico {
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          border-radius: var(--radius-md);
          background: var(--surface-2); color: var(--text-tertiary);
        }
        .hist__blank-text {
          font-size: var(--text-sm); line-height: 1.5; color: var(--text-secondary);
          max-width: 26ch; margin: 0;
        }

        /* The app's list row, with the delete control tucked in beside it. */
        .hist__item {
          display: flex; align-items: center;
          background: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          transition: transform var(--t), border-color var(--t);
        }
        .hist__item:active { transform: scale(0.99); }
        .hist__item--active { border-color: var(--btn-bg); background: var(--surface-2); }
        .hist__open {
          flex: 1; min-width: 0;
          display: flex; align-items: center; gap: var(--space-3);
          padding: var(--space-3) 0 var(--space-3) var(--space-3);
          text-align: left; background: transparent;
        }
        .hist__row-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hist__row-sub   { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hist__delete {
          width: 40px; align-self: stretch; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          color: var(--text-tertiary); background: transparent;
          border-radius: 0 var(--radius-md) var(--radius-md) 0;
          transition: background var(--t), color var(--t);
        }
        .hist__delete:active { background: var(--danger-bg); color: var(--danger); }
      `}</style>
    </div>
  );
}

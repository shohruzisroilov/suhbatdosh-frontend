import React, { useState } from 'react';
import Modal from './Modal';
import { Users2, Copy, Check, Share2, ArrowRight, X, Sparkles, KeyRound } from 'lucide-react';
import { notifyHaptic, tapHaptic } from '../utils/haptics';

interface PrivateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoinRoom: (roomCode: string) => void;
  botUsername?: string;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function PrivateRoomModal({
  isOpen,
  onClose,
  onJoinRoom,
  botUsername = 'suhbatdoshbot',
}: PrivateRoomModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [createdCode] = useState(() => generateCode());
  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const botName = botUsername?.replace(/^@/, '') || 'suhbatdoshbot';
  const shareLink = `https://t.me/${botName}?startapp=room_${createdCode.toLowerCase()}`;
  const shareText = `Salom! Suhbatdosh'da men bilan ingliz tilida gaplashish uchun ushbu havolani bosing 🎙️`;

  const handleCopy = () => {
    tapHaptic('light');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareLink).catch(() => {});
    }
    setCopied(true);
    notifyHaptic('success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareTelegram = () => {
    tapHaptic('medium');
    const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent(shareText)}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(telegramShareUrl);
    } else {
      window.open(telegramShareUrl, '_blank');
    }
  };

  const handleStartHost = () => {
    tapHaptic('medium');
    onJoinRoom(createdCode);
    onClose();
  };

  const handleJoinGuest = () => {
    const code = inputCode.trim().toUpperCase();
    if (code.length < 3) return;
    tapHaptic('medium');
    onJoinRoom(code);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="private-room-sheet">
      <div className="private-room-container">
        <div className="private-room-head">
          <div className="private-room-badge">
            <Users2 size={16} />
            <span>Do'st Bilan Suhbat</span>
          </div>
          <button
            type="button"
            className="private-room-close"
            onClick={() => {
              tapHaptic('light');
              onClose();
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="private-room-tabs">
          <button
            type="button"
            className={`private-room-tab ${tab === 'create' ? 'active' : ''}`}
            onClick={() => {
              tapHaptic('light');
              setTab('create');
            }}
          >
            <Sparkles size={14} />
            <span>Xona Ochish</span>
          </button>
          <button
            type="button"
            className={`private-room-tab ${tab === 'join' ? 'active' : ''}`}
            onClick={() => {
              tapHaptic('light');
              setTab('join');
            }}
          >
            <KeyRound size={14} />
            <span>Xonaga Ulanish</span>
          </button>
        </div>

        {tab === 'create' ? (
          <div className="private-room-create">
            <p className="private-room-desc">
              Do'stingizga quyidagi kod yoki havolani yuboring. U ochishi bilan suhbatingiz to'g'ridan-to'g'ri boshlanadi!
            </p>

            <div className="private-room-code-card">
              <span className="private-room-code-lbl">Xona Kodi</span>
              <div className="private-room-code-val">{createdCode}</div>
            </div>

            <div className="private-room-actions">
              <button
                type="button"
                className="btn-primary flex items-center justify-center gap-2 w-full"
                onClick={handleShareTelegram}
              >
                <Share2 size={16} />
                <span>Telegram orqali yuborish</span>
              </button>

              <button
                type="button"
                className="btn-secondary flex items-center justify-center gap-2 w-full"
                onClick={handleCopy}
              >
                {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                <span>{copied ? 'Havola nusxalandi!' : 'Havoladan nusxa olish'}</span>
              </button>

              <button
                type="button"
                className="btn-quiet flex items-center justify-center gap-1.5 w-full mt-2"
                onClick={handleStartHost}
              >
                <span>Xonaga kirish va do'stni kutish</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="private-room-join">
            <p className="private-room-desc">
              Do'stingiz yuborgan 6 xonali xona kodini kiriting:
            </p>

            <div className="private-room-input-wrap">
              <input
                type="text"
                className="private-room-input"
                placeholder="Masalan: K7P9Q2"
                maxLength={10}
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>

            <button
              type="button"
              className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              disabled={inputCode.trim().length < 3}
              onClick={handleJoinGuest}
            >
              <span>Xonaga ulanish</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      <style>{`
        .private-room-sheet {
          width: 100%; max-width: 380px; margin: 0 auto;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl); padding: 20px;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
        }
        .private-room-container { display: flex; flex-direction: column; gap: 14px; }
        .private-room-head {
          display: flex; align-items: center; justify-content: space-between;
        }
        .private-room-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--primary-subtle); color: var(--primary);
          padding: 6px 12px; border-radius: var(--radius-full);
          font-size: 12px; font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .private-room-close {
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-secondary); width: 32px; height: 32px;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          cursor: pointer;
        }
        .private-room-tabs {
          display: flex; gap: 8px; background: var(--surface-2);
          padding: 4px; border-radius: var(--radius-md); border: 1px solid var(--border);
        }
        .private-room-tab {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 8px; border-radius: var(--radius-sm); font-size: 12px;
          font-weight: var(--weight-bold); color: var(--text-secondary);
          background: transparent; border: none; cursor: pointer;
          transition: all 0.15s ease;
        }
        .private-room-tab.active {
          background: var(--surface); color: var(--primary);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .private-room-desc {
          font-size: 12.5px; color: var(--text-secondary); line-height: 1.45; text-align: center;
        }
        .private-room-code-card {
          background: var(--surface-2); border: 1px solid var(--border-strong);
          border-radius: var(--radius-lg); padding: 16px; text-align: center;
          margin: 10px 0;
        }
        .private-room-code-lbl {
          font-size: 11px; font-weight: var(--weight-bold); text-transform: uppercase;
          letter-spacing: 0.08em; color: var(--text-tertiary); display: block; margin-bottom: 4px;
        }
        .private-room-code-val {
          font-family: var(--font-display); font-size: 32px; font-weight: var(--weight-heavy);
          color: var(--primary); letter-spacing: 0.15em; line-height: 1.1;
        }
        .private-room-actions { display: flex; flex-direction: column; gap: 8px; }
        .private-room-input-wrap { margin-top: 12px; }
        .private-room-input {
          width: 100%; padding: 14px; text-align: center; font-size: 20px;
          font-weight: var(--weight-bold); letter-spacing: 0.1em;
          border-radius: var(--radius-md); border: 1.5px solid var(--border);
          background: var(--surface-2); color: var(--text-primary);
          outline: none; transition: border-color 0.15s ease;
        }
        .private-room-input:focus { border-color: var(--primary); }
      `}</style>
    </Modal>
  );
}

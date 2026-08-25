import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { tapHaptic, notifyHaptic } from '../utils/haptics';

interface Props {
  isOpen: boolean;
  onSubscribed: () => void;
  telegramId?: string | number;
}

export default function ChannelSubscribeModal({ isOpen, onSubscribed, telegramId }: Props) {
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenChannel = () => {
    tapHaptic('medium');
    const channelUrl = 'https://t.me/shohruzblog';
    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(channelUrl);
    } else {
      window.open(channelUrl, '_blank');
    }
  };

  const handleCheckSubscription = async () => {
    tapHaptic('light');
    setChecking(true);
    setErrorMsg(null);

    try {
      if (!telegramId) {
        // Fallback testing
        onSubscribed();
        return;
      }

      const res = await fetch('/api/auth/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId }),
      });
      const data = await res.json();

      if (data.subscribed) {
        notifyHaptic('success');
        onSubscribed();
      } else {
        notifyHaptic('error');
        setErrorMsg("Siz hali kanalga obuna bo'lmadingiz. Iltimos obuna bo'ling!");
      }
    } catch {
      // In case of error, unlock user
      onSubscribed();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="sub-modal-backdrop fade-in">
      <div className="sub-modal scale-in">
        <div className="sub-modal__icon-wrap">
          <Send size={32} className="sub-modal__send-icon" />
          <span className="sub-modal__glow" />
        </div>

        <h2 className="sub-modal__title">Kanalga obuna bo'ling</h2>
        <p className="sub-modal__desc">
          Suhbatdosh ilovasida suhbat qurish va foydalanish uchun rasmiy <b>@shohruzblog</b> kanaliga obuna bo'lishingiz kerak.
        </p>

        {errorMsg && (
          <div className="sub-modal__error">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="sub-modal__actions">
          <button className="sub-modal__btn-primary" onClick={handleOpenChannel}>
            <Send size={18} />
            <span>Kanalga o'tish (@shohruzblog)</span>
          </button>

          <button className="sub-modal__btn-secondary" onClick={handleCheckSubscription} disabled={checking}>
            {checking ? (
              <span>Tekshirilmoqda...</span>
            ) : (
              <>
                <CheckCircle2 size={18} />
                <span>Obunani tekshirish</span>
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        .sub-modal-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(5, 10, 20, 0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }

        .sub-modal {
          width: 100%; max-width: 380px;
          background: linear-gradient(145deg, #101B2B 0%, #0A121E 100%);
          border: 1px solid rgba(0, 168, 255, 0.3);
          border-radius: var(--radius-xl, 24px);
          padding: 28px 20px 24px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 168, 255, 0.2);
        }

        .sub-modal__icon-wrap {
          position: relative;
          width: 64px; height: 64px; border-radius: 50%;
          background: var(--btn-bg-soft, rgba(0, 168, 255, 0.15));
          border: 1px solid rgba(0, 168, 255, 0.4);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }

        .sub-modal__send-icon {
          color: #00A8FF; transform: translateX(-2px) translateY(1px);
        }

        .sub-modal__glow {
          position: absolute; inset: -6px; border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 168, 255, 0.3), transparent 70%);
          pointer-events: none;
        }

        .sub-modal__title {
          font-size: 20px; font-weight: var(--weight-heavy, 800);
          color: #FFFFFF; letter-spacing: -0.02em; margin-bottom: 8px;
        }

        .sub-modal__desc {
          font-size: 13px; color: var(--text-secondary, #94A3B8);
          line-height: 1.5; margin-bottom: 20px;
        }

        .sub-modal__desc b { color: #00A8FF; }

        .sub-modal__error {
          width: 100%; display: flex; align-items: center; gap: 8px;
          padding: 10px 14px; border-radius: var(--radius-md, 12px);
          background: rgba(255, 69, 58, 0.12); border: 1px solid rgba(255, 69, 58, 0.3);
          color: #FF453A; font-size: 12px; font-weight: var(--weight-medium, 500);
          margin-bottom: 16px; text-align: left;
        }

        .sub-modal__actions {
          width: 100%; display: flex; flex-direction: column; gap: 10px;
        }

        .sub-modal__btn-primary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-height: 48px;
          background: var(--grad-primary, linear-gradient(135deg, #00A8FF 0%, #0066FF 100%));
          color: #FFFFFF; border-radius: var(--radius-md, 14px);
          font-size: 14px; font-weight: var(--weight-heavy, 800);
          box-shadow: 0 4px 18px rgba(0, 168, 255, 0.4);
          transition: transform 0.15s ease;
        }

        .sub-modal__btn-primary:active { transform: scale(0.97); }

        .sub-modal__btn-secondary {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; min-height: 46px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text-primary, #FFFFFF);
          border-radius: var(--radius-md, 14px);
          font-size: 13px; font-weight: var(--weight-bold, 700);
          transition: transform 0.15s ease;
        }

        .sub-modal__btn-secondary:active { transform: scale(0.97); }
        .sub-modal__btn-secondary:disabled { opacity: 0.5; }
      `}</style>
    </div>
  );
}

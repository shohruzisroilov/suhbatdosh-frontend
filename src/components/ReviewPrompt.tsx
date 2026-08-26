import React, { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { getMyReview, submitReview } from '../api/endpoints';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Star, X, Check, Loader2 } from 'lucide-react';

const DISMISS_KEY = 'suhbatdosh.reviewPromptDismissed';

function dismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {}
}

interface ReviewPromptProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export default function ReviewPrompt({ forceShow = false, onClose }: ReviewPromptProps) {
  const t = useT();
  const [show, setShow] = useState(forceShow);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (forceShow) {
      setShow(true);
      return;
    }
    if (dismissed()) return;
    getMyReview()
      .then((d) => {
        if (!d?.review) setShow(true);
      })
      .catch(() => {});
  }, [forceShow]);

  if (!show) return null;

  async function send() {
    if (!rating || sending) return;
    tapHaptic('medium');
    setSending(true);
    try {
      await submitReview(rating, comment.trim() || '');
      markDismissed();
      setDone(true);
      if (onClose) setTimeout(onClose, 1400);
    } catch {
      setSending(false);
    }
  }

  function handleClose() {
    tapHaptic('light');
    markDismissed();
    setShow(false);
    onClose?.();
  }

  if (done) {
    return (
      <div className="rp-container rp-done">
        <div className="rp-done-icon">
          <Check size={28} />
        </div>
        <p className="rp-title">{t('rp.thanks')}</p>
        <p className="rp-sub">Thank you for your feedback! Your review helps us improve Suhbatdosh.</p>
        <Styles />
      </div>
    );
  }

  return (
    <div className="rp-container">
      {onClose && (
        <button type="button" className="rp-close-btn" onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>
      )}

      <div className="rp-header">
        <h3 className="rp-title">{t('rp.title')}</h3>
        <p className="rp-sub">{t('rp.sub')}</p>
      </div>

      <div className="rp-stars-row">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`rp-star-btn ${rating >= n ? 'active' : ''}`}
            onClick={() => {
              selectionHaptic();
              setRating(n);
            }}
          >
            <Star size={30} fill={rating >= n ? '#EAB308' : 'none'} strokeWidth={1.8} />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <div className="rp-form-section fade-up">
          <div className="rp-input-wrap">
            <textarea
              className="rp-textarea"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('rp.placeholder')}
              maxLength={500}
              rows={3}
            />
            <span className="rp-char-counter">{comment.length}/500</span>
          </div>

          <button className="rp-submit-btn" onClick={send} disabled={sending}>
            {sending ? <Loader2 size={18} className="animate-spin" /> : t('rp.send')}
          </button>
        </div>
      )}

      {!rating && (
        <button type="button" className="rp-later-btn" onClick={handleClose}>
          {t('rp.later')}
        </button>
      )}

      <Styles />
    </div>
  );
}

const Styles = React.memo(function Styles() {
  return (
    <style>{`
      .rp-container {
        width: 100%;
        background: #0F172A;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 24px;
        padding: 24px 20px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        position: relative;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
        box-sizing: border-box;
      }

      .rp-done {
        padding: 32px 20px;
        text-align: center;
      }

      .rp-done-icon {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: rgba(34, 197, 94, 0.18);
        border: 1px solid rgba(34, 197, 94, 0.35);
        color: #4ADE80;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 4px;
      }

      .rp-close-btn {
        position: absolute;
        top: 14px;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #94A3B8;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .rp-close-btn:active {
        transform: scale(0.9);
        color: #FFFFFF;
        background: rgba(255, 255, 255, 0.15);
      }

      .rp-header {
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .rp-title {
        font-size: 17px;
        font-weight: 700;
        color: #FFFFFF;
        margin: 0;
        letter-spacing: -0.01em;
      }

      .rp-sub {
        font-size: 13px;
        color: #94A3B8;
        margin: 0;
        line-height: 1.4;
      }

      .rp-stars-row {
        display: flex;
        gap: 8px;
        padding: 4px 0;
      }

      .rp-star-btn {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      .rp-star-btn.active {
        color: #EAB308;
        background: rgba(234, 179, 8, 0.12);
        border-color: rgba(234, 179, 8, 0.35);
      }
      .rp-star-btn:active {
        transform: scale(0.85);
      }

      .rp-form-section {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .rp-input-wrap {
        position: relative;
        width: 100%;
      }

      .rp-textarea {
        width: 100%;
        box-sizing: border-box;
        resize: none;
        background: #1E293B;
        border: 1.5px solid #334155;
        border-radius: 14px;
        padding: 12px 14px 28px;
        font-size: 14px;
        color: #FFFFFF;
        font-family: inherit;
        line-height: 1.4;
        transition: border-color 0.15s ease;
      }
      .rp-textarea:focus {
        outline: none;
        border-color: #0ea5e9;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.18);
      }
      .rp-textarea::placeholder {
        color: #64748B;
      }

      .rp-char-counter {
        position: absolute;
        bottom: 8px;
        right: 12px;
        font-size: 11px;
        color: #64748B;
        font-weight: 500;
        pointer-events: none;
      }

      .rp-submit-btn {
        width: 100%;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 700;
        border: none;
        box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.15s ease;
      }
      .rp-submit-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .rp-submit-btn:active:not(:disabled) {
        transform: scale(0.97);
      }

      .rp-later-btn {
        background: none;
        border: none;
        color: #64748B;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.15s ease;
      }
      .rp-later-btn:active {
        color: #94A3B8;
      }
    `}</style>
  );
});

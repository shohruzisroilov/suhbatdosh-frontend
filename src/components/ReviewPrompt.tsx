import React, { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { getMyReview, submitReview } from '../api/endpoints';
import { tapHaptic, selectionHaptic } from '../utils/haptics';
import { Star } from 'lucide-react';

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

export default function ReviewPrompt() {
  const t = useT();
  const [show, setShow] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (dismissed()) return;
    getMyReview()
      .then((d) => {
        if (!d.review) setShow(true);
      })
      .catch(() => {});
  }, []);

  if (!show) return null;

  async function send() {
    if (!rating || sending) return;
    tapHaptic('medium');
    setSending(true);
    try {
      await submitReview(rating, comment.trim() || '');
      markDismissed();
      setDone(true);
    } catch {
      setSending(false);
    }
  }

  function later() {
    tapHaptic('light');
    markDismissed();
    setShow(false);
  }

  if (done) {
    return (
      <div className="rp">
        <p className="rp__thanks">{t('rp.thanks')}</p>
        <Styles />
      </div>
    );
  }

  return (
    <div className="rp">
      <p className="rp__title">{t('rp.title')}</p>
      <p className="rp__sub">{t('rp.sub')}</p>

      <div className="rp__stars" role="radiogroup" aria-label="rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`rp__star${rating >= n ? ' on' : ''}`}
            onClick={() => {
              selectionHaptic();
              setRating(n);
            }}
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star`}
          >
            <Star size={26} fill={rating >= n ? 'currentColor' : 'none'} strokeWidth={1.75} />
          </button>
        ))}
      </div>

      {rating > 0 && (
        <>
          <textarea
            className="rp__input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('rp.placeholder')}
            maxLength={500}
            rows={2}
          />
          <button className="rp__send" onClick={send} disabled={sending}>
            {sending ? t('rp.sending') : t('rp.send')}
          </button>
        </>
      )}

      <button className="rp__later" onClick={later}>
        {t('rp.later')}
      </button>
      <Styles />
    </div>
  );
}

const Styles = React.memo(function Styles() {
  return (
    <style>{`
      .rp {
        width: 100%; display: flex; flex-direction: column; align-items: center;
        gap: var(--space-2); padding: var(--space-4);
        background: var(--bg-secondary); border: 1px solid var(--border);
        border-radius: var(--radius-lg);
      }
      .rp__title {
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
      }
      .rp__sub {
        font-size: var(--text-sm); color: var(--text-secondary);
        text-align: center; line-height: 1.5;
      }
      .rp__thanks {
        font-size: var(--text-sm); color: var(--text-secondary);
        text-align: center; line-height: 1.5;
      }
      .rp__stars { display: flex; gap: var(--space-1); }
      .rp__star {
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center;
        color: var(--border-strong);
        transition: color var(--t), transform var(--t);
      }
      .rp__star.on     { color: var(--rating); }
      .rp__star:active { transform: scale(0.88); }
      .rp__input {
        width: 100%; resize: none;
        background: var(--bg); border: 1px solid var(--border);
        border-radius: var(--radius-md); padding: var(--space-2) var(--space-3);
        font-size: var(--text-sm); color: var(--text-primary); font-family: inherit;
      }
      .rp__input::placeholder { color: var(--text-secondary); }
      .rp__send {
        width: 100%; background: var(--btn-bg); color: var(--btn-text);
        border-radius: var(--radius-md); padding: var(--space-3);
        font-size: var(--text-base); font-weight: var(--weight-bold);
        transition: opacity var(--t);
      }
      .rp__send:disabled { opacity: 0.5; }
      .rp__later {
        font-size: var(--text-xs); color: var(--text-secondary);
        padding: var(--space-1) var(--space-3);
      }
    `}</style>
  );
});

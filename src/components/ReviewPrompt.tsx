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
        gap: var(--space-3); padding: var(--space-5) var(--space-4);
        background: var(--bg-secondary); border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        position: relative; overflow: hidden;
      }
      .rp::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 2px;
        background: linear-gradient(90deg, var(--btn-bg), #0066FF);
        border-radius: 2px 2px 0 0;
      }
      .rp__title {
        font-family: var(--font-display);
        font-size: var(--text-md); font-weight: var(--weight-heavy); letter-spacing: -0.02em;
        color: var(--text-primary);
      }
      .rp__sub {
        font-size: var(--text-sm); color: var(--text-secondary);
        text-align: center; line-height: 1.5; margin-top: -4px;
      }
      .rp__thanks {
        font-size: var(--text-sm); color: var(--success);
        text-align: center; line-height: 1.5; font-weight: var(--weight-semi);
      }
      .rp__stars { display: flex; gap: 4px; }
      .rp__star {
        width: 42px; height: 42px;
        display: flex; align-items: center; justify-content: center;
        color: var(--border-strong);
        transition: color var(--t), transform var(--t-spring);
      }
      .rp__star.on     { color: var(--rating); }
      .rp__star:active { transform: scale(0.82); }
      .rp__input {
        width: 100%; resize: none;
        background: var(--surface-2); border: 1px solid var(--border);
        border-radius: var(--radius-md); padding: var(--space-3) var(--space-3);
        font-size: var(--text-sm); color: var(--text-primary); font-family: inherit;
        transition: border-color var(--t);
      }
      .rp__input:focus { border-color: rgba(0, 168, 255, 0.4); outline: none; }
      .rp__input::placeholder { color: var(--text-tertiary); }
      .rp__send {
        width: 100%; background: var(--btn-bg); color: var(--btn-text);
        border-radius: var(--radius-md); padding: var(--space-3);
        font-size: var(--text-base); font-weight: var(--weight-bold);
        box-shadow: 0 4px 14px rgba(0, 168, 255, 0.25);
        transition: opacity var(--t), transform var(--t);
      }
      .rp__send:disabled { opacity: 0.5; }
      .rp__send:active:not(:disabled) { opacity: 0.88; transform: scale(0.98); }
      .rp__later {
        font-size: var(--text-xs); color: var(--text-tertiary);
        padding: var(--space-1) var(--space-3);
        transition: color var(--t);
      }
      .rp__later:active { color: var(--text-secondary); }
    `}</style>
  );
});

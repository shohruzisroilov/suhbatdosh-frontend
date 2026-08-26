import { useState } from 'react';
import { BookmarkPlus, Check, Loader2, X } from 'lucide-react';
import { saveVocabularyItem } from '../api/endpoints';
import { useT } from '../i18n';
import { notifyHaptic, tapHaptic } from '../utils/haptics';

export interface VocabItem {
  word: string;
  meaning?: string;
  example?: string;
}

/**
 * Offers to save a word the AI partner just used.
 *
 * The partner never corrects grammar mid-conversation — being stopped on every slip is
 * what makes learners go quiet — so this is how the session still leaves something
 * behind. It sits under the transcript rather than interrupting, and disappears once
 * the word is saved or dismissed.
 *
 * The vocabulary endpoints and table already existed but nothing called them; this is
 * what puts them to use.
 */
export default function VocabPrompt({ item, onDone }: { item: VocabItem; onDone: () => void }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function save() {
    if (state !== 'idle') return;
    tapHaptic('light');
    setState('saving');
    try {
      await saveVocabularyItem({
        word: item.word,
        meaning: item.meaning,
        example: item.example,
        category: 'ai-partner',
      });
      notifyHaptic('success');
      setState('saved');
      setTimeout(onDone, 1400);
    } catch {
      notifyHaptic('error');
      setState('idle');
    }
  }

  return (
    <div className="vocab-prompt fade-up">
      <div className="vocab-prompt__body">
        <span className="vocab-prompt__label">{t('vocab.newWord')}</span>
        <p className="vocab-prompt__word">{item.word}</p>
        {item.meaning && <p className="vocab-prompt__meaning">{item.meaning}</p>}
        {item.example && <p className="vocab-prompt__example">“{item.example}”</p>}
      </div>

      <div className="vocab-prompt__actions">
        <button
          type="button"
          className="vocab-prompt__save"
          onClick={save}
          disabled={state !== 'idle'}
        >
          {state === 'saving' ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : state === 'saved' ? (
            <Check size={15} aria-hidden="true" />
          ) : (
            <BookmarkPlus size={15} aria-hidden="true" />
          )}
          <span>{state === 'saved' ? t('vocab.saved') : t('vocab.save')}</span>
        </button>

        <button
          type="button"
          className="vocab-prompt__dismiss"
          onClick={() => { tapHaptic('light'); onDone(); }}
          aria-label={t('vocab.dismiss')}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <style>{`
        .vocab-prompt {
          display: flex; align-items: flex-start; gap: var(--space-3);
          margin: var(--space-2) 0;
          padding: var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
        }
        .vocab-prompt__body { flex: 1; min-width: 0; }
        .vocab-prompt__label {
          display: block;
          font-size: var(--text-2xs); font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--btn-bg);
        }
        .vocab-prompt__word {
          margin-top: 2px;
          font-size: var(--text-base); font-weight: var(--weight-heavy);
          color: var(--text-primary);
        }
        .vocab-prompt__meaning {
          margin-top: 2px;
          font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.4;
        }
        .vocab-prompt__example {
          margin-top: 4px;
          font-size: var(--text-xs); color: var(--text-tertiary);
          font-style: italic; line-height: 1.4;
        }
        .vocab-prompt__actions {
          display: flex; align-items: center; gap: var(--space-1); flex-shrink: 0;
        }
        .vocab-prompt__save {
          display: inline-flex; align-items: center; gap: 6px;
          min-height: 36px; padding: 0 var(--space-3);
          border-radius: var(--radius-full);
          background: var(--btn-bg-soft); color: var(--btn-bg);
          font-size: var(--text-xs); font-weight: var(--weight-bold);
          transition: opacity var(--t);
        }
        .vocab-prompt__save:disabled { opacity: 0.75; }
        .vocab-prompt__dismiss {
          display: flex; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          border-radius: var(--radius-full);
          color: var(--text-tertiary);
        }
        .vocab-prompt__dismiss:active { background: var(--surface-3); }
      `}</style>
    </div>
  );
}

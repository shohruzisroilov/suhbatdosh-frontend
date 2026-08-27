import { useMemo } from 'react';
import { Shuffle, MessagesSquare } from 'lucide-react';
import { PART1 } from '../constants/speakingTopics';
import { useT } from '../i18n';
import { tapHaptic } from '../utils/haptics';

/**
 * Offered once, before the first turn.
 *
 * "Talk about anything" is the hardest possible opening for a learner — they freeze
 * looking for something to say. Picking a subject up front removes that, and the
 * topic bank already existed for the mock exams without the AI partner ever using it.
 *
 * Skipping is a first-class option, not a hidden one: some people know what they want
 * to talk about.
 */
export default function AiTopicPicker({
  onPick,
}: {
  onPick: (topic: string | null) => void;
}) {
  const t = useT();

  // Fresh three each time the picker mounts, so it does not feel like a fixed menu.
  const suggestions = useMemo(() => {
    const pool = PART1.map((topic: any) => topic.title).filter(Boolean);
    const picked: string[] = [];
    while (picked.length < 3 && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return picked;
  }, []);

  return (
    <div className="ai-topics fade-up">
      <span className="ai-topics__label">{t('ai.topicLabel')}</span>

      <div className="ai-topics__list">
        {suggestions.map((topic) => (
          <button
            key={topic}
            type="button"
            className="ai-topics__item"
            onClick={() => { tapHaptic('light'); onPick(topic); }}
          >
            <MessagesSquare size={16} aria-hidden="true" />
            <span>{topic}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="ai-topics__skip"
        onClick={() => { tapHaptic('light'); onPick(null); }}
      >
        <Shuffle size={14} aria-hidden="true" />
        <span>{t('ai.topicSkip')}</span>
      </button>

      <style>{`
        .ai-topics {
          display: flex; flex-direction: column; gap: var(--space-2);
          padding: var(--space-4);
          margin: var(--space-3) 0;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border);
          background: var(--bg-secondary);
        }
        .ai-topics__label {
          font-size: var(--text-2xs); font-weight: var(--weight-bold);
          text-transform: uppercase; letter-spacing: 0.08em;
          color: var(--text-secondary);
        }
        .ai-topics__list { display: flex; flex-direction: column; gap: var(--space-2); }
        .ai-topics__item {
          display: flex; align-items: center; gap: var(--space-2);
          width: 100%; min-height: 46px; padding: 0 var(--space-3);
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--text-primary);
          font-size: var(--text-sm); font-weight: var(--weight-semi);
          text-align: left;
          transition: transform var(--t), border-color var(--t);
        }
        .ai-topics__item:active { transform: scale(0.985); border-color: var(--btn-bg); }
        .ai-topics__skip {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          min-height: 40px; margin-top: var(--space-1);
          color: var(--text-secondary);
          font-size: var(--text-xs); font-weight: var(--weight-semi);
        }
        .ai-topics__skip:active { color: var(--text-primary); }
      `}</style>
    </div>
  );
}
